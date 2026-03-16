-- Tabla principal de conversiones: almacena eventos contact, lead y purchase.
-- Reemplaza la hoja "Leads" del Google Sheet + Apps Script.

create table public.conversions (
  id uuid primary key default gen_random_uuid(),
  landing_id uuid references public.landings (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  landing_name text not null default '',

  -- Identidad del contacto
  phone text not null default '',
  email text not null default '',
  fn text not null default '',
  ln text not null default '',

  -- Geo del contacto (para Meta user_data)
  ct text not null default '',
  st text not null default '',
  zip text not null default '',
  country text not null default '',

  -- Facebook browser/click IDs
  fbp text not null default '',
  fbc text not null default '',

  -- Event IDs y times para deduplicación Pixel + CAPI
  contact_event_id text not null default '',
  contact_event_time bigint,
  lead_event_id text not null default '',
  lead_event_time bigint,
  purchase_event_id text not null default '',
  purchase_event_time bigint,

  -- Metadata del request
  client_ip text not null default '',
  agent_user text not null default '',
  device_type text not null default '',
  event_source_url text not null default '',

  -- Estado y valor
  estado text not null default 'contact' check (estado in ('contact', 'lead', 'purchase')),
  valor numeric not null default 0,

  -- Status de envío a Meta CAPI por tipo de evento
  contact_status_capi text not null default '',
  lead_status_capi text not null default '',
  purchase_status_capi text not null default '',

  -- Observaciones acumuladas (tokens con |)
  observaciones text not null default '',

  -- Campos de tracking / segmentación
  external_id text not null default '',
  utm_campaign text not null default '',
  telefono_asignado text not null default '',
  promo_code text not null default '',

  -- Geo enriquecida por IP
  geo_city text not null default '',
  geo_region text not null default '',
  geo_country text not null default '',

  -- Timestamps
  created_at timestamptz not null default now()
);

alter table public.conversions enable row level security;

-- El usuario puede leer sus propias conversiones
create policy "Users can read own conversions"
  on public.conversions for select
  using (auth.uid() = user_id);

-- Admins pueden leer todas las conversiones
create policy "Admins can read all conversions"
  on public.conversions for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Índices para queries frecuentes
create index idx_conversions_user_id on public.conversions (user_id);
create index idx_conversions_landing_id on public.conversions (landing_id);
create index idx_conversions_phone on public.conversions (phone) where phone <> '';
create index idx_conversions_promo_code on public.conversions (promo_code) where promo_code <> '';
create index idx_conversions_retry on public.conversions (estado, purchase_status_capi) where estado = 'purchase' and purchase_status_capi <> 'enviado';
create index idx_conversions_created_at on public.conversions (created_at desc);

comment on table public.conversions is 'Eventos de conversión (contact/lead/purchase) recibidos desde las landings y sistemas externos.';
