BEGIN READ ONLY;
SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='1s';
SELECT jsonb_build_object(
'relations',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default_md5',md5(pg_get_expr(d.adbin,d.adrelid))) ORDER BY a.attnum)
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY c.relname),'[]'::jsonb)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')),
'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'type',k.contype,'columns',(SELECT jsonb_agg(a.attname ORDER BY u.ordinality) FROM unnest(k.conkey) WITH ORDINALITY u(num,ordinality) JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=u.num),
'references',CASE WHEN k.confrelid<>0 THEN k.confrelid::regclass::text END,'validated',k.convalidated,'definition_md5',md5(pg_get_constraintdef(k.oid))) ORDER BY c.relname,k.conname),'[]'::jsonb) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',ic.relname,'unique',i.indisunique,'valid',i.indisvalid,'columns',(SELECT jsonb_agg(a.attname ORDER BY u.ordinality) FROM unnest(i.indkey) WITH ORDINALITY u(num,ordinality) LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=u.num),'predicate_md5',md5(pg_get_expr(i.indpred,c.oid)),'definition_md5',md5(pg_get_indexdef(i.indexrelid))) ORDER BY c.relname,ic.relname),'[]'::jsonb)
FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class ic ON ic.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'function',p.proname,'enabled',t.tgenabled,'definition_md5',md5(pg_get_triggerdef(t.oid))) ORDER BY c.relname,t.tgname),'[]'::jsonb)
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND NOT t.tgisinternal),
'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'command',cmd,'roles',roles,'permissive',permissive,'using_md5',md5(qual),'check_md5',md5(with_check)) ORDER BY tablename,policyname),'[]'::jsonb) FROM pg_policies WHERE schemaname='public'),
'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'language',l.lanname,'security_definer',p.prosecdef,'definition_md5',md5(pg_get_functiondef(p.oid)),
'references_conversions',p.prosrc ~* 'public[.]conversions([^_a-z]|$)|from[[:space:]]+conversions([^_a-z]|$)|join[[:space:]]+conversions([^_a-z]|$)') ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.prokind IN ('f','p'))
) AS metadata;
ROLLBACK;
