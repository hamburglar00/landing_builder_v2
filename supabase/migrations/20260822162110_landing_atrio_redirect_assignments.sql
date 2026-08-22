set statement_timeout = '10min';

alter table public.atrio_clients
  add column if not exists usage_count bigint not null default 0;

comment on column public.atrio_clients.usage_count is
  'Contador global de redirecciones a este cliente Atrio. La seleccion fair usa metricas scopeadas por landing.';

alter table public.landings
  add column if not exists atrio_selection_mode text not null default 'weighted_random',
  add column if not exists atrio_fair_criterion text not null default 'usage_count';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'landings_atrio_selection_mode_check'
  ) then
    alter table public.landings
      add constraint landings_atrio_selection_mode_check
      check (atrio_selection_mode in ('weighted_random', 'fair'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'landings_atrio_fair_criterion_check'
  ) then
    alter table public.landings
      add constraint landings_atrio_fair_criterion_check
      check (atrio_fair_criterion in ('usage_count', 'messages_received'));
  end if;
end $$;

comment on column public.landings.atrio_selection_mode is
  'Modo de seleccion de clientes Atrio para el CTA: weighted_random o fair.';

comment on column public.landings.atrio_fair_criterion is
  'Criterio para atrio_selection_mode=fair: usage_count o messages_received.';

create table if not exists public.landings_atrio_clients (
  landing_id uuid not null references public.landings(id) on delete cascade,
  atrio_client_id uuid not null references public.atrio_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weight integer not null default 1 check (weight >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (landing_id, atrio_client_id)
);

comment on table public.landings_atrio_clients is
  'Clientes Atrio disponibles como destinos del CTA de una landing.';

comment on column public.landings_atrio_clients.weight is
  'Peso usado cuando atrio_selection_mode=weighted_random.';

create index if not exists landings_atrio_clients_user_idx
  on public.landings_atrio_clients (user_id, landing_id);

create index if not exists landings_atrio_clients_client_idx
  on public.landings_atrio_clients (atrio_client_id);

create or replace function public.set_landings_atrio_clients_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_landing_user_id uuid;
  v_landing_workspace text;
  v_atrio_user_id uuid;
  v_atrio_workspace text;
begin
  select l.user_id, l.workspace_currency
  into v_landing_user_id, v_landing_workspace
  from public.landings l
  where l.id = new.landing_id;

  if v_landing_user_id is null then
    raise exception 'Landing no encontrada';
  end if;

  select ac.user_id, ac.workspace_currency
  into v_atrio_user_id, v_atrio_workspace
  from public.atrio_clients ac
  where ac.id = new.atrio_client_id;

  if v_atrio_user_id is null then
    raise exception 'Cliente Atrio no encontrado';
  end if;

  if v_landing_user_id <> v_atrio_user_id then
    raise exception 'Cliente Atrio pertenece a otro usuario';
  end if;

  if coalesce(v_landing_workspace, 'ARS') <> coalesce(v_atrio_workspace, 'ARS') then
    raise exception 'Cliente Atrio pertenece a otro workspace';
  end if;

  new.user_id := v_landing_user_id;
  new.weight := greatest(0, coalesce(new.weight, 1));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists landings_atrio_clients_owner
  on public.landings_atrio_clients;

create trigger landings_atrio_clients_owner
before insert or update on public.landings_atrio_clients
for each row execute function public.set_landings_atrio_clients_owner();

alter table public.landings_atrio_clients enable row level security;

drop policy if exists "Users can manage own landing atrio clients"
  on public.landings_atrio_clients;
create policy "Users can manage own landing atrio clients"
  on public.landings_atrio_clients
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Admins can manage all landing atrio clients"
  on public.landings_atrio_clients;
create policy "Admins can manage all landing atrio clients"
  on public.landings_atrio_clients
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

revoke all on public.landings_atrio_clients from anon, authenticated;
grant select, insert, update, delete on public.landings_atrio_clients to authenticated;

create table if not exists public.atrio_assignment_scope_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('landing')),
  scope_id uuid not null,
  atrio_client_id uuid not null references public.atrio_clients(id) on delete cascade,
  usage_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope_type, scope_id, atrio_client_id)
);

comment on table public.atrio_assignment_scope_metrics is
  'Metricas de reparto de clientes Atrio aisladas por landing/subconjunto.';

comment on column public.atrio_assignment_scope_metrics.usage_count is
  'Contador usado como fuente de verdad para reparto fair dentro del scope.';

create index if not exists atrio_assignment_scope_metrics_user_idx
  on public.atrio_assignment_scope_metrics (user_id, scope_type, scope_id);

alter table public.atrio_assignment_scope_metrics enable row level security;

drop policy if exists "Users can read own atrio assignment scope metrics"
  on public.atrio_assignment_scope_metrics;
create policy "Users can read own atrio assignment scope metrics"
  on public.atrio_assignment_scope_metrics
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can read all atrio assignment scope metrics"
  on public.atrio_assignment_scope_metrics;
create policy "Admins can read all atrio assignment scope metrics"
  on public.atrio_assignment_scope_metrics
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

revoke all on public.atrio_assignment_scope_metrics from anon, authenticated;
grant select on public.atrio_assignment_scope_metrics to authenticated;

create or replace function public.atrio_assignment_scope_usage(
  p_scope_type text,
  p_scope_id uuid,
  p_atrio_client_id uuid default null
)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(sm.usage_count), 0)::bigint
  from public.atrio_assignment_scope_metrics sm
  where sm.scope_type = p_scope_type
    and sm.scope_id = p_scope_id
    and (p_atrio_client_id is null or sm.atrio_client_id = p_atrio_client_id);
$$;

comment on function public.atrio_assignment_scope_usage(text, uuid, uuid) is
  'Devuelve usage_count aislado por scope para seleccionar cliente Atrio en modo fair.';

revoke all on function public.atrio_assignment_scope_usage(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.atrio_assignment_scope_usage(text, uuid, uuid)
  to service_role;

create or replace function public.increment_atrio_assignment_scope_usage(
  p_atrio_client_id uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  select coalesce(p_user_id, ac.user_id)
  into v_user_id
  from public.atrio_clients ac
  where ac.id = p_atrio_client_id
  limit 1;

  if v_user_id is null then
    return;
  end if;

  update public.atrio_clients
  set usage_count = coalesce(usage_count, 0) + 1
  where id = p_atrio_client_id;

  if coalesce(p_scope_type, '') <> 'landing' or p_scope_id is null then
    return;
  end if;

  insert into public.atrio_assignment_scope_metrics (
    user_id,
    scope_type,
    scope_id,
    atrio_client_id,
    usage_count
  )
  values (
    v_user_id,
    p_scope_type,
    p_scope_id,
    p_atrio_client_id,
    1
  )
  on conflict (scope_type, scope_id, atrio_client_id)
  do update set
    usage_count = public.atrio_assignment_scope_metrics.usage_count + 1,
    updated_at = now();
end;
$$;

comment on function public.increment_atrio_assignment_scope_usage(uuid, text, uuid, uuid) is
  'Incrementa el contador global de Atrio y el contador aislado por scope para reparto fair.';

revoke all on function public.increment_atrio_assignment_scope_usage(uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.increment_atrio_assignment_scope_usage(uuid, text, uuid, uuid)
  to service_role;

create or replace function public.get_atrio_for_landing(p_landing_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_landing_id uuid;
  v_landing_name text;
  v_owner_user_id uuid;
  v_workspace text;
  v_config jsonb;
  v_selection_mode text;
  v_fair_criterion text;
  v_total_weight numeric;
  v_random numeric;
  v_atrio_client_id uuid;
  v_atrio_slug text;
  v_atrio_id text;
  v_weight integer;
begin
  select
    l.id,
    l.name,
    l.user_id,
    coalesce(l.workspace_currency, 'ARS'),
    coalesce(l.config, '{}'::jsonb),
    coalesce(l.atrio_selection_mode, 'weighted_random'),
    coalesce(l.atrio_fair_criterion, 'usage_count')
  into
    v_landing_id,
    v_landing_name,
    v_owner_user_id,
    v_workspace,
    v_config,
    v_selection_mode,
    v_fair_criterion
  from public.landings l
  where l.name = trim(p_landing_name)
  limit 1;

  if v_landing_id is null then
    return jsonb_build_object('_status', 'not_found');
  end if;

  if lower(coalesce(v_config->>'ctaDestination', 'whatsapp')) <> 'atrio' then
    return jsonb_build_object('_status', 'not_atrio');
  end if;

  if v_selection_mode = 'fair' then
    select
      c.atrio_client_id,
      c.slug,
      c.atrio_id,
      c.weight
    into v_atrio_client_id, v_atrio_slug, v_atrio_id, v_weight
    from (
      select
        ac.id as atrio_client_id,
        ac.slug,
        ac.atrio_id,
        greatest(0, lac.weight) as weight,
        public.atrio_assignment_scope_usage('landing', v_landing_id, ac.id) as scoped_usage,
        (
          select count(*)::bigint
          from public.conversions cv
          where cv.user_id = v_owner_user_id
            and cv.landing_id = v_landing_id
            and cv.lead_event_id <> ''
            and (
              cv.atrio_client_id = ac.id
              or cv.atrio_id = ac.atrio_id
              or cv.atrio_slug = ac.slug
            )
        ) as lead_count
      from public.landings_atrio_clients lac
      join public.atrio_clients ac on ac.id = lac.atrio_client_id
      where lac.landing_id = v_landing_id
        and lac.user_id = v_owner_user_id
        and ac.user_id = v_owner_user_id
        and ac.workspace_currency = v_workspace
    ) c
    order by
      case
        when v_fair_criterion = 'messages_received' then c.lead_count
        else c.scoped_usage
      end asc,
      random()
    limit 1;
  else
    select coalesce(sum(greatest(0, lac.weight)), 0)::numeric
    into v_total_weight
    from public.landings_atrio_clients lac
    join public.atrio_clients ac on ac.id = lac.atrio_client_id
    where lac.landing_id = v_landing_id
      and lac.user_id = v_owner_user_id
      and ac.user_id = v_owner_user_id
      and ac.workspace_currency = v_workspace;

    if v_total_weight > 0 then
      v_random := random() * v_total_weight;

      select
        c.atrio_client_id,
        c.slug,
        c.atrio_id,
        c.weight
      into v_atrio_client_id, v_atrio_slug, v_atrio_id, v_weight
      from (
        select
          ac.id as atrio_client_id,
          ac.slug,
          ac.atrio_id,
          greatest(0, lac.weight) as weight,
          sum(greatest(0, lac.weight)) over (order by ac.id)::numeric
            - greatest(0, lac.weight)::numeric as cum_start,
          sum(greatest(0, lac.weight)) over (order by ac.id)::numeric as cum_end
        from public.landings_atrio_clients lac
        join public.atrio_clients ac on ac.id = lac.atrio_client_id
        where lac.landing_id = v_landing_id
          and lac.user_id = v_owner_user_id
          and ac.user_id = v_owner_user_id
          and ac.workspace_currency = v_workspace
          and lac.weight > 0
      ) c
      where v_random >= c.cum_start and v_random < c.cum_end
      limit 1;
    end if;
  end if;

  if v_atrio_client_id is null then
    select
      ac.id,
      ac.slug,
      ac.atrio_id,
      1
    into v_atrio_client_id, v_atrio_slug, v_atrio_id, v_weight
    from public.atrio_clients ac
    where ac.user_id = v_owner_user_id
      and ac.workspace_currency = v_workspace
      and (
        ac.id::text = coalesce(v_config->>'atrioClientId', '')
        or ac.atrio_id = coalesce(v_config->>'atrioId', '')
        or ac.slug = coalesce(v_config->>'atrioSlug', '')
      )
    limit 1;
  end if;

  if v_atrio_client_id is null then
    return jsonb_build_object('_status', 'no_atrio_clients');
  end if;

  return jsonb_build_object(
    '_status', 'ok',
    'landingId', v_landing_id,
    'landingName', v_landing_name,
    'selectionMode', v_selection_mode,
    'fairCriterion', v_fair_criterion,
    'atrioClientId', v_atrio_client_id,
    'atrioId', v_atrio_id,
    'atrioSlug', v_atrio_slug,
    'atrioRedirectUrl', 'https://www.atrio.website/' || v_atrio_slug,
    'weight', v_weight
  );
end;
$$;

comment on function public.get_atrio_for_landing(text) is
  'Devuelve el cliente Atrio ganador para una landing, usando asignaciones y metricas aisladas por landing.';

revoke all on function public.get_atrio_for_landing(text)
  from public, anon, authenticated;
grant execute on function public.get_atrio_for_landing(text)
  to service_role;

insert into public.landings_atrio_clients (
  landing_id,
  atrio_client_id,
  user_id,
  weight
)
select
  l.id,
  ac.id,
  l.user_id,
  1
from public.landings l
join public.atrio_clients ac
  on ac.user_id = l.user_id
  and ac.workspace_currency = coalesce(l.workspace_currency, 'ARS')
  and (
    ac.id::text = coalesce(l.config->>'atrioClientId', '')
    or ac.atrio_id = coalesce(l.config->>'atrioId', '')
    or ac.slug = coalesce(l.config->>'atrioSlug', '')
  )
where lower(coalesce(l.config->>'ctaDestination', '')) = 'atrio'
on conflict (landing_id, atrio_client_id) do nothing;
