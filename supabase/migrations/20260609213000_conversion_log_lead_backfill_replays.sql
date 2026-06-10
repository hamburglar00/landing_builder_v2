-- Tracks one-off replays of historical LEAD payloads that were previously
-- ignored because the bot reused action_event_id with a different promo_code.
create table if not exists public.conversion_log_lead_backfill_replays (
  log_id bigint primary key references public.conversion_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null default 'LEAD',
  action_event_id text not null default '',
  promo_code text not null default '',
  status text not null check (status in ('replayed', 'skipped', 'error')),
  http_status integer,
  response_body text not null default '',
  notes text not null default '',
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.conversion_log_lead_backfill_replays enable row level security;

comment on table public.conversion_log_lead_backfill_replays is
  'Control de backfill para LEAD historicos recuperados desde conversion_logs cuando action_event_id fue reutilizado por el bot.';

create index if not exists conversion_log_lead_backfill_replays_user_status_idx
  on public.conversion_log_lead_backfill_replays (user_id, status, processed_at desc);

create index if not exists conversion_log_lead_backfill_replays_action_event_idx
  on public.conversion_log_lead_backfill_replays (user_id, action_event_id, promo_code);
