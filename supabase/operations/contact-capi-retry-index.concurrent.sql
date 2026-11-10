-- Execute this ONE statement in an autocommit session, never in a transaction
-- or a multi-statement request. First inspect any index with the same name.
-- Then apply the migration, which checks its exact definition and validity.
CREATE INDEX CONCURRENTLY conversions_contact_capi_retryable_created_idx
  ON public.conversions USING btree (created_at ASC)
  WHERE contact_capi_retryable = true
    AND (contact_status_capi = 'error'
      OR lead_status_capi = 'error'
      OR registration_status_capi = 'error');
