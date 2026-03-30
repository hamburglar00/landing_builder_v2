alter table public.conversions
  add column if not exists contact_payload_raw text not null default '';

comment on column public.conversions.contact_payload_raw is
  'Raw JSON payload recibido desde landing publica para Contact (trazabilidad de entrada).';

-- Hacer visible la nueva columna para configs existentes.
update public.conversions_config
set visible_columns = (
  select array_agg(distinct x)
  from unnest(coalesce(visible_columns, array[]::text[]) || array['contact_payload_raw']) as t(x)
)
where not (
  coalesce(visible_columns, array[]::text[]) @> array['contact_payload_raw']
);

