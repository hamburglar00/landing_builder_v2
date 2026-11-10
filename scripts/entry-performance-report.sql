-- READ ONLY. Apply entry_funnel_navigation_delivery_observability before running this report.
-- Production is a deployment environment, not proof of a real customer. Keep
-- synthetic and unknown separate; historical NULL provenance stays unknown.
-- release is the landing SHA carried through the attempt, not a gateway SHA.
-- entry_strategy is the gateway opt-in cohort, including failed combined attempts
-- and their fallbacks. Aggregate it across the attempt, because CTA precedes selection.
-- Missing telemetry is not proof of abandonment. Keep new/existing/unknown and
-- retries separate. Phase spans can overlap; never add durations or percentiles.
-- Run each database independently. Nexo uses public.nx_entry_funnel_events;
-- replace that table name AND collector_scope='builder' with 'nexo' for its report.
-- Never UNION the databases without preserving collector_scope and landing_id.
-- Browser/alias origin is not persisted: the same landing across custom domains
-- cannot be separated retrospectively. Collector scope is not a claimed page origin.

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
-- Navigation/component coverage. Run with an explicit short UTC range; source=unknown is not proof of human traffic.
-- Separate releases by component. Do not sum overlapping navigation/request/provider timings.
select template, engine, coalesce(source,'unknown') as source, component, component_release,
  count(distinct navigation_id) as navigations,
  count(distinct request_id) as correlated_requests,
  count(*) filter (where event_name='welcome_ready') as welcome_ready,
  count(*) filter (where event_name='welcome_visible') as welcome_visible,
  count(*) filter (where event_name='wallet_ready') as wallet_ready,
  count(*) filter (where event_name='wallet_visible') as wallet_visible,
  count(*) filter (where event_name='chat_usable') as chat_usable
from public.entry_funnel_events
where received_at >= now() - interval '24 hours'
group by template, engine, source, component, component_release;

-- Raw observations, not the percentage denominator (a retry can emit several rows).
select template, engine, release, coalesce(source,'unknown') as source, event_name, phone_readiness, phone_outcome, count(*) as samples,
  percentile_cont(.5) within group(order by duration_ms) filter(where event_name='phone_wait_completed') as wait_p50_ms,
  percentile_cont(.9) within group(order by duration_ms) filter(where event_name='phone_wait_completed') as wait_p90_ms
from public.entry_funnel_events
where received_at >= now() - interval '24 hours' and event_name in ('phone_at_click','phone_wait_completed')
group by template, engine, release, source, event_name, phone_readiness, phone_outcome;

-- BEGIN unique-click-report
-- One anchor per (landing,flow,attempt): the FIRST phone_at_click wins even if a
-- repeated event says ready later. CTA-only attempts remain visible as no sample.
-- Replace these bounded defaults with the SAME explicit UTC range for comparisons.
-- NULL/unknown readiness and incomplete context never enter ready_pct's denominator.
-- source='unknown' remains its own cohort, never a claim of real customer traffic.
with scope as (
  select 'builder'::text as collector_scope, now()-interval '24 hours' as from_at, now() as until_at
), observed as materialized (
  select e.*,s.collector_scope from public.entry_funnel_events e cross join scope s
  where e.received_at >= s.from_at and e.received_at < s.until_at
    and e.event_name in ('phone_at_click','cta_clicked','outbound_requested','entry_retry')
), anchors as (
  select distinct on (collector_scope,landing_id,flow_id,attempt_id) *
  from observed
  where attempt_id is not null and flow_id is not null
    and event_name in ('phone_at_click','cta_clicked')
  order by collector_scope,landing_id,flow_id,attempt_id,
    (event_name='phone_at_click') desc,elapsed_ms,received_at,event_id
), attempts as (
  select a.*,
    (select count(*) from observed c where c.collector_scope=a.collector_scope
      and c.landing_id=a.landing_id and c.flow_id=a.flow_id and c.attempt_id=a.attempt_id
      and c.event_name='cta_clicked') as cta_event_count,
    (select count(*) from observed c where c.collector_scope=a.collector_scope
      and c.landing_id=a.landing_id and c.flow_id=a.flow_id and c.attempt_id=a.attempt_id
      and c.event_name='phone_at_click') as phone_click_event_count,
    a.navigation_id is not null and a.engine is not null and a.release is not null
      and a.environment is not null and a.source is not null as context_complete,
    case when a.attempt_number=1 then 'first' when a.attempt_number>1 then 'later' else 'unknown' end as attempt_kind,
    exists (select 1 from observed r where r.collector_scope=a.collector_scope
      and r.landing_id=a.landing_id and r.flow_id=a.flow_id and r.attempt_id=a.attempt_id
      and r.event_name='entry_retry') as transport_retried,
    -- Compare FLOW-relative timestamps only, within the anchor's document/cohort.
    -- A later navigation, a mismatched release or a negative span is not a timing.
    (select min(o.elapsed_ms)-a.elapsed_ms from observed o
      where o.collector_scope=a.collector_scope and o.landing_id=a.landing_id
        and o.flow_id=a.flow_id and o.attempt_id=a.attempt_id
        and o.navigation_id=a.navigation_id and o.event_name='outbound_requested'
        and o.elapsed_ms>=a.elapsed_ms and o.engine=a.engine and o.release=a.release
        and o.environment=a.environment and o.source=a.source) as click_to_outbound_ms
  from anchors a
), eligible as (
  select *,context_complete and event_name='phone_at_click'
    and phone_readiness in ('ready','pending','failed') as readiness_sample
  from attempts
)
select collector_scope,landing_id,template,coalesce(engine,'unknown') as engine,
  coalesce(release,'unknown') as release,coalesce(environment,'unknown') as environment,
  coalesce(source,'missing') as source,attempt_kind,transport_retried,
  count(*) as observed_attempts,
  sum(cta_event_count) as observed_cta_events,
  sum(phone_click_event_count) as observed_phone_click_events,
  count(*) filter(where not context_complete) as incomplete_context_attempts,
  count(*) filter(where not coalesce(readiness_sample,false)) as attempts_without_readiness_sample,
  count(*) filter(where readiness_sample) as readiness_sample_attempts,
  round(100.0*count(*) filter(where readiness_sample)/nullif(count(*),0),2) as readiness_coverage_pct,
  count(*) filter(where readiness_sample and phone_readiness='ready') as ready_attempts,
  round(100.0*count(*) filter(where readiness_sample and phone_readiness='ready')
    /nullif(count(*) filter(where readiness_sample),0),2) as ready_pct,
  count(*) filter(where context_complete and click_to_outbound_ms is not null) as outbound_timing_samples,
  count(*) filter(where context_complete and click_to_outbound_ms is null) as attempts_without_observed_outbound,
  round(100.0*count(*) filter(where context_complete and click_to_outbound_ms is not null)
    /nullif(count(*) filter(where context_complete),0),2) as outbound_coverage_pct,
  percentile_cont(.5) within group(order by click_to_outbound_ms) filter(where context_complete) as click_to_outbound_p50_ms,
  percentile_cont(.9) within group(order by click_to_outbound_ms) filter(where context_complete) as click_to_outbound_p90_ms,
  percentile_cont(.95) within group(order by click_to_outbound_ms) filter(where context_complete) as click_to_outbound_p95_ms
from eligible
group by collector_scope,landing_id,template,engine,release,environment,source,attempt_kind,transport_retried;
-- END unique-click-report
-- No row means no observed attempt in that cohort/range; NULL ready_pct means no
-- eligible phone sample, not 0%. Missing attempt_id clicks remain in coverage #1.
-- attempts_without_observed_outbound is incomplete observation, not proven abandonment.
-- outbound_requested is an attempted navigation, not proof that WhatsApp opened.

-- Loss reports are best effort too. They count affected events/delivery incidents, never customers.
select component, component_release, coalesce(source,'unknown') as source, loss_reason, count(*) as reports, sum(loss_count) as reported_count
from public.entry_funnel_events
where received_at >= now() - interval '24 hours' and event_name='telemetry_loss'
group by component, component_release, source, loss_reason;
