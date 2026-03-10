-- Permite a los admins editar y eliminar cualquier landing (incluidas las de clientes).

create policy "Admins can update all landings"
on public.landings
for update
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

create policy "Admins can delete all landings"
on public.landings
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

-- Admins pueden insertar y eliminar asignaciones landings_gerencias (al guardar una landing de un cliente).
create policy "Admins can insert landings_gerencias"
on public.landings_gerencias
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "Admins can delete landings_gerencias"
on public.landings_gerencias
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
