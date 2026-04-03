alter table public.conversions
  add column if not exists send_contact_pixel boolean not null default false;

comment on column public.conversions.send_contact_pixel is
  'Bandera enviada por la landing publica para indicar si Contact tambien se envio por Pixel browser.';

update public.conversions_config
set visible_columns = (
  select array_agg(distinct x)
  from unnest(coalesce(visible_columns, array[]::text[]) || array['send_contact_pixel']) as t(x)
)
where not (
  coalesce(visible_columns, array[]::text[]) @> array['send_contact_pixel']
);
