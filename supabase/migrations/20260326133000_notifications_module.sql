-- Notifications module: bot config, per-user settings, dedupe alerts, cron

create table if not exists public.notification_bot_config (
  id integer primary key default 1,
  telegram_bot_token text not null default '',
  telegram_bot_username text not null default '',
  telegram_update_offset bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint notification_bot_config_singleton check (id = 1)
);

insert into public.notification_bot_config (id)
values (1)
on conflict (id) do nothing;

alter table public.notification_bot_config enable row level security;

drop policy if exists "Admins can read bot config" on public.notification_bot_config;
create policy "Admins can read bot config"
  on public.notification_bot_config for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update bot config" on public.notification_bot_config;
create policy "Admins can update bot config"
  on public.notification_bot_config for update
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

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  channel text not null default 'telegram',
  telegram_chat_id text not null default '',
  telegram_start_token text not null default replace(gen_random_uuid()::text, '-', ''),
  inactive_days integer not null default 1 check (inactive_days >= 1 and inactive_days <= 90),
  renotify_days integer not null default 5 check (renotify_days >= 1 and renotify_days <= 90),
  notify_hour integer not null default 10 check (notify_hour >= 8 and notify_hour <= 22),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists "Users can read own notification settings" on public.notification_settings;
create policy "Users can read own notification settings"
  on public.notification_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification settings" on public.notification_settings;
create policy "Users can insert own notification settings"
  on public.notification_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification settings" on public.notification_settings;
create policy "Users can update own notification settings"
  on public.notification_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins can read all notification settings" on public.notification_settings;
create policy "Admins can read all notification settings"
  on public.notification_settings for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update all notification settings" on public.notification_settings;
create policy "Admins can update all notification settings"
  on public.notification_settings for update
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

insert into public.notification_settings (user_id)
select p.id
from public.profiles p
left join public.notification_settings ns on ns.user_id = p.id
where ns.user_id is null;

create table if not exists public.notification_contact_alerts (
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  last_notified_at timestamptz not null,
  last_notified_activity_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, phone)
);

alter table public.notification_contact_alerts enable row level security;

drop policy if exists "Users can read own notification alerts" on public.notification_contact_alerts;
create policy "Users can read own notification alerts"
  on public.notification_contact_alerts for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all notification alerts" on public.notification_contact_alerts;
create policy "Admins can read all notification alerts"
  on public.notification_contact_alerts for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Cron function: invoke Edge Function notify-inactive-contacts hourly.
create or replace function public.cron_notify_inactive_contacts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  notify_url text;
  secret text;
begin
  select value into base_url from public.cron_config where key = 'sync_phones_url';
  select value into secret from public.cron_config where key = 'sync_phones_cron_secret';
  if base_url is null or base_url like '%REPLACE_%' or secret is null then
    return;
  end if;

  notify_url := replace(base_url, '/functions/v1/sync-phones', '/functions/v1/notify-inactive-contacts');

  perform net.http_post(
    url := notify_url,
    body := jsonb_build_object('cron_secret', secret),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

do $$
begin
  perform cron.unschedule('notify-inactive-contacts-hourly');
exception when others then
  null;
end $$;

select cron.schedule(
  'notify-inactive-contacts-hourly',
  '0 * * * *',
  $$select public.cron_notify_inactive_contacts()$$
);

create or replace function public.get_notification_bot_username()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(telegram_bot_username, '')
  from public.notification_bot_config
  where id = 1
  limit 1
$$;

grant execute on function public.get_notification_bot_username() to authenticated;
