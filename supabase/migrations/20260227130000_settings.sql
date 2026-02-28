-- Configuración global: solo accesible por administradores.
-- Una sola fila (id = 1).

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  url_base text not null default ''
);

comment on table public.settings is 'Configuración global; solo administradores pueden leer y modificar.';

insert into public.settings (id, url_base) values (1, '');

alter table public.settings enable row level security;

-- Solo admins pueden leer
create policy "Admins can read settings"
on public.settings
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

-- Solo admins pueden actualizar
create policy "Admins can update settings"
on public.settings
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

-- Solo admins pueden insert (por si se borra la fila)
create policy "Admins can insert settings"
on public.settings
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
