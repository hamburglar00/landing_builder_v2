alter table public.conversions
  add column if not exists atrio_players_id text not null default '',
  add column if not exists lead_atrio_players_id text not null default '',
  add column if not exists purchase_atrio_players_id text not null default '',
  add column if not exists registration_atrio_players_id text not null default '';

comment on column public.conversions.atrio_players_id is
  'Identificador del jugador/cliente dentro de Atrio, si Atrio lo informa.';
comment on column public.conversions.lead_atrio_players_id is
  'players_id recibido en action LEAD desde Atrio.';
comment on column public.conversions.purchase_atrio_players_id is
  'players_id recibido en action PURCHASE desde Atrio.';
comment on column public.conversions.registration_atrio_players_id is
  'players_id recibido en action COMPLETEREGISTRATION desde Atrio, si existiera.';

create index if not exists conversions_user_atrio_players_idx
  on public.conversions (user_id, atrio_players_id, created_at desc)
  where coalesce(atrio_players_id, '') <> '';

create index if not exists conversions_user_lead_atrio_players_idx
  on public.conversions (user_id, lead_atrio_players_id, created_at desc)
  where coalesce(lead_atrio_players_id, '') <> '';

create index if not exists conversions_user_purchase_atrio_players_idx
  on public.conversions (user_id, purchase_atrio_players_id, created_at desc)
  where coalesce(purchase_atrio_players_id, '') <> '';
