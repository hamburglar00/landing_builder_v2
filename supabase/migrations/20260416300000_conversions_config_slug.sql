-- Agrega slug único por cliente para URL de conversiones
-- Ejemplo: ?name=kobe -> busca conversions_config.slug = 'kobe'

alter table public.conversions_config
  add column slug text not null default '';

-- Solo alfanumérico y lowercase, o vacío
alter table public.conversions_config
  add constraint conversions_config_slug_format
  check (slug ~ '^[a-z0-9]*$');

-- Único parcial: solo aplica cuando slug no está vacío
create unique index if not exists conversions_config_slug_unique
  on public.conversions_config (slug)
  where slug <> '';

comment on column public.conversions_config.slug is 'Identificador único del cliente para la URL del endpoint (ej: kobe).';
