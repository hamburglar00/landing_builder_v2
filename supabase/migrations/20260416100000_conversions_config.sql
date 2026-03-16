-- Configuración de conversiones (Meta CAPI) por usuario.
-- Cada cliente tiene una sola config que alimenta todas sus landings.

create table public.conversions_config (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pixel_id text not null default '',
  meta_access_token text not null default '',
  meta_currency text not null default 'ARS',
  meta_api_version text not null default 'v25.0',
  send_contact_capi boolean not null default false,
  geo_use_ipapi boolean not null default false,
  geo_fill_only_when_missing boolean not null default false,
  test_event_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversions_config enable row level security;

-- El usuario lee/edita su propia config
create policy "Users can read own conversions_config"
  on public.conversions_config for select
  using (auth.uid() = user_id);

create policy "Users can update own conversions_config"
  on public.conversions_config for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own conversions_config"
  on public.conversions_config for insert
  with check (auth.uid() = user_id);

-- Admins pueden ver y editar la config de cualquier usuario
create policy "Admins can read all conversions_config"
  on public.conversions_config for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update all conversions_config"
  on public.conversions_config for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can insert all conversions_config"
  on public.conversions_config for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

comment on table public.conversions_config is 'Configuración Meta CAPI por usuario (un registro por cliente).';
comment on column public.conversions_config.pixel_id is 'ID del Pixel de Meta. Se sincroniza a todas las landings del usuario.';
comment on column public.conversions_config.meta_access_token is 'Token de acceso a Meta Conversions API (sensible).';
comment on column public.conversions_config.meta_currency is 'Moneda para eventos Purchase (ej: ARS, USD).';
comment on column public.conversions_config.send_contact_capi is 'Si true, envía evento Contact por CAPI al recibir contacto de la landing.';
comment on column public.conversions_config.test_event_code is 'Si no vacío, se envía como test_event_code en los payloads a Meta (modo test).';
