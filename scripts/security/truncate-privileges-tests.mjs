import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {canonical} from '../phase0/catalog-canonical.mjs';
import {hash} from '../phase0/bootstrap-manifest.mjs';
import {fixture,ids} from './profile-security-tests.mjs';

export const digest=value=>hash(JSON.stringify(canonical(value)));
const last=value=>value.trim().split(/\r?\n/).at(-1);
const quoted=names=>names.map(name=>{assert.match(name,/^[a-z_]+$/);return `'${name}'`;}).join(',');

// All PostgreSQL ACL-bearing catalogs, including column and default ACLs.
// Implicit ACLs stay null in this raw snapshot; effective access is checked separately.
export function snapshot(db,tables) {
  const acl=JSON.parse(db.sql(`BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
    WITH objects(kind,object,owner,acl) AS (
      SELECT 'relation',format('%I.%I',n.nspname,c.relname),c.relowner,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      UNION ALL SELECT 'column',format('%I.%I.%I',n.nspname,c.relname,a.attname),c.relowner,a.attacl FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE a.attnum>0 AND NOT a.attisdropped
      UNION ALL SELECT 'function',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),p.proowner,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      UNION ALL SELECT 'schema',nspname,nspowner,nspacl FROM pg_namespace
      UNION ALL SELECT 'database',datname,datdba,datacl FROM pg_database
      UNION ALL SELECT 'language',lanname,lanowner,lanacl FROM pg_language
      UNION ALL SELECT 'type',format('%I.%I',n.nspname,t.typname),t.typowner,t.typacl FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      UNION ALL SELECT 'tablespace',spcname,spcowner,spcacl FROM pg_tablespace
      UNION ALL SELECT 'foreign_data_wrapper',fdwname,fdwowner,fdwacl FROM pg_foreign_data_wrapper
      UNION ALL SELECT 'foreign_server',srvname,srvowner,srvacl FROM pg_foreign_server
      UNION ALL SELECT 'large_object',oid::text,lomowner,lomacl FROM pg_largeobject_metadata
      UNION ALL SELECT 'parameter',parname,NULL::oid,paracl FROM pg_parameter_acl
      UNION ALL SELECT 'default',pg_get_userbyid(d.defaclrole)||':'||coalesce(n.nspname,'*')||':'||d.defaclobjtype::text,d.defaclrole,d.defaclacl FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
    ) SELECT jsonb_agg(jsonb_build_object('kind',o.kind,'object',o.object,'owner',pg_get_userbyid(o.owner),'implicit',o.acl IS NULL,
      'grants',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee,a.grantor,a.privilege_type),'[]') FROM aclexplode(o.acl) a))) FROM objects o;
    ROLLBACK;`));
  const structure=JSON.parse(db.sql(`BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
    SELECT jsonb_build_object(
      'relations',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'kind',c.relkind,'options',c.reloptions) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace),
      'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]') FROM pg_policy p),
      'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'body',md5(p.prosrc),'binary',md5(p.probin),'config',p.proconfig,'security_definer',p.prosecdef,'definition',CASE WHEN p.prokind IN ('f','p') THEN md5(pg_get_functiondef(p.oid)) END) ORDER BY p.oid) FROM pg_proc p),
      'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t),
      'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m),
      'roles',(SELECT jsonb_agg(jsonb_build_object('role',rolname,'superuser',rolsuper,'inherit',rolinherit,'create_role',rolcreaterole,'create_db',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypass_rls',rolbypassrls) ORDER BY rolname) FROM pg_roles));
    ROLLBACK;`));
  const matrix=JSON.parse(db.sql(`SELECT jsonb_agg(jsonb_build_object('table',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
    'truncateGrants',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable) ORDER BY a.grantee),'[]') FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.privilege_type='TRUNCATE'),
    'roles',(SELECT jsonb_agg(jsonb_build_object('role',r.role,'privileges',(SELECT jsonb_object_agg(p,has_table_privilege(r.role,c.oid,p)) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p),
      'truncateSources',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'via',CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT oid FROM pg_roles WHERE rolname=r.role) THEN 'direct' ELSE 'inherited' END) ORDER BY a.grantee),'[]') FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.privilege_type='TRUNCATE' AND CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.role,a.grantee,'USAGE') END)) ORDER BY r.role) FROM (SELECT DISTINCT unnest(ARRAY['anon','authenticated','service_role','postgres',pg_get_userbyid(c.relowner)]) AS role) r)) ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (${quoted(tables)});`));
  return {acl,structure,matrix};
}

export function compareSnapshots(before,after,scope,report) {
  const removable=(object,grant)=>object.kind==='relation'&&scope.pendingTables.some(t=>object.object==='public.'+t)&&grant.privilege==='TRUNCATE'&&['PUBLIC','anon','authenticated'].includes(grant.grantee);
  const normalized=objects=>objects.map(o=>({...o,grants:o.grants.filter(g=>!removable(o,g))}));
  assert.deepEqual(canonical(after.acl),canonical(normalized(before.acl)));
  assert.deepEqual(canonical(after.structure),canonical(before.structure));
  const removeEveryTruncate=objects=>objects.map(o=>({...o,grants:o.grants.filter(g=>g.privilege!=='TRUNCATE')}));
  assert.deepEqual(canonical(removeEveryTruncate(before.acl)),canonical(removeEveryTruncate(after.acl)));
  const removed=before.acl.flatMap(o=>o.grants.filter(g=>removable(o,g)).map(g=>({kind:o.kind,object:o.object,...g})));
  assert.ok(removed.length>=scope.pendingTables.length);
  for(const row of after.matrix) {
    const old=before.matrix.find(x=>x.table===row.table);assert.ok(old);assert.equal(row.owner,old.owner);
    assert.ok(!row.truncateGrants.some(x=>['PUBLIC','anon','authenticated'].includes(x.grantee)));
    for(const role of row.roles) {
      const was=old.roles.find(x=>x.role===role.role);assert.ok(was);
      const expected={...was.privileges};
      if(['anon','authenticated'].includes(role.role))expected.TRUNCATE=false;
      assert.deepEqual(role.privileges,expected);
      if(['postgres',row.owner].includes(role.role))assert.equal(role.privileges.TRUNCATE,true);
    }
  }
  report.snapshots={
    method:'SHA-256 of canonically sorted JSON; full snapshots compared in memory without reading application values',
    aclObjectCount:before.acl.length,aclKinds:[...new Set(before.acl.map(x=>x.kind))].sort(),
    allAclBefore:digest(before.acl),allAclAfter:digest(after.acl),
    nonTruncateAclBefore:digest(removeEveryTruncate(before.acl)),nonTruncateAclAfter:digest(removeEveryTruncate(after.acl)),
    structureBefore:digest(before.structure),structureAfter:digest(after.structure),
    structureSections:Object.fromEntries(Object.keys(before.structure).map(key=>[key,{before:digest(before.structure[key]),after:digest(after.structure[key])}])),
    removedAcl:removed,addedAcl:[],before:before.matrix,after:after.matrix
  };
}

export function directedTests(db,scope,check,report) {
  for(const table of scope.allTables)for(const role of ['anon','authenticated'])check(`SQL ${role} TRUNCATE public.${table} denied`,()=>{
    let code=null;
    try{db.sql(`BEGIN; SET LOCAL statement_timeout='10s'; SET LOCAL ROLE ${role}; TRUNCATE TABLE public.${table} CASCADE; ROLLBACK;`);}catch(error){code=error.sqlstate;}
    assert.equal(code,'42501');
  });
  check('pgTAP effective privileges on all 42 tables',()=>{
    const test=readFileSync(join(root,'supabase/tests/remaining_truncate_privileges.test.sql'),'utf8');
    const output=db.sql(`BEGIN; CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions; SET LOCAL search_path=public,extensions;
      CREATE TEMP TABLE phase1b4_truncate_targets(name text PRIMARY KEY); INSERT INTO phase1b4_truncate_targets SELECT unnest(ARRAY[${quoted(scope.allTables)}]); ${test} ROLLBACK;`);
    const passed=output.split(/\r?\n/).filter(x=>/^ok \d+/.test(x)).length;
    assert.equal(passed,169);assert.ok(!/^not ok|^# Looks like/m.test(output));
    report.pgTap={passed,failed:0,countedInsideOneCheck:true};
  });
  check('postgres maintenance truncates synthetic rows and rollback restores them',()=>{
    const output=db.sql(`BEGIN; SET LOCAL statement_timeout='15s'; ${fixture}
      INSERT INTO public.landings(id,user_id,name) VALUES ('27300000-0000-4000-8000-000000000001','${ids.client}','phase1b4-truncate-synthetic');
      SAVEPOINT synthetic_fixture;
      TRUNCATE TABLE ${scope.allTables.map(t=>'public.'+t).join(',')} CASCADE;
      SELECT NOT EXISTS(SELECT FROM public.landings) AND NOT EXISTS(SELECT FROM public.profiles);
      ROLLBACK TO synthetic_fixture;
      SELECT EXISTS(SELECT FROM public.landings WHERE id='27300000-0000-4000-8000-000000000001' AND name='phase1b4-truncate-synthetic') AND EXISTS(SELECT FROM public.profiles WHERE id='${ids.client}');
      ROLLBACK;`);
    assert.deepEqual(output.trim().split(/\r?\n/),['t','t']);
    assert.equal(last(db.sql(`SELECT NOT EXISTS(SELECT FROM auth.users WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}')) AND NOT EXISTS(SELECT FROM public.landings WHERE id='27300000-0000-4000-8000-000000000001')`)),'t');
  });
}
