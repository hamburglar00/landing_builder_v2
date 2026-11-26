alter table public.conversions_pixel_configs
  add column send_whatsapp_view_content boolean not null default false,
  add column whatsapp_username_meta_event text not null default 'off'
    check (whatsapp_username_meta_event in ('off', 'CompleteRegistration', 'InitiateCheckout'));

alter table public.atrio_meta_journey_events
  drop constraint atrio_meta_journey_events_event_name_check,
  add constraint atrio_meta_journey_events_event_name_check
    check (event_name in ('ViewContent', 'InitiateCheckout', 'CompleteRegistration'));
