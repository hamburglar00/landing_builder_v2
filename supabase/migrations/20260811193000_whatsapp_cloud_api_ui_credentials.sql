alter table public.whatsapp_cloud_api_configs
  add column if not exists meta_app_secret text not null default '';

alter table public.whatsapp_cloud_api_configs
  drop constraint if exists whatsapp_cloud_api_configs_name_format;

alter table public.whatsapp_cloud_api_configs
  drop constraint if exists whatsapp_cloud_api_configs_name_not_blank;

alter table public.whatsapp_cloud_api_configs
  add constraint whatsapp_cloud_api_configs_name_not_blank
  check (length(btrim(name)) > 0 and length(name) <= 120);

comment on column public.whatsapp_cloud_api_configs.meta_app_secret is
  'App Secret de la app Meta para validar X-Hub-Signature-256 por configuracion.';

comment on table public.whatsapp_cloud_api_configs is
  'Configuracion de WhatsApp Cloud API oficial para derivar a gerencias.';
