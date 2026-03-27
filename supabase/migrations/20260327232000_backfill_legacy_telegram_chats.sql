-- Backfill legacy telegram_chat_id from notification_settings into
-- notification_telegram_destinations (multi-destination model).

insert into public.notification_telegram_destinations (
  user_id,
  telegram_chat_id,
  telegram_username,
  telegram_first_name,
  telegram_last_name,
  telegram_phone,
  is_active,
  welcome_sent_at,
  linked_at,
  updated_at
)
select
  ns.user_id,
  ns.telegram_chat_id,
  '',
  '',
  '',
  '',
  true,
  ns.telegram_welcome_sent_at,
  now(),
  now()
from public.notification_settings ns
where coalesce(ns.telegram_chat_id, '') <> ''
on conflict (user_id, telegram_chat_id) do update
set
  is_active = true,
  updated_at = excluded.updated_at,
  welcome_sent_at = coalesce(public.notification_telegram_destinations.welcome_sent_at, excluded.welcome_sent_at);
