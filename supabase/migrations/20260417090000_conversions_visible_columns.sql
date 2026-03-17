alter table public.conversions_config
  add column visible_columns text[] not null default array[]::text[];

comment on column public.conversions_config.visible_columns
  is 'Columnas visibles en la tabla de conversiones para este usuario (compartidas entre admin y dashboard).';

