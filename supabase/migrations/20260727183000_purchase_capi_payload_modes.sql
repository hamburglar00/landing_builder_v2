-- Separate Purchase delivery from the optional first/repeat parameter.
-- Existing configurations stay in segmented mode and preserve their subtype switches.

alter table public.conversions_config
  add column if not exists include_purchase_type_capi boolean;

alter table public.conversions_pixel_configs
  add column if not exists include_purchase_type_capi boolean;

update public.conversions_config
set
  include_purchase_type_capi = coalesce(include_purchase_type_capi, true),
  send_purchase_capi =
    coalesce(send_first_purchase_capi, send_purchase_capi, true)
    or coalesce(send_repeat_purchase_capi, send_purchase_capi, true)
where include_purchase_type_capi is null
   or send_purchase_capi is distinct from (
     coalesce(send_first_purchase_capi, send_purchase_capi, true)
     or coalesce(send_repeat_purchase_capi, send_purchase_capi, true)
   );

update public.conversions_pixel_configs
set
  include_purchase_type_capi = coalesce(include_purchase_type_capi, true),
  send_purchase_capi =
    coalesce(send_first_purchase_capi, send_purchase_capi, true)
    or coalesce(send_repeat_purchase_capi, send_purchase_capi, true)
where include_purchase_type_capi is null
   or send_purchase_capi is distinct from (
     coalesce(send_first_purchase_capi, send_purchase_capi, true)
     or coalesce(send_repeat_purchase_capi, send_purchase_capi, true)
   );

alter table public.conversions_config
  alter column include_purchase_type_capi set default true,
  alter column include_purchase_type_capi set not null;

alter table public.conversions_pixel_configs
  alter column include_purchase_type_capi set default true,
  alter column include_purchase_type_capi set not null;

comment on column public.conversions_config.send_purchase_capi is
  'Switch maestro. Si true, permite enviar Purchase por CAPI para la configuracion base.';

comment on column public.conversions_pixel_configs.send_purchase_capi is
  'Switch maestro. Si true, permite enviar Purchase por CAPI para este pixel.';

comment on column public.conversions_config.include_purchase_type_capi is
  'Si true, agrega custom_data.purchase_type y aplica los filtros first/repeat. Si false, envia Purchase estandar.';

comment on column public.conversions_pixel_configs.include_purchase_type_capi is
  'Si true, agrega custom_data.purchase_type y aplica los filtros first/repeat. Si false, envia Purchase estandar.';
