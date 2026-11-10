-- READ ONLY. Apply entry_funnel_all_templates_provenance before running this report.
-- Production is a deployment environment, not proof of a real customer. Keep
-- synthetic and unknown separate; historical NULL provenance stays unknown.
-- release is the landing SHA carried through the attempt, not a gateway SHA.
-- entry_strategy is the gateway opt-in cohort, including failed combined attempts
-- and their fallbacks. Aggregate it across the attempt, because CTA precedes selection.
-- Missing telemetry is not proof of abandonment. Keep new/existing/unknown and
-- retries separate. Phase spans can overlap; never add durations or percentiles.

-- 1. Coverage: shows whether each template actually has complete observations.
select template,coalesce(engine,'unknown') as engine,coalesce(release,'unknown') as release,
  coalesce(environment,'unknown') as environment,coalesce(source,'unknown') as source,
  count(distinct flow_id) as flows,
  count(distinct attempt_id) as attempts,
  count(*) filter(where event_name='cta_clicked') as clicks,
  count(*) filter(where event_name='chat_usable') as usable_events,
  count(*) filter(where event_name='cta_available') as actionable_events,
  count(*) filter(where event_name='outbound_requested') as outbound_requests,
  count(*) filter(where event_name='entry_error') as recorded_errors,
  count(*) filter(where attempt_id is null and event_name='cta_clicked') as legacy_clicks,
  max(received_at) as last_event
from public.entry_funnel_events
where received_at >= now()-interval '7 days'
group by template,engine,release,environment,source order by template,engine,release;

-- Explicit missing coverage across both engines/all templates. Zero observations
-- must remain visible; an outbound request is not a successful WhatsApp delivery.
with expected as (select t as template,e as engine from generate_series(1,9) t
  cross join (values ('classic'),('constructor')) engines(e))
select expected.*,count(events.event_id) as events,max(events.received_at) as last_event
from expected left join public.entry_funnel_events events
  on events.template=expected.template and events.engine=expected.engine
  and events.received_at>=now()-interval '7 days'
group by expected.template,expected.engine order by expected.template,expected.engine;

-- 2. Comparable per-attempt timings (CTA -> visible authorized composer).
with attempts as (
  select landing_id,template,flow_id,attempt_id,engine,release,environment,source,max(attempt_number) as attempt_number,
    coalesce(max(account_kind),'unknown') as account_kind,
    coalesce(max(entry_strategy),'unknown') as entry_strategy,
    coalesce(max(provider),'unknown') as provider,coalesce(max(skin),'') as skin,
    bool_or(event_name='entry_retry') as retried,
    min(elapsed_ms) filter(where event_name='cta_clicked') as cta_ms,
    min(elapsed_ms) filter(where event_name='chat_usable') as usable_ms,
    min(elapsed_ms) filter(where event_name='chat_ready') as complete_ms
  from public.entry_funnel_events
  where received_at >= now()-interval '7 days' and attempt_id is not null
  group by landing_id,template,flow_id,attempt_id,engine,release,environment,source
), timed as (
  select a.*,f.form_ms,
    case when usable_ms>=cta_ms then usable_ms-cta_ms end as entry_ms,
    case when complete_ms>=cta_ms then complete_ms-cta_ms end as with_welcome_wallet_ms,
    case when attempt_number=1 and cta_ms>=f.form_ms then cta_ms-f.form_ms end as before_submit_ms
  from attempts a
  left join lateral (select max(elapsed_ms) as form_ms from public.entry_funnel_events e
    where e.flow_id=a.flow_id and e.landing_id=a.landing_id and e.event_name='form_visible' and e.elapsed_ms<=a.cta_ms
      and e.engine is not distinct from a.engine and e.release is not distinct from a.release
      and e.environment is not distinct from a.environment and e.source is not distinct from a.source) f on true
)
select landing_id,template,provider,skin,account_kind,retried,entry_strategy,
  coalesce(engine,'unknown') as engine,coalesce(release,'unknown') as release,
  coalesce(environment,'unknown') as environment,coalesce(source,'unknown') as source,
  count(*) as observed_attempts,count(entry_ms) as complete_timings,
  percentile_cont(.5) within group(order by entry_ms) as click_to_usable_p50_ms,
  percentile_cont(.9) within group(order by entry_ms) as click_to_usable_p90_ms,
  percentile_cont(.95) within group(order by entry_ms) as click_to_usable_p95_ms,
  percentile_cont(.5) within group(order by before_submit_ms) as form_to_click_p50_ms,
  percentile_cont(.5) within group(order by with_welcome_wallet_ms) as click_to_full_chat_p50_ms
from timed group by landing_id,template,provider,skin,account_kind,retried,entry_strategy,engine,release,environment,source;

-- 3. Breakdown. Navigation/runtime values are relative to that document's navigation.
-- LCP/blocked are snapshots up to CTA/chat usable or page hide, not full-lifetime vitals.
select landing_id,template,phase,coalesce(account_kind,'unknown') as account_kind,coalesce(entry_strategy,'unknown') as entry_strategy,
  coalesce(engine,'unknown') as engine,coalesce(release,'unknown') as release,
  coalesce(environment,'unknown') as environment,coalesce(source,'unknown') as source,
  count(*) as samples,percentile_cont(.5) within group(order by duration_ms) as p50_ms,
  percentile_cont(.9) within group(order by duration_ms) as p90_ms,
  percentile_cont(.95) within group(order by duration_ms) as p95_ms
from public.entry_funnel_events
where received_at>=now()-interval '7 days' and event_name='stage_timing'
group by landing_id,template,phase,account_kind,entry_strategy,engine,release,environment,source order by template,phase;

-- 4. Failure stage, including timeouts. No raw error messages or credentials.
select template,provider,skin,error_stage,error_code,http_status,coalesce(entry_strategy,'unknown') as entry_strategy,
  coalesce(engine,'unknown') as engine,coalesce(release,'unknown') as release,
  coalesce(environment,'unknown') as environment,coalesce(source,'unknown') as source,count(*) as samples,
  percentile_cont(.5) within group(order by duration_ms) as p50_ms
from public.entry_funnel_events where received_at>=now()-interval '7 days' and event_name='entry_error'
group by template,provider,skin,error_stage,error_code,http_status,entry_strategy,engine,release,environment,source;

-- 5. Timeline for a chosen flow/attempt: add WHERE flow_id = '<uuid>' and optionally
-- attempt_id = '<uuid>' to inspect milestones alongside flow-scoped loading phases.
-- stage_timing elapsed_ms is its observation time; server child phases share the
-- response observation time and must not be interpreted as sequential spans.
select flow_id,attempt_id,attempt_number,template,event_name,phase,elapsed_ms,duration_ms,
  coalesce(engine,'unknown') as engine,coalesce(release,'unknown') as release,
  coalesce(environment,'unknown') as environment,coalesce(source,'unknown') as source,
  provider,skin,account_kind,coalesce(entry_strategy,'unknown') as entry_strategy,error_stage,error_code,http_status
from public.entry_funnel_events where received_at>=now()-interval '24 hours'
order by flow_id,elapsed_ms,event_id;
