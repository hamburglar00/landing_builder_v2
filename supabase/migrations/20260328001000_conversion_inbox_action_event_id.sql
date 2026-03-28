alter table public.conversion_inbox
  add column if not exists action_event_id text null;

create unique index if not exists conversion_inbox_action_event_uidx
  on public.conversion_inbox (user_id, action, action_event_id)
  where action_event_id is not null
    and action in ('LEAD', 'PURCHASE');

