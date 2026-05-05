alter table public.notification_settings
  add column if not exists promotion_winner_notifications_enabled boolean not null default true;
