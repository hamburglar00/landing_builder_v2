-- Resume a persisted Purchase by its exact receiver and original event ID.
-- This is a non-unique lookup index only: no rows, identities, timestamps,
-- statuses, payloads or existing deduplication constraints are changed.
create index conversions_purchase_ingest_recovery_idx
  on public.conversions(user_id, purchase_event_id)
  include(id)
  where estado = 'purchase';
