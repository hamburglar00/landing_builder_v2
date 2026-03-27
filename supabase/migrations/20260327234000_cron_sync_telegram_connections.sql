-- Split responsibilities:
-- 1) sync-telegram-connections: link/start/enrich/welcome (frequent)
-- 2) notify-inactive-contacts: send summaries (hourly by configured hour)

create or replace function public.cron_sync_telegram_connections()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  sync_url text;
  secret text;
begin
  select value into base_url from public.cron_config where key = 'sync_phones_url';
  select value into secret from public.cron_config where key = 'sync_phones_cron_secret';
  if base_url is null or base_url like '%REPLACE_%' or secret is null then
    return;
  end if;

  sync_url := replace(base_url, '/functions/v1/sync-phones', '/functions/v1/sync-telegram-connections');

  perform net.http_post(
    url := sync_url,
    body := jsonb_build_object('cron_secret', secret),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

do $$
begin
  perform cron.unschedule('sync-telegram-connections-minute');
exception when others then
  null;
end $$;

select cron.schedule(
  'sync-telegram-connections-minute',
  '* * * * *',
  $$select public.cron_sync_telegram_connections()$$
);
