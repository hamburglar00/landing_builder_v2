alter table public.notification_settings
  add column if not exists whatsapp_cloud_api_health_notifications_enabled boolean not null default true;

comment on column public.notification_settings.whatsapp_cloud_api_health_notifications_enabled is
  'Permite activar o desactivar alertas Telegram ante cambios de estado/calidad/limite del numero de WhatsApp Cloud API.';
