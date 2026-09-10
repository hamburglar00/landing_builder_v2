-- The application has two monetary workspaces. Keep the Purchase CAPI
-- thresholds aligned with those scopes and discard unsupported hidden keys.

update public.conversions_config
set purchase_capi_min_amounts = jsonb_build_object(
  'ARS',
  case
    when (purchase_capi_min_amounts ->> 'ARS') ~ '^[0-9]+([.][0-9]{1,2})?$'
      then (purchase_capi_min_amounts ->> 'ARS')::numeric
    else 0
  end,
  'PYG',
  case
    when (purchase_capi_min_amounts ->> 'PYG') ~ '^[0-9]+([.][0-9]{1,2})?$'
      then (purchase_capi_min_amounts ->> 'PYG')::numeric
    else 0
  end
);

alter table public.conversions_config
  alter column purchase_capi_min_amounts
    set default '{"ARS": 0, "PYG": 0}'::jsonb;

comment on column public.conversions_config.purchase_capi_min_amounts is
  'Montos minimos ARS y PYG para enviar Purchase a Meta CAPI cuando el filtro esta activo.';
