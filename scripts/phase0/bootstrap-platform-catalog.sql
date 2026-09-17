BEGIN READ ONLY;
SET LOCAL statement_timeout='8s';
SET LOCAL lock_timeout='1s';
SET LOCAL search_path=public,extensions;
SELECT jsonb_build_object(
 'pg_net_members',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definition_md5',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_extension e JOIN pg_depend d ON d.refclassid='pg_extension'::regclass AND d.refobjid=e.oid AND d.deptype='e' JOIN pg_proc p ON d.classid='pg_proc'::regclass AND p.oid=d.objid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE e.extname='pg_net' AND p.prokind='f'),
 'graphql_event_members',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.evtname,'extension',e.extname,'function_schema',n.nspname,'function',p.proname) ORDER BY t.evtname),'[]') FROM pg_event_trigger t JOIN pg_proc p ON p.oid=t.evtfoid JOIN pg_namespace n ON n.oid=p.pronamespace LEFT JOIN pg_depend d ON d.classid='pg_event_trigger'::regclass AND d.objid=t.oid AND d.refclassid='pg_extension'::regclass AND d.deptype='e' LEFT JOIN pg_extension e ON e.oid=d.refobjid WHERE t.evtname IN ('graphql_watch_ddl','graphql_watch_drop'))
) AS metadata;
ROLLBACK;
