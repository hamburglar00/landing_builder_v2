-- Target the current pg_stat_statements top offenders without changing query
-- semantics. These indexes match the exact PostgREST shapes observed on
-- 2026-08-05.

set statement_timeout = '10min';

create index if not exists conversions_purchase_coelsa_lookup_idx
  on public.conversions (user_id, purchase_coelsa_id, created_at desc)
  include (id, purchase_event_id, estado);

create index if not exists conversions_purchase_transaction_lookup_idx
  on public.conversions (user_id, purchase_transaction_id, created_at desc)
  include (id, purchase_event_id, estado);

create index if not exists conversion_inbox_user_action_event_promo_created_full_idx
  on public.conversion_inbox (
    user_id,
    action,
    action_event_id,
    promo_code,
    created_at desc
  );

create index if not exists conversion_inbox_user_action_event_created_full_idx
  on public.conversion_inbox (
    user_id,
    action,
    action_event_id,
    created_at desc
  );

create index if not exists conversions_purchase_retry_created_idx
  on public.conversions (estado, created_at asc)
  include (
    valor,
    purchase_status_capi
  );

create index if not exists conversion_logs_backfill_scan_idx
  on public.conversion_logs (function_name, message, id asc)
  include (user_id, created_at);

create index if not exists conversions_user_created_at_lookup_idx
  on public.conversions (user_id, created_at desc)
  include (
    phone,
    estado,
    valor,
    currency,
    purchase_event_id,
    test_event_code
  );

create index if not exists conversions_phone_metrics_contacts_normalized_idx
  on public.conversions (
    user_id,
    (trim(coalesce(external_id, '')))
  )
  where coalesce(contact_event_id, '') <> ''
    and trim(coalesce(external_id, '')) <> ''
    and nullif(regexp_replace(coalesce(telefono_asignado, ''), '\D', '', 'g'), '') is not null
    and coalesce(test_event_code, '') = '';

create index if not exists conversions_phone_metrics_leads_normalized_idx
  on public.conversions (
    user_id,
    (regexp_replace(coalesce(telefono_asignado, ''), '\D', '', 'g')),
    (trim(coalesce(external_id, ''))),
    lead_event_time
  )
  where coalesce(lead_event_id, '') <> ''
    and trim(coalesce(external_id, '')) <> ''
    and nullif(regexp_replace(coalesce(telefono_asignado, ''), '\D', '', 'g'), '') is not null
    and coalesce(test_event_code, '') = '';
