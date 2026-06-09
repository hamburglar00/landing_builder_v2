-- Keep PURCHASE strong idempotency on coelsa_id / transaction_id in the edge
-- function. When those ids are absent, protect action_event_id reuse without
-- losing valid purchases whose promo_code differs.

drop index if exists public.conversion_inbox_purchase_action_event_uidx;

create unique index if not exists conversion_inbox_purchase_action_event_promo_no_strong_uidx
  on public.conversion_inbox (user_id, action, action_event_id, promo_code)
  where action = 'PURCHASE'
    and coalesce(action_event_id, '') <> ''
    and coalesce(promo_code, '') <> ''
    and coalesce(coelsa_id, '') = ''
    and coalesce(transaction_id, '') = '';

create unique index if not exists conversion_inbox_purchase_action_event_no_promo_no_strong_uidx
  on public.conversion_inbox (user_id, action, action_event_id)
  where action = 'PURCHASE'
    and coalesce(action_event_id, '') <> ''
    and coalesce(promo_code, '') = ''
    and coalesce(coelsa_id, '') = ''
    and coalesce(transaction_id, '') = '';
