-- Multiple Telegram destinations per client + identifiable metadata.

create table if not exists public.notification_telegram_destinations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'telegram',
  telegram_chat_id text not null,
  telegram_username text not null default '',
  telegram_first_name text not null default '',
  telegram_last_name text not null default '',
  telegram_phone text not null default '',
  is_active boolean not null default true,
  welcome_sent_at timestamptz null,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, telegram_chat_id)
);

create index if not exists idx_notification_telegram_destinations_user
  on public.notification_telegram_destinations (user_id, is_active, linked_at desc);

alter table public.notification_telegram_destinations enable row level security;

drop policy if exists "Users can read own telegram destinations" on public.notification_telegram_destinations;
create policy "Users can read own telegram destinations"
  on public.notification_telegram_destinations for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all telegram destinations" on public.notification_telegram_destinations;
create policy "Admins can read all telegram destinations"
  on public.notification_telegram_destinations for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Users can update own telegram destinations" on public.notification_telegram_destinations;
create policy "Users can update own telegram destinations"
  on public.notification_telegram_destinations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins can update all telegram destinations" on public.notification_telegram_destinations;
create policy "Admins can update all telegram destinations"
  on public.notification_telegram_destinations for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Backfill: create one destination for clients that already had telegram_chat_id in notification_settings.
insert into public.notification_telegram_destinations (user_id, telegram_chat_id, linked_at, updated_at, is_active, welcome_sent_at)
select ns.user_id, ns.telegram_chat_id, now(), now(), true, ns.telegram_welcome_sent_at
from public.notification_settings ns
where coalesce(ns.telegram_chat_id, '') <> ''
on conflict (user_id, telegram_chat_id) do update
set updated_at = excluded.updated_at;
