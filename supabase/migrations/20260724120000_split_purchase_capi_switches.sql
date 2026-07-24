-- Split the legacy Purchase CAPI switch while preserving every existing pixel's behavior.
-- Columns are added nullable first so the backfill can copy the legacy value accurately.

alter table public.conversions_config
  add column if not exists send_first_purchase_capi boolean,
  add column if not exists send_repeat_purchase_capi boolean;

alter table public.conversions_pixel_configs
  add column if not exists send_first_purchase_capi boolean,
  add column if not exists send_repeat_purchase_capi boolean;

update public.conversions_config
set
  send_first_purchase_capi = coalesce(send_first_purchase_capi, send_purchase_capi, true),
  send_repeat_purchase_capi = coalesce(send_repeat_purchase_capi, send_purchase_capi, true)
where send_first_purchase_capi is null
   or send_repeat_purchase_capi is null;

update public.conversions_pixel_configs
set
  send_first_purchase_capi = coalesce(send_first_purchase_capi, send_purchase_capi, true),
  send_repeat_purchase_capi = coalesce(send_repeat_purchase_capi, send_purchase_capi, true)
where send_first_purchase_capi is null
   or send_repeat_purchase_capi is null;

alter table public.conversions_config
  alter column send_first_purchase_capi set default true,
  alter column send_first_purchase_capi set not null,
  alter column send_repeat_purchase_capi set default true,
  alter column send_repeat_purchase_capi set not null;

alter table public.conversions_pixel_configs
  alter column send_first_purchase_capi set default true,
  alter column send_first_purchase_capi set not null,
  alter column send_repeat_purchase_capi set default true,
  alter column send_repeat_purchase_capi set not null;

comment on column public.conversions_config.send_first_purchase_capi is
  'Si true, envia la primera compra (Purchase first) por CAPI para la configuracion base.';

comment on column public.conversions_config.send_repeat_purchase_capi is
  'Si true, envia las recompras (Purchase repeat) por CAPI para la configuracion base.';

comment on column public.conversions_pixel_configs.send_first_purchase_capi is
  'Si true, envia la primera compra (Purchase first) por CAPI para este pixel.';

comment on column public.conversions_pixel_configs.send_repeat_purchase_capi is
  'Si true, envia las recompras (Purchase repeat) por CAPI para este pixel.';

comment on column public.conversions_config.send_purchase_capi is
  'Flag legacy conservado por compatibilidad. Usar send_first_purchase_capi y send_repeat_purchase_capi.';

comment on column public.conversions_pixel_configs.send_purchase_capi is
  'Flag legacy conservado por compatibilidad. Usar send_first_purchase_capi y send_repeat_purchase_capi.';

-- Improve historical traceability where the purchase type is already known.
update public.conversions
set purchase_status_capi = case purchase_type
  when 'first' then 'skipped_first_purchase_capi_disabled'
  when 'repeat' then 'skipped_repeat_purchase_capi_disabled'
  else purchase_status_capi
end
where purchase_status_capi = 'skipped_purchase_capi_disabled'
  and purchase_type in ('first', 'repeat');
