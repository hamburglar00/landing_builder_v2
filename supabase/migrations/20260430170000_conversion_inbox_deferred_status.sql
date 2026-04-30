alter table public.conversion_inbox
  drop constraint if exists conversion_inbox_status_check;

alter table public.conversion_inbox
  add constraint conversion_inbox_status_check
  check (status in ('received', 'deferred', 'processed', 'error'));

update public.conversion_inbox
set
  status = 'deferred',
  http_status = coalesce(http_status, 202),
  response_body = case
    when coalesce(response_body, '') = ''
      then 'LEAD recibido y en espera para reintento diferido (1h)'
    else response_body
  end
where action = 'LEAD'
  and status = 'received'
  and coalesce(promo_code, '') !~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$';

create index if not exists conversion_inbox_deferred_action_created_idx
  on public.conversion_inbox (action, created_at)
  where status = 'deferred';

create index if not exists conversion_inbox_deferred_lead_phone_idx
  on public.conversion_inbox (user_id, phone, created_at)
  where status = 'deferred'
    and action = 'LEAD';
