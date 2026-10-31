-- Separate the visible composer from welcome/bank readiness. Existing events
-- keep their meaning; ownership, grants, retention and closed payloads stay intact.
alter table public.entry_funnel_events drop constraint entry_funnel_events_event_name_check;
alter table public.entry_funnel_events add constraint entry_funnel_events_event_name_check check (event_name in (
 'page_visible','form_visible','name_focus','name_started','name_valid','skin_selected','cta_clicked',
 'destination_ready','account_ready','login_confirmed','gateway_loaded','iframe_loaded',
 'chat_bootstrap_ready','welcome_ready','wallet_ready','chat_usable','chat_ready','entry_error','visibility_hidden','resumed'
));
comment on column public.entry_funnel_events.event_name is 'chat_usable: authenticated visible composer painted and enabled; wallet_ready: current bank data ready; chat_ready: legacy combined entry readiness. Timings can overlap.';
