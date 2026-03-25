alter table public.conversions
  add column if not exists lead_payload_raw text not null default '',
  add column if not exists purchase_payload_raw text not null default '';

comment on column public.conversions.lead_payload_raw is
  'Raw JSON payload recibido para action=LEAD (trazabilidad de entrada).';

comment on column public.conversions.purchase_payload_raw is
  'Raw JSON payload recibido para action=PURCHASE (trazabilidad de entrada).';

-- Asegurar que las nuevas columnas queden visibles por defecto en configs existentes.
update public.conversions_config
set visible_columns = (
  select array_agg(distinct x)
  from unnest(coalesce(visible_columns, array[]::text[]) || array['lead_payload_raw','purchase_payload_raw']) as t(x)
)
where not (
  coalesce(visible_columns, array[]::text[]) @> array['lead_payload_raw','purchase_payload_raw']
);
