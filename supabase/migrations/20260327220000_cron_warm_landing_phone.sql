-- Cron: cada 5 minutos, entre 8:00 y 2:00, invoca landing-phone para mantener la función "caliente".
-- Requiere: pg_cron y pg_net. Usa la URL derivada de cron_config (sync_phones_url).

create or replace function public.cron_warm_landing_phone()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  landing_url text;
  landing_name text;
begin
  select value into base_url from public.cron_config where key = 'sync_phones_url';
  if base_url is null or base_url like '%REPLACE_%' then
    return;
  end if;

  select name into landing_name from public.landings limit 1;
  landing_name := coalesce(nullif(trim(landing_name), ''), 'warmup');

  landing_url := replace(base_url, '/functions/v1/sync-phones', '/functions/v1/landing-phone') || '?name=' || landing_name;

  perform net.http_get(
    url := landing_url,
    headers := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end;
$$;

comment on function public.cron_warm_landing_phone() is
  'Invoca GET landing-phone para mantener la Edge Function caliente. Cron cada 5 min entre 8:00 y 2:00.';

do $$
begin
  perform cron.unschedule('warm-landing-phone-8am-2am');
exception when others then
  null;
end $$;

-- Cada 5 min en horas 0,1,2 y 8-23 (8:00 a 2:59 del día siguiente)
select cron.schedule(
  'warm-landing-phone-8am-2am',
  '*/5 0,1,2,8-23 * * *',
  $$select public.cron_warm_landing_phone()$$
);
