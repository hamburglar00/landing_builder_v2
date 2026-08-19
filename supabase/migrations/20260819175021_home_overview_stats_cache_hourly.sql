create table if not exists public.home_overview_stats_cache (
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_currency text not null,
  stats jsonb not null,
  calculated_at timestamptz not null default now(),
  primary key (user_id, workspace_currency),
  constraint home_overview_stats_cache_currency_check
    check (workspace_currency ~ '^[A-Z]{3}$')
);

alter table public.home_overview_stats_cache enable row level security;

drop policy if exists home_overview_stats_cache_owner_read
  on public.home_overview_stats_cache;
create policy home_overview_stats_cache_owner_read
on public.home_overview_stats_cache
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists home_overview_stats_cache_admin_read
  on public.home_overview_stats_cache;
create policy home_overview_stats_cache_admin_read
on public.home_overview_stats_cache
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

comment on table public.home_overview_stats_cache is
  'Cache horario de metricas de Inicio por usuario y workspace. Evita recalcular el resumen al entrar al constructor.';

create or replace function public.calculate_home_overview_stats_by_currency(
  p_user_id uuid,
  p_hidden_by uuid default null,
  p_currency text default 'ARS'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hidden_by uuid := coalesce(p_hidden_by, p_user_id);
  v_currency text := upper(trim(coalesce(p_currency, 'ARS')));
  v_month_start timestamptz := date_trunc('month', now());
  v_now timestamptz := now();
  v_cutoff_30 timestamptz := now() - interval '30 days';
  v_cutoff_7 timestamptz := now() - interval '7 days';
  v_threshold numeric := 50000;
  v_landings_count int := 0;
  v_unique_leads_linked_to_contact int := 0;
  v_first_load_linked int := 0;
  v_total_revenue numeric := 0;
  v_total_purchase_count int := 0;
  v_premium_players int := 0;
  v_retention_30d int := 0;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency';
  end if;

  select coalesce(
      case
        when (cc.funnel_premium_thresholds ->> v_currency) ~ '^[0-9]+([.][0-9]+)?$'
          then (cc.funnel_premium_thresholds ->> v_currency)::numeric
        else null
      end,
      cc.funnel_premium_threshold,
      50000
    )
    into v_threshold
  from public.conversions_config cc
  where cc.user_id = p_user_id
  limit 1;

  v_threshold := coalesce(v_threshold, 50000);

  select count(*)::int
    into v_landings_count
  from public.landings l
  where l.user_id = p_user_id
    and upper(coalesce(l.workspace_currency, 'ARS')) = v_currency;

  with monthly as materialized (
    select c.*
    from public.conversions c
    where c.user_id = p_user_id
      and upper(coalesce(c.currency, 'ARS')) = v_currency
      and c.created_at >= v_month_start
      and c.created_at <= v_now
      and trim(coalesce(c.test_event_code, '')) = ''
      and not exists (
        select 1
        from public.hidden_conversions h
        where h.conversion_id = c.id
          and h.hidden_by = v_hidden_by
      )
  ),
  lead_rows as (
    select *
    from monthly
    where coalesce(lead_event_id, '') <> ''
  ),
  contact_external_keys as (
    select distinct user_id, trim(coalesce(external_id, '')) as external_id
    from monthly
    where coalesce(contact_event_id, '') <> ''
      and trim(coalesce(external_id, '')) <> ''
  ),
  lead_external_keys as (
    select distinct user_id, trim(coalesce(external_id, '')) as external_id
    from lead_rows
    where trim(coalesce(external_id, '')) <> ''
  ),
  lead_linked_to_contact as (
    select l.user_id, l.external_id
    from lead_external_keys l
    join contact_external_keys c
      on c.user_id = l.user_id
     and c.external_id = l.external_id
  ),
  purchase_rows as (
    select *
    from monthly
    where coalesce(purchase_event_id, '') <> ''
  ),
  first_purchase_rows as (
    select *
    from purchase_rows
    where purchase_type = 'first'
       or (
        coalesce(purchase_type, '') not in ('first', 'repeat')
        and coalesce(observaciones, '') not like '%REPEAT%'
      )
  ),
  first_purchase_by_phone as (
    select distinct on (
      case
        when trim(coalesce(phone, '')) <> '' then user_id::text || '::' || trim(phone)
        else user_id::text || '::__fallback__' || coalesce(contact_event_id, lead_event_id, purchase_event_id, id::text, created_at::text)
      end
    )
      user_id,
      trim(coalesce(external_id, '')) as external_id,
      created_at
    from first_purchase_rows
    order by
      case
        when trim(coalesce(phone, '')) <> '' then user_id::text || '::' || trim(phone)
        else user_id::text || '::__fallback__' || coalesce(contact_event_id, lead_event_id, purchase_event_id, id::text, created_at::text)
      end,
      created_at asc
  ),
  inferred_first_contact_purchase as (
    select f.user_id, f.external_id
    from first_purchase_by_phone f
    join contact_external_keys c
      on c.user_id = f.user_id
     and c.external_id = f.external_id
    left join lead_linked_to_contact l
      on l.user_id = f.user_id
     and l.external_id = f.external_id
    where f.external_id <> ''
      and l.external_id is null
  ),
  grouped_funnel as (
    select
      phone,
      sum(case when coalesce(purchase_event_id, '') <> '' then coalesce(valor, 0) else 0 end) as total_valor,
      count(*) filter (where coalesce(purchase_event_id, '') <> '') as purchase_count,
      (array_agg(estado order by created_at desc))[1] as latest_estado
    from monthly
    group by user_id, phone
  ),
  retention_by_phone as (
    select
      c.phone,
      min(c.created_at) as first_purchase_at,
      count(*) filter (where c.created_at >= v_cutoff_30) as recent_count
    from public.conversions c
    where c.user_id = p_user_id
      and upper(coalesce(c.currency, 'ARS')) = v_currency
      and trim(coalesce(c.phone, '')) <> ''
      and trim(coalesce(c.test_event_code, '')) = ''
      and coalesce(c.purchase_event_id, '') <> ''
      and not exists (
        select 1
        from public.hidden_conversions h
        where h.conversion_id = c.id
          and h.hidden_by = v_hidden_by
      )
    group by c.phone
  )
  select
    ((select count(*)::int from lead_linked_to_contact) + (select count(*)::int from inferred_first_contact_purchase)),
    ((select count(*)::int
      from first_purchase_by_phone f
      join lead_linked_to_contact l
        on l.user_id = f.user_id
       and l.external_id = f.external_id
      where f.external_id <> '') + (select count(*)::int from inferred_first_contact_purchase)),
    coalesce((select sum(coalesce(valor, 0)) from purchase_rows), 0),
    (select count(*)::int from purchase_rows),
    (select count(*)::int
      from grouped_funnel
      where latest_estado in ('lead', 'purchase')
        and purchase_count > 0
        and total_valor >= v_threshold),
    (select count(*)::int
      from retention_by_phone
      where recent_count >= 4
        and first_purchase_at <= v_cutoff_7)
  into
    v_unique_leads_linked_to_contact,
    v_first_load_linked,
    v_total_revenue,
    v_total_purchase_count,
    v_premium_players,
    v_retention_30d;

  return jsonb_build_object(
    'currency', v_currency,
    'landings_count', v_landings_count,
    'porcentaje_carga', case
      when v_unique_leads_linked_to_contact > 0 then (v_first_load_linked::numeric / v_unique_leads_linked_to_contact::numeric) * 100
      else 0
    end,
    'carga_promedio', case
      when v_total_purchase_count > 0 then v_total_revenue / v_total_purchase_count
      else 0
    end,
    'total_cargado', v_total_revenue,
    'jugadores_premium', v_premium_players,
    'retencion_activa_30d', v_retention_30d
  );
end;
$$;

revoke all on function public.calculate_home_overview_stats_by_currency(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.calculate_home_overview_stats_by_currency(uuid, uuid, text)
  to service_role;

create or replace function public.refresh_home_overview_stats_cache(
  p_user_id uuid default null,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refreshed int := 0;
  v_row record;
  v_stats jsonb;
begin
  for v_row in
    with targets as (
      select p.id as user_id, 'ARS'::text as workspace_currency
      from public.profiles p
      where p_user_id is null or p.id = p_user_id

      union

      select p.id as user_id, 'PYG'::text as workspace_currency
      from public.profiles p
      where p_user_id is null or p.id = p_user_id

      union

      select distinct l.user_id, upper(coalesce(l.workspace_currency, 'ARS')) as workspace_currency
      from public.landings l
      where (p_user_id is null or l.user_id = p_user_id)

      union

      select distinct c.user_id, upper(coalesce(c.currency, 'ARS')) as workspace_currency
      from public.conversions c
      where (p_user_id is null or c.user_id = p_user_id)
    )
    select user_id, workspace_currency
    from targets
    where workspace_currency ~ '^[A-Z]{3}$'
      and (p_currency is null or workspace_currency = upper(trim(p_currency)))
  loop
    v_stats := public.calculate_home_overview_stats_by_currency(
      v_row.user_id,
      v_row.user_id,
      v_row.workspace_currency
    );

    insert into public.home_overview_stats_cache (
      user_id,
      workspace_currency,
      stats,
      calculated_at
    )
    values (
      v_row.user_id,
      v_row.workspace_currency,
      v_stats,
      now()
    )
    on conflict (user_id, workspace_currency) do update set
      stats = excluded.stats,
      calculated_at = excluded.calculated_at;

    v_refreshed := v_refreshed + 1;
  end loop;

  return jsonb_build_object('ok', true, 'refreshed', v_refreshed);
end;
$$;

revoke all on function public.refresh_home_overview_stats_cache(uuid, text)
  from public, anon, authenticated;
grant execute on function public.refresh_home_overview_stats_cache(uuid, text)
  to service_role;

create or replace function public.get_home_overview_stats_cached_by_currency(
  p_user_id uuid,
  p_hidden_by uuid default null,
  p_currency text default 'ARS'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_hidden_by uuid := coalesce(p_hidden_by, p_user_id);
  v_currency text := upper(trim(coalesce(p_currency, 'ARS')));
  v_stats jsonb;
  v_calculated_at timestamptz;
begin
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency';
  end if;

  if v_auth_uid is null then
    raise exception 'not authorized';
  end if;

  if v_auth_uid <> p_user_id then
    select exists (
      select 1
      from public.profiles p
      where p.id = v_auth_uid
        and p.role = 'admin'
    )
    into v_is_admin;

    if not v_is_admin then
      raise exception 'not authorized';
    end if;
  end if;

  select c.stats, c.calculated_at
    into v_stats, v_calculated_at
  from public.home_overview_stats_cache c
  where c.user_id = p_user_id
    and c.workspace_currency = v_currency;

  if v_stats is null then
    v_stats := public.calculate_home_overview_stats_by_currency(
      p_user_id,
      v_hidden_by,
      v_currency
    );

    insert into public.home_overview_stats_cache (
      user_id,
      workspace_currency,
      stats,
      calculated_at
    )
    values (p_user_id, v_currency, v_stats, now())
    on conflict (user_id, workspace_currency) do update set
      stats = excluded.stats,
      calculated_at = excluded.calculated_at
    returning calculated_at into v_calculated_at;
  end if;

  return v_stats || jsonb_build_object('cached_at', v_calculated_at);
end;
$$;

revoke all on function public.get_home_overview_stats_cached_by_currency(uuid, uuid, text)
  from public, anon;
grant execute on function public.get_home_overview_stats_cached_by_currency(uuid, uuid, text)
  to authenticated;

do $$
begin
  execute 'create extension if not exists pg_cron';
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('refresh-home-overview-stats-cache-hourly');
exception when others then
  null;
end $$;

select cron.schedule(
  'refresh-home-overview-stats-cache-hourly',
  '7 * * * *',
  $$select public.refresh_home_overview_stats_cache()$$
);

select public.refresh_home_overview_stats_cache();
