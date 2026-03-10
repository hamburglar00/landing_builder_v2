-- Alinear id interno con id externo (gerencia_id) en public.gerencias
-- y hacer que siempre sean iguales.

-- 1) Soltar FKs que apuntan a gerencias.id
alter table public.landings_gerencias
  drop constraint if exists landings_gerencias_gerencia_id_fkey;

alter table public.gerencia_phones
  drop constraint if exists gerencia_phones_gerencia_id_fkey;

-- 2) Soltar PK temporalmente para poder reasignar id
alter table public.gerencias
  drop constraint if exists gerencias_pkey;

-- 3) Actualizar landings_gerencias y gerencia_phones para que usen gerencia_id externo
update public.landings_gerencias lg
set gerencia_id = g.gerencia_id
from public.gerencias g
where lg.gerencia_id = g.id;

update public.gerencia_phones gp
set gerencia_id = g.gerencia_id
from public.gerencias g
where gp.gerencia_id = g.id;

-- 4) Forzar que id = gerencia_id para todas las gerencias
update public.gerencias
set id = gerencia_id;

-- 5) Volver a crear la PK sobre id
alter table public.gerencias
  add constraint gerencias_pkey primary key (id);

-- 6) Quitar default de id (ya no es serial automático)
alter table public.gerencias
  alter column id drop default;

-- 7) Asegurar por constraint que id y gerencia_id siempre sean iguales
alter table public.gerencias
  add constraint gerencias_id_equals_gerencia_id_check
  check (id = gerencia_id);

-- 8) Recrear FKs con ON UPDATE CASCADE para propagar cambios de id/gerencia_id
alter table public.landings_gerencias
  add constraint landings_gerencias_gerencia_id_fkey
  foreign key (gerencia_id)
  references public.gerencias (id)
  on delete cascade
  on update cascade;

alter table public.gerencia_phones
  add constraint gerencia_phones_gerencia_id_fkey
  foreign key (gerencia_id)
  references public.gerencias (id)
  on delete cascade
  on update cascade;

