do $$
begin
  perform cron.unschedule('notify-inactive-contacts-hourly');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('notify-inactive-contacts-every-5-min');
exception when others then
  null;
end $$;

select cron.schedule(
  'notify-inactive-contacts-every-5-min',
  '*/5 * * * *',
  $$select public.cron_notify_inactive_contacts()$$
);

