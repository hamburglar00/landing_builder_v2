alter table public.conversions
  add column if not exists dataset_id text not null default '';

comment on column public.conversions.dataset_id is
  'Dataset de Meta usado para Conversions API for Business Messaging. Vacío para recorridos website/landing.';

create index if not exists conversions_dataset_id_idx
  on public.conversions (dataset_id)
  where dataset_id <> '';

update public.conversions_config
set visible_columns = visible_columns || array['dataset_id']::text[]
where visible_columns is not null
  and not (visible_columns @> array['dataset_id']::text[]);
