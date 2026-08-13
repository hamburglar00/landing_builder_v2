alter table public.whatsapp_cloud_api_webhook_events
  drop constraint if exists whatsapp_cloud_api_webhook_events_event_type_check;

alter table public.whatsapp_cloud_api_webhook_events
  add constraint whatsapp_cloud_api_webhook_events_event_type_check
  check (event_type in ('message', 'status', 'error', 'quality_update', 'unknown'));

create index if not exists whatsapp_cloud_api_webhook_event_type_created_idx
  on public.whatsapp_cloud_api_webhook_events (event_type, received_at desc);
