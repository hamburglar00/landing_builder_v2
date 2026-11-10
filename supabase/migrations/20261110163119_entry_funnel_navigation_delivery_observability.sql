-- Additive diagnostics only. Apply before producers; historical NULL remains unknown.
-- No backfill, business identifiers, URLs, tokens or profile fields. Existing RLS/retention stays unchanged.
alter table public.entry_funnel_events
  add column navigation_id uuid,
  add column navigation_elapsed_ms integer check(navigation_elapsed_ms between 0 and 86400000),
  add column request_id uuid,
  add column component text check(component in ('landing','gateway','chat')),
  add column component_release text check(component_release ~ '^[0-9a-f]{7,40}$'),
  add column phone_readiness text check(phone_readiness in ('ready','pending','failed','unknown')),
  add column phone_outcome text check(phone_outcome in ('ready','empty','http_error','network_error','invalid_response','legacy_unknown','unconfigured','timeout')),
  add column wallet_outcome text check(wallet_outcome in ('available','not_applicable','unavailable','error')),
  add column loss_reason text check(loss_reason in ('overflow','invalid_batch','context_mismatch','rate_limited','collector_rejected','delivery_failed')),
  add column loss_count integer check(loss_count between 1 and 10000);
alter table public.entry_funnel_events drop constraint entry_funnel_events_event_name_check;
alter table public.entry_funnel_events add constraint entry_funnel_events_event_name_check check(event_name in ('navigation_started','phone_at_click','phone_wait_completed','wallet_result','welcome_visible','wallet_visible','telemetry_loss','page_visible','form_visible','name_focus','name_started','name_valid','skin_selected','cta_clicked','destination_ready','account_ready','login_confirmed','gateway_loaded','iframe_loaded','chat_bootstrap_ready','welcome_ready','wallet_ready','chat_usable','chat_ready','entry_error','visibility_hidden','resumed','stage_timing','casino_account_ready','entry_retry','attempt_started','cta_available','outbound_requested'));
alter table public.entry_funnel_events drop constraint entry_funnel_events_phase_check;
alter table public.entry_funnel_events add constraint entry_funnel_events_phase_check check(phase in ('phone_owner','phone_plan','phone_cache','phone_select','phone_total','landing_dns','landing_connect','landing_tls','landing_ttfb','landing_download','landing_navigation','gateway_dns','gateway_connect','gateway_tls','gateway_ttfb','gateway_download','gateway_navigation','casino_ttfb','casino_download','casino_navigation','preparation_dns','preparation_connect','preparation_tls','preparation_ttfb','preparation_download','preparation_navigation','destination_scope','destination_resolve','destination_fallback','destination_total','identity_bootstrap','builder_context','atrio_identity','casino_account','atrio_link','gateway_handoff','entry_finalize','entry_total','account_lookup','provider_create','provider_verify','account_finalize','provider_login','session_confirm','landing_dom','landing_load','landing_fcp','landing_lcp','landing_blocked','landing_runtime','gateway_dom','gateway_load','gateway_fcp','gateway_lcp','gateway_blocked','gateway_runtime','preparation_dom','preparation_load','preparation_fcp','preparation_lcp','preparation_blocked','preparation_runtime','identity_request','destination_request','account_request','prepare_request','login_request','session_request','chat_session_request','chat_dns','chat_connect','chat_tls','chat_ttfb','chat_download','chat_navigation','chat_dom','chat_load','chat_fcp','chat_hydration','chat_visible_to_usable'));
comment on column public.entry_funnel_events.navigation_id is 'Diagnostic document/activation UUID. Changes on reload and BFCache; flow_id may remain for 24h.';
comment on column public.entry_funnel_events.component_release is 'Build SHA of the emitting landing/gateway/chat; legacy release remains the landing SHA. NULL means unknown.';
comment on column public.entry_funnel_events.wallet_outcome is 'Closed logical outcome, separate from wallet_visible paint milestone. No bank data.';
comment on column public.entry_funnel_events.loss_count is 'Bounded affected queue events or delivery incidents, not a count of customers or proven permanent loss.';
create or replace function public.record_entry_funnel_events(p_landing_id uuid, p_flow_id uuid, p_template integer, p_events jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid; v_config jsonb; v_event jsonb; v_count integer; v_new_count integer; v_allowed integer;
  v_minute timestamptz := date_trunc('minute', now());
begin
  if p_landing_id is null or p_flow_id is null or p_template not in (1,2,3,4,5,6,7,8,9) or p_events is null
    or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 20
    or octet_length(p_events::text) > 16384 then return false; end if;
  select l.user_id, l.config into v_owner, v_config from public.landings l where l.id = p_landing_id;
  if v_owner is null or coalesce(nullif(v_config->>'template',''),'template1') <> 'template' || p_template::text then return false; end if;
  -- Reject extra/free-form fields even if an internal caller accidentally adds sensitive data.
  for v_event in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(v_event) <> 'object' or not (v_event ?& array['id','name','elapsed_ms'])
      or exists (select 1 from jsonb_object_keys(v_event) k where k not in ('id','name','elapsed_ms','provider','skin','error_code','status','error_stage','duration_ms','attempt_id','attempt_number','account_kind','phase','engine','release','environment','source','entry_strategy','navigation_id','navigation_elapsed_ms','request_id','component','component_release','phone_readiness','phone_outcome','wallet_outcome','loss_reason','loss_count'))
      or (v_event ? 'id' and (jsonb_typeof(v_event->'id') <> 'string' or v_event->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'))
      or (v_event ? 'navigation_id' and (jsonb_typeof(v_event->'navigation_id') <> 'string' or v_event->>'navigation_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'))
      or (v_event ? 'request_id' and (jsonb_typeof(v_event->'request_id') <> 'string' or v_event->>'request_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'))
      or (v_event ? 'component' and (jsonb_typeof(v_event->'component') <> 'string' or v_event->>'component' not in ('landing','gateway','chat')))
      or (v_event ? 'phone_readiness' and (jsonb_typeof(v_event->'phone_readiness') <> 'string' or v_event->>'phone_readiness' not in ('ready','pending','failed','unknown')))
      or (v_event ? 'phone_outcome' and (jsonb_typeof(v_event->'phone_outcome') <> 'string' or v_event->>'phone_outcome' not in ('ready','empty','http_error','network_error','invalid_response','legacy_unknown','unconfigured','timeout')))
      or (v_event ? 'wallet_outcome' and (jsonb_typeof(v_event->'wallet_outcome') <> 'string' or v_event->>'wallet_outcome' not in ('available','not_applicable','unavailable','error')))
      or (v_event ? 'loss_reason' and (jsonb_typeof(v_event->'loss_reason') <> 'string' or v_event->>'loss_reason' not in ('overflow','invalid_batch','context_mismatch','rate_limited','collector_rejected','delivery_failed')))
      or (v_event ? 'component_release' and (jsonb_typeof(v_event->'component_release') <> 'string' or v_event->>'component_release' !~ '^[0-9a-f]{7,40}$'))
      or (v_event ? 'navigation_elapsed_ms' and (jsonb_typeof(v_event->'navigation_elapsed_ms') <> 'number' or v_event->>'navigation_elapsed_ms' !~ '^[0-9]+$' or (v_event->>'navigation_elapsed_ms')::numeric not between 0 and 86400000))
      or (v_event ? 'loss_count' and (jsonb_typeof(v_event->'loss_count') <> 'number' or v_event->>'loss_count' !~ '^[0-9]+$' or (v_event->>'loss_count')::numeric not between 1 and 10000))
      or (v_event->>'name' = 'wallet_result' and not (v_event ? 'wallet_outcome'))
      or (v_event->>'name' = 'telemetry_loss' and not (v_event ?& array['loss_reason','loss_count']))
      or (v_event ? 'engine' and (jsonb_typeof(v_event->'engine') <> 'string' or v_event->>'engine' not in ('classic','constructor','nexobet')))
      or (v_event ? 'release' and (jsonb_typeof(v_event->'release') <> 'string' or v_event->>'release' !~ '^[0-9a-f]{7,40}$'))
      or (v_event ? 'environment' and (jsonb_typeof(v_event->'environment') <> 'string' or v_event->>'environment' not in ('production','preview','development','unknown')))
      or (v_event ? 'source' and (jsonb_typeof(v_event->'source') <> 'string' or v_event->>'source' not in ('synthetic','unknown')))
      or (v_event ? 'entry_strategy' and (jsonb_typeof(v_event->'entry_strategy') <> 'string' or v_event->>'entry_strategy' not in ('sequential','combined_login')))
      or ((v_event ? 'attempt_id') <> (v_event ? 'attempt_number'))
      or (v_event ? 'attempt_id' and (jsonb_typeof(v_event->'attempt_id') <> 'string' or
        (v_event->>'attempt_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or
        jsonb_typeof(v_event->'attempt_number') <> 'number' or (v_event->>'attempt_number') !~ '^[0-9]+$' or
        (v_event->>'attempt_number')::numeric not between 1 and 1000))
      or (v_event ? 'account_kind' and (jsonb_typeof(v_event->'account_kind') <> 'string' or v_event->>'account_kind' not in ('new','existing')))
      or (v_event->>'name' = 'stage_timing' and (not (v_event ?& array['phase','duration_ms']) or
        jsonb_typeof(v_event->'phase') <> 'string' or v_event->>'phase' not in ('landing_dns','landing_connect','landing_tls','landing_ttfb','landing_download','landing_navigation','gateway_dns','gateway_connect','gateway_tls','gateway_ttfb','gateway_download','gateway_navigation','casino_ttfb','casino_download','casino_navigation','preparation_dns','preparation_connect','preparation_tls','preparation_ttfb','preparation_download','preparation_navigation','destination_scope','destination_resolve','destination_fallback','destination_total','identity_bootstrap','builder_context','atrio_identity','casino_account','atrio_link','gateway_handoff','entry_finalize','entry_total','account_lookup','provider_create','provider_verify','account_finalize','provider_login','session_confirm','landing_dom','landing_load','landing_fcp','landing_lcp','landing_blocked','landing_runtime','gateway_dom','gateway_load','gateway_fcp','gateway_lcp','gateway_blocked','gateway_runtime','preparation_dom','preparation_load','preparation_fcp','preparation_lcp','preparation_blocked','preparation_runtime','identity_request','destination_request','account_request','prepare_request','login_request','session_request','chat_session_request','chat_dns','chat_connect','chat_tls','chat_ttfb','chat_download','chat_navigation','chat_dom','chat_load','chat_fcp','chat_hydration','chat_visible_to_usable','phone_owner','phone_plan','phone_cache','phone_select','phone_total')))
      or (v_event->>'name' <> 'stage_timing' and v_event ? 'phase')
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
  select count(*) into v_count from public.entry_funnel_events e where e.landing_id = p_landing_id and e.flow_id = p_flow_id and e.received_at >= now() - interval '24 hours';
  if v_count + v_new_count > 2000 then return false; end if;
  -- Count only new UUIDs, not retries or duplicates within a batch. A batch may replay several navigations.
  if exists (
    select 1 from (
      select (e->>'navigation_id')::uuid as navigation_id, count(distinct e->>'id') as incoming
      from jsonb_array_elements(p_events) e
      where e ? 'navigation_id' and not exists (select 1 from public.entry_funnel_events previous where previous.event_id=(e->>'id')::uuid)
      group by e->>'navigation_id'
    ) n where n.incoming + (select count(*) from public.entry_funnel_events previous
      where previous.landing_id=p_landing_id and previous.flow_id=p_flow_id and previous.navigation_id=n.navigation_id) > 300
  ) then return false; end if;
  insert into public.entry_funnel_limits(landing_id,minute_at,event_count)
    values(p_landing_id,v_minute,v_new_count)
    on conflict(landing_id,minute_at) do update
      set event_count = public.entry_funnel_limits.event_count + excluded.event_count
      where public.entry_funnel_limits.event_count + excluded.event_count <= 3000
    returning event_count into v_allowed;
  if v_allowed is null then return false; end if;
  insert into public.entry_funnel_events(event_id,landing_id,owner_id,flow_id,template,event_name,elapsed_ms,provider,skin,error_code,http_status,error_stage,duration_ms,attempt_id,attempt_number,account_kind,phase,engine,release,environment,source,entry_strategy,navigation_id,navigation_elapsed_ms,request_id,component,component_release,phone_readiness,phone_outcome,wallet_outcome,loss_reason,loss_count)
    select (e->>'id')::uuid,p_landing_id,v_owner,p_flow_id,p_template,e->>'name',(e->>'elapsed_ms')::integer,
      e->>'provider',e->>'skin',e->>'error_code',(e->>'status')::smallint,e->>'error_stage',(e->>'duration_ms')::integer,(e->>'attempt_id')::uuid,(e->>'attempt_number')::integer,e->>'account_kind',e->>'phase',e->>'engine',e->>'release',e->>'environment',e->>'source',e->>'entry_strategy',(e->>'navigation_id')::uuid,(e->>'navigation_elapsed_ms')::integer,(e->>'request_id')::uuid,(e->>'component')::text,(e->>'component_release')::text,(e->>'phone_readiness')::text,(e->>'phone_outcome')::text,(e->>'wallet_outcome')::text,(e->>'loss_reason')::text,(e->>'loss_count')::integer
    from jsonb_array_elements(p_events) e
    on conflict(event_id) do nothing;
  return true;
end;
$$;
revoke all on function public.record_entry_funnel_events(uuid,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.record_entry_funnel_events(uuid,uuid,integer,jsonb) to service_role;
