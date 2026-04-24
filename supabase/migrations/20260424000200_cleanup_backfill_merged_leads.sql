-- Cleanup historical duplicated LEAD rows produced by backfill merge.
-- These rows were already merged into their CONTACT counterpart and should
-- not remain in conversions because they inflate metrics.
delete from public.conversions
where estado = 'lead_backfill_merged'
   or observaciones ilike '%backfill_merged_into:%';
