-- Landings: agregar pixel_id (texto, opcional).
alter table public.landings
add column if not exists pixel_id text default '';

comment on column public.landings.pixel_id is 'ID del pixel para tracking (referencia externa).';

-- Gerencias: agregar gerencia_id (entero para referencia a objeto externo).
alter table public.gerencias
add column if not exists gerencia_id integer;

comment on column public.gerencias.gerencia_id is 'ID entero de referencia a un objeto externo.';
