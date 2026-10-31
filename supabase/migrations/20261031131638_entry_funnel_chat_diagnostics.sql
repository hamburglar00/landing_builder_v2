-- Add bounded diagnostics only; authentication, ownership, retention and Contact are unchanged.
alter table public.entry_funnel_events drop constraint entry_funnel_events_event_name_check;
alter table public.entry_funnel_events add constraint entry_funnel_events_event_name_check check (event_name in (
 'page_visible','form_visible','name_focus','name_started','name_valid','skin_selected','cta_clicked',
 'destination_ready','account_ready','login_confirmed','gateway_loaded','iframe_loaded',
 'chat_bootstrap_ready','welcome_ready','wallet_ready','chat_ready','entry_error','visibility_hidden','resumed'
));
alter table public.entry_funnel_events
 add column error_stage text check (error_stage in ('runtime','destination','account','login','session','chat_iframe','chat_bootstrap','welcome','wallet','chat')),
 add column duration_ms integer check (duration_ms between 0 and 86400000);
comment on column public.entry_funnel_events.duration_ms is 'Duration of the observed operation only; elapsed_ms remains time from flow start. Bootstrap and welcome can overlap.';

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
      or exists (select 1 from jsonb_object_keys(v_event) k where k not in ('id','name','elapsed_ms','provider','skin','error_code','status','error_stage','duration_ms'))
      or jsonb_typeof(v_event->'elapsed_ms') <> 'number'
      or (v_event ? 'duration_ms' and (jsonb_typeof(v_event->'duration_ms') <> 'number' or (v_event->>'duration_ms') !~ '^[0-9]+$' or (v_event->>'duration_ms')::numeric > 86400000))
      or (v_event ? 'error_stage' and (jsonb_typeof(v_event->'error_stage') <> 'string' or v_event->>'error_stage' not in ('runtime','destination','account','login','session','chat_iframe','chat_bootstrap','welcome','wallet','chat'))) then return false; end if;
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
  insert into public.entry_funnel_events(event_id,landing_id,owner_id,flow_id,template,event_name,elapsed_ms,provider,skin,error_code,http_status,error_stage,duration_ms)
    select (e->>'id')::uuid,p_landing_id,v_owner,p_flow_id,p_template,e->>'name',(e->>'elapsed_ms')::integer,
      e->>'provider',e->>'skin',e->>'error_code',(e->>'status')::smallint,e->>'error_stage',(e->>'duration_ms')::integer
    from jsonb_array_elements(p_events) e
    on conflict(event_id) do nothing;
  return true;
end;
$$;
revoke all on function public.record_entry_funnel_events(uuid,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.record_entry_funnel_events(uuid,uuid,integer,jsonb) to service_role;

