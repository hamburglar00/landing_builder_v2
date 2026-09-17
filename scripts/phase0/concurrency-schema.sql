-- Minimal synthetic dependencies. Actual tested functions/indexes are loaded from migrations.
create table public.profiles(id uuid primary key, role text default 'client');
create table public.landings(id uuid primary key, name text unique, user_id uuid,
  gerencia_selection_mode text, gerencia_fair_criterion text);
create table public.gerencias(id integer primary key, user_id uuid, gerencia_id integer, fair_criterion text);
create table public.gerencia_phones(id bigint primary key, gerencia_id integer references public.gerencias(id),
  phone text, kind text, status text default 'active', assignment_role text default 'acquisition',
  usage_count bigint default 0, messages_reset_at timestamptz);
create table public.landings_gerencias(landing_id uuid, gerencia_id integer, weight integer,
  phone_mode text, phone_kind text, interval_start_hour integer, interval_end_hour integer);
alter table public.conversions add column landing_id uuid,
  add column lead_event_id text default '', add column lead_event_time bigint,
  add column telefono_asignado text default '', add column contact_event_id text default '',
  add column promo_code text default '', add column purchase_payload_raw text default '',
  add column contact_event_time bigint;
create table public.whatsapp_cloud_api_configs(id uuid primary key);
