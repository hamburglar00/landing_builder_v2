create table if not exists public.tracking_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  status text not null default 'pending',
  attempt_count int not null default 0,
  post_url text not null,
  payload jsonb not null,
  event_id text,
  last_error text,
  last_status int
);

create unique index if not exists tracking_queue_event_id_uidx
  on public.tracking_queue (event_id)
  where event_id is not null and event_id <> '';

create index if not exists tracking_queue_pending_idx
  on public.tracking_queue (status, next_attempt_at);

create or replace function public.set_tracking_queue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tracking_queue_updated_at on public.tracking_queue;

create trigger trg_tracking_queue_updated_at
before update on public.tracking_queue
for each row
execute function public.set_tracking_queue_updated_at();
