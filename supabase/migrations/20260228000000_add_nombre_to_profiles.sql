-- Añadir campo nombre al perfil (para clientes y admins)
alter table public.profiles
add column if not exists nombre text;
