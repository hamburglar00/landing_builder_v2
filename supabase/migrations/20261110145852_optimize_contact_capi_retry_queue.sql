-- The canonical CTA retry queue includes Contact, Lead and CompleteRegistration.
-- Keep the older Contact-only index for callers that still use its predicate.
-- Populated installations MUST prebuild the additional index with the standalone
-- supabase/operations/contact-capi-retry-index.concurrent.sql in autocommit.
-- This transaction adopts only a complete index with the exact approved shape.
DO $migration$
DECLARE
  target_index regclass := to_regclass('public.conversions_contact_capi_retryable_created_idx');
BEGIN
  IF target_index IS NULL THEN
    IF EXISTS (SELECT FROM public.conversions LIMIT 1) THEN
      RAISE EXCEPTION 'Contact CAPI retry index requires a completed concurrent prebuild on populated conversions';
    END IF;
    LOCK TABLE public.conversions IN SHARE MODE NOWAIT;
    IF EXISTS (SELECT FROM public.conversions LIMIT 1) THEN
      RAISE EXCEPTION 'Contact CAPI retry index requires a completed concurrent prebuild on populated conversions';
    END IF;
    CREATE INDEX conversions_contact_capi_retryable_created_idx
      ON public.conversions USING btree (created_at ASC)
      WHERE contact_capi_retryable = true
        AND (contact_status_capi = 'error'
          OR lead_status_capi = 'error'
          OR registration_status_capi = 'error');
    target_index := 'public.conversions_contact_capi_retryable_created_idx'::regclass;
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_index i
    WHERE i.indexrelid = target_index
      AND i.indrelid = 'public.conversions'::regclass
      AND i.indisvalid AND i.indisready AND i.indislive
      AND NOT i.indisunique AND NOT i.indisprimary AND NOT i.indisexclusion
      AND i.indnkeyatts = 1 AND i.indnatts = 1
      AND i.indexprs IS NULL
      AND pg_catalog.pg_get_indexdef(i.indexrelid) =
        'CREATE INDEX conversions_contact_capi_retryable_created_idx ON public.conversions USING btree (created_at) WHERE ((contact_capi_retryable = true) AND ((contact_status_capi = ''error''::text) OR (lead_status_capi = ''error''::text) OR (registration_status_capi = ''error''::text)))'
  ) THEN
    RAISE EXCEPTION 'Contact CAPI retry index is invalid or does not match the approved definition';
  END IF;
END
$migration$;

COMMENT ON INDEX public.conversions_contact_capi_retryable_created_idx IS
  'Oldest-first canonical CTA CAPI retry queue. Eligibility, attempt limits and event identity remain in the worker.';
