// One local reconstruction; pause at 272 to attest ACLs before creating/applying 273.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment,validateManifest,hash} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {compatibilitySources,applyCompatibility} from '../phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet} from '../phase0/bootstrap-net.mjs';
import {canonical} from '../phase0/catalog-canonical.mjs';

assertSafeEnvironment();
const folder=join(root,'docs/security/phase-1b4');
const readJson=file=>JSON.parse(readFileSync(join(folder,file)));
let scope=readJson('truncate-scope.json'),revision=0,db;
const report={phase:'1B.4',continuation:'remaining TRUNCATE only',complete:false,localOnly:true,reconstructions:1,migrationsApplied:0,checks:[],failures:[],corrections:[],remoteWrites:0,productionRequests:0,startedAt:new Date().toISOString()};
const save=()=>writeFileSync(join(folder,'truncate-validation.json'),JSON.stringify(report,null,2)+'\n');
const input=createInterface({input:process.stdin,terminal:false}),iterator=input[Symbol.asyncIterator]();
const passed=new Set();
const tests=()=>import(`./truncate-privileges-tests.mjs?revision=${revision++}`);
const check=(name,fn)=>{
  if(passed.has(name))return;
  try{fn();passed.add(name);report.checks.push({name,status:'passed'});}
  catch(error){error.caseName=name;report.checks.push({name,status:'failed',sqlstate:error.sqlstate??null,code:error.code??null});throw error;}
  finally{save();}
};
async function bounded(stage,fn){
  while(true){
    try{return await fn();}catch(error){
      const failure={stage,case:error.caseName??stage,sqlstate:error.sqlstate??null,code:error.code??null};
      report.failures.push(failure);report.failure=failure;save();console.log(JSON.stringify({paused:true,...failure}));
      const answer=await iterator.next();if(answer.done||answer.value==='close')throw Error('Local run stopped');
      const command=JSON.parse(answer.value);
      if(command.action!=='retry'||command.classification!==1||!command.cause||!command.correction)throw Error('Only classified fixture/harness retries accepted');
      if(report.corrections.filter(x=>x.cause===command.cause).length>=2)throw Error('Two corrections exhausted');
      report.corrections.push({stage,cause:command.cause,classification:1,correction:command.correction});save();
    }
  }
}
let beforeCatalog,afterCatalog,before,after,entries;
const catalogSql=readFileSync(join(root,'scripts/phase0/bootstrap-catalog.sql'),'utf8');
const catalog=()=>JSON.parse(db.sql(catalogSql));
const digest=value=>hash(JSON.stringify(canonical(value)));
const applyEntry=(entry,source)=>{
  if(!db.verify())throw Error('Local isolation gate failed');
  for(const relation of entry.requiredEmptyRelations??[])if(!/^public\.[a-z_]+$/.test(relation)||db.sql(`SELECT NOT EXISTS(SELECT FROM ${relation})`).trim()!=='t')throw Error('Historical empty relation guard failed');
  db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';
    ${source}
    INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
  report.migrationsApplied++;save();
  if(report.migrationsApplied%50===0||report.migrationsApplied>=272)console.log(`Reconstruction ${report.migrationsApplied}/273`);
};
try {
  const initial=validateManifest();entries=initial.entries;assert.equal(entries.length,272);
  report.historicalMigrationsSha256=hash(JSON.stringify(entries.map(x=>({file:x.file,sha256:x.sha256}))));
  db=await createBootstrapDatabase();report.provider=db.provider;report.nativeCompatibility=alignNativePgNet(db);
  db.sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
  for(const [index,entry] of entries.entries()){
    if(index===268)report.compatibility=applyCompatibility(db,compatibilitySources());
    applyEntry(entry,initial.sources.get(entry.file));
  }
  beforeCatalog=catalog();report.catalogBefore=digest(beforeCatalog);
  check('272 baseline matches accredited catalog',()=>assert.equal(report.catalogBefore,readJson('validation.json').catalogAfter));
  await bounded('snapshot harness before migration',async()=>{before=(await tests()).snapshot(db,scope.allTables);});
  check('exact pending 29 tables and previous 13 match accredited inventory',()=>{
    const original=readJson('scope.json');
    assert.deepEqual(scope.pendingTables,original.deferredTruncate);assert.equal(scope.pendingTables.length,29);
    assert.deepEqual(scope.allTables,[...original.truncateTables,...original.deferredTruncate].sort());assert.equal(new Set(scope.allTables).size,42);
    assert.equal(before.matrix.length,42);
  });
  check('all pending tables currently have effective client TRUNCATE and legitimate owners',()=>{
    for(const row of before.matrix){
      assert.equal(row.kind,'r');assert.ok(!['anon','authenticated'].includes(row.owner));
      for(const role of row.roles.filter(x=>['anon','authenticated'].includes(x.role))){
        assert.equal(role.privileges.TRUNCATE,scope.pendingTables.includes(row.table));
        if(scope.pendingTables.includes(row.table))assert.ok(role.truncateSources.length>0);
      }
      assert.equal(row.roles.find(x=>x.role===row.owner).privileges.TRUNCATE,true);
    }
  });
  report.preflight={verified:true,atMigration:272,aclBefore:digest(before.acl),structureBefore:digest(before.structure),matrix:before.matrix};save();
  console.log(JSON.stringify({paused:true,stage:'create migration 273 after successful preflight',pendingTables:29,allTables:42}));
  const answer=await iterator.next();if(answer.done||JSON.parse(answer.value).action!=='apply')throw Error('Migration application not selected');
  const updated=validateManifest();assert.equal(updated.entries.length,273);assert.deepEqual(updated.entries.slice(0,272),entries);
  const finalScope=readJson('truncate-scope.json');assert.deepEqual({...finalScope,migration:null},{...scope,migration:null});scope=finalScope;
  const migration=updated.entries[272];assert.equal(scope.migration.file,'supabase/migrations/'+migration.file);assert.equal(scope.migration.sha256,migration.sha256);
  const source=updated.sources.get(migration.file),expected=scope.pendingTables.map(t=>`REVOKE TRUNCATE ON TABLE public.${t} FROM PUBLIC, anon, authenticated;`).join('\n');
  assert.equal(source.replace(/--[^\n]*/g,'').trim(),expected);
  report.migration=scope.migration;applyEntry(migration,source);entries=updated.entries;
  afterCatalog=catalog();report.catalogAfter=digest(afterCatalog);
  check('273/273 ledger is complete',()=>assert.deepEqual(db.sql('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version').trim().split(/\r?\n/),entries.map(x=>x.version).sort()));
  check('application catalog changes only the 29 TRUNCATE ACL sets',()=>{
    const remove=g=>g.kind==='relation'&&g.schema==='public'&&scope.pendingTables.includes(g.name)&&g.privilege==='TRUNCATE'&&['PUBLIC','anon','authenticated'].includes(g.grantee);
    assert.deepEqual(canonical(afterCatalog),canonical({...beforeCatalog,grants:beforeCatalog.grants.filter(g=>!remove(g))}));
  });
  await bounded('snapshot harness after migration',async()=>{after=(await tests()).snapshot(db,scope.allTables);});
  // These comparisons are security gates, not retryable expectation changes.
  check('all other ACLs effective CRUD owners RLS functions triggers and memberships remain identical',()=>{
    const compare=before.acl.map(o=>({...o,grants:o.grants.filter(g=>!(o.kind==='relation'&&scope.pendingTables.some(t=>o.object==='public.'+t)&&g.privilege==='TRUNCATE'&&['PUBLIC','anon','authenticated'].includes(g.grantee)))}));
    assert.deepEqual(canonical(after.acl),canonical(compare));assert.deepEqual(canonical(after.structure),canonical(before.structure));
  });
  (await tests()).compareSnapshots(before,after,scope,report);save();
  await bounded('directed SQL fixtures and pgTAP',async()=>{(await tests()).directedTests(db,scope,check,report);});
  check('test rollback leaves schema ACLs and role metadata unchanged',()=>{
    assert.deepEqual(canonical(catalog()),canonical(afterCatalog));
    // Extension, temporary relations, fixture users and any maintenance changes were rolled back.
    assert.ok(db.verify());assert.equal(db.sql('SELECT NOT EXISTS(SELECT FROM net.http_request_queue) AND NOT EXISTS(SELECT FROM net._http_response) AND NOT EXISTS(SELECT FROM public.profiles)').trim(),'t');
  });
  report.complete=true;delete report.failure;
}catch(error){report.failure??={stage:'runner',case:error.caseName??null,sqlstate:error.sqlstate??null,code:error.code??null};process.exitCode=1;}
finally{
  input.close();if(db)try{report.cleanup=db.close();}catch{report.cleanup={failed:true};report.complete=false;}
  report.passed=passed.size;report.finishedAt=new Date().toISOString();save();if(!report.complete)process.exitCode=1;
  console.log(JSON.stringify({complete:report.complete,migrations:report.migrationsApplied,passed:report.passed,failure:report.failure??null,cleanup:report.cleanup}));
}
