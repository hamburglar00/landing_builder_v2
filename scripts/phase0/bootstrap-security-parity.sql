BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='1s';
SELECT jsonb_build_object(
 'rls_auto_enable', (SELECT jsonb_build_object('owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'body_md5',md5(replace(p.prosrc,E'\r','')),'extension_member',EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'),'mentions_enable_row_level_security',p.prosrc ~* 'enable\s+row\s+level\s+security') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rls_auto_enable'),
 'ledger_versions_referencing_security_objects',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]') FROM supabase_migrations.schema_migrations WHERE array_to_string(statements,E'\n') ~* '(rls_auto_enable|ensure_rls)'),
 'rls_tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('ar_name_inferred_sex','ar_phone_area_codes','cron_config','tracking_queue'))
) AS metadata;
ROLLBACK;
