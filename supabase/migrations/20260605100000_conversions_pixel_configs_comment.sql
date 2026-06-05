alter table public.conversions_pixel_configs
  add column if not exists comment text not null default '';

comment on column public.conversions_pixel_configs.comment is
  'Comentario opcional para identificar el pixel en la UI. No afecta el envio a Meta CAPI.';
