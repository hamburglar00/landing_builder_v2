-- Modo de selección de teléfono por landing y tabla de teléfonos por gerencia.

-- Modo de selección de teléfono:
-- - 'random': elige un número activo al azar.
-- - 'fair': elige el número activo con menor usage_count (round-robin simple).
alter table public.landings
add column if not exists phone_mode text not null default 'random'
  check (phone_mode in ('random', 'fair'));

comment on column public.landings.phone_mode is
  'Modo de selección de teléfono: random (aleatorio) o fair (equitativo).';

-- Teléfonos por gerencia.
-- Un mismo número puede aparecer varias veces si la API externa así lo devuelve;
-- la clave lógica es (gerencia_id, phone).
create table if not exists public.gerencia_phones (
  id bigserial primary key,
  gerencia_id integer not null references public.gerencias (id) on delete cascade,
  phone text not null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  usage_count bigint not null default 0,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gerencia_id, phone)
);

comment on table public.gerencia_phones is
  'Números de teléfono por gerencia, con estado y contador de uso.';

create index if not exists gerencia_phones_gerencia_id_status_idx
  on public.gerencia_phones (gerencia_id, status);

-- Trigger para updated_at en gerencia_phones
create or replace function public.set_gerencia_phones_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists gerencia_phones_updated_at on public.gerencia_phones;

create trigger gerencia_phones_updated_at
before update on public.gerencia_phones
for each row
execute function public.set_gerencia_phones_updated_at();

alter table public.gerencia_phones enable row level security;

-- El dueño de la gerencia puede gestionar sus teléfonos.
create policy "Users manage own gerencia phones"
on public.gerencia_phones
for all
using (
  exists (
    select 1 from public.gerencias g
    where g.id = gerencia_id and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.gerencias g
    where g.id = gerencia_id and g.user_id = auth.uid()
  )
);

-- Los admins pueden leer todos los teléfonos (soporte).
create policy "Admins can read all gerencia phones"
on public.gerencia_phones
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

