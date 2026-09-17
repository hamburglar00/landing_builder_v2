BEGIN READ ONLY;
SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='1s';
SELECT jsonb_build_object(
'private_functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'language',l.lanname,'security_definer',p.prosecdef,'definition_md5',md5(pg_get_functiondef(p.oid)),'references_conversions',p.prosrc ~* 'public[.]conversions([^_a-z]|$)|from[[:space:]]+conversions([^_a-z]|$)|join[[:space:]]+conversions([^_a-z]|$)') ORDER BY p.proname),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='private' AND p.prokind IN ('f','p')),
'trigger_functions',(SELECT jsonb_agg(jsonb_build_object('trigger',t.tgname,'schema',n.nspname,'function',p.proname)) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public.conversions'::regclass AND NOT t.tgisinternal),
'from_meta_ads_definition',(SELECT jsonb_build_object('body_md5',md5(replace(p.prosrc,E'\r','')),'mentions_promo_code',p.prosrc ~* 'promo_code','mentions_fbc',p.prosrc ~* 'fbc') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='set_conversions_from_meta_ads')
) AS metadata;
ROLLBACK;
