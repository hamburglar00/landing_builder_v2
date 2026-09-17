BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='1s';
SELECT jsonb_build_object(
'event_triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'enabled',e.evtenabled,'tags',e.evttags,'function_schema',n.nspname,'function',p.proname)),'[]') FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid JOIN pg_namespace n ON n.oid=p.pronamespace),
'extensions',(SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
'rls_auto_enable_extension',(SELECT jsonb_agg(e.extname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e' JOIN pg_extension e ON d.refclassid='pg_extension'::regclass AND d.refobjid=e.oid WHERE n.nspname='public' AND p.proname='rls_auto_enable'),
'related_dependencies',(SELECT jsonb_agg(jsonb_build_object('type',d.type,'schema',d.schema,'name',d.name,'identity_md5',md5(d.identity),'dependency_type',p.deptype)) FROM pg_depend p CROSS JOIN LATERAL pg_identify_object(p.classid,p.objid,p.objsubid) d WHERE p.refclassid='pg_class'::regclass AND p.refobjid='public.conversions'::regclass)
) AS metadata; ROLLBACK;
