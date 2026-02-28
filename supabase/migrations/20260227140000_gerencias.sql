-- Gerencias: un usuario puede tener muchas. id es siempre entero (gerencia id).
create table public.gerencias (
  id serial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null
);

comment on table public.gerencias is 'Gerencias del usuario; cada una tiene id entero y nombre.';
create index gerencias_user_id_idx on public.gerencias (user_id);

alter table public.gerencias enable row level security;

create policy "Users manage own gerencias"
on public.gerencias
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Admins pueden leer todas (soporte)
create policy "Admins can read all gerencias"
on public.gerencias
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

-- Una landing puede tener muchas gerencias asignadas (N:N).
create table public.landings_gerencias (
  landing_id uuid not null references public.landings (id) on delete cascade,
  gerencia_id integer not null references public.gerencias (id) on delete cascade,
  primary key (landing_id, gerencia_id)
);

comment on table public.landings_gerencias is 'Asignación de gerencias a landings (N:N).';
create index landings_gerencias_landing_id_idx on public.landings_gerencias (landing_id);
create index landings_gerencias_gerencia_id_idx on public.landings_gerencias (gerencia_id);

alter table public.landings_gerencias enable row level security;

-- Solo el dueño de la landing y de la gerencia puede insertar/delete (asignar/desasignar).
create policy "Users manage own landing gerencia assignments"
on public.landings_gerencias
for all
using (
  exists (
    select 1 from public.landings l
    where l.id = landing_id and l.user_id = auth.uid()
  )
  and exists (
    select 1 from public.gerencias g
    where g.id = gerencia_id and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.landings l
    where l.id = landing_id and l.user_id = auth.uid()
  )
  and exists (
    select 1 from public.gerencias g
    where g.id = gerencia_id and g.user_id = auth.uid()
  )
);

-- Admins pueden leer todas las asignaciones
create policy "Admins can read landings_gerencias"
on public.landings_gerencias
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
