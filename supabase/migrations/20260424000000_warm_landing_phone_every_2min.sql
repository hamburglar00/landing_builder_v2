-- Aumenta frecuencia del warm de landing-phone para reducir cold starts percibidos en mobile.
-- Antes: cada 5 minutos. Ahora: cada 2 minutos (8:00 a 2:59).

do $$
begin
  perform cron.unschedule('warm-landing-phone-8am-2am');
exception when others then
  null;
end $$;

select cron.schedule(
  'warm-landing-phone-8am-2am',
  '*/2 0,1,2,8-23 * * *',
  $$select public.cron_warm_landing_phone()$$
);
