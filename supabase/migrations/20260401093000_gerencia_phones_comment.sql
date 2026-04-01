alter table public.gerencia_phones
add column if not exists comment text not null default '';

comment on column public.gerencia_phones.comment is
  'Comentario libre para identificar visualmente el teléfono (especialmente en gerencias manuales).';
