-- Internal, read-only aggregate. One visit is one measured navigation, not one player.
-- Covers visits with an observed optional field in the last 30 days. Production may
-- include unmarked tests; explicitly synthetic traffic and previews are excluded.
with visits as (
  select landing_id, template, navigation_id,
    bool_or(event_name = 'whatsapp_field_visible') as saw_field,
    bool_or(event_name in ('whatsapp_field_focus', 'whatsapp_field_started')) as interacted,
    bool_or(event_name = 'whatsapp_field_started') as started_input,
    bool_or(event_name = 'whatsapp_form_submitted') as submitted,
    max(received_at) as last_signal
  from public.entry_funnel_events
  where received_at >= now() - interval '30 days'
    and template in (7, 9) and navigation_id is not null
    and environment = 'production' and source is distinct from 'synthetic'
    and event_name in ('whatsapp_field_visible', 'whatsapp_field_focus', 'whatsapp_field_started', 'whatsapp_form_submitted')
  group by landing_id, template, navigation_id
)
select l.id as landing_id, l.name as landing_name, v.template,
  count(*) as visits_shown,
  count(*) filter (where interacted) as visits_interacted,
  count(*) filter (where started_input) as visits_started_input,
  count(*) filter (where submitted) as visits_submitted,
  count(*) filter (where interacted and submitted) as interacted_then_submitted,
  -- Classify on read. A delayed submit automatically supersedes a previous estimate.
  count(*) filter (where interacted and not submitted and last_signal <= now() - interval '24 hours') as interacted_without_submit_24h,
  count(*) filter (where interacted and not submitted and last_signal > now() - interval '24 hours') as interacted_still_pending
from visits v
join public.landings l on l.id = v.landing_id
where v.saw_field
group by l.id, l.name, v.template
order by l.name, l.id, v.template;
