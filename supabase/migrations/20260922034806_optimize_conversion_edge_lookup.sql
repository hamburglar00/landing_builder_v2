-- 277: unconditional access for Edge's user/promotion lookups, in either date order.
-- Populated installations MUST prebuild this exact index concurrently in a separate
-- autocommit session. This transactional migration only adopts the completed index.
-- Empty bootstraps may create it normally, after a NOWAIT lock and a second check.
DO $migration$
DECLARE
  target_index regclass := to_regclass('public.idx_conversions_user_promo_created');
BEGIN
  IF target_index IS NULL THEN
    IF EXISTS (SELECT FROM public.conversions LIMIT 1) THEN
      RAISE EXCEPTION '277 requires a completed concurrent prebuild on populated conversions';
    END IF;
    LOCK TABLE public.conversions IN SHARE MODE NOWAIT;
    IF EXISTS (SELECT FROM public.conversions LIMIT 1) THEN
      RAISE EXCEPTION '277 requires a completed concurrent prebuild on populated conversions';
    END IF;
    CREATE INDEX idx_conversions_user_promo_created
      ON public.conversions USING btree (user_id, promo_code, created_at);
    target_index := 'public.idx_conversions_user_promo_created'::regclass;
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_index i
    WHERE i.indexrelid = target_index
      AND i.indrelid = 'public.conversions'::regclass
      AND i.indisvalid AND i.indisready AND i.indislive
      AND NOT i.indisunique AND NOT i.indisprimary AND NOT i.indisexclusion
      AND i.indnkeyatts = 3 AND i.indnatts = 3
      AND i.indexprs IS NULL AND i.indpred IS NULL
      AND pg_catalog.pg_get_indexdef(i.indexrelid) =
        'CREATE INDEX idx_conversions_user_promo_created ON public.conversions USING btree (user_id, promo_code, created_at)'
  ) THEN
    RAISE EXCEPTION '277 index is invalid or does not match the approved definition';
  END IF;
END
$migration$;
