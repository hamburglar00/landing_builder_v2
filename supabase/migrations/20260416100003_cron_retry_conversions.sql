-- Cron: cada 10 minutos, reintenta envíos fallidos de Purchase a Meta CAPI.
-- Invoca la Edge Function retry-failed-conversions vía pg_net.

create or replace function public.cron_retry_failed_conversions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  retry_url text;
  secret text;
  payload jsonb;
begin
  select value into base_url from public.cron_config where key = 'sync_phones_url';
  if base_url is null or base_url like '%REPLACE_%' then
    return;
  end if;

  select value into secret from public.cron_config where key = 'sync_phones_cron_secret';
  if secret is null then
    return;
  end if;

  retry_url := replace(base_url, '/functions/v1/sync-phones', '/functions/v1/retry-failed-conversions');
  payload := jsonb_build_object('cron_secret', secret);

  perform net.http_post(
    url := retry_url,
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

comment on function public.cron_retry_failed_conversions() is
  'Reintenta envíos Purchase fallidos a Meta CAPI cada 10 minutos.';

do $$
begin
  perform cron.unschedule('retry-failed-conversions');
exception when others then
  null;
end $$;

select cron.schedule(
  'retry-failed-conversions',
  '*/10 * * * *',
  $$select public.cron_retry_failed_conversions()$$
);
