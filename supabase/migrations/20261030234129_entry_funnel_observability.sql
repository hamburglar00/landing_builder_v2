-- Internal, pseudonymous diagnostics. No user names, credentials, URL queries, IPs or advertising identifiers.
create table public.entry_funnel_events (
  event_id uuid primary key,
  landing_id uuid not null references public.landings(id) on delete cascade,
  owner_id uuid not null,
  flow_id uuid not null,
  template smallint not null check (template in (7, 8)),
  event_name text not null check (event_name in (
    'page_visible','form_visible','name_focus','name_started','name_valid','skin_selected',
    'cta_clicked','destination_ready','account_ready','login_confirmed','gateway_loaded','chat_ready',
    'entry_error','visibility_hidden','resumed'
  )),
  elapsed_ms integer not null check (elapsed_ms between 0 and 86400000),
  provider text check (provider in ('rey_de_ases','ases_del_norte','ganamos_net','multi_skin')),
  skin text check (skin in ('jugamos','ganamos_plus','casino_zeus','bet30','gana_en_casa','celu_apuestas','casino_zeta','oro_puro','fortu_bet','gran_poseidon','kona_bet','mega_faraon','camel_bet','rhino_play')),
  error_code text check (error_code in ('destination_unavailable','account_unavailable','prepare_rejected','prepare_unavailable','login_unavailable','session_unavailable','chat_unavailable','request_timeout','network_error','rate_limited','invalid_entry','unknown')),
  http_status smallint check (http_status between 100 and 599),
  received_at timestamptz not null default now()
);
create index entry_funnel_landing_received_idx on public.entry_funnel_events (landing_id, received_at desc);
create index entry_funnel_owner_received_idx on public.entry_funnel_events (owner_id, received_at desc);
create index entry_funnel_flow_idx on public.entry_funnel_events (landing_id, flow_id, received_at);
create index entry_funnel_retention_idx on public.entry_funnel_events (received_at);
alter table public.entry_funnel_events enable row level security;
revoke all on public.entry_funnel_events from public, anon, authenticated;
grant select, insert, delete on public.entry_funnel_events to service_role;

-- A single compact bucket per landing and minute caps anonymous diagnostics regardless of client-generated IDs.
create table public.entry_funnel_limits (
  landing_id uuid not null references public.landings(id) on delete cascade,
  minute_at timestamptz not null,
  event_count integer not null check (event_count between 0 and 3000),
  primary key (landing_id, minute_at)
);
create index entry_funnel_limits_retention_idx on public.entry_funnel_limits (minute_at);
alter table public.entry_funnel_limits enable row level security;
revoke all on public.entry_funnel_limits from public, anon, authenticated;
grant select, insert, update, delete on public.entry_funnel_limits to service_role;

create or replace function public.record_entry_funnel_events(p_landing_id uuid, p_flow_id uuid, p_template integer, p_events jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid; v_config jsonb; v_event jsonb; v_count integer; v_new_count integer; v_allowed integer;
  v_minute timestamptz := date_trunc('minute', now());
begin
  if p_landing_id is null or p_flow_id is null or p_template not in (7,8) or p_events is null
    or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 20
    or octet_length(p_events::text) > 16384 then return false; end if;
  select l.user_id, l.config into v_owner, v_config from public.landings l where l.id = p_landing_id;
  if v_owner is null or coalesce(v_config->>'template','') <> 'template' || p_template::text then return false; end if;
  -- Reject extra/free-form fields even if an internal caller accidentally adds sensitive data.
  for v_event in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(v_event) <> 'object' or not (v_event ?& array['id','name','elapsed_ms'])
      or exists (select 1 from jsonb_object_keys(v_event) k where k not in ('id','name','elapsed_ms','provider','skin','error_code','status'))
      or jsonb_typeof(v_event->'elapsed_ms') <> 'number' then return false; end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('entry-funnel:' || p_landing_id::text || ':' || p_flow_id::text, 0));
  if exists (select 1 from jsonb_array_elements(p_events) e join public.entry_funnel_events previous
    on previous.event_id = (e->>'id')::uuid
    where previous.landing_id <> p_landing_id or previous.flow_id <> p_flow_id) then return false; end if;
  select count(distinct e->>'id') into v_new_count from jsonb_array_elements(p_events) e
    where not exists (select 1 from public.entry_funnel_events previous where previous.event_id = (e->>'id')::uuid);
  if v_new_count = 0 then return true; end if;
  select count(*) into v_count from public.entry_funnel_events e where e.landing_id = p_landing_id and e.flow_id = p_flow_id;
  if v_count + v_new_count > 200 then return false; end if;
  insert into public.entry_funnel_limits(landing_id,minute_at,event_count)
    values(p_landing_id,v_minute,v_new_count)
    on conflict(landing_id,minute_at) do update
      set event_count = public.entry_funnel_limits.event_count + excluded.event_count
      where public.entry_funnel_limits.event_count + excluded.event_count <= 3000
    returning event_count into v_allowed;
  if v_allowed is null then return false; end if;
  insert into public.entry_funnel_events(event_id,landing_id,owner_id,flow_id,template,event_name,elapsed_ms,provider,skin,error_code,http_status)
    select (e->>'id')::uuid,p_landing_id,v_owner,p_flow_id,p_template,e->>'name',(e->>'elapsed_ms')::integer,
      e->>'provider',e->>'skin',e->>'error_code',(e->>'status')::smallint
    from jsonb_array_elements(p_events) e
    on conflict(event_id) do nothing;
  return true;
end;
$$;
revoke all on function public.record_entry_funnel_events(uuid,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.record_entry_funnel_events(uuid,uuid,integer,jsonb) to service_role;

-- Run out of the write path. Each call is bounded; no production rows are deleted by this migration.
create or replace function public.purge_entry_funnel_events()
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_deleted integer;
begin
  delete from public.entry_funnel_events where event_id in (
    select event_id from public.entry_funnel_events where received_at < now() - interval '90 days'
    order by received_at limit 10000
  );
  get diagnostics v_deleted = row_count;
  delete from public.entry_funnel_limits where (landing_id,minute_at) in (
    select landing_id,minute_at from public.entry_funnel_limits where minute_at < now() - interval '2 days'
    order by minute_at limit 10000
  );
  return v_deleted;
end;
$$;
revoke all on function public.purge_entry_funnel_events() from public, anon, authenticated;
grant execute on function public.purge_entry_funnel_events() to service_role;
do $$
begin
  if to_regnamespace('cron') is not null then
    execute $schedule$select cron.schedule('entry-funnel-retention', '17 * * * *', 'select public.purge_entry_funnel_events();')$schedule$;
  end if;
end;
$$;
