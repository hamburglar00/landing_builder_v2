-- Keep the Purchase CAPI retry scan bounded to rows that can actually be
-- retried. Every skipped_* status is terminal; including those rows made the
-- worker revisit old purchases before reaching the deferred LEAD/PURCHASE
-- queues handled later in the same invocation.

set statement_timeout = '10min';

create index if not exists conversions_purchase_capi_retryable_created_idx
  on public.conversions (created_at asc)
  where estado = 'purchase'
    and valor > 0
    and purchase_status_capi in ('', 'error');

comment on index public.conversions_purchase_capi_retryable_created_idx is
  'Oldest-first queue for Purchase CAPI rows whose delivery may be retried.';
