-- Make LEAD idempotency resilient to bot action_event_id reuse.
-- A LEAD retry is a duplicate only when action_event_id AND promo_code match.
-- PURCHASE keeps the previous action_event_id guard; stronger coelsa/transaction
-- dedupe still runs in the edge function before processing.

drop index if exists public.conversion_inbox_action_event_uidx;

create unique index if not exists conversion_inbox_lead_action_event_promo_uidx
  on public.conversion_inbox (user_id, action, action_event_id, promo_code)
  where action = 'LEAD'
    and coalesce(action_event_id, '') <> ''
    and coalesce(promo_code, '') <> '';

create unique index if not exists conversion_inbox_lead_action_event_no_promo_uidx
  on public.conversion_inbox (user_id, action, action_event_id)
  where action = 'LEAD'
    and coalesce(action_event_id, '') <> ''
    and coalesce(promo_code, '') = '';

create unique index if not exists conversion_inbox_purchase_action_event_uidx
  on public.conversion_inbox (user_id, action, action_event_id)
  where action = 'PURCHASE'
    and coalesce(action_event_id, '') <> '';
