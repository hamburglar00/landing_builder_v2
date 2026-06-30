do $$
begin
  execute 'create extension if not exists pg_cron';
exception when others then
  null;
end $$;

do $$
begin
  execute 'create extension if not exists pg_net';
exception when others then
  null;
end $$;

do $$
begin
  execute 'create extension if not exists pgcrypto';
exception when others then
  null;
end $$;

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

create table if not exists public.cron_config (
  key text primary key,
  value text not null
);

insert into public.cron_config (key, value) values
  ('tracking_retry_url', 'https://mkt.panelbotadmin.com/api/track/retry')
on conflict (key) do nothing;

insert into public.cron_config (key, value) values
  ('tracking_retry_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do update set
  value = excluded.value
where
  public.cron_config.value like 'REPLACE_%'
  or btrim(public.cron_config.value) = '';

create or replace function public.cron_retry_tracking_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  retry_url text;
  retry_secret text;
begin
  select value into retry_url from public.cron_config where key = 'tracking_retry_url';
  select value into retry_secret from public.cron_config where key = 'tracking_retry_secret';

  if retry_url is null or retry_secret is null then
    raise notice 'cron_retry_tracking_queue: missing tracking_retry_url or tracking_retry_secret.';
    return;
  end if;

  if retry_url like '%REPLACE_%' or retry_secret like 'REPLACE_%' then
    raise notice 'cron_retry_tracking_queue: replace placeholders in cron_config.';
    return;
  end if;

  perform net.http_post(
    url := retry_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || retry_secret
    ),
    body := jsonb_build_object(
      'limit', 50,
      'cron_secret', retry_secret
    ),
    timeout_milliseconds := 30000
  );
end;
$$;

comment on function public.cron_retry_tracking_queue() is
  'Reintenta envios fallidos del tracking publico del motor constructor cada 5 minutos.';

do $$
begin
  perform cron.unschedule('tracking-retry-every-5m');
exception when others then
  null;
end $$;

select cron.schedule(
  'tracking-retry-every-5m',
  '*/5 * * * *',
  $$select public.cron_retry_tracking_queue()$$
);
