-- Añade secreto para revalidar la landing pública (ISR) desde el constructor.

alter table public.settings
  add column if not exists revalidate_secret text not null default '';

comment on column public.settings.revalidate_secret is
  'Secreto compartido con la landing pública (Next.js) para /api/revalidate. Solo admins pueden verlo y modificarlo.';

