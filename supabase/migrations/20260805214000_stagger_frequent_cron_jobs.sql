-- Stagger frequent cron jobs to avoid several expensive tasks starting on the
-- same minute. Frequencies stay the same; only minute offsets change.

set statement_timeout = '10min';

create or replace function pg_temp.alter_cron_schedule_if_exists(
  p_jobname text,
  p_schedule text
)
returns void
language plpgsql
as $$
declare
  target_job_id bigint;
begin
  select jobid
    into target_job_id
  from cron.job
  where jobname = p_jobname
  order by jobid
  limit 1;

  if target_job_id is null then
    raise notice 'Cron job % not found; skipping schedule alignment.', p_jobname;
    return;
  end if;

  perform cron.alter_job(
    job_id := target_job_id,
    schedule := p_schedule
  );
end $$;

-- Keep sync-phones at :00/:05/:10... so downstream cache/warm jobs can follow it.
select pg_temp.alter_cron_schedule_if_exists(
  'sync-phones-every-5min',
  '*/5 * * * *'
);

select pg_temp.alter_cron_schedule_if_exists(
  'notify-inactive-contacts-every-5-min',
  '1-59/5 * * * *'
);

select pg_temp.alter_cron_schedule_if_exists(
  'warm-landing-phone-8am-2am',
  '2-59/5 0,1,2,8-23 * * *'
);

select pg_temp.alter_cron_schedule_if_exists(
  'tracking-retry-every-5m',
  '3-59/5 * * * *'
);

select pg_temp.alter_cron_schedule_if_exists(
  'refresh-constructor-landing-phone-cache-every-minute',
  '4-59/5 * * * *'
);

select pg_temp.alter_cron_schedule_if_exists(
  'retry-failed-conversions',
  '6-59/10 * * * *'
);

select pg_temp.alter_cron_schedule_if_exists(
  'refresh-phone-metrics-every-5min',
  '7-59/10 * * * *'
);
