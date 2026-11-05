-- READ ONLY. Apply entry_render_timings before deploying the additional producers.
-- Missing telemetry is not proof of abandonment. Keep new/existing/unknown and
-- retries separate. Phase spans can overlap; never add durations or percentiles.

-- 1. Coverage: shows whether each template actually has complete observations.
select template, count(distinct flow_id) as flows,
  count(distinct attempt_id) as attempts,
  count(*) filter(where event_name='cta_clicked') as clicks,
  count(*) filter(where event_name='chat_usable') as usable_events,
  count(*) filter(where event_name='entry_error') as recorded_errors,
  count(*) filter(where attempt_id is null and event_name='cta_clicked') as legacy_clicks,
  max(received_at) as last_event
from public.entry_funnel_events
where received_at >= now()-interval '7 days'
group by template order by template;

-- 2. Comparable per-attempt timings (CTA -> visible authorized composer).
with attempts as (
  select landing_id,template,flow_id,attempt_id,max(attempt_number) as attempt_number,
    coalesce(max(account_kind),'unknown') as account_kind,
    coalesce(max(provider),'unknown') as provider,coalesce(max(skin),'') as skin,
    bool_or(event_name='entry_retry') as retried,
    min(elapsed_ms) filter(where event_name='cta_clicked') as cta_ms,
    min(elapsed_ms) filter(where event_name='chat_usable') as usable_ms,
    min(elapsed_ms) filter(where event_name='chat_ready') as complete_ms
  from public.entry_funnel_events
  where received_at >= now()-interval '7 days' and attempt_id is not null
  group by landing_id,template,flow_id,attempt_id
), timed as (
  select a.*,f.form_ms,
    case when usable_ms>=cta_ms then usable_ms-cta_ms end as entry_ms,
    case when complete_ms>=cta_ms then complete_ms-cta_ms end as with_welcome_wallet_ms,
    case when attempt_number=1 and cta_ms>=f.form_ms then cta_ms-f.form_ms end as before_submit_ms
  from attempts a
  left join lateral (select max(elapsed_ms) as form_ms from public.entry_funnel_events e
    where e.flow_id=a.flow_id and e.landing_id=a.landing_id and e.event_name='form_visible' and e.elapsed_ms<=a.cta_ms) f on true
)
select landing_id,template,provider,skin,account_kind,retried,
  count(*) as observed_attempts,count(entry_ms) as complete_timings,
  percentile_cont(.5) within group(order by entry_ms) as click_to_usable_p50_ms,
  percentile_cont(.9) within group(order by entry_ms) as click_to_usable_p90_ms,
  percentile_cont(.95) within group(order by entry_ms) as click_to_usable_p95_ms,
  percentile_cont(.5) within group(order by before_submit_ms) as form_to_click_p50_ms,
  percentile_cont(.5) within group(order by with_welcome_wallet_ms) as click_to_full_chat_p50_ms
from timed group by landing_id,template,provider,skin,account_kind,retried;

-- 3. Breakdown. Navigation/runtime values are relative to that document's navigation.
-- LCP/blocked are snapshots up to CTA/chat usable or page hide, not full-lifetime vitals.
select landing_id,template,phase,coalesce(account_kind,'unknown') as account_kind,
  count(*) as samples,percentile_cont(.5) within group(order by duration_ms) as p50_ms,
  percentile_cont(.9) within group(order by duration_ms) as p90_ms,
  percentile_cont(.95) within group(order by duration_ms) as p95_ms
from public.entry_funnel_events
where received_at>=now()-interval '7 days' and event_name='stage_timing'
group by landing_id,template,phase,account_kind order by template,phase;

-- 4. Failure stage, including timeouts. No raw error messages or credentials.
select template,provider,skin,error_stage,error_code,http_status,count(*) as samples,
  percentile_cont(.5) within group(order by duration_ms) as p50_ms
from public.entry_funnel_events where received_at>=now()-interval '7 days' and event_name='entry_error'
group by template,provider,skin,error_stage,error_code,http_status;

-- 5. Timeline for a chosen flow/attempt: add WHERE flow_id = '<uuid>' and optionally
-- attempt_id = '<uuid>' to inspect milestones alongside flow-scoped loading phases.
-- stage_timing elapsed_ms is its observation time; server child phases share the
-- response observation time and must not be interpreted as sequential spans.
select flow_id,attempt_id,attempt_number,template,event_name,phase,elapsed_ms,duration_ms,
  provider,skin,account_kind,error_stage,error_code,http_status
from public.entry_funnel_events where received_at>=now()-interval '24 hours'
order by flow_id,elapsed_ms,event_id;
