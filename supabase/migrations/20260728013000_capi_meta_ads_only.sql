alter table public.conversions_config
  add column if not exists meta_ads_only_capi boolean not null default false;

alter table public.conversions_pixel_configs
  add column if not exists meta_ads_only_capi boolean not null default false;

comment on column public.conversions_config.meta_ads_only_capi is
  'Si true, CAPI solo envia conversiones con from_meta_ads=true.';

comment on column public.conversions_pixel_configs.meta_ads_only_capi is
  'Si true, este pixel solo envia por CAPI conversiones con from_meta_ads=true.';
