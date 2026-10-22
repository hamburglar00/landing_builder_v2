alter table public.landing_card_clicks add column target_provider text, add column card_label text;

alter table public.client_template_permissions add column template8_enabled boolean not null default false;
create policy "Template 8 permission on landing insert"
on public.landings as restrictive
for insert to authenticated
with check (
  (
    coalesce(config ->> 'template', '') <> 'template8'
    and coalesce(landing_config #>> '{layout,template}', '') <> '8'
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
  or exists (
    select 1 from public.client_template_permissions permission
    where permission.user_id = landings.user_id
      and permission.template8_enabled
  )
);

create policy "Template 8 permission on landing update"
on public.landings as restrictive
for update to authenticated
using (true)
with check (
  (
    coalesce(config ->> 'template', '') <> 'template8'
    and coalesce(landing_config #>> '{layout,template}', '') <> '8'
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
  or exists (
    select 1 from public.client_template_permissions permission
    where permission.user_id = landings.user_id
      and permission.template8_enabled
  )
);

-- Read the public landing's trusted selection scope in one database request.
-- No account, conversation, assignment, rate limit, or counter is written here.
create or replace function public.resolve_template7_destination_context(
  p_landing_id uuid,
  p_landing_slug text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_landing public.landings%rowtype;
  v_landing_json jsonb;
  v_blocked boolean;
  v_advisors jsonb;
begin
  if p_landing_id is null
     or p_landing_slug is null
     or p_landing_slug !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$' then
    return jsonb_build_object('landing', null, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  select l.* into v_landing
  from public.landings as l
  where l.id = p_landing_id and l.name = p_landing_slug;

  if not found then
    return jsonb_build_object('landing', null, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  v_landing_json := jsonb_build_object(
    'id', v_landing.id,
    'name', v_landing.name,
    'user_id', v_landing.user_id,
    'workspace_currency', v_landing.workspace_currency,
    'config', v_landing.config
  );

  -- The HTTP handler keeps its exact template/provider validation and errors.
  -- Invalid templates never need an advisor-directory read.
  if coalesce(v_landing.config ->> 'template','') not in ('template7','template8')
     or v_landing.config ->> 'ctaDestination' is distinct from 'atrio' then
    return jsonb_build_object('landing', v_landing_json, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  -- Preserve the existing subscription guard, including fail-closed NULL.
  v_blocked := public.is_client_access_blocked(v_landing.user_id) is distinct from false;
  if v_blocked then
    return jsonb_build_object('landing', v_landing_json, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'atrio_id', a.atrio_id,
    'slug', a.slug,
    'user_id', a.user_id,
    'workspace_currency', a.workspace_currency
  ) order by a.id), '[]'::jsonb)
  into v_advisors
  from public.atrio_clients as a
  where a.user_id = v_landing.user_id
    and a.workspace_currency = v_landing.workspace_currency;

  return jsonb_build_object('landing', v_landing_json, 'blocked', false, 'advisors', v_advisors);
end;
$$;

revoke all on function public.resolve_template7_destination_context(uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_template7_destination_context(uuid, text)
  to service_role;

comment on function public.resolve_template7_destination_context(uuid, text) is
  'Internal read-only Template 7 context: exact landing, subscription status and owner/workspace Atrio advisors in one request. No account or assignment creation.';

create or replace function public.resolve_template8_start_context(
  p_landing_id uuid,
  p_landing_slug text,
  p_atrio_client_id uuid,
  p_advisor_id text,
  p_advisor_slug text,
  p_global_bucket_key text,
  p_start_bucket_key text,
  p_unbound_bucket_key text,
  p_card_index integer
)
returns table (
  status text,
  landing_id uuid,
  landing_name text,
  owner_user_id uuid,
  workspace_currency text,
  landing_config_raw jsonb,
  landing_config_published jsonb,
  target_provider text,
  atrio_client_id uuid,
  advisor_id text,
  advisor_slug text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_landing public.landings%rowtype;
  v_advisor public.atrio_clients%rowtype;
  v_provider text;
begin
  if p_landing_slug is null or length(p_landing_slug) > 160
     or p_advisor_id is null or length(p_advisor_id) > 80
     or p_advisor_slug is null or length(p_advisor_slug) > 81 then
    raise exception 'invalid template 7 start context';
  end if;

  select l.* into v_landing
  from public.landings as l
  where l.id = p_landing_id
    and l.name = p_landing_slug;

  if not found
     or not (
       (v_landing.config ->> 'template' = 'template8'
        or v_landing.landing_config #>> '{layout,template}' = '8')
       and v_landing.config ->> 'ctaDestination' = 'atrio'
     ) then
    return query select
      'landing_not_found'::text, null::uuid, null::text, null::uuid,
      null::text, null::jsonb, null::jsonb, null::text, null::uuid,
      null::text, null::text;
    return;
  end if;

  if p_card_index is null or p_card_index < 1 or p_card_index > 6
     or coalesce(v_landing.config #>> '{template8Cover,cardCount}','') !~ '^[1-6]$'
     or p_card_index > (v_landing.config #>> '{template8Cover,cardCount}')::integer then
    raise exception 'Invalid page selection';
  end if;
  v_provider := v_landing.config #>> array['template8Cover','cards',(p_card_index-1)::text,'targetProvider'];
  if v_provider is null or v_provider not in ('rey_de_ases', 'ases_del_norte', 'ganamos_net') then
    return query select
      'integration_pending'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, null::text, null::uuid, null::text, null::text;
    return;
  end if;

  if public.is_client_access_blocked(v_landing.user_id) then
    return query select
      'landing_unavailable'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  if not public.consume_template7_rate_limit(p_global_bucket_key, 120, 60) then
    return query select
      'rate_limited'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  if p_unbound_bucket_key is not null
     and not public.consume_template7_rate_limit(p_unbound_bucket_key, 1, 45) then
    return query select
      'rate_limited'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  if not public.consume_template7_rate_limit(encode(sha256(convert_to(p_start_bucket_key || ':' || v_provider,'UTF8')),'hex'), 1, 45) then
    return query select
      'rate_limited'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  select a.* into v_advisor
  from public.landings_atrio_clients as la
  join public.atrio_clients as a
    on a.id = la.atrio_client_id
  where la.landing_id = v_landing.id
    and la.atrio_client_id = p_atrio_client_id
    and la.user_id = v_landing.user_id
    and a.user_id = v_landing.user_id
    and a.workspace_currency = v_landing.workspace_currency
    and a.atrio_id = p_advisor_id
    and a.slug = p_advisor_slug;

  if not found then
    return query select
      'advisor_not_assigned'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  return query select
    'ok'::text, v_landing.id, v_landing.name, v_landing.user_id,
    v_landing.workspace_currency, v_landing.config, v_landing.landing_config,
    v_provider, v_advisor.id, v_advisor.atrio_id, v_advisor.slug;
end;
$$;

revoke all on function public.resolve_template8_start_context(
  uuid, text, uuid, text, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.resolve_template8_start_context(
  uuid, text, uuid, text, text, text, text, text, integer
) to service_role;

comment on function public.resolve_template8_start_context(
  uuid, text, uuid, text, text, text, text, text, integer
) is 'Validates a Template 7 start, consumes its durable rate limits and resolves the assigned Atrio advisor in one transaction.';

-- End migration.

create or replace function public.record_template6_card_click(
  p_landing_id uuid,
  p_card_index integer,
  p_event_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config jsonb;
  v_card_count integer;
begin
  if p_landing_id is null or p_card_index is null or p_event_id is null then
    return false;
  end if;

  select l.config into v_config
  from public.landings l
  where l.id = p_landing_id
  for share;

  if not found or coalesce(v_config->>'template','') not in ('template6','template8') then
    return false;
  end if;

  v_card_count := case when v_config->>'template'='template8' then least(6,greatest(1,(v_config #>> '{template8Cover,cardCount}')::integer)) else case v_config->'template6Cover'->>'grid'
    when '2x1' then 2
    when '2x3' then 6
    else 4
  end end;
  if p_card_index < 1 or p_card_index > v_card_count then
    return false;
  end if;

  insert into public.landing_card_clicks (landing_id, card_index, event_id, target_provider, card_label)
  values (p_landing_id, p_card_index, p_event_id,
    case when v_config->>'template'='template8' then v_config #>> array['template8Cover','cards',(p_card_index-1)::text,'targetProvider'] end,
    case when v_config->>'template'='template8' then v_config #>> array['template8Cover','cards',(p_card_index-1)::text,'text'] end)
  on conflict (landing_id, event_id) do nothing;

  return true;
end;
$$;

revoke all on function public.record_template6_card_click(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.record_template6_card_click(uuid, integer, uuid) to service_role;

-- Inclusive calendar dates in Buenos Aires, with counts computed in SQL.
create or replace function public.get_template6_card_analytics(
  p_landing_id uuid,
  p_from date,
  p_to date
)
returns table (card_index integer, clicks bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.card_index::integer, count(*)::bigint
  from public.landings l
  join public.landing_card_clicks c on c.landing_id = l.id
  where l.id = p_landing_id
    and l.config->>'template' in ('template6','template8')
    and p_from is not null
    and p_to is not null
    and p_from <= p_to
    and c.clicked_at >= greatest(
      p_from::timestamp at time zone 'America/Argentina/Buenos_Aires',
      coalesce(l.card_analytics_reset_at, '-infinity'::timestamptz)
    )
    and c.clicked_at < (p_to + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'
  group by c.card_index
  order by c.card_index;
$$;

revoke all on function public.get_template6_card_analytics(uuid, date, date) from public, anon;
grant execute on function public.get_template6_card_analytics(uuid, date, date) to authenticated;

create or replace function public.reset_template6_card_analytics(p_landing_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reset_at timestamptz;
begin
  update public.landings l
  set card_analytics_reset_at = clock_timestamp()
  where l.id = p_landing_id
    and l.config->>'template' in ('template6','template8')
  returning l.card_analytics_reset_at into v_reset_at;

  if not found then
    raise exception 'Landing no disponible para reiniciar las analíticas';
  end if;
  return v_reset_at;
end;
$$;

revoke all on function public.reset_template6_card_analytics(uuid) from public, anon;
grant execute on function public.reset_template6_card_analytics(uuid) to authenticated;

-- Template 8 prepares up to six distinct pages. Its device bucket is separate
-- from Template 7; account creation keeps the existing durable start limits.
-- One service-only request preserves the existing IP/device quotas and reads
-- the already-hardened owner/workspace context. No account or assignment writes.
create or replace function public.resolve_template8_limited_destination_context(
  p_landing_id uuid,
  p_landing_slug text,
  p_ip_bucket_key text,
  p_device_bucket_key text,
  p_consume_device_on_ip_denial boolean default true
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_ip_allowed boolean;
  v_device_allowed boolean := false;
begin
  if p_ip_bucket_key is null or p_device_bucket_key is null
     or p_ip_bucket_key !~ '^[0-9a-f]{64}$'
     or p_device_bucket_key !~ '^[0-9a-f]{64}$'
     or p_ip_bucket_key = p_device_bucket_key
     or p_consume_device_on_ip_denial is null then
    raise exception 'invalid destination rate limit keys';
  end if;

  -- Keep the exact existing 60/IP/minute and 24/device/minute buckets.
  -- Consume in a consistent lock order to avoid cross-device deadlocks.
  v_ip_allowed := public.consume_template7_rate_limit(p_ip_bucket_key, 60, 60);
  -- Constructor previously consumed both in parallel; classic short-circuited
  -- the device bucket when IP was denied. Preserve both established behaviors.
  if p_consume_device_on_ip_denial or v_ip_allowed is true then
    v_device_allowed := public.consume_template7_rate_limit(p_device_bucket_key, 24, 60);
  end if;
  if v_ip_allowed is distinct from true or v_device_allowed is distinct from true then
    return jsonb_build_object('allowed', false, 'landing', null, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  return public.resolve_template7_destination_context(p_landing_id, p_landing_slug)
    || jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.resolve_template8_limited_destination_context(uuid, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.resolve_template8_limited_destination_context(uuid, text, text, text, boolean)
  to service_role;

comment on function public.resolve_template8_limited_destination_context(uuid, text, text, text, boolean) is
  'Internal Template 7 destination scope: consumes the server-HMAC IP/device warm quotas and reads trusted landing context in one database request.';
