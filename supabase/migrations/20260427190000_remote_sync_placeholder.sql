-- Authorized local/CI sanitization of historical tracking_retry_scheduler.
-- Original ledger MD5: 34162945f0a3ae6cf9cd926cdf9b588f.
-- URL and authorization are synthetic settings; cron stays disabled.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'tracking-retry-every-5m') then
    perform cron.unschedule('tracking-retry-every-5m');
  end if;

  perform cron.schedule(
    'tracking-retry-every-5m',
    '*/5 * * * *',
    $job$
    select net.http_post(
      url := current_setting('phase0.tracking_retry_url', true),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('phase0.tracking_retry_token', true)
      ),
      body := '{"limit":50}'::jsonb
    );
    $job$
  );
end;
$$;
