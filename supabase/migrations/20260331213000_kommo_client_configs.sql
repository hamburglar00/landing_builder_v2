create table if not exists public.kommo_client_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kommo_api_base_url text not null,
  kommo_access_token text not null,
  active boolean not null default true,
  sync_status text not null default 'pending',
  sync_error text null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kommo_client_configs_user_unique unique (user_id),
  constraint kommo_client_configs_name_format check (name ~ '^[a-z0-9-]+$'),
  constraint kommo_client_configs_sync_status check (sync_status in ('pending', 'synced', 'error'))
);

alter table public.kommo_client_configs enable row level security;

drop policy if exists "Users can read own kommo_client_configs" on public.kommo_client_configs;
create policy "Users can read own kommo_client_configs"
  on public.kommo_client_configs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own kommo_client_configs" on public.kommo_client_configs;
create policy "Users can insert own kommo_client_configs"
  on public.kommo_client_configs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own kommo_client_configs" on public.kommo_client_configs;
create policy "Users can update own kommo_client_configs"
  on public.kommo_client_configs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own kommo_client_configs" on public.kommo_client_configs;
create policy "Users can delete own kommo_client_configs"
  on public.kommo_client_configs for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all kommo_client_configs" on public.kommo_client_configs;
create policy "Admins can read all kommo_client_configs"
  on public.kommo_client_configs for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can insert all kommo_client_configs" on public.kommo_client_configs;
create policy "Admins can insert all kommo_client_configs"
  on public.kommo_client_configs for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update all kommo_client_configs" on public.kommo_client_configs;
create policy "Admins can update all kommo_client_configs"
  on public.kommo_client_configs for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can delete all kommo_client_configs" on public.kommo_client_configs;
create policy "Admins can delete all kommo_client_configs"
  on public.kommo_client_configs for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

comment on table public.kommo_client_configs is 'Configuracion de integracion Kommo por cliente, con estado de sincronizacion al intermediario.';
