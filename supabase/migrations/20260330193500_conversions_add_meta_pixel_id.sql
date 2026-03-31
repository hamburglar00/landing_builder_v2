-- Add explicit meta_pixel_id in conversions payload trace and UI.
alter table public.conversions
  add column if not exists meta_pixel_id text not null default '';

comment on column public.conversions.meta_pixel_id is
  'Pixel de Meta enviado por la landing (payload key meta_pixel_id).';

-- Backfill from legacy pixel_id when empty.
update public.conversions
set meta_pixel_id = coalesce(pixel_id, '')
where coalesce(meta_pixel_id, '') = '';

-- Keep visible columns in sync for existing clients.
update public.conversions_config
set visible_columns = (
  select array_agg(case when x = 'pixel_id' then 'meta_pixel_id' else x end)
  from unnest(coalesce(visible_columns, array[]::text[])) as t(x)
)
where coalesce(visible_columns, array[]::text[]) @> array['pixel_id'];

update public.conversions_config
set visible_columns = (
  select array_agg(distinct x order by x)
  from unnest(coalesce(visible_columns, array[]::text[]) || array['meta_pixel_id']) as t(x)
)
where not (coalesce(visible_columns, array[]::text[]) @> array['meta_pixel_id']);
