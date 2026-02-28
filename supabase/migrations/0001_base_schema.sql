-- Base schema for admin / client roles

-- Tabla de perfiles enlazada a auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

-- Trigger para crear un perfil automáticamente cuando se crea un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Políticas básicas: cada usuario solo puede ver/editar su propio perfil
create policy "Read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

