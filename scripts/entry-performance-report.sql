-- Read-only, after applying entry_attempt_timings. Scope by landing_id when comparing landings.
-- These are diagnostic cohorts: missing chat events are not proof of abandonment.
with attempts as (
  select landing_id, template, flow_id, attempt_id,
    max(attempt_number) as attempt_number,
    coalesce(max(account_kind), 'unknown') as account_kind,
    bool_or(event_name = 'entry_retry') as retried,
    min(elapsed_ms) filter (where event_name in ('attempt_started','cta_clicked')) as begin_ms,
    min(elapsed_ms) filter (where event_name = 'chat_usable') as usable_ms
  from public.entry_funnel_events
  where received_at >= now() - interval '7 days' and attempt_id is not null
  group by landing_id, template, flow_id, attempt_id
)
select landing_id, template, account_kind, retried,
  count(*) as observed_attempts,
  count(*) filter (where usable_ms >= begin_ms) as attempts_with_complete_timing,
  percentile_cont(0.5) within group (order by usable_ms - begin_ms)
    filter (where usable_ms >= begin_ms) as entry_p50_ms,
  percentile_cont(0.9) within group (order by usable_ms - begin_ms)
    filter (where usable_ms >= begin_ms) as entry_p90_ms
from attempts group by landing_id, template, account_kind, retried;

-- Phase durations can nest/overlap and must not be summed, including percentiles.
select landing_id, template, phase, count(*) as samples,
  percentile_cont(0.5) within group (order by duration_ms) as p50_ms,
  percentile_cont(0.9) within group (order by duration_ms) as p90_ms
from public.entry_funnel_events
where received_at >= now() - interval '7 days' and event_name = 'stage_timing'
group by landing_id, template, phase;
