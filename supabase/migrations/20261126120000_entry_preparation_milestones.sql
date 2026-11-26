-- Gateway preparation milestones share the existing scoped collector.
alter table public.entry_funnel_events drop constraint entry_funnel_events_event_name_check;
alter table public.entry_funnel_events add constraint entry_funnel_events_event_name_check
  check(event_name in (
    'navigation_started', 'phone_at_click', 'phone_wait_completed', 'wallet_result',
    'welcome_visible', 'wallet_visible', 'telemetry_loss', 'page_visible', 'form_visible',
    'name_focus', 'name_started', 'name_valid', 'skin_selected',
    'whatsapp_field_visible', 'whatsapp_field_focus', 'whatsapp_field_started', 'whatsapp_form_submitted',
    'cta_clicked', 'destination_ready', 'account_ready', 'login_confirmed', 'gateway_loaded',
    'iframe_loaded', 'chat_bootstrap_ready', 'welcome_ready', 'wallet_ready', 'chat_usable', 'chat_ready',
    'entry_error', 'visibility_hidden', 'resumed', 'stage_timing', 'casino_account_ready', 'entry_retry',
    'attempt_started', 'cta_available', 'outbound_requested',
    'credentials_visible', 'continue_clicked', 'access_ready'
  ));
