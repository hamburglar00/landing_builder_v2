-- Añade flag para controlar si los clientes ven el preview del editor de landings.

alter table public.settings
  add column if not exists show_client_landing_preview boolean not null default true;

comment on column public.settings.show_client_landing_preview is
  'Si es true, los clientes ven el preview del editor de landings en el dashboard. Solo admins pueden cambiarlo.';

-- Permitir que cualquier usuario autenticado lea la configuración (no contiene datos sensibles),
-- manteniendo que solo administradores puedan modificarla. Esta policy se suma a las existentes.
create policy "Authenticated can read settings"
on public.settings
for select
to authenticated
using (true);

