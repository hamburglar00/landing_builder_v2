alter table public.conversions_config
  add column if not exists send_lead_capi boolean not null default true,
  add column if not exists send_purchase_capi boolean not null default true;

alter table public.conversions_pixel_configs
  add column if not exists send_lead_capi boolean not null default true,
  add column if not exists send_purchase_capi boolean not null default true;

comment on column public.conversions_config.send_lead_capi is
  'Si true, envia evento Lead por CAPI para el pixel default/configuracion base.';

comment on column public.conversions_config.send_purchase_capi is
  'Si true, envia evento Purchase por CAPI para el pixel default/configuracion base.';

comment on column public.conversions_pixel_configs.send_lead_capi is
  'Si true, envia evento Lead por CAPI para este pixel.';

comment on column public.conversions_pixel_configs.send_purchase_capi is
  'Si true, envia evento Purchase por CAPI para este pixel.';

update public.conversions_pixel_configs p
set
  send_lead_capi = coalesce(c.send_lead_capi, true),
  send_purchase_capi = coalesce(c.send_purchase_capi, true)
from public.conversions_config c
where c.user_id = p.user_id
  and p.is_default = true
  and (
    p.send_lead_capi is distinct from coalesce(c.send_lead_capi, true)
    or p.send_purchase_capi is distinct from coalesce(c.send_purchase_capi, true)
  );
