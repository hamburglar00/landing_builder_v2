-- Keep geo enrichment independent from geo delivery to Meta.
-- Existing configurations preserve the current behavior (geo is sent).

alter table public.conversions_config
  add column if not exists send_geo_capi boolean not null default true;

alter table public.conversions_pixel_configs
  add column if not exists send_geo_capi boolean not null default true;

comment on column public.conversions_config.send_geo_capi is
  'Si true, incluye ciudad/provincia/codigo postal/pais en user_data enviado por CAPI.';

comment on column public.conversions_pixel_configs.send_geo_capi is
  'Si true, incluye ciudad/provincia/codigo postal/pais en user_data enviado por CAPI para este pixel.';
