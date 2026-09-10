-- Optional client-wide minimum amounts for sending Purchase to Meta CAPI.
-- Internal Purchase processing remains unchanged; the switch only controls
-- delivery to Meta after the conversion has been persisted.

alter table public.conversions_config
  add column if not exists purchase_capi_min_amount_enabled boolean not null default false,
  add column if not exists purchase_capi_min_amounts jsonb;

update public.conversions_config
set purchase_capi_min_amounts = '{"ARS": 0, "PYG": 0, "USD": 0, "EUR": 0, "BRL": 0, "CLP": 0, "MXN": 0, "COP": 0}'::jsonb
where purchase_capi_min_amounts is null
   or jsonb_typeof(purchase_capi_min_amounts) <> 'object';

alter table public.conversions_config
  alter column purchase_capi_min_amounts set default '{"ARS": 0, "PYG": 0, "USD": 0, "EUR": 0, "BRL": 0, "CLP": 0, "MXN": 0, "COP": 0}'::jsonb,
  alter column purchase_capi_min_amounts set not null;

alter table public.conversions_config
  drop constraint if exists conversions_config_purchase_capi_min_amounts_object_check;

alter table public.conversions_config
  add constraint conversions_config_purchase_capi_min_amounts_object_check
    check (jsonb_typeof(purchase_capi_min_amounts) = 'object');

comment on column public.conversions_config.purchase_capi_min_amount_enabled is
  'Si true, Purchase solo se envia a Meta CAPI cuando alcanza el umbral de su moneda. No altera el procesamiento interno.';

comment on column public.conversions_config.purchase_capi_min_amounts is
  'Montos minimos por moneda para enviar Purchase a Meta CAPI cuando el filtro esta activo.';
