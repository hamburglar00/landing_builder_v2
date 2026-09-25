-- Migration 278 is registered in production but its deferred statistics
-- objects were removed by the approved compensating rollback. Keep clean
-- reconstructions and production equivalent without reactivating Statistics.
-- This migration changes no application data, existing RPC body, role or ACL.

DROP FUNCTION IF EXISTS public.get_conversion_stats_source(jsonb, jsonb, boolean);
DROP FUNCTION IF EXISTS public.get_conversion_stats_summary(jsonb);
DROP FUNCTION IF EXISTS conversions_read.stats_summary(jsonb);
DROP FUNCTION IF EXISTS conversions_read.stats_money(jsonb);
DROP FUNCTION IF EXISTS conversions_read.stats_dictionary(text[]);
DROP FUNCTION IF EXISTS conversions_read.stats_text(text);
DROP FUNCTION IF EXISTS conversions_read.stats_part(text, text);
DROP DOMAIN IF EXISTS conversions_read."application/vnd.conversion-columns";

NOTIFY pgrst, 'reload schema';
