alter table public.conversions
  add column if not exists lead_player_username text not null default '',
  add column if not exists registration_event_id text not null default '',
  add column if not exists registration_event_time bigint,
  add column if not exists registration_payload_raw text not null default '',
  add column if not exists registration_player_username text not null default '',
  add column if not exists registration_bot_phone text not null default '',
  add column if not exists registration_agency_id text not null default '',
  add column if not exists registration_gerencia_id integer,
  add column if not exists registration_gerencia_external_id integer,
  add column if not exists registration_gerencia_name text not null default '',
  add column if not exists registration_gerencia_label text not null default '',
  add column if not exists registration_incoming_promo_code text not null default '',
  add column if not exists registration_attribution_status text not null default '',
  add column if not exists registration_attribution_conversion_id uuid,
  add column if not exists purchase_player_username text not null default '';

comment on column public.conversions.lead_player_username is
  'player_username recibido en action LEAD. Puede venir vacio o igual al phone hasta que el bot cree el usuario.';
comment on column public.conversions.registration_player_username is
  'player_username recibido en action COMPLETEREGISTRATION. Identifica al jugador dentro de una gerencia cuando el bot ya creo el usuario.';
comment on column public.conversions.purchase_player_username is
  'player_username recibido en action PURCHASE, si el bot lo informa.';

create index if not exists idx_conversions_lead_player_username
  on public.conversions (user_id, lead_player_username)
  where lead_player_username <> '';

create index if not exists idx_conversions_registration_player_username
  on public.conversions (user_id, registration_player_username)
  where registration_player_username <> '';

create index if not exists idx_conversions_purchase_player_username
  on public.conversions (user_id, purchase_player_username)
  where purchase_player_username <> '';

