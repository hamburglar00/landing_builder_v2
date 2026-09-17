BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='1s';
WITH historical AS (SELECT (regexp_match(array_to_string(statements,E'\n'),'Bearer ([A-Za-z0-9._-]+)'))[1] AS token FROM supabase_migrations.schema_migrations WHERE version='20260427190000')
SELECT jsonb_agg(x) AS metadata FROM (
SELECT 'chatrace_client_configs' AS configuration_table, count(*) AS matching_rows FROM public.chatrace_client_configs c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'conversions_config' AS configuration_table, count(*) AS matching_rows FROM public.conversions_config c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'conversions_pixel_configs' AS configuration_table, count(*) AS matching_rows FROM public.conversions_pixel_configs c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'cron_config' AS configuration_table, count(*) AS matching_rows FROM public.cron_config c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'kommo_client_configs' AS configuration_table, count(*) AS matching_rows FROM public.kommo_client_configs c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'meta_audience_configs' AS configuration_table, count(*) AS matching_rows FROM public.meta_audience_configs c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'notification_bot_config' AS configuration_table, count(*) AS matching_rows FROM public.notification_bot_config c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'notification_settings' AS configuration_table, count(*) AS matching_rows FROM public.notification_settings c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'settings' AS configuration_table, count(*) AS matching_rows FROM public.settings c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
UNION ALL
SELECT 'whatsapp_cloud_api_configs' AS configuration_table, count(*) AS matching_rows FROM public.whatsapp_cloud_api_configs c, historical h WHERE h.token IS NOT NULL AND strpos(to_jsonb(c)::text,h.token)>0
) x; ROLLBACK;
