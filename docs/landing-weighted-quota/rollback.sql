-- Functional rollback for the quota rollout. Restore frontend and Edge versions separately.
-- Preserves migration history and additive columns for a later reconciled migration.
begin;
do $$ begin
  if exists (select 1 from public.landings where gerencia_selection_mode = 'weighted_quota') then
    raise exception 'Reset quota landings to a supported mode before rollback';
  end if;
end $$;

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

commit;
