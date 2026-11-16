-- Nullable, no backfill/default: historical log rows retain their original information.
alter table public.conversion_logs
  add column meta_api_version text,
  add column meta_http_status smallint,
  add column meta_attempt integer;

comment on column public.conversion_logs.meta_api_version is
  'Graph version reported in facebook-api-version; otherwise version requested in the endpoint path. No URL or token.';
comment on column public.conversion_logs.meta_http_status is
  'Actual HTTP response status, or NULL when no response was received.';
comment on column public.conversion_logs.meta_attempt is
  'HTTP call number within this sender execution; starts again at 1 in a later cron execution. Not a lifetime retry count.';
