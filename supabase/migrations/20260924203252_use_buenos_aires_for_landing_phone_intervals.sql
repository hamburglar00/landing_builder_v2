-- Landing assignment intervals are configured as civil hours in Buenos Aires.

-- Keep that meaning independent from the database/session timezone.

create or replace function public.get_phone_for_landing(
  p_landing_name text,
  p_create_reservation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landing_id               uuid;
  v_landing_name             text;
  v_current_hour             int;
  v_gerencia_selection_mode  text;
  v_gerencia_fair_criterion  text;
  v_gerencia_id              int;
  v_weight                   int;
  v_phone_mode               text;
  v_phone_kind               text;
  v_external_id              int;
  v_owner_user_id            uuid;
  v_fair_criterion           text;
  v_phone_id                 bigint;
  v_phone                    text;
  v_total_weight             float;
  v_r                        float;
  v_reservation_id           uuid;
begin
  select
    id,
    name,
    coalesce(gerencia_selection_mode, 'weighted_random'),
    coalesce(gerencia_fair_criterion, 'usage_count')
  into
    v_landing_id,
    v_landing_name,
    v_gerencia_selection_mode,
    v_gerencia_fair_criterion
  from landings
  where name = trim(p_landing_name)
  limit 1;

  if v_landing_id is null then
    return jsonb_build_object('_status', 'not_found');
  end if;

  if p_create_reservation
     and v_gerencia_selection_mode = 'fair'
     and v_gerencia_fair_criterion = 'messages_received' then
    perform pg_advisory_xact_lock(95017, hashtext(v_landing_id::text));

    update public.landing_phone_assignment_reservations
    set status = 'expired'
    where landing_id = v_landing_id
      and status in ('prewarmed', 'clicked')
      and expires_at <= statement_timestamp();

    delete from public.landing_phone_assignment_reservations
    where landing_id = v_landing_id
      and expires_at < statement_timestamp() - interval '1 day';
  end if;

  v_current_hour := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::int;

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
    lg.gerencia_id,
    greatest(0, lg.weight),
    lg.phone_mode,
    lg.phone_kind,
    g.gerencia_id,
    g.user_id,
    coalesce(g.fair_criterion, 'usage_count')
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
        order by private.landing_phone_message_load(
          v_landing_id,
          p.gerencia_id,
          p.phone_kind,
          p.owner_user_id,
          null
        ) asc, random()
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
        order by public.phone_assignment_scope_usage(
          'landing',
          v_landing_id,
          p.gerencia_id,
          p.phone_kind,
          null
        ) asc, random()
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
        where gp.gerencia_id = v_gerencia_id
          and gp.status = 'active'
          and gp.kind = v_phone_kind
          and gp.assignment_role = 'acquisition'
        order by private.landing_phone_message_load(
          v_landing_id,
          v_gerencia_id,
          v_phone_kind,
          v_owner_user_id,
          gp.id
        ) asc, random()
        limit 1;
      else
        select gp.id, gp.phone
        into v_phone_id, v_phone
        from gerencia_phones gp
        where gp.gerencia_id = v_gerencia_id
          and gp.status = 'active'
          and gp.kind = v_phone_kind
          and gp.assignment_role = 'acquisition'
        order by public.phone_assignment_scope_usage(
          'landing',
          v_landing_id,
          v_gerencia_id,
          v_phone_kind,
          gp.id
        ) asc, random()
        limit 1;
      end if;
    else
      select gp.id, gp.phone
      into v_phone_id, v_phone
      from gerencia_phones gp
      where gp.gerencia_id = v_gerencia_id
        and gp.status = 'active'
        and gp.kind = v_phone_kind
        and gp.assignment_role = 'acquisition'
      order by random()
      limit 1;
    end if;

    if v_phone_id is not null then
      if p_create_reservation
         and v_gerencia_selection_mode = 'fair'
         and v_gerencia_fair_criterion = 'messages_received' then
        insert into public.landing_phone_assignment_reservations (
          landing_id,
          gerencia_id,
          phone_id,
          phone,
          phone_kind,
          expires_at
        ) values (
          v_landing_id,
          v_gerencia_id,
          v_phone_id,
          v_phone,
          v_phone_kind,
          clock_timestamp() + interval '60 seconds'
        )
        returning id into v_reservation_id;
      end if;

      drop table if exists _get_phone_pool;
      return jsonb_build_object(
        'phoneId', v_phone_id,
        'phone', v_phone,
        'landingId', v_landing_id,
        'landingName', v_landing_name,
        'gerenciaSelectionMode', v_gerencia_selection_mode,
        'gerenciaFairCriterion', v_gerencia_fair_criterion,
        'phoneMode', v_phone_mode,
        'phoneKind', v_phone_kind,
        'fairCriterion', v_fair_criterion,
        'assignmentReservationId', v_reservation_id,
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

create or replace function public.record_landing_phone_availability_demand(
  p_landing_name text,
  p_request_id uuid,
  p_source text default 'landing-phone',
  p_result_status text default 'ok',
  p_selected_gerencia_id integer default null,
  p_selected_phone_id bigint default null,
  p_selected_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_hour integer := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::integer;
  v_inserted integer := 0;
begin
  if nullif(trim(coalesce(p_landing_name, '')), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_landing_name');
  end if;

  if p_request_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_request_id');
  end if;

  with landing_row as (
    select l.id, l.user_id, l.name
    from public.landings l
    where l.name = trim(p_landing_name)
    limit 1
  ),
  candidates as (
    select
      lr.id as landing_id,
      lr.user_id,
      lr.name as landing_name,
      lg.gerencia_id,
      lg.phone_kind,
      g.gerencia_id as gerencia_external_id,
      format(
        '%s (ID %s)',
        coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))),
        coalesce(g.gerencia_id, g.id)
      ) as gerencia_label
    from landing_row lr
    join public.landings_gerencias lg on lg.landing_id = lr.id
    join public.gerencias g on g.id = lg.gerencia_id
    where (
      (lg.interval_start_hour is null or lg.interval_end_hour is null)
      or (lg.interval_start_hour = lg.interval_end_hour)
      or (
        lg.interval_start_hour < lg.interval_end_hour
        and v_current_hour >= lg.interval_start_hour
        and v_current_hour < lg.interval_end_hour
      )
      or (
        lg.interval_start_hour > lg.interval_end_hour
        and (v_current_hour >= lg.interval_start_hour or v_current_hour < lg.interval_end_hour)
      )
    )
  ),
  phone_counts as (
    select
      c.*,
      count(gp.id)::integer as total_phone_count,
      count(gp.id) filter (
        where gp.status = 'active'
          and gp.assignment_role = 'acquisition'
      )::integer as active_phone_count
    from candidates c
    left join public.gerencia_phones gp
      on gp.gerencia_id = c.gerencia_id
     and gp.kind = c.phone_kind
    group by
      c.landing_id,
      c.user_id,
      c.landing_name,
      c.gerencia_id,
      c.phone_kind,
      c.gerencia_external_id,
      c.gerencia_label
  ),
  inserted as (
    insert into public.landing_phone_availability_demands (
      request_id,
      user_id,
      landing_id,
      landing_name,
      gerencia_id,
      gerencia_external_id,
      gerencia_label,
      phone_kind,
      had_active_phone,
      active_phone_count,
      total_phone_count,
      was_selected,
      selected_phone_id,
      selected_phone,
      result_status,
      source,
      checked_at
    )
    select
      p_request_id,
      pc.user_id,
      pc.landing_id,
      pc.landing_name,
      pc.gerencia_id,
      pc.gerencia_external_id,
      pc.gerencia_label,
      pc.phone_kind,
      pc.active_phone_count > 0,
      pc.active_phone_count,
      pc.total_phone_count,
      p_selected_gerencia_id is not null and pc.gerencia_id = p_selected_gerencia_id,
      case when p_selected_gerencia_id is not null and pc.gerencia_id = p_selected_gerencia_id then p_selected_phone_id else null end,
      case when p_selected_gerencia_id is not null and pc.gerencia_id = p_selected_gerencia_id then nullif(trim(coalesce(p_selected_phone, '')), '') else null end,
      coalesce(nullif(trim(p_result_status), ''), 'unknown'),
      coalesce(nullif(trim(p_source), ''), 'landing-phone'),
      now()
    from phone_counts pc
    on conflict (request_id, gerencia_id) do nothing
    returning 1
  )
  select count(*)::integer into v_inserted from inserted;

  return jsonb_build_object('ok', true, 'inserted', v_inserted);
end;
$$;

-- A cached constructor assignment may span an interval boundary. Return it only
-- while its selected gerencia is eligible at the current Buenos Aires hour.
create or replace function public.get_cached_constructor_landing_phone(p_landing_name text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with local_clock as (
    select extract(
      hour from now() at time zone 'America/Argentina/Buenos_Aires'
    )::integer as current_hour
  )
  select
    c.payload
      || jsonb_build_object(
        'cacheRefreshedAt', c.refreshed_at,
        'cacheSource', 'landing_phone_cache'
      )
  from public.landing_phone_cache c
  join public.landings l on l.id = c.landing_id
  cross join local_clock t
  where c.landing_name = trim(p_landing_name)
    and c.status = 'ok'
    and c.refreshed_at >= now() - interval '90 seconds'
    and coalesce(c.payload ->> 'phone', '') <> ''
    and coalesce(l.landing_type, 'internal') = 'internal'
    and coalesce(l.publish_target, 'classic') = 'constructor'
    and exists (
      select 1
      from public.landings_gerencias lg
      where lg.landing_id = c.landing_id
        and lg.gerencia_id::text = c.payload #>> '{gerencia,id}'
        and (
          lg.interval_start_hour is null
          or lg.interval_end_hour is null
          or lg.interval_start_hour = lg.interval_end_hour
          or (
            lg.interval_start_hour < lg.interval_end_hour
            and t.current_hour >= lg.interval_start_hour
            and t.current_hour < lg.interval_end_hour
          )
          or (
            lg.interval_start_hour > lg.interval_end_hour
            and (
              t.current_hour >= lg.interval_start_hour
              or t.current_hour < lg.interval_end_hour
            )
          )
        )
    )
  limit 1;
$$;

revoke all on function public.get_cached_constructor_landing_phone(text) from public;
grant execute on function public.get_cached_constructor_landing_phone(text)
  to anon, authenticated, service_role;

comment on function public.get_cached_constructor_landing_phone(text) is
  'Devuelve el telefono cacheado del constructor solo si sigue fresco y su gerencia esta habilitada en la hora de Buenos Aires.';
