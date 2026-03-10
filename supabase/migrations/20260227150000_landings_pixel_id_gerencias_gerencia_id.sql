-- Landings: agregar pixel_id (texto, opcional).
alter table public.landings
add column if not exists pixel_id text default '';

comment on column public.landings.pixel_id is 'ID del pixel para tracking (referencia externa).';

-- Gerencias: gerencia_id es el identificador para invocar la API externa.
-- Con ese id se consulta la API externa que devuelve el JSON de números de teléfono
-- que pertenecen a esa gerencia. Un cliente puede tener varias gerencias;
-- una gerencia puede tener varios números de teléfono (relación resuelta en la API externa).
alter table public.gerencias
add column if not exists gerencia_id integer;

comment on column public.gerencias.gerencia_id is 'ID para invocar API externa que devuelve los números de teléfono de esta gerencia.';
