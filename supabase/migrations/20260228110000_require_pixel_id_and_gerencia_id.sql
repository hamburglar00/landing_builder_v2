-- pixel_id y gerencia_id son obligatorios (no opcionales).

-- Landings: pixel_id NOT NULL (ya tiene default '' para filas existentes).
alter table public.landings
  alter column pixel_id set default '',
  alter column pixel_id set not null;

-- Gerencias: gerencia_id NOT NULL. Asignar 0 a los existentes que estén en null y poner default 0.
update public.gerencias set gerencia_id = 0 where gerencia_id is null;
alter table public.gerencias
  alter column gerencia_id set default 0,
  alter column gerencia_id set not null;
