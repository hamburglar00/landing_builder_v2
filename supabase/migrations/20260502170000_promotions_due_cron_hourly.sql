-- Sorteos: procesar pendientes 1 vez por hora, alineado con la UI sin minutos.

do $$
begin
  perform cron.unschedule('promotion-draw-due-every-minute');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('promotion-draw-due-hourly');
exception when others then
  null;
end $$;

select cron.schedule(
  'promotion-draw-due-hourly',
  '0 * * * *',
  $$select public.cron_process_due_promotions()$$
);
