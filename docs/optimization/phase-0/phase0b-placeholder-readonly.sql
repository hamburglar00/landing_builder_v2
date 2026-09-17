BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='1s';
SELECT version,name,
(SELECT coalesce(jsonb_agg(m[1]),'[]'::jsonb) FROM unnest(statements) s CROSS JOIN LATERAL regexp_matches(s,'create[[:space:]]+table[[:space:]]+(?:if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?([a-zA-Z0-9_." ]+?)[[:space:]]*[(]','gi') m) AS created_tables,
(SELECT coalesce(jsonb_agg(m[1]),'[]'::jsonb) FROM unnest(statements) s CROSS JOIN LATERAL regexp_matches(s,'create[[:space:]]+(?:or[[:space:]]+replace[[:space:]]+)?function[[:space:]]+([a-zA-Z0-9_."]+)[[:space:]]*[(]','gi') m) AS created_functions,
EXISTS(SELECT 1 FROM unnest(statements) s WHERE s ~* 'cron[.]schedule') AS schedules_cron,
EXISTS(SELECT 1 FROM unnest(statements) s WHERE s ~* 'net[.]http_post') AS has_http_call
FROM supabase_migrations.schema_migrations WHERE version IN ('20260427180000','20260427190000','20260629190000');
ROLLBACK;
