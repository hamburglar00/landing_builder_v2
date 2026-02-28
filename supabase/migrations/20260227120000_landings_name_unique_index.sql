-- Nombre único en toda la tabla y índice para búsquedas por nombre.
-- Primero deshacemos duplicados existentes (sufijo con id).
update public.landings a
set name = a.name || ' (' || substr(a.id::text, 1, 8) || ')'
where exists (
  select 1 from public.landings b
  where b.name = a.name and b.id < a.id
);

-- Restricción única: no puede haber dos landings con el mismo nombre.
-- Crea implícitamente un índice único (btree) que sirve para búsquedas por nombre.
alter table public.landings
add constraint landings_name_key unique (name);
