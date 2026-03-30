-- Multi-pixel configs per client (compatible with existing conversions_config).

create table if not exists public.conversions_pixel_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pixel_id text not null,
  meta_access_token text not null,
  meta_currency text not null default 'ARS',
  meta_api_version text not null default 'v25.0',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversions_pixel_configs_pixel_id_numeric check (pixel_id ~ '^[0-9]+$'),
  constraint conversions_pixel_configs_currency_len check (char_length(meta_currency) between 3 and 8)
);

create unique index if not exists conversions_pixel_configs_user_pixel_unique
  on public.conversions_pixel_configs(user_id, pixel_id);

create unique index if not exists conversions_pixel_configs_user_default_unique
  on public.conversions_pixel_configs(user_id)
  where is_default = true;

alter table public.conversions_pixel_configs enable row level security;

drop policy if exists "Users can read own conversions_pixel_configs" on public.conversions_pixel_configs;
create policy "Users can read own conversions_pixel_configs"
  on public.conversions_pixel_configs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own conversions_pixel_configs" on public.conversions_pixel_configs;
create policy "Users can insert own conversions_pixel_configs"
  on public.conversions_pixel_configs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own conversions_pixel_configs" on public.conversions_pixel_configs;
create policy "Users can update own conversions_pixel_configs"
  on public.conversions_pixel_configs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own conversions_pixel_configs" on public.conversions_pixel_configs;
create policy "Users can delete own conversions_pixel_configs"
  on public.conversions_pixel_configs for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all conversions_pixel_configs" on public.conversions_pixel_configs;
create policy "Admins can read all conversions_pixel_configs"
  on public.conversions_pixel_configs for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can insert all conversions_pixel_configs" on public.conversions_pixel_configs;
create policy "Admins can insert all conversions_pixel_configs"
  on public.conversions_pixel_configs for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update all conversions_pixel_configs" on public.conversions_pixel_configs;
create policy "Admins can update all conversions_pixel_configs"
  on public.conversions_pixel_configs for update
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

drop policy if exists "Admins can delete all conversions_pixel_configs" on public.conversions_pixel_configs;
create policy "Admins can delete all conversions_pixel_configs"
  on public.conversions_pixel_configs for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Backfill from legacy single config table, preserving current behavior.
insert into public.conversions_pixel_configs (
  user_id,
  pixel_id,
  meta_access_token,
  meta_currency,
  meta_api_version,
  is_default
)
select
  cc.user_id,
  cc.pixel_id,
  cc.meta_access_token,
  coalesce(nullif(cc.meta_currency, ''), 'ARS'),
  coalesce(nullif(cc.meta_api_version, ''), 'v25.0'),
  true
from public.conversions_config cc
where cc.pixel_id is not null
  and cc.pixel_id <> ''
  and cc.meta_access_token is not null
  and cc.meta_access_token <> ''
on conflict (user_id, pixel_id) do update
set
  meta_access_token = excluded.meta_access_token,
  meta_currency = excluded.meta_currency,
  meta_api_version = excluded.meta_api_version,
  is_default = public.conversions_pixel_configs.is_default or excluded.is_default,
  updated_at = now();

comment on table public.conversions_pixel_configs is 'Configuraciones CAPI por pixel para cada cliente (multi-pixel).';
