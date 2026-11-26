-- The existing inbox stores each lead independently, with workspace-scoped read access.
alter table public.conversion_inbox
  add column if not exists mkt_username_requested_at timestamptz,
  add column if not exists mkt_username_sent_at timestamptz;
