BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='1s';
WITH historical AS (SELECT (regexp_match(array_to_string(statements,E'\n'),'Bearer ([A-Za-z0-9._-]+)'))[1] AS token FROM supabase_migrations.schema_migrations WHERE version='20260427190000')
SELECT jsonb_build_object(
'found',token IS NOT NULL,
'probable_type',CASE WHEN token LIKE 'eyJ%' THEN 'JWT: privileges not inferred' WHEN token LIKE 'sb_secret_%' THEN 'Supabase secret key' WHEN token ~ '^[a-fA-F0-9]{64}$' THEN 'custom 256-bit hexadecimal bearer token' ELSE 'custom bearer token; privileges unknown' END,
'cron_job_references',(SELECT coalesce(jsonb_agg(jobname),'[]') FROM cron.job WHERE token IS NOT NULL AND strpos(command,token)>0),
'function_references',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname)),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE token IS NOT NULL AND strpos(p.prosrc,token)>0),
'configuration_matches',(SELECT count(*) FROM public.cron_config c WHERE token IS NOT NULL AND strpos(c.value,token)>0),
'vault_matches',(SELECT count(*) FROM vault.decrypted_secrets v WHERE token IS NOT NULL AND strpos(v.decrypted_secret,token)>0),
'migration_references',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]') FROM supabase_migrations.schema_migrations WHERE token IS NOT NULL AND strpos(array_to_string(statements,E'\n'),token)>0),
'view_references',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname)),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('v','m') AND token IS NOT NULL AND strpos(pg_get_viewdef(c.oid),token)>0)
) AS metadata FROM historical; ROLLBACK;
