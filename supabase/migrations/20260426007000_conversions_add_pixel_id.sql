alter table public.conversions
  add column if not exists pixel_id text not null default '';

comment on column public.conversions.pixel_id is
  'Pixel ID recibido en payload de contacto para trazabilidad de origen.';

-- Hacer visible la columna en configuraciones existentes.
update public.conversions_config
set visible_columns = (
  select array_agg(distinct x)
  from unnest(coalesce(visible_columns, array[]::text[]) || array['pixel_id']) as t(x)
)
where not (
  coalesce(visible_columns, array[]::text[]) @> array['pixel_id']
);

