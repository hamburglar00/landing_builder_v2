-- Snapshots de disponibilidad por gerencia.
-- Permite calcular que porcentaje del periodo tuvo al menos un telefono activo.

create table if not exists public.gerencia_phone_availability_snapshots (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  gerencia_id integer not null references public.gerencias (id) on delete cascade,
  checked_at timestamptz not null default now(),
  active_phone_count integer not null default 0,
  total_phone_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gerencia_phone_availability_snapshots enable row level security;

drop policy if exists "Users read own gerencia phone availability snapshots"
  on public.gerencia_phone_availability_snapshots;
create policy "Users read own gerencia phone availability snapshots"
  on public.gerencia_phone_availability_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists "Admins read all gerencia phone availability snapshots"
  on public.gerencia_phone_availability_snapshots;
create policy "Admins read all gerencia phone availability snapshots"
  on public.gerencia_phone_availability_snapshots
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create index if not exists gerencia_phone_availability_user_checked_idx
  on public.gerencia_phone_availability_snapshots (user_id, checked_at desc);

create index if not exists gerencia_phone_availability_gerencia_checked_idx
  on public.gerencia_phone_availability_snapshots (gerencia_id, checked_at desc);
