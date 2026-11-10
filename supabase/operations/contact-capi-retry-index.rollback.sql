-- Operator-only recovery/rollback, in autocommit. Inspect the index first.
-- Dropping a valid index restores the slow scan; keep it during worker rollback.
-- This never drops the existing Contact-only compatibility index.
DROP INDEX CONCURRENTLY IF EXISTS public.conversions_contact_capi_retryable_created_idx;
