-- Garantizar relación 1 a 1 entre id interno (PK) y gerencia_id externo.
-- Política: para cada gerencia_id duplicado se conserva la fila con id más bajo
-- (keep_id) y se re-asignan las referencias antes de borrar las demás.

-- 1) Reasignar referencias en landings_gerencias y gerencia_phones
with dups as (
  select
    gerencia_id,
    min(id) as keep_id,
    array_agg(id) as all_ids
  from public.gerencias
  group by gerencia_id
  having count(*) > 1
),
reassign_landings as (
  update public.landings_gerencias lg
  set gerencia_id = d.keep_id
  from dups d
  where lg.gerencia_id = any(d.all_ids)
    and lg.gerencia_id <> d.keep_id
),
reassign_phones as (
  update public.gerencia_phones gp
  set gerencia_id = d.keep_id
  from dups d
  where gp.gerencia_id = any(d.all_ids)
    and gp.gerencia_id <> d.keep_id
)
-- 2) Borrar filas de gerencias duplicadas, conservando solo keep_id
delete from public.gerencias g
using dups d
where g.gerencia_id = d.gerencia_id
  and g.id <> d.keep_id;

-- 3) Eliminar default de gerencia_id y volverlo estrictamente único
alter table public.gerencias
  alter column gerencia_id drop default;

alter table public.gerencias
  add constraint gerencias_gerencia_id_unique unique (gerencia_id);

