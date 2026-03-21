-- Ajuste operativo: volver el warm de landing-phone a cada 5 minutos.
-- Horario: 8:00 a 2:59 (horas 0,1,2,8-23), igual que antes.

do $$
begin
  perform cron.unschedule('warm-landing-phone-8am-2am');
exception when others then
  null;
end $$;

select cron.schedule(
  'warm-landing-phone-8am-2am',
  '*/5 0,1,2,8-23 * * *',
  $$select public.cron_warm_landing_phone()$$
);

