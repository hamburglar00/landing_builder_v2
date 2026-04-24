-- Backfill external_id for LEAD rows created without match so they use
-- deterministic hash by phone (same criterio que el flujo nuevo).
-- Esto ayuda a evitar fragmentacion de identidad en metricas.

update public.conversions
set external_id = md5(regexp_replace(coalesce(phone, ''), '\D', '', 'g'))
where estado = 'lead'
  and observaciones ilike '%match_source:created_new%'
  and regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> '';
