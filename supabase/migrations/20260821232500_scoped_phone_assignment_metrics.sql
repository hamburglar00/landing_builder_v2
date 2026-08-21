set statement_timeout = '10min';

create table if not exists public.phone_assignment_scope_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('landing', 'chatrace', 'whatsapp_cloud_api')),
  scope_id uuid not null,
  gerencia_id integer not null references public.gerencias(id) on delete cascade,
  phone_id bigint not null references public.gerencia_phones(id) on delete cascade,
  usage_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope_type, scope_id, gerencia_id, phone_id)
);

comment on table public.phone_assignment_scope_metrics is
  'Metricas de reparto de telefonos aisladas por subconjunto: landing, Chatrace o WhatsApp Cloud API.';

comment on column public.phone_assignment_scope_metrics.usage_count is
  'Contador usado como fuente de verdad para reparto fair dentro del scope. gerencia_phones.usage_count queda como metrica global.';

create index if not exists phone_assignment_scope_metrics_user_idx
  on public.phone_assignment_scope_metrics (user_id, scope_type, scope_id);

create index if not exists phone_assignment_scope_metrics_lookup_idx
  on public.phone_assignment_scope_metrics (scope_type, scope_id, gerencia_id, phone_id);

alter table public.phone_assignment_scope_metrics enable row level security;

drop policy if exists "Users can read own phone assignment scope metrics"
  on public.phone_assignment_scope_metrics;
create policy "Users can read own phone assignment scope metrics"
  on public.phone_assignment_scope_metrics
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can read all phone assignment scope metrics"
  on public.phone_assignment_scope_metrics;
create policy "Admins can read all phone assignment scope metrics"
  on public.phone_assignment_scope_metrics
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

revoke all on public.phone_assignment_scope_metrics from anon, authenticated;
grant select on public.phone_assignment_scope_metrics to authenticated;

create or replace function public.phone_assignment_scope_usage(
  p_scope_type text,
  p_scope_id uuid,
  p_gerencia_id integer,
  p_phone_kind text,
  p_phone_id bigint default null
)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(sm.usage_count), 0)::bigint
  from public.phone_assignment_scope_metrics sm
  join public.gerencia_phones gp on gp.id = sm.phone_id
  where sm.scope_type = p_scope_type
    and sm.scope_id = p_scope_id
    and sm.gerencia_id = p_gerencia_id
    and gp.kind = p_phone_kind
    and gp.assignment_role = 'acquisition'
    and (p_phone_id is null or sm.phone_id = p_phone_id);
$$;

comment on function public.phone_assignment_scope_usage(text, uuid, integer, text, bigint) is
  'Devuelve usage_count aislado por scope para seleccionar gerencia/telefono en modo fair.';

revoke all on function public.phone_assignment_scope_usage(text, uuid, integer, text, bigint)
  from public, anon, authenticated;
grant execute on function public.phone_assignment_scope_usage(text, uuid, integer, text, bigint)
  to service_role;

create or replace function public.increment_phone_assignment_scope_usage(
  p_phone_id bigint,
  p_scope_type text,
  p_scope_id uuid,
  p_user_id uuid default null,
  p_gerencia_id integer default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_gerencia_id integer;
begin
  select coalesce(p_user_id, g.user_id), coalesce(p_gerencia_id, gp.gerencia_id)
  into v_user_id, v_gerencia_id
  from public.gerencia_phones gp
  join public.gerencias g on g.id = gp.gerencia_id
  where gp.id = p_phone_id
  limit 1;

  if v_user_id is null or v_gerencia_id is null then
    return;
  end if;

  update public.gerencia_phones
  set usage_count = coalesce(usage_count, 0) + 1
  where id = p_phone_id;

  if coalesce(p_scope_type, '') not in ('landing', 'chatrace', 'whatsapp_cloud_api')
     or p_scope_id is null then
    return;
  end if;

  insert into public.phone_assignment_scope_metrics (
    user_id,
    scope_type,
    scope_id,
    gerencia_id,
    phone_id,
    usage_count
  )
  values (
    v_user_id,
    p_scope_type,
    p_scope_id,
    v_gerencia_id,
    p_phone_id,
    1
  )
  on conflict (scope_type, scope_id, gerencia_id, phone_id)
  do update set
    usage_count = public.phone_assignment_scope_metrics.usage_count + 1,
    updated_at = now();
end;
$$;

comment on function public.increment_phone_assignment_scope_usage(bigint, text, uuid, uuid, integer) is
  'Incrementa el contador global de telefonos y el contador aislado por scope para reparto fair.';

revoke all on function public.increment_phone_assignment_scope_usage(bigint, text, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.increment_phone_assignment_scope_usage(bigint, text, uuid, uuid, integer)
  to service_role;

do $$
declare
  v_ddl text;
  v_next text;
begin
  select pg_get_functiondef('public.get_phone_for_landing(text)'::regprocedure)
  into v_ddl;

  if v_ddl is null then
    raise exception 'Function public.get_phone_for_landing(text) was not found';
  end if;

  v_next := v_ddl;

  v_next := regexp_replace(
    v_next,
    'select[[:space:]]+coalesce\(sum\(gp\.usage_count\), 0\)::bigint as metric[[:space:]]+from[[:space:]]+(public\.)?gerencia_phones gp[[:space:]]+where gp\.gerencia_id = p\.gerencia_id[[:space:]]+and gp\.kind = p\.phone_kind[[:space:]]+and gp\.assignment_role = ''acquisition''',
    'select public.phone_assignment_scope_usage(''landing'', v_landing_id, p.gerencia_id, p.phone_kind, null) as metric',
    'g'
  );

  v_next := replace(
    v_next,
    'where c.user_id = p.owner_user_id
            and c.lead_event_id <> ''''',
    'where c.user_id = p.owner_user_id
            and c.landing_id = v_landing_id
            and c.lead_event_id <> '''''
  );

  v_next := replace(
    v_next,
    'where c.user_id = v_owner_user_id
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> ''''',
    'where c.user_id = v_owner_user_id
            and c.landing_id = v_landing_id
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> '''''
  );

  v_next := replace(
    v_next,
    'order by gp.usage_count asc, random()',
    'order by public.phone_assignment_scope_usage(''landing'', v_landing_id, v_gerencia_id, v_phone_kind, gp.id) asc, random()'
  );

  execute v_next;
end $$;

do $$
declare
  v_ddl text;
  v_next text;
begin
  select pg_get_functiondef('public.get_phone_for_chatrace_client(text)'::regprocedure)
  into v_ddl;

  if v_ddl is null then
    raise exception 'Function public.get_phone_for_chatrace_client(text) was not found';
  end if;

  v_next := v_ddl;

  v_next := regexp_replace(
    v_next,
    'select[[:space:]]+coalesce\(sum\(gp\.usage_count\), 0\)::bigint as metric[[:space:]]+from[[:space:]]+(public\.)?gerencia_phones gp[[:space:]]+where gp\.gerencia_id = p\.gerencia_id[[:space:]]+and gp\.kind = p\.phone_kind[[:space:]]+and gp\.assignment_role = ''acquisition''',
    'select public.phone_assignment_scope_usage(''chatrace'', v_user_id, p.gerencia_id, p.phone_kind, null) as metric',
    'g'
  );

  v_next := replace(
    v_next,
    'where c.user_id = p.owner_user_id
            and c.lead_event_id <> ''''',
    'where c.user_id = p.owner_user_id
            and lower(coalesce(c.source_platform, '''')) = ''chatrace''
            and c.lead_event_id <> '''''
  );

  v_next := replace(
    v_next,
    'where c.user_id = v_owner_user_id
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> ''''',
    'where c.user_id = v_owner_user_id
            and lower(coalesce(c.source_platform, '''')) = ''chatrace''
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> '''''
  );

  v_next := replace(
    v_next,
    'order by gp.usage_count asc, random()',
    'order by public.phone_assignment_scope_usage(''chatrace'', v_user_id, v_gerencia_id, v_phone_kind, gp.id) asc, random()'
  );

  execute v_next;
end $$;

do $$
declare
  v_ddl text;
  v_next text;
begin
  select pg_get_functiondef('public.get_phone_for_whatsapp_cloud_api(uuid)'::regprocedure)
  into v_ddl;

  if v_ddl is null then
    raise exception 'Function public.get_phone_for_whatsapp_cloud_api(uuid) was not found';
  end if;

  v_next := v_ddl;

  v_next := regexp_replace(
    v_next,
    'select[[:space:]]+coalesce\(sum\(gp\.usage_count\), 0\)::bigint as metric[[:space:]]+from[[:space:]]+(public\.)?gerencia_phones gp[[:space:]]+where gp\.gerencia_id = p\.gerencia_id[[:space:]]+and gp\.kind = p\.phone_kind[[:space:]]+and gp\.assignment_role = ''acquisition''',
    'select public.phone_assignment_scope_usage(''whatsapp_cloud_api'', v_config.id, p.gerencia_id, p.phone_kind, null) as metric',
    'g'
  );

  v_next := replace(
    v_next,
    'where c.user_id = p.owner_user_id
            and c.lead_event_id <> ''''',
    'where c.user_id = p.owner_user_id
            and lower(coalesce(c.source_platform, '''')) = ''whatsapp_cloud_api''
            and (
              exists (
                select 1
                from public.whatsapp_cloud_api_assignments a
                where a.config_id = v_config.id
                  and a.conversion_id = c.id
              )
              or c.event_source_url = ''whatsapp-cloud-api://'' || coalesce(v_config.phone_number_id, '''')
            )
            and c.lead_event_id <> '''''
  );

  v_next := replace(
    v_next,
    'where c.user_id = v_owner_user_id
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> ''''',
    'where c.user_id = v_owner_user_id
            and lower(coalesce(c.source_platform, '''')) = ''whatsapp_cloud_api''
            and (
              exists (
                select 1
                from public.whatsapp_cloud_api_assignments a
                where a.config_id = v_config.id
                  and a.conversion_id = c.id
              )
              or c.event_source_url = ''whatsapp-cloud-api://'' || coalesce(v_config.phone_number_id, '''')
            )
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> '''''
  );

  v_next := replace(
    v_next,
    'order by gp.usage_count asc, random()',
    'order by public.phone_assignment_scope_usage(''whatsapp_cloud_api'', v_config.id, v_gerencia_id, v_phone_kind, gp.id) asc, random()'
  );

  execute v_next;
end $$;
