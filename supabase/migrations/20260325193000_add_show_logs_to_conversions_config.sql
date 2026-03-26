alter table public.conversions_config
  add column if not exists show_logs boolean not null default true;

comment on column public.conversions_config.show_logs is
  'Define si el cliente puede ver la pestaña Logs en Conversiones.';

