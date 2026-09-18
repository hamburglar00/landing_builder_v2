-- The local runner supplies exactly the 42 accredited table names in a temp table.
SELECT plan(169);
SELECT is((SELECT count(*)::integer FROM phase1b4_truncate_targets),42,'all 42 tables are covered');
SELECT ok(NOT has_table_privilege('anon','public.'||name,'TRUNCATE'),'anon denied: '||name) FROM phase1b4_truncate_targets ORDER BY name;
SELECT ok(NOT has_table_privilege('authenticated','public.'||name,'TRUNCATE'),'authenticated denied: '||name) FROM phase1b4_truncate_targets ORDER BY name;
SELECT ok(NOT EXISTS(SELECT FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0 AND a.privilege_type='TRUNCATE'),'PUBLIC denied: '||t.name)
FROM phase1b4_truncate_targets t JOIN pg_class c ON c.oid=('public.'||t.name)::regclass ORDER BY t.name;
SELECT ok(has_table_privilege('postgres',c.oid,'TRUNCATE') AND has_table_privilege(c.relowner,c.oid,'TRUNCATE'),'postgres and owner retained: '||t.name)
FROM phase1b4_truncate_targets t JOIN pg_class c ON c.oid=('public.'||t.name)::regclass ORDER BY t.name;
SELECT * FROM finish();
