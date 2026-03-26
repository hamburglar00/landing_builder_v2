alter table public.notification_settings
  add column if not exists telegram_welcome_sent_at timestamptz null;

