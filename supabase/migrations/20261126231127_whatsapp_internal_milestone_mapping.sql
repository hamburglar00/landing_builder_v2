-- NULL retains the existing routes for configurations not yet edited.
alter table public.conversions_pixel_configs
  add column whatsapp_milestone_meta_events jsonb,
  add constraint conversions_pixel_whatsapp_milestone_events_check check (
    whatsapp_milestone_meta_events is null or (
      jsonb_typeof(whatsapp_milestone_meta_events) = 'object'
      and whatsapp_milestone_meta_events ?& array['first_message', 'username_requested', 'username_sent']
      and whatsapp_milestone_meta_events - array['first_message', 'username_requested', 'username_sent'] = '{}'::jsonb
      and whatsapp_milestone_meta_events->>'first_message' in ('off', 'Lead', 'CompleteRegistration', 'InitiateCheckout')
      and whatsapp_milestone_meta_events->>'username_requested' in ('off', 'Lead', 'CompleteRegistration', 'InitiateCheckout')
      and whatsapp_milestone_meta_events->>'username_sent' in ('off', 'Lead', 'CompleteRegistration', 'InitiateCheckout')
      and jsonb_typeof(whatsapp_milestone_meta_events->'first_message') = 'string'
      and jsonb_typeof(whatsapp_milestone_meta_events->'username_requested') = 'string'
      and jsonb_typeof(whatsapp_milestone_meta_events->'username_sent') = 'string'
      and (whatsapp_milestone_meta_events->>'first_message' = 'off' or (
        whatsapp_milestone_meta_events->>'first_message' <> whatsapp_milestone_meta_events->>'username_requested'
        and whatsapp_milestone_meta_events->>'first_message' <> whatsapp_milestone_meta_events->>'username_sent'
      ))
      and (whatsapp_milestone_meta_events->>'username_requested' = 'off'
        or whatsapp_milestone_meta_events->>'username_requested' <> whatsapp_milestone_meta_events->>'username_sent')
    )
  );

alter table public.atrio_meta_journey_events
  drop constraint atrio_meta_journey_events_event_name_check,
  add constraint atrio_meta_journey_events_event_name_check
    check (event_name in ('ViewContent', 'Lead', 'InitiateCheckout', 'CompleteRegistration'));
