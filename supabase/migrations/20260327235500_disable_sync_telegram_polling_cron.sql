-- Webhook mode: stop polling cron for telegram sync.

do $$
begin
  perform cron.unschedule('sync-telegram-connections-minute');
exception when others then
  null;
end $$;
