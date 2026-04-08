alter table public.conversions
  add column if not exists source_platform text not null default '';

comment on column public.conversions.source_platform is
  'Origen de la plataforma que envio el payload (ej: landing, chatrace). Solo trazabilidad.';
