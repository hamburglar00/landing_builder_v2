-- Purchase CAPI delivery controls belong to the destination pixel.
-- NULL repeat window keeps the existing unlimited behavior.
alter table public.conversions_pixel_configs
  add column repeat_purchase_capi_window_days smallint,
  add column purchase_capi_min_amount_enabled boolean not null default false,
  add column purchase_capi_min_amount numeric(20, 2) not null default 0;

alter table public.conversions_pixel_configs
  add constraint conversions_pixel_repeat_window_days_check
    check (repeat_purchase_capi_window_days between 1 and 30),
  add constraint conversions_pixel_purchase_min_amount_check
    check (purchase_capi_min_amount >= 0);

-- Preserve each existing client's active minimum in the currency configured
-- for each pixel. The former client-wide columns remain only as a fallback for
-- installations that still have no per-pixel configuration row.
update public.conversions_pixel_configs as p
set purchase_capi_min_amount_enabled = c.purchase_capi_min_amount_enabled
      and coalesce(jsonb_typeof(c.purchase_capi_min_amounts -> upper(trim(coalesce(p.meta_currency, 'ARS')))) = 'number', false),
    purchase_capi_min_amount = case
      when jsonb_typeof(c.purchase_capi_min_amounts -> upper(trim(coalesce(p.meta_currency, 'ARS')))) = 'number'
        and (c.purchase_capi_min_amounts ->> upper(trim(coalesce(p.meta_currency, 'ARS'))))::numeric
          between 0 and 999999999999999999.99
      then (c.purchase_capi_min_amounts ->> upper(trim(coalesce(p.meta_currency, 'ARS'))))::numeric
      else 0
    end
from public.conversions_config as c
where c.user_id = p.user_id;

comment on column public.conversions_pixel_configs.repeat_purchase_capi_window_days is
  'NULL envia Repeat Purchase sin limite temporal. Si se configura, solo envia repeats ocurridos dentro de N dias de 24 horas desde el primer Purchase del usuario y workspace.';
comment on column public.conversions_pixel_configs.purchase_capi_min_amount_enabled is
  'Filtro de envio Purchase a Meta CAPI para este pixel; no modifica las filas de conversiones.';
comment on column public.conversions_pixel_configs.purchase_capi_min_amount is
  'Monto minimo de Purchase para este pixel, expresado en meta_currency. No convierte monedas.';
