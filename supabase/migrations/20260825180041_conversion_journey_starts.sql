create table if not exists public.conversion_journey_starts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_platform text not null
    check (source_platform in ('landing', 'whatsapp_cloud_api')),
  start_identity_key text not null,
  landing_id uuid null references public.landings (id) on delete set null,
  landing_name text not null default '',
  workspace_currency text not null default 'ARS'
    check (workspace_currency in ('ARS', 'PYG')),
  external_id text not null default '',
  phone text not null default '',
  wa_id text not null default '',
  email text not null default '',
  utm_campaign text not null default '',
  fbp text not null default '',
  fbc text not null default '',
  from_meta_ads boolean not null default false,
  meta_pixel_id text not null default '',
  dataset_id text not null default '',
  ctwa_clid text not null default '',
  telefono_asignado text not null default '',
  assigned_gerencia_id integer null references public.gerencias (id) on delete set null,
  assigned_gerencia_external_id integer null,
  assigned_gerencia_name text null,
  assigned_gerencia_label text null,
  device_type text not null default '',
  event_source_url text not null default '',
  client_ip text not null default '',
  agent_user text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversion_journey_starts_identity_unique
    unique (user_id, source_platform, start_identity_key)
);

comment on table public.conversion_journey_starts is
  'Inicios unicos de recorrido anteriores al Contact: visitas unicas de landing y chats iniciados en WhatsApp Cloud API.';
comment on column public.conversion_journey_starts.start_identity_key is
  'Clave estable por usuario, origen y persona para deduplicar recorridos iniciados.';

create index if not exists conversion_journey_starts_user_seen_idx
  on public.conversion_journey_starts (user_id, first_seen_at desc);
create index if not exists conversion_journey_starts_source_seen_idx
  on public.conversion_journey_starts (source_platform, first_seen_at desc);
create index if not exists conversion_journey_starts_landing_seen_idx
  on public.conversion_journey_starts (landing_id, first_seen_at desc)
  where landing_id is not null;
create index if not exists conversion_journey_starts_external_idx
  on public.conversion_journey_starts (user_id, source_platform, external_id)
  where external_id <> '';
create index if not exists conversion_journey_starts_phone_idx
  on public.conversion_journey_starts (user_id, source_platform, phone)
  where phone <> '';

create or replace function public.set_conversion_journey_starts_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversion_journey_starts_updated_at
  on public.conversion_journey_starts;
create trigger conversion_journey_starts_updated_at
before update on public.conversion_journey_starts
for each row execute function public.set_conversion_journey_starts_updated_at();

create or replace function public.record_conversion_journey_start(
  p_user_id uuid,
  p_source_platform text,
  p_start_identity_key text,
  p_landing_id uuid default null,
  p_landing_name text default '',
  p_workspace_currency text default 'ARS',
  p_external_id text default '',
  p_phone text default '',
  p_wa_id text default '',
  p_email text default '',
  p_utm_campaign text default '',
  p_fbp text default '',
  p_fbc text default '',
  p_from_meta_ads boolean default false,
  p_meta_pixel_id text default '',
  p_dataset_id text default '',
  p_ctwa_clid text default '',
  p_telefono_asignado text default '',
  p_assigned_gerencia_id integer default null,
  p_assigned_gerencia_external_id integer default null,
  p_assigned_gerencia_name text default null,
  p_assigned_gerencia_label text default null,
  p_device_type text default '',
  p_event_source_url text default '',
  p_client_ip text default '',
  p_agent_user text default '',
  p_first_seen_at timestamptz default null,
  p_last_seen_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_source text := lower(btrim(coalesce(p_source_platform, '')));
  v_identity text := btrim(coalesce(p_start_identity_key, ''));
  v_workspace_currency text := upper(btrim(coalesce(p_workspace_currency, 'ARS')));
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;
  if v_source not in ('landing', 'whatsapp_cloud_api') then
    raise exception 'source_platform invalido: %', v_source;
  end if;
  if v_identity = '' then
    raise exception 'p_start_identity_key is required';
  end if;
  if v_workspace_currency not in ('ARS', 'PYG') then
    v_workspace_currency := 'ARS';
  end if;

  insert into public.conversion_journey_starts (
    user_id,
    source_platform,
    start_identity_key,
    landing_id,
    landing_name,
    workspace_currency,
    external_id,
    phone,
    wa_id,
    email,
    utm_campaign,
    fbp,
    fbc,
    from_meta_ads,
    meta_pixel_id,
    dataset_id,
    ctwa_clid,
    telefono_asignado,
    assigned_gerencia_id,
    assigned_gerencia_external_id,
    assigned_gerencia_name,
    assigned_gerencia_label,
    device_type,
    event_source_url,
    client_ip,
    agent_user,
    first_seen_at,
    last_seen_at
  ) values (
    p_user_id,
    v_source,
    v_identity,
    p_landing_id,
    btrim(coalesce(p_landing_name, '')),
    v_workspace_currency,
    btrim(coalesce(p_external_id, '')),
    regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'),
    regexp_replace(coalesce(p_wa_id, ''), '\D', '', 'g'),
    lower(btrim(coalesce(p_email, ''))),
    btrim(coalesce(p_utm_campaign, '')),
    btrim(coalesce(p_fbp, '')),
    btrim(coalesce(p_fbc, '')),
    coalesce(p_from_meta_ads, false),
    regexp_replace(coalesce(p_meta_pixel_id, ''), '\D', '', 'g'),
    btrim(coalesce(p_dataset_id, '')),
    btrim(coalesce(p_ctwa_clid, '')),
    regexp_replace(coalesce(p_telefono_asignado, ''), '\D', '', 'g'),
    p_assigned_gerencia_id,
    p_assigned_gerencia_external_id,
    nullif(btrim(coalesce(p_assigned_gerencia_name, '')), ''),
    nullif(btrim(coalesce(p_assigned_gerencia_label, '')), ''),
    btrim(coalesce(p_device_type, '')),
    left(btrim(coalesce(p_event_source_url, '')), 2048),
    btrim(coalesce(p_client_ip, '')),
    left(btrim(coalesce(p_agent_user, '')), 1024),
    coalesce(p_first_seen_at, now()),
    coalesce(p_last_seen_at, p_first_seen_at, now())
  )
  on conflict on constraint conversion_journey_starts_identity_unique do update
  set
    landing_id = coalesce(excluded.landing_id, conversion_journey_starts.landing_id),
    landing_name = coalesce(nullif(excluded.landing_name, ''), conversion_journey_starts.landing_name),
    workspace_currency = coalesce(nullif(excluded.workspace_currency, ''), conversion_journey_starts.workspace_currency),
    external_id = coalesce(nullif(excluded.external_id, ''), conversion_journey_starts.external_id),
    phone = coalesce(nullif(excluded.phone, ''), conversion_journey_starts.phone),
    wa_id = coalesce(nullif(excluded.wa_id, ''), conversion_journey_starts.wa_id),
    email = coalesce(nullif(excluded.email, ''), conversion_journey_starts.email),
    utm_campaign = coalesce(nullif(excluded.utm_campaign, ''), conversion_journey_starts.utm_campaign),
    fbp = coalesce(nullif(excluded.fbp, ''), conversion_journey_starts.fbp),
    fbc = coalesce(nullif(excluded.fbc, ''), conversion_journey_starts.fbc),
    from_meta_ads = conversion_journey_starts.from_meta_ads or excluded.from_meta_ads,
    meta_pixel_id = coalesce(nullif(excluded.meta_pixel_id, ''), conversion_journey_starts.meta_pixel_id),
    dataset_id = coalesce(nullif(excluded.dataset_id, ''), conversion_journey_starts.dataset_id),
    ctwa_clid = coalesce(nullif(excluded.ctwa_clid, ''), conversion_journey_starts.ctwa_clid),
    telefono_asignado = coalesce(nullif(excluded.telefono_asignado, ''), conversion_journey_starts.telefono_asignado),
    assigned_gerencia_id = coalesce(excluded.assigned_gerencia_id, conversion_journey_starts.assigned_gerencia_id),
    assigned_gerencia_external_id = coalesce(excluded.assigned_gerencia_external_id, conversion_journey_starts.assigned_gerencia_external_id),
    assigned_gerencia_name = coalesce(excluded.assigned_gerencia_name, conversion_journey_starts.assigned_gerencia_name),
    assigned_gerencia_label = coalesce(excluded.assigned_gerencia_label, conversion_journey_starts.assigned_gerencia_label),
    device_type = coalesce(nullif(excluded.device_type, ''), conversion_journey_starts.device_type),
    event_source_url = coalesce(nullif(excluded.event_source_url, ''), conversion_journey_starts.event_source_url),
    client_ip = coalesce(nullif(excluded.client_ip, ''), conversion_journey_starts.client_ip),
    agent_user = coalesce(nullif(excluded.agent_user, ''), conversion_journey_starts.agent_user),
    first_seen_at = least(conversion_journey_starts.first_seen_at, excluded.first_seen_at),
    last_seen_at = greatest(conversion_journey_starts.last_seen_at, excluded.last_seen_at),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

alter table public.conversion_journey_starts enable row level security;

drop policy if exists "conversion_journey_starts_owner_read"
  on public.conversion_journey_starts;
create policy "conversion_journey_starts_owner_read"
on public.conversion_journey_starts for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "conversion_journey_starts_admin_read"
  on public.conversion_journey_starts;
create policy "conversion_journey_starts_admin_read"
on public.conversion_journey_starts for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

revoke all on public.conversion_journey_starts from anon, authenticated;
grant select on public.conversion_journey_starts to authenticated;
grant all on public.conversion_journey_starts to service_role;

revoke all on function public.record_conversion_journey_start(
  uuid, text, text, uuid, text, text, text, text, text, text, text, text, text,
  boolean, text, text, text, text, integer, integer, text, text, text, text,
  text, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_conversion_journey_start(
  uuid, text, text, uuid, text, text, text, text, text, text, text, text, text,
  boolean, text, text, text, text, integer, integer, text, text, text, text,
  text, text, timestamptz, timestamptz
) to service_role;

with latest_assignment as (
  select distinct on (a.contact_id)
    a.contact_id,
    a.assigned_phone,
    a.assigned_gerencia_id,
    a.assigned_gerencia_external_id,
    a.assigned_gerencia_label,
    a.created_at
  from public.whatsapp_cloud_api_assignments a
  order by a.contact_id, a.created_at desc
),
latest_session as (
  select distinct on (s.contact_id)
    s.contact_id,
    s.ctwa_clid,
    s.source_url,
    s.started_at
  from public.whatsapp_cloud_api_attribution_sessions s
  order by s.contact_id, s.started_at desc
)
insert into public.conversion_journey_starts (
  user_id,
  source_platform,
  start_identity_key,
  landing_name,
  workspace_currency,
  external_id,
  phone,
  wa_id,
  from_meta_ads,
  dataset_id,
  ctwa_clid,
  telefono_asignado,
  assigned_gerencia_id,
  assigned_gerencia_external_id,
  assigned_gerencia_name,
  assigned_gerencia_label,
  event_source_url,
  first_seen_at,
  last_seen_at,
  created_at,
  updated_at
)
select
  c.user_id,
  'whatsapp_cloud_api',
  concat('whatsapp_cloud_api:', c.config_id::text, ':', c.wa_id),
  coalesce(cfg.name, ''),
  coalesce(nullif(cfg.workspace_currency, ''), 'ARS'),
  coalesce(c.external_id, ''),
  coalesce(c.phone, c.wa_id, ''),
  coalesce(c.wa_id, ''),
  coalesce(nullif(s.ctwa_clid, ''), '') <> '',
  coalesce(cfg.meta_messaging_dataset_id, ''),
  coalesce(s.ctwa_clid, ''),
  coalesce(a.assigned_phone, ''),
  a.assigned_gerencia_id,
  a.assigned_gerencia_external_id,
  nullif(btrim(coalesce(g.nombre, '')), ''),
  nullif(
    btrim(
      coalesce(
        nullif(a.assigned_gerencia_label, ''),
        case
          when g.nombre is not null and a.assigned_gerencia_external_id is not null
            then concat(g.nombre, ' (ID ', a.assigned_gerencia_external_id, ')')
          when a.assigned_gerencia_external_id is not null
            then concat('Gerencia ', a.assigned_gerencia_external_id)
          else ''
        end
      )
    ),
    ''
  ),
  coalesce(nullif(s.source_url, ''), concat('whatsapp-cloud-api://', cfg.phone_number_id)),
  coalesce(c.first_message_at, c.created_at, s.started_at, now()),
  coalesce(c.last_message_at, c.first_message_at, c.created_at, s.started_at, now()),
  coalesce(c.created_at, c.first_message_at, now()),
  now()
from public.whatsapp_cloud_api_contacts c
join public.whatsapp_cloud_api_configs cfg
  on cfg.id = c.config_id
left join latest_assignment a
  on a.contact_id = c.id
left join public.gerencias g
  on g.id = a.assigned_gerencia_id
left join latest_session s
  on s.contact_id = c.id
where c.user_id is not null
  and coalesce(c.wa_id, '') <> ''
on conflict on constraint conversion_journey_starts_identity_unique do update
set
  landing_name = coalesce(nullif(excluded.landing_name, ''), conversion_journey_starts.landing_name),
  workspace_currency = excluded.workspace_currency,
  external_id = coalesce(nullif(excluded.external_id, ''), conversion_journey_starts.external_id),
  phone = coalesce(nullif(excluded.phone, ''), conversion_journey_starts.phone),
  wa_id = coalesce(nullif(excluded.wa_id, ''), conversion_journey_starts.wa_id),
  from_meta_ads = conversion_journey_starts.from_meta_ads or excluded.from_meta_ads,
  dataset_id = coalesce(nullif(excluded.dataset_id, ''), conversion_journey_starts.dataset_id),
  ctwa_clid = coalesce(nullif(excluded.ctwa_clid, ''), conversion_journey_starts.ctwa_clid),
  telefono_asignado = coalesce(nullif(excluded.telefono_asignado, ''), conversion_journey_starts.telefono_asignado),
  assigned_gerencia_id = coalesce(excluded.assigned_gerencia_id, conversion_journey_starts.assigned_gerencia_id),
  assigned_gerencia_external_id = coalesce(excluded.assigned_gerencia_external_id, conversion_journey_starts.assigned_gerencia_external_id),
  assigned_gerencia_name = coalesce(excluded.assigned_gerencia_name, conversion_journey_starts.assigned_gerencia_name),
  assigned_gerencia_label = coalesce(excluded.assigned_gerencia_label, conversion_journey_starts.assigned_gerencia_label),
  event_source_url = coalesce(nullif(excluded.event_source_url, ''), conversion_journey_starts.event_source_url),
  first_seen_at = least(conversion_journey_starts.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(conversion_journey_starts.last_seen_at, excluded.last_seen_at),
  updated_at = now();
