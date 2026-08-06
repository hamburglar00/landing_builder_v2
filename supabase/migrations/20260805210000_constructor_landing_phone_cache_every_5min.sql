-- Documents and preserves the production hotfix applied on 2026-08-05.
-- Before: refresh_constructor_landing_phone_cache ran every minute (* * * * *).
-- After: it runs every 5 minutes (*/5 * * * *), reducing constant DB CPU load.

do $$
declare
  target_job_id bigint;
begin
  select jobid
    into target_job_id
  from cron.job
  where jobname = 'refresh-constructor-landing-phone-cache-every-minute'
  order by jobid
  limit 1;

  if target_job_id is null then
    raise notice 'Cron job refresh-constructor-landing-phone-cache-every-minute not found; skipping schedule alignment.';
    return;
  end if;

  perform cron.alter_job(
    job_id := target_job_id,
    schedule := '*/5 * * * *'
  );
end $$;
