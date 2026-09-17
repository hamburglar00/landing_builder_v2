import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {root} from './local-runtime.mjs';
import {hash} from './bootstrap-manifest.mjs';
import {canonical} from './compare-schema-metadata.mjs';

const APPROVED='d842aeb284e4e6a64f78c098d80f7c6cbb5c0b9ed564f0851dea7b5ef8a38611';
export function compatibilitySources() {
  const bytes=readFileSync(join(root,'supabase/bootstrap/compatibility-manifest.json'));
  if(hash(bytes)!==APPROVED)throw Error('Unapproved local compatibility manifest');
  const manifest=JSON.parse(bytes),sql=readFileSync(join(root,manifest.file)),reference=readFileSync(join(root,manifest.reference));
  if(hash(sql)!==manifest.sha256||hash(reference)!==manifest.referenceSha256)throw Error('Compatibility source hash mismatch');
  return {manifest,sql:sql.toString(),reference:JSON.parse(reference)};
}
const normalizeAcl=value=>{
  if(Array.isArray(value))return value.map(normalizeAcl);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='acl'?v.slice(1,-1).split(',').sort():normalizeAcl(v)]));
  return value;
};
export function applyCompatibility(db,sources) {
  const count=Number(db.sql('select count(*) from supabase_migrations.schema_migrations').trim());
  if(count!==268||!db.verify())throw Error('Compatibility requires exactly 268 historical migrations and disabled cron');
  db.sql(`BEGIN; SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.local_compatibility='runner-owned-isolated-database';\n${sources.sql}\nCOMMIT;`);
  const query=readFileSync(join(root,'scripts/phase0/bootstrap-security-reference.sql'),'utf8');
  const local=JSON.parse(db.sql(query));
  assert.deepEqual(canonical(normalizeAcl(local)),canonical(normalizeAcl(sources.reference)),'Local security definition, owners, ACLs, policies, flags and effective privileges must match remote');
  return {applied:true,afterHistoricalCount:count,sourceSha256:sources.manifest.sha256,referenceMatched:true};
}

// Synthetic, transaction-scoped probes on the actual fully reconstructed tables.
// No table contents are returned; every mutation (including TRUNCATE) rolls back.
export function testSecurityAccess(db) {
  const fixtures=[
    {table:'ar_name_inferred_sex',insert:"(name_key,display_name,inferred_sex,source) values ('phase0_synthetic','Synthetic fixture','f','synthetic')",update:"display_name='Synthetic update'"},
    {table:'ar_phone_area_codes',insert:"(codigo_de_area,localidad) values ('999999','Synthetic fixture')",update:"localidad='Synthetic update'"},
    {table:'cron_config',insert:"(key,value) values ('phase0_synthetic','synthetic')",update:"value='synthetic-update'"},
    {table:'tracking_queue',insert:"(post_url,payload,event_id) values ('http://127.0.0.1:1/disabled','{}','phase0_synthetic')",update:"last_error='synthetic-update'"},
  ];
  const results=[];
  for(const f of fixtures)for(const role of ['anon','authenticated','service_role']) {
    const table='public.'+f.table;
    const prefix=`BEGIN; SET LOCAL statement_timeout='10s'; TRUNCATE ${table}; INSERT INTO ${table} ${f.insert}; SET LOCAL ROLE ${role};`;
    const visible=role==='service_role'?1:0;
    for(const operation of ['select','update','delete']) {
      const statement=operation==='select'?`select count(*) from ${table}`:`with affected as (${operation==='update'?`update ${table} set ${f.update}`:`delete from ${table}`} returning 1) select count(*) from affected`;
      const count=Number(db.sql(`${prefix} ${statement}; ROLLBACK;`).trim());assert.equal(count,visible);
      results.push({table:f.table,role,operation,affected:count,status:'passed'});
    }
    // INSERT is checked independently so the failed statement cannot mask another result.
    const emptyPrefix=`BEGIN; SET LOCAL statement_timeout='10s'; TRUNCATE ${table}; SET LOCAL ROLE ${role};`;
    let errorCode=null;
    try {db.sql(`${emptyPrefix} INSERT INTO ${table} ${f.insert}; ROLLBACK;`);}catch(error){errorCode=error.sqlstate;}
    assert.equal(errorCode,role==='service_role'?null:'42501');results.push({table:f.table,role,operation:'insert',sqlstate:errorCode,status:'passed'});
    const afterTruncate=Number(db.sql(`${prefix} TRUNCATE ${table}; RESET ROLE; SELECT count(*) FROM ${table}; ROLLBACK;`).trim());assert.equal(afterTruncate,0);
    results.push({table:f.table,role,operation:'truncate',affectedSyntheticRows:1,status:'passed',risk:'TRUNCATE privilege bypasses row filtering; replicated, not hardened'});
  }
  const future=db.sql("BEGIN; CREATE TABLE public.phase0_future_rls_probe(id int); SELECT relrowsecurity FROM pg_class WHERE oid='public.phase0_future_rls_probe'::regclass; ROLLBACK;").trim();assert.equal(future,'t');
  results.push({operation:'future-table-auto-rls',status:'passed'});
  return {passed:results.length,failed:0,syntheticOnly:true,rolledBack:true,results};
}
