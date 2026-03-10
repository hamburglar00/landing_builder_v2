-- Función RPC: toda la lógica de selección de teléfono en la DB (1 round-trip desde la Edge Function).
-- Respeta el flujo: landing → gerencias asignadas → filtro horario → elegir gerencia por peso
-- → elegir teléfono activo (random o fair) → si no hay teléfonos, probar otra gerencia.

create or replace function public.get_phone_for_landing(p_landing_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landing_id     uuid;
  v_landing_name   text;
  v_current_hour    int;
  v_gerencia_id    int;
  v_weight         int;
  v_phone_mode     text;
  v_phone_kind     text;
  v_external_id    int;
  v_phone_id       bigint;
  v_phone          text;
  v_total_weight   float;
  v_r              float;
begin
  -- 1) Landing por nombre
  select id, name into v_landing_id, v_landing_name
  from landings
  where name = trim(p_landing_name)
  limit 1;

  if v_landing_id is null then
    return jsonb_build_object('_status', 'not_found');
  end if;

  v_current_hour := extract(hour from now())::int;

  -- 2) Pool de asignaciones filtradas por intervalo horario (temp table para ir quitando gerencias sin teléfonos)
  drop table if exists _get_phone_pool;
  create temp table _get_phone_pool (
    gerencia_id   int,
    weight        int,
    phone_mode    text,
    phone_kind    text,
    external_id   int
  );

  insert into _get_phone_pool (gerencia_id, weight, phone_mode, phone_kind, external_id)
  select lg.gerencia_id, greatest(0, lg.weight), lg.phone_mode, lg.phone_kind, g.gerencia_id
  from landings_gerencias lg
  join gerencias g on g.id = lg.gerencia_id
  where lg.landing_id = v_landing_id
    and (
      (lg.interval_start_hour is null or lg.interval_end_hour is null)
      or (lg.interval_start_hour = lg.interval_end_hour)
      or (lg.interval_start_hour < lg.interval_end_hour
          and v_current_hour >= lg.interval_start_hour
          and v_current_hour < lg.interval_end_hour)
      or (lg.interval_start_hour > lg.interval_end_hour
          and (v_current_hour >= lg.interval_start_hour or v_current_hour < lg.interval_end_hour))
    );

  if (select count(*) from _get_phone_pool) = 0 then
    drop table if exists _get_phone_pool;
    return jsonb_build_object('_status', 'no_assignments');
  end if;

  -- 3) Bucle: elegir gerencia por peso → si tiene teléfonos activos, elegir uno y devolver; si no, quitarla y repetir
  loop
    v_total_weight := (select sum(weight)::float from _get_phone_pool);
    if v_total_weight is null or v_total_weight <= 0 then
      drop table if exists _get_phone_pool;
      return jsonb_build_object('_status', 'no_phones');
    end if;

    v_r := random() * v_total_weight;

    select p.gerencia_id, p.weight, p.phone_mode, p.phone_kind, p.external_id
    into v_gerencia_id, v_weight, v_phone_mode, v_phone_kind, v_external_id
    from (
      select
        gerencia_id,
        weight,
        phone_mode,
        phone_kind,
        external_id,
        sum(weight) over (order by gerencia_id)::float - weight::float as cum_start,
        sum(weight) over (order by gerencia_id)::float as cum_end
      from _get_phone_pool
    ) p
    where v_r >= p.cum_start and v_r < p.cum_end
    limit 1;

    if v_gerencia_id is null then
      drop table if exists _get_phone_pool;
      return jsonb_build_object('_status', 'no_phones');
    end if;

    -- 4) Elegir teléfono activo de esta gerencia: fair (menor usage_count, desempate random) o random
    if v_phone_mode = 'fair' then
      select id, gp.phone into v_phone_id, v_phone
      from gerencia_phones gp
      where gp.gerencia_id = v_gerencia_id
        and gp.status = 'active'
        and gp.kind = v_phone_kind
      order by gp.usage_count asc, random()
      limit 1;
    else
      select id, gp.phone into v_phone_id, v_phone
      from gerencia_phones gp
      where gp.gerencia_id = v_gerencia_id
        and gp.status = 'active'
        and gp.kind = v_phone_kind
      order by random()
      limit 1;
    end if;

    if v_phone_id is not null then
      drop table if exists _get_phone_pool;
      return jsonb_build_object(
        'phoneId', v_phone_id,
        'phone', v_phone,
        'landingId', v_landing_id,
        'landingName', v_landing_name,
        'phoneMode', v_phone_mode,
        'phoneKind', v_phone_kind,
        'gerencia', jsonb_build_object(
          'id', v_gerencia_id,
          'externalId', v_external_id,
          'weight', v_weight
        )
      );
    end if;

    delete from _get_phone_pool where _get_phone_pool.gerencia_id = v_gerencia_id;
  end loop;
end;
$$;

comment on function public.get_phone_for_landing(text) is
  'Devuelve un número de teléfono para la landing (nombre). Usado por la Edge Function landing-phone. _status: not_found | no_assignments | no_phones; si OK devuelve phoneId, phone, landingId, landingName, phoneMode, phoneKind, gerencia.';

grant execute on function public.get_phone_for_landing(text) to service_role;
grant execute on function public.get_phone_for_landing(text) to authenticated;
grant execute on function public.get_phone_for_landing(text) to anon;
