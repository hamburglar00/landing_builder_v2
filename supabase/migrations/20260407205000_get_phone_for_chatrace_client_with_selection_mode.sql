create or replace function public.get_phone_for_chatrace_client(p_client_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id                    uuid;
  v_client_name                text;
  v_current_hour               int;
  v_gerencia_selection_mode    text;
  v_gerencia_fair_criterion    text;
  v_gerencia_id                int;
  v_weight                     int;
  v_phone_mode                 text;
  v_phone_kind                 text;
  v_external_id                int;
  v_owner_user_id              uuid;
  v_fair_criterion             text;
  v_phone_id                   bigint;
  v_phone                      text;
  v_total_weight               float;
  v_r                          float;
begin
  select p.id, p.nombre
  into v_user_id, v_client_name
  from profiles p
  where p.nombre = trim(p_client_name)
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('_status', 'not_found');
  end if;

  select
    coalesce(c.gerencia_selection_mode, 'weighted_random'),
    coalesce(c.gerencia_fair_criterion, 'usage_count')
  into
    v_gerencia_selection_mode,
    v_gerencia_fair_criterion
  from chatrace_client_configs c
  where c.user_id = v_user_id
    and coalesce(c.active, true) = true
  limit 1;

  if v_gerencia_selection_mode is null then
    return jsonb_build_object('_status', 'not_found');
  end if;

  v_current_hour := extract(hour from now())::int;

  drop table if exists _get_phone_pool;
  create temp table _get_phone_pool (
    gerencia_id      int,
    weight           int,
    phone_mode       text,
    phone_kind       text,
    external_id      int,
    owner_user_id    uuid,
    fair_criterion   text
  );

  insert into _get_phone_pool (
    gerencia_id,
    weight,
    phone_mode,
    phone_kind,
    external_id,
    owner_user_id,
    fair_criterion
  )
  select
    cg.gerencia_id,
    greatest(0, cg.weight),
    cg.phone_mode,
    cg.phone_kind,
    g.gerencia_id,
    g.user_id,
    coalesce(g.fair_criterion, 'usage_count')
  from chatrace_gerencias cg
  join gerencias g on g.id = cg.gerencia_id
  where cg.user_id = v_user_id
    and (
      (cg.interval_start_hour is null or cg.interval_end_hour is null)
      or (cg.interval_start_hour = cg.interval_end_hour)
      or (cg.interval_start_hour < cg.interval_end_hour
          and v_current_hour >= cg.interval_start_hour
          and v_current_hour < cg.interval_end_hour)
      or (cg.interval_start_hour > cg.interval_end_hour
          and (v_current_hour >= cg.interval_start_hour or v_current_hour < cg.interval_end_hour))
    );

  if (select count(*) from _get_phone_pool) = 0 then
    drop table if exists _get_phone_pool;
    return jsonb_build_object('_status', 'no_assignments');
  end if;

  loop
    if v_gerencia_selection_mode = 'fair' then
      if v_gerencia_fair_criterion = 'messages_received' then
        select
          p.gerencia_id,
          p.weight,
          p.phone_mode,
          p.phone_kind,
          p.external_id,
          p.owner_user_id,
          p.fair_criterion
        into
          v_gerencia_id,
          v_weight,
          v_phone_mode,
          v_phone_kind,
          v_external_id,
          v_owner_user_id,
          v_fair_criterion
        from _get_phone_pool p
        left join lateral (
          select count(*)::bigint as metric
          from conversions c
          where c.user_id = p.owner_user_id
            and c.lead_event_id <> ''
            and exists (
              select 1
              from gerencia_phones gp
              where gp.gerencia_id = p.gerencia_id
                and gp.status = 'active'
                and gp.kind = p.phone_kind
                and gp.phone = c.telefono_asignado
            )
        ) m on true
        order by coalesce(m.metric, 0) asc, random()
        limit 1;
      else
        select
          p.gerencia_id,
          p.weight,
          p.phone_mode,
          p.phone_kind,
          p.external_id,
          p.owner_user_id,
          p.fair_criterion
        into
          v_gerencia_id,
          v_weight,
          v_phone_mode,
          v_phone_kind,
          v_external_id,
          v_owner_user_id,
          v_fair_criterion
        from _get_phone_pool p
        left join lateral (
          select coalesce(sum(gp.usage_count), 0)::bigint as metric
          from gerencia_phones gp
          where gp.gerencia_id = p.gerencia_id
            and gp.status = 'active'
            and gp.kind = p.phone_kind
        ) m on true
        order by coalesce(m.metric, 0) asc, random()
        limit 1;
      end if;
    else
      v_total_weight := (select sum(weight)::float from _get_phone_pool);
      if v_total_weight is null or v_total_weight <= 0 then
        drop table if exists _get_phone_pool;
        return jsonb_build_object('_status', 'no_phones');
      end if;

      v_r := random() * v_total_weight;

      select
        p.gerencia_id,
        p.weight,
        p.phone_mode,
        p.phone_kind,
        p.external_id,
        p.owner_user_id,
        p.fair_criterion
      into
        v_gerencia_id,
        v_weight,
        v_phone_mode,
        v_phone_kind,
        v_external_id,
        v_owner_user_id,
        v_fair_criterion
      from (
        select
          gerencia_id,
          weight,
          phone_mode,
          phone_kind,
          external_id,
          owner_user_id,
          fair_criterion,
          sum(weight) over (order by gerencia_id)::float - weight::float as cum_start,
          sum(weight) over (order by gerencia_id)::float as cum_end
        from _get_phone_pool
      ) p
      where v_r >= p.cum_start and v_r < p.cum_end
      limit 1;
    end if;

    if v_gerencia_id is null then
      drop table if exists _get_phone_pool;
      return jsonb_build_object('_status', 'no_phones');
    end if;

    if v_phone_mode = 'fair' then
      if v_fair_criterion = 'messages_received' then
        select gp.id, gp.phone
        into v_phone_id, v_phone
        from gerencia_phones gp
        left join lateral (
          select count(*)::bigint as lead_count
          from conversions c
          where c.user_id = v_owner_user_id
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> ''
        ) lc on true
        where gp.gerencia_id = v_gerencia_id
          and gp.status = 'active'
          and gp.kind = v_phone_kind
        order by coalesce(lc.lead_count, 0) asc, random()
        limit 1;
      else
        select gp.id, gp.phone
        into v_phone_id, v_phone
        from gerencia_phones gp
        where gp.gerencia_id = v_gerencia_id
          and gp.status = 'active'
          and gp.kind = v_phone_kind
        order by gp.usage_count asc, random()
        limit 1;
      end if;
    else
      select gp.id, gp.phone
      into v_phone_id, v_phone
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
        'landingId', null,
        'landingName', v_client_name,
        'integrationSource', 'chatrace',
        'gerenciaSelectionMode', v_gerencia_selection_mode,
        'gerenciaFairCriterion', v_gerencia_fair_criterion,
        'phoneMode', v_phone_mode,
        'phoneKind', v_phone_kind,
        'fairCriterion', v_fair_criterion,
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
comment on function public.get_phone_for_chatrace_client(text) is
  'Selecciona telefono para integracion Chatrace por cliente (profiles.nombre), con seleccion de gerencias weighted_random/fair y seleccion de telefono random/fair.';
grant execute on function public.get_phone_for_chatrace_client(text) to service_role;
grant execute on function public.get_phone_for_chatrace_client(text) to authenticated;
grant execute on function public.get_phone_for_chatrace_client(text) to anon;
