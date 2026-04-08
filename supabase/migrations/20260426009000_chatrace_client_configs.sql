create table if not exists public.chatrace_client_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  meta_pixel_id text not null default '',
  post_url text not null default '',
  landing_tag text not null default '',
  send_contact_pixel boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatrace_client_configs_user_unique unique (user_id),
  constraint chatrace_client_configs_name_format check (name ~ '^[a-z0-9-]+$')
);

alter table public.chatrace_client_configs enable row level security;

drop policy if exists "Users can read own chatrace_client_configs" on public.chatrace_client_configs;
create policy "Users can read own chatrace_client_configs"
  on public.chatrace_client_configs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own chatrace_client_configs" on public.chatrace_client_configs;
create policy "Users can insert own chatrace_client_configs"
  on public.chatrace_client_configs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own chatrace_client_configs" on public.chatrace_client_configs;
create policy "Users can update own chatrace_client_configs"
  on public.chatrace_client_configs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own chatrace_client_configs" on public.chatrace_client_configs;
create policy "Users can delete own chatrace_client_configs"
  on public.chatrace_client_configs for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all chatrace_client_configs" on public.chatrace_client_configs;
create policy "Admins can read all chatrace_client_configs"
  on public.chatrace_client_configs for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can insert all chatrace_client_configs" on public.chatrace_client_configs;
create policy "Admins can insert all chatrace_client_configs"
  on public.chatrace_client_configs for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update all chatrace_client_configs" on public.chatrace_client_configs;
create policy "Admins can update all chatrace_client_configs"
  on public.chatrace_client_configs for update
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

drop policy if exists "Admins can delete all chatrace_client_configs" on public.chatrace_client_configs;
create policy "Admins can delete all chatrace_client_configs"
  on public.chatrace_client_configs for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

comment on table public.chatrace_client_configs is 'Configuracion de integracion Chatrace por cliente.';
