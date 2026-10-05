-- A third, opt-in landing gerencia mode and shared provisional counter load.
alter table public.landings
  drop constraint if exists landings_gerencia_selection_mode_check;
alter table public.landings
  add constraint landings_gerencia_selection_mode_check
  check (gerencia_selection_mode in ('weighted_random', 'fair', 'weighted_quota'));

comment on column public.landings.gerencia_selection_mode is
  'weighted_random: weighted lottery; fair: equal share; weighted_quota: controlled weighted share.';

-- The existing Telefonos reset buttons define the period for both fair and
-- weighted quota. No hidden baseline or separately reset quota counter.
alter table public.gerencia_phones
  add column assignment_counter_reset_at timestamptz;

comment on column public.gerencia_phones.assignment_counter_reset_at is
  'Excludes pre-reset provisional fair/quota reservations after resetting the operational click counter.';

alter table public.landing_phone_assignment_reservations
  add column click_counted_at timestamptz;

comment on column public.landing_phone_assignment_reservations.click_counted_at is
  'Set once when a fair-counter or weighted-quota CTA click is counted; repeated notifications are idempotent.';

-- Both balanced modes read the same operational click load. A reservation
-- temporarily stands in for a click and is excluded once counted or expired.
create or replace function private.landing_phone_counter_load(
  p_landing_id uuid,
  p_gerencia_id integer,
  p_phone_kind text,
  p_phone_id bigint default null
)
returns bigint
language sql
stable
set search_path = ''
as $$
  select public.phone_assignment_scope_usage(
    'landing', p_landing_id, p_gerencia_id, p_phone_kind, p_phone_id
  ) + (
    select count(*)::bigint
    from public.landing_phone_assignment_reservations r
    join public.gerencia_phones gp on gp.id = r.phone_id
    where r.landing_id = p_landing_id
      and r.gerencia_id = p_gerencia_id
      and r.phone_kind = p_phone_kind
      and (p_phone_id is null or r.phone_id = p_phone_id)
      and r.status in ('prewarmed', 'clicked')
      and r.expires_at > pg_catalog.statement_timestamp()
      and r.click_counted_at is null
      and (gp.assignment_counter_reset_at is null
           or r.reserved_at >= gp.assignment_counter_reset_at)
  );
$$;

revoke all on function private.landing_phone_counter_load(uuid, integer, text, bigint)
  from public, anon, authenticated;

create or replace function private.select_landing_weighted_quota_phone(
  p_landing_id uuid,
  p_landing_name text,
  p_criterion text,
  p_create_reservation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_hour integer := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::integer;
  v_total_weight numeric;
  v_gerencia_id integer;
  v_weight integer;
  v_phone_mode text;
  v_phone_kind text;
  v_external_id integer;
  v_owner_user_id uuid;
  v_fair_criterion text;
  v_phone_id bigint;
  v_phone text;
  v_reservation_id uuid;
begin
  -- Serialize provisional selections so concurrent visitors see reservations.
  perform pg_catalog.pg_advisory_xact_lock(95017, pg_catalog.hashtext(p_landing_id::text));

  if p_create_reservation then
    update public.landing_phone_assignment_reservations
    set status = 'expired'
    where landing_id = p_landing_id
      and status in ('prewarmed', 'clicked')
      and expires_at <= pg_catalog.statement_timestamp();

    delete from public.landing_phone_assignment_reservations
    where landing_id = p_landing_id
      and expires_at < pg_catalog.statement_timestamp() - interval '1 day';
  end if;

  drop table if exists pg_temp._landing_quota_pool;
  create temp table _landing_quota_pool on commit drop as
  select lg.gerencia_id, greatest(0, lg.weight)::integer as weight,
    lg.phone_mode, lg.phone_kind, g.gerencia_id as external_id,
    g.user_id as owner_user_id,
    coalesce(g.fair_criterion, 'usage_count') as fair_criterion
  from public.landings_gerencias lg
  join public.gerencias g on g.id = lg.gerencia_id
  where lg.landing_id = p_landing_id
    and (
      lg.interval_start_hour is null or lg.interval_end_hour is null
      or lg.interval_start_hour = lg.interval_end_hour
      or (lg.interval_start_hour < lg.interval_end_hour
          and v_current_hour >= lg.interval_start_hour
          and v_current_hour < lg.interval_end_hour)
      or (lg.interval_start_hour > lg.interval_end_hour
          and (v_current_hour >= lg.interval_start_hour
               or v_current_hour < lg.interval_end_hour))
    );

  if not exists (select 1 from _landing_quota_pool) then
    return pg_catalog.jsonb_build_object('_status', 'no_assignments');
  end if;

  -- A zero weight excludes a gerencia just as in the existing weighted lottery.
  delete from _landing_quota_pool p
  where p.weight <= 0
    or not exists (
      select 1 from public.gerencia_phones gp
      where gp.gerencia_id = p.gerencia_id
        and gp.status = 'active'
        and gp.kind = p.phone_kind
        and gp.assignment_role = 'acquisition'
    );

  if not exists (select 1 from _landing_quota_pool) then
    return pg_catalog.jsonb_build_object('_status', 'no_phones');
  end if;

  loop
    select sum(p.weight)::numeric into v_total_weight from _landing_quota_pool p;
    if v_total_weight is null or v_total_weight <= 0 then
      return pg_catalog.jsonb_build_object('_status', 'no_phones');
    end if;

    -- Both criteria pursue the same target: measured load / configured weight.
    -- The Telefonos reset buttons change the measured load for fair and quota.
    -- Reservations temporarily stand in for a click or a bot-confirmed LEAD.
    with measured as (
      select p.*,
        case when p_criterion = 'messages_received' then
          private.landing_phone_message_load(
            p_landing_id, p.gerencia_id, p.phone_kind, p.owner_user_id, null
          )
        else
          private.landing_phone_counter_load(
            p_landing_id, p.gerencia_id, p.phone_kind, null
          )
        end as observed
      from _landing_quota_pool p
    )
    select m.gerencia_id, m.weight, m.phone_mode, m.phone_kind,
      m.external_id, m.owner_user_id, m.fair_criterion
    into v_gerencia_id, v_weight, v_phone_mode, v_phone_kind,
      v_external_id, v_owner_user_id, v_fair_criterion
    from measured m
    order by m.observed::numeric / m.weight::numeric asc, m.gerencia_id asc
    limit 1;

    if v_gerencia_id is null then
      return pg_catalog.jsonb_build_object('_status', 'no_phones');
    end if;

    v_phone_id := null;
    v_phone := null;
    if v_phone_mode = 'fair' then
      if v_fair_criterion = 'messages_received' then
        select gp.id, gp.phone into v_phone_id, v_phone
        from public.gerencia_phones gp
        where gp.gerencia_id = v_gerencia_id
          and gp.status = 'active' and gp.kind = v_phone_kind
          and gp.assignment_role = 'acquisition'
        order by private.landing_phone_message_load(
          p_landing_id, v_gerencia_id, v_phone_kind, v_owner_user_id, gp.id
        ), random()
        limit 1;
      else
        select gp.id, gp.phone into v_phone_id, v_phone
        from public.gerencia_phones gp
        where gp.gerencia_id = v_gerencia_id
          and gp.status = 'active' and gp.kind = v_phone_kind
          and gp.assignment_role = 'acquisition'
        order by private.landing_phone_counter_load(
          p_landing_id, v_gerencia_id, v_phone_kind, gp.id
        ), random()
        limit 1;
      end if;
    else
      select gp.id, gp.phone into v_phone_id, v_phone
      from public.gerencia_phones gp
      where gp.gerencia_id = v_gerencia_id
        and gp.status = 'active' and gp.kind = v_phone_kind
        and gp.assignment_role = 'acquisition'
      order by random()
      limit 1;
    end if;

    if v_phone_id is not null then
      if p_create_reservation then
        insert into public.landing_phone_assignment_reservations (
          landing_id, gerencia_id, phone_id, phone, phone_kind, expires_at
        ) values (
          p_landing_id, v_gerencia_id, v_phone_id, v_phone, v_phone_kind,
          pg_catalog.clock_timestamp() + interval '60 seconds'
        ) returning id into v_reservation_id;

      end if;

      return pg_catalog.jsonb_build_object(
        'phoneId', v_phone_id, 'phone', v_phone,
        'landingId', p_landing_id, 'landingName', p_landing_name,
        'gerenciaSelectionMode', 'weighted_quota',
        'gerenciaFairCriterion', p_criterion,
        'phoneMode', v_phone_mode, 'phoneKind', v_phone_kind,
        'fairCriterion', v_fair_criterion,
        'assignmentReservationId', v_reservation_id,
        'gerencia', pg_catalog.jsonb_build_object(
          'id', v_gerencia_id, 'externalId', v_external_id, 'weight', v_weight
        )
      );
    end if;

    -- A phone became unavailable during selection. Retry among the others,
    -- without charging the failed candidate any credit or reservation.
    delete from _landing_quota_pool p where p.gerencia_id = v_gerencia_id;
  end loop;
end;
$$;

revoke all on function private.select_landing_weighted_quota_phone(uuid, text, text, boolean)
  from public, anon, authenticated;

create or replace function public.count_landing_controlled_click(
  p_reservation_id uuid,
  p_landing_id uuid,
  p_phone_id bigint,
  p_phone text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid;
  v_gerencia_id integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(95017, pg_catalog.hashtext(p_landing_id::text));

  update public.landing_phone_assignment_reservations r
  set status = case when r.status = 'converted' then 'converted' else 'clicked' end,
      clicked_at = coalesce(r.clicked_at, pg_catalog.clock_timestamp()),
      click_counted_at = pg_catalog.clock_timestamp(),
      expires_at = pg_catalog.clock_timestamp() + interval '30 seconds'
  from public.landings l
  where r.id = p_reservation_id
    and r.landing_id = p_landing_id
    and r.phone_id = p_phone_id
    and r.phone = p_phone
    and r.click_counted_at is null
    and r.status in ('prewarmed', 'clicked', 'expired', 'converted')
    and r.reserved_at >= pg_catalog.clock_timestamp() - interval '1 day'
    and l.id = r.landing_id
    and (
      l.gerencia_selection_mode = 'weighted_quota'
      or (l.gerencia_selection_mode = 'fair'
          and l.gerencia_fair_criterion = 'usage_count')
    )
  returning l.user_id, r.gerencia_id into v_owner_user_id, v_gerencia_id;

  if v_owner_user_id is null then
    return false;
  end if;

  perform public.increment_phone_assignment_scope_usage(
    p_phone_id, 'landing', p_landing_id, v_owner_user_id, v_gerencia_id
  );
  return true;
end;
$$;

revoke all on function public.count_landing_controlled_click(uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.count_landing_controlled_click(uuid, uuid, bigint, text)
  to service_role;

comment on function public.count_landing_controlled_click(uuid, uuid, bigint, text) is
  'Counts a fair-counter or weighted-quota CTA click at most once for its selection reservation.';

-- Dispatch quota separately; fair by counter uses the shared provisional load.
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

  if v_gerencia_selection_mode = 'weighted_quota' then
    return private.select_landing_weighted_quota_phone(
      v_landing_id, v_landing_name, v_gerencia_fair_criterion, p_create_reservation
    );
  end if;

  if p_create_reservation
     and v_gerencia_selection_mode = 'fair' then
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
        order by private.landing_phone_counter_load(
          v_landing_id, p.gerencia_id, p.phone_kind, null
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
        order by private.landing_phone_counter_load(
          v_landing_id, v_gerencia_id, v_phone_kind, gp.id
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
         and v_gerencia_selection_mode = 'fair' then
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


-- Never serve a cached number for a quota-controlled landing.
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
    and l.gerencia_selection_mode <> 'weighted_quota'
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
