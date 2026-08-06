-- Reduce continuous DB load from the phone metrics refresh job.
-- Before: refresh_phone_metrics ran every 5 minutes (*/5 * * * *).
-- After: it runs every 10 minutes (*/10 * * * *). Metrics in the Telefonos UI
-- may lag by up to 10 minutes, but phone assignment/CTA logic does not use this table.

comment on function public.refresh_phone_metrics() is
  'Recalcula el resumen de mensajes recibidos por telefono. Ejecutado por pg_cron cada 10 minutos.';

do $$
declare
  target_job_id bigint;
begin
  select jobid
    into target_job_id
  from cron.job
  where jobname = 'refresh-phone-metrics-every-5min'
  order by jobid
  limit 1;

  if target_job_id is null then
    raise notice 'Cron job refresh-phone-metrics-every-5min not found; skipping schedule alignment.';
    return;
  end if;

  perform cron.alter_job(
    job_id := target_job_id,
    schedule := '*/10 * * * *'
  );
end $$;
