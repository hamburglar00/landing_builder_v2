-- Registrar si la gerencia estaba asignada a landings al momento del snapshot.
-- La disponibilidad solo debe medir periodos donde la gerencia participaba en al menos una landing.

alter table public.gerencia_phone_availability_snapshots
  add column if not exists assigned_landing_count integer;

create index if not exists gerencia_phone_availability_assigned_idx
  on public.gerencia_phone_availability_snapshots (user_id, checked_at desc)
  where assigned_landing_count > 0;
