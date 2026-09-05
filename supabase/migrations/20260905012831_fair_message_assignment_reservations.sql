create table public.landing_phone_assignment_reservations (
  id uuid primary key default gen_random_uuid(),
  landing_id uuid not null references public.landings(id) on delete cascade,
  gerencia_id integer not null references public.gerencias(id) on delete cascade,
  phone_id bigint not null references public.gerencia_phones(id) on delete cascade,
  phone text not null,
  phone_kind text not null,
  status text not null default 'prewarmed'
    check (status in ('prewarmed', 'clicked', 'converted', 'expired')),
  reserved_at timestamptz not null default clock_timestamp(),
  clicked_at timestamptz,
  expires_at timestamptz not null,
  converted_at timestamptz,
  conversion_id uuid references public.conversions(id) on delete set null
);

comment on table public.landing_phone_assignment_reservations is
  'Reservas breves usadas para equilibrar landings fair por mensajes mientras el lead todavia no fue confirmado.';

create index landing_phone_reservations_active_gerencia_idx
  on public.landing_phone_assignment_reservations
    (landing_id, gerencia_id, phone_kind, expires_at)
  where status in ('prewarmed', 'clicked');

create index landing_phone_reservations_active_phone_idx
  on public.landing_phone_assignment_reservations
    (landing_id, phone_id, expires_at)
  where status in ('prewarmed', 'clicked');

create index landing_phone_reservations_phone_match_idx
  on public.landing_phone_assignment_reservations
    (landing_id, phone, reserved_at desc)
  where status in ('prewarmed', 'clicked', 'expired');

create index landing_phone_reservations_gerencia_fk_idx
  on public.landing_phone_assignment_reservations (gerencia_id);

create index landing_phone_reservations_phone_fk_idx
  on public.landing_phone_assignment_reservations (phone_id);

create index landing_phone_reservations_conversion_fk_idx
  on public.landing_phone_assignment_reservations (conversion_id)
  where conversion_id is not null;

create index landing_phone_reservations_cleanup_idx
  on public.landing_phone_assignment_reservations (landing_id, expires_at);

create index conversions_landing_assignment_messages_lookup_idx
  on public.conversions
    (landing_id, user_id, telefono_asignado, lead_event_time, created_at)
  where lead_event_id <> '' and telefono_asignado <> '';

alter table public.landing_phone_assignment_reservations enable row level security;

revoke all on table public.landing_phone_assignment_reservations from anon, authenticated;
grant select, insert, update, delete on table public.landing_phone_assignment_reservations to service_role;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.landing_phone_message_load(
  p_landing_id uuid,
  p_gerencia_id integer,
  p_phone_kind text,
  p_owner_user_id uuid,
  p_phone_id bigint default null
)
returns bigint
language sql
stable
set search_path = ''
as $$
  select
    (
      select count(*)::bigint
      from public.conversions c
      where c.user_id = p_owner_user_id
        and c.landing_id = p_landing_id
        and c.lead_event_id <> ''
        and exists (
          select 1
          from public.gerencia_phones gp
          where gp.gerencia_id = p_gerencia_id
            and gp.kind = p_phone_kind
            and gp.assignment_role = 'acquisition'
            and (p_phone_id is null or gp.id = p_phone_id)
            and gp.phone = c.telefono_asignado
            and (
              gp.messages_reset_at is null
              or coalesce(to_timestamp(nullif(c.lead_event_time, 0)), c.created_at) >= gp.messages_reset_at
            )
        )
    ) + (
      select count(*)::bigint
      from public.landing_phone_assignment_reservations r
      join public.gerencia_phones gp on gp.id = r.phone_id
      where r.landing_id = p_landing_id
        and r.gerencia_id = p_gerencia_id
        and r.phone_kind = p_phone_kind
        and (p_phone_id is null or r.phone_id = p_phone_id)
        and r.status in ('prewarmed', 'clicked')
        and r.expires_at > statement_timestamp()
        and (gp.messages_reset_at is null or r.reserved_at >= gp.messages_reset_at)
    );
$$;

revoke all on function private.landing_phone_message_load(uuid, integer, text, uuid, bigint) from public;

create or replace function public.extend_landing_phone_assignment_reservation(
  p_reservation_id uuid,
  p_landing_id uuid,
  p_phone_id bigint,
  p_phone text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  perform pg_advisory_xact_lock(95017, hashtext(p_landing_id::text));

  update public.landing_phone_assignment_reservations
  set status = 'clicked',
      clicked_at = clock_timestamp(),
      expires_at = clock_timestamp() + interval '30 seconds'
  where id = p_reservation_id
    and landing_id = p_landing_id
    and phone_id = p_phone_id
    and phone = p_phone
    and status in ('prewarmed', 'clicked', 'expired')
    and reserved_at >= clock_timestamp() - interval '10 minutes'
  returning true into v_updated;

  return coalesce(v_updated, false);
end;
$$;

revoke all on function public.extend_landing_phone_assignment_reservation(uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.extend_landing_phone_assignment_reservation(uuid, uuid, bigint, text)
  to service_role;

create or replace function private.close_landing_phone_reservation_on_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.lead_event_id, '') = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.lead_event_id, '') <> '' then
    return new;
  end if;

  if new.landing_id is null or coalesce(new.telefono_asignado, '') = '' then
    return new;
  end if;

  with candidate as (
    select r.id
    from public.landing_phone_assignment_reservations r
    where r.landing_id = new.landing_id
      and r.phone = new.telefono_asignado
      and r.status in ('prewarmed', 'clicked', 'expired')
      and r.reserved_at >= clock_timestamp() - interval '10 minutes'
    order by
      case when r.status = 'clicked' then 0 else 1 end,
      r.clicked_at desc nulls last,
      r.reserved_at desc
    limit 1
    for update skip locked
  )
  update public.landing_phone_assignment_reservations r
  set status = 'converted',
      converted_at = clock_timestamp(),
      conversion_id = new.id
  from candidate c
  where r.id = c.id;

  return new;
end;
$$;

revoke all on function private.close_landing_phone_reservation_on_lead() from public;

drop trigger if exists close_landing_phone_reservation_on_lead on public.conversions;
create trigger close_landing_phone_reservation_on_lead
after insert or update of lead_event_id on public.conversions
for each row
when (new.lead_event_id <> '')
execute function private.close_landing_phone_reservation_on_lead();

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

comment on function public.get_phone_for_landing(text, boolean) is
  'Selecciona telefono para una landing y reserva durante 60 segundos las asignaciones fair por mensajes para contemplar leads en camino.';

revoke all on function public.get_phone_for_landing(text, boolean) from public, anon, authenticated;
grant execute on function public.get_phone_for_landing(text, boolean) to service_role;

create or replace function public.get_phone_for_landing(p_landing_name text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.get_phone_for_landing(p_landing_name, false);
$$;

comment on function public.get_phone_for_landing(text) is
  'Compatibilidad para procesos tecnicos que consultan un telefono sin crear una reserva.';

grant execute on function public.get_phone_for_landing(text) to service_role, authenticated, anon;
