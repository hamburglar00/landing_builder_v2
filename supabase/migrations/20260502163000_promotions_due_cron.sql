-- Process due promotions automatically, even if nobody has the public page open.

create or replace function public.cron_process_due_promotions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  draw_due_url text;
  secret text;
begin
  select value into base_url from public.cron_config where key = 'sync_phones_url';
  select value into secret from public.cron_config where key = 'sync_phones_cron_secret';
  if base_url is null or base_url like '%REPLACE_%' or secret is null then
    return;
  end if;

  draw_due_url := regexp_replace(base_url, '/functions/v1/[^/]+$', '/functions/v1/promotion-draw-due');

  perform net.http_post(
    url := draw_due_url,
    body := jsonb_build_object('cron_secret', secret),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

do $$
begin
  perform cron.unschedule('promotion-draw-due-every-minute');
exception when others then
  null;
end $$;

select cron.schedule(
  'promotion-draw-due-every-minute',
  '* * * * *',
  $$select public.cron_process_due_promotions()$$
);
