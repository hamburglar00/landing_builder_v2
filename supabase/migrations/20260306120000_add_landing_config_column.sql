-- Agrega columna landing_config a public.landings.
-- Migración sin riesgo: no borra ni modifica datos existentes.

alter table public.landings
add column if not exists landing_config jsonb;

comment on column public.landings.landing_config is
  'Payload JSON final de configuración de la landing (schemaVersion, updatedAt, tracking, background, content, typography, colors, layout).';

-- Antes de crear un índice UNIQUE sobre name, verificá si hay duplicados:
--   select name, count(*) 
--   from public.landings 
--   group by name 
--   having count(*) > 1;
--
-- Si el resultado es vacío, entonces es seguro crear el índice (en otra migración):
--   create unique index concurrently if not exists landings_name_unique
--   on public.landings (name);

