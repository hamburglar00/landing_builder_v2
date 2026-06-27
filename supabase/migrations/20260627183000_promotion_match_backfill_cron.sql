-- Retry unmatched promotion participants against conversions by phone.

alter table public.promotion_participants
  add column if not exists last_match_attempt_at timestamptz null;

create index if not exists idx_promotion_participants_unmatched_attempt
  on public.promotion_participants (last_match_attempt_at asc nulls first, created_at asc)
  where matched_conversion_count = 0 and phone <> '';

create index if not exists idx_conversions_phone_empty_email
  on public.conversions (phone)
  where phone <> '' and email = '';

create or replace function public.cron_match_promotion_participants()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  match_url text;
  secret text;
begin
  select value into base_url from public.cron_config where key = 'sync_phones_url';
  select value into secret from public.cron_config where key = 'sync_phones_cron_secret';
  if base_url is null or base_url like '%REPLACE_%' or secret is null then
    return;
  end if;

  match_url := regexp_replace(base_url, '/functions/v1/[^/]+$', '/functions/v1/promotion-match-backfill');

  perform net.http_post(
    url := match_url,
    body := jsonb_build_object('cron_secret', secret, 'mode', 'cron', 'batch_size', 1000),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

comment on function public.cron_match_promotion_participants() is
  'Cada hora intenta matchear participantes de promociones sin match contra conversiones por phone.';

do $$
begin
  perform cron.unschedule('promotion-match-backfill-hourly');
exception when others then
  null;
end $$;

select cron.schedule(
  'promotion-match-backfill-hourly',
  '17 * * * *',
  $$select public.cron_match_promotion_participants()$$
);
