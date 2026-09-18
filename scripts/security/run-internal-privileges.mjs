// Exactly one isolated replay. A paused local case can be retried after at most
// two classified fixture/harness corrections; no remote target is accepted.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment,validateManifest,hash} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {compatibilitySources,applyCompatibility} from '../phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet} from '../phase0/bootstrap-net.mjs';
import {canonical} from '../phase0/compare-schema-metadata.mjs';
import {profileDataApi} from './profile-data-api.mjs';

assertSafeEnvironment();
const folder=join(root,'docs/security/phase-1b4');
let scope=JSON.parse(readFileSync(join(folder,'scope.json')));
const evidence=JSON.parse(readFileSync(join(root,'docs/security/phase-1a/evidence.json')));
const catalogSql=readFileSync(join(root,'scripts/phase0/bootstrap-catalog.sql'),'utf8');
const report={phase:'1B.4',complete:false,localOnly:true,reconstructions:1,migrationsApplied:0,checks:[],http:[],corrections:[],remoteWrites:0,productionRequests:0,startedAt:new Date().toISOString()};
const save=()=>writeFileSync(join(folder,'validation.json'),JSON.stringify(report,null,2)+'\n');
const input=createInterface({input:process.stdin,terminal:false}),iterator=input[Symbol.asyncIterator]();
const passed=new Set();let revision=0,db,api;
const module=()=>import(`./internal-privileges-tests.mjs?revision=${revision++}`);
const check=(name,fn)=>{
  if(passed.has(name))return;
  try{fn();passed.add(name);report.checks.push({name,status:'passed'});}
  catch(error){error.caseName=name;report.checks.push({name,status:'failed',sqlstate:error.sqlstate??null,code:error.code??null});throw error;}
  finally{save();}
};
async function bounded(stage,fn){
  while(true){
    try{return await fn();}catch(error){
      const detail={stage,case:error.caseName??stage,sqlstate:error.sqlstate??null,code:error.code??null,message:error.message.slice(0,500)};
      report.failure=detail;save();console.log(JSON.stringify({paused:true,...detail}));
      const answer=await iterator.next();if(answer.done||answer.value==='close')throw Error('Local run stopped by operator');
      const command=JSON.parse(answer.value);
      if(command.action!=='retry'||![1,2].includes(command.classification)||!command.cause)throw Error('Unclassified retry rejected');
      if(report.corrections.filter(x=>x.cause===command.cause).length>=2)throw Error('Two corrections exhausted for this cause');
      report.corrections.push({stage,cause:command.cause,classification:command.classification,correction:command.correction});save();
    }
  }
}
const removed=g=>g.schema==='public'&&(
  (g.kind==='relation'&&scope.truncateTables.includes(g.name)&&g.privilege==='TRUNCATE'&&['PUBLIC','anon','authenticated'].includes(g.grantee))||
  (g.kind==='relation'&&scope.dataApiRevokes.some(x=>x.table===g.name&&x.roles.includes(g.grantee)&&x.privileges.includes(g.privilege)))||
  (g.kind==='function'&&scope.functions.some(x=>x.name===g.name&&x.remove.includes(g.grantee))));
let before,after,beforeBehavior;
try{
  const {entries,sources}=validateManifest();assert.equal(entries.length,272);
  report.migration={file:scope.migration.file,sha256:hash(readFileSync(join(root,scope.migration.file)))};
  report.historicalMigrationsSha256=hash(JSON.stringify(entries.slice(0,271).map(x=>({file:x.file,sha256:x.sha256}))));
  db=await createBootstrapDatabase();report.provider=db.provider;report.nativeCompatibility=alignNativePgNet(db);
  db.sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
  for(const [index,entry] of entries.entries()){
    if(index===268)report.compatibility=applyCompatibility(db,compatibilitySources());
    if(index===271){
      // A scope clarification can be incorporated before applying migration 272,
      // without replaying any historical migration or accepting a changed base.
      const finalManifest=validateManifest();
      assert.deepEqual(finalManifest.entries.slice(0,271),entries.slice(0,271));
      assert.equal(finalManifest.entries.length,272);assert.equal(finalManifest.entries[271].file,entry.file);
      scope=JSON.parse(readFileSync(join(folder,'scope.json')));
      entry.sha256=finalManifest.entries[271].sha256;sources.set(entry.file,finalManifest.sources.get(entry.file));
      report.migration={file:scope.migration.file,sha256:entry.sha256};
      before=JSON.parse(db.sql(catalogSql));report.catalogBefore=hash(JSON.stringify(canonical(before)));
      await bounded('preflight',async()=>{
        check('271 baseline catalog matches accredited phase 1B.3',()=>assert.equal(report.catalogBefore,JSON.parse(readFileSync(join(root,'docs/security/phase-1b3/database-validation.json'))).catalogFingerprint));
        check('target function definitions owners paths and consumers match phase 1A',()=>{
          for(const target of scope.functions){const old=evidence.functions.find(x=>x.name===target.name),current=before.functions.find(x=>x.name===target.name);assert.equal(current.body_md5,old.body_md5);assert.equal(current.owner,'postgres');assert.deepEqual(current.settings,old.settings);assert.equal(current.security_definer,old.security_definer);}
          const job=before.cron.find(x=>x.name==='promotion-draw-due-hourly');assert.ok(job);assert.equal(job.username,'postgres');assert.equal(job.schedule,'0 * * * *');
          for(const target of scope.functions.filter(x=>x.remove.includes('authenticated')&&x.name!=='cron_process_due_promotions'))assert.ok(before.triggers.some(x=>x.function===target.name));
        });
        const tests=await module();beforeBehavior=tests.historicalBehavior(db);report.historicalBehavior=beforeBehavior;save();
      });
    }
    if(!db.verify())throw Error('Local isolation gate failed');
    for(const relation of entry.requiredEmptyRelations??[])if(!/^public\.[a-z_]+$/.test(relation)||db.sql(`SELECT NOT EXISTS(SELECT FROM ${relation})`).trim()!=='t')throw Error('Historical empty relation guard failed');
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';
      ${sources.get(entry.file)}
      INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
    report.migrationsApplied=index+1;save();if((index+1)%50===0||index+1===272)console.log(`Reconstruction ${index+1}/272`);
  }
  after=JSON.parse(db.sql(catalogSql));report.catalogAfter=hash(JSON.stringify(canonical(after)));
  await bounded('SQL and catalog',async()=>{
    const tests=await module();
    check('complete 272/272 ledger',()=>assert.deepEqual(db.sql('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version').trim().split(/\r?\n/),entries.map(x=>x.version).sort()));
    check('catalog changes are exactly approved revokes and legacy null-subject guard',()=>{
      const old=before.functions.find(x=>x.name==='get_home_overview_stats'),current=after.functions.find(x=>x.name==='get_home_overview_stats');
      assert.deepEqual({...current,body_md5:old.body_md5,definition_md5:old.definition_md5},old);
      assert.equal(db.sql(`SELECT md5(replace(replace(prosrc,E'\\r',''),$guard$${tests.authGuard}$guard$,'')) FROM pg_proc WHERE oid='public.get_home_overview_stats(uuid,uuid)'::regprocedure`).trim(),old.body_md5);
      const expected={...before,grants:before.grants.filter(x=>!removed(x)),functions:before.functions.map(x=>x===old?current:x)};
      assert.deepEqual(canonical(after),canonical(expected));
      report.removedAclRows=before.grants.filter(removed);report.addedAclRows=0;
    });
    check('before and after ACL matrix retains all owner and backend privileges',()=>{
      const selected=g=>g.schema==='public'&&((g.kind==='relation'&&(scope.truncateTables.includes(g.name)||g.name==='cron_config'))||(g.kind==='function'&&scope.functions.some(x=>x.name===g.name)));
      const objects=[...new Set([...before.grants,...after.grants].filter(selected).map(x=>x.kind+':'+x.name))].sort();
      report.aclMatrix=objects.map(object=>{const [kind,name]=object.split(':');return {object,roles:['PUBLIC','anon','authenticated','postgres','service_role'].map(role=>({role,before:before.grants.filter(x=>x.kind===kind&&x.name===name&&x.grantee===role).map(x=>x.privilege).sort(),after:after.grants.filter(x=>x.kind===kind&&x.name===name&&x.grantee===role).map(x=>x.privilege).sort()}))};});
      for(const entry of report.aclMatrix)for(const role of entry.roles.filter(x=>['postgres','service_role'].includes(x.role)))assert.deepEqual(role.after,role.before);
      assert.deepEqual(after.cron,before.cron);
    });
    check('real authorized trigger RPC backend cron and public behavior unchanged',()=>assert.deepEqual(tests.historicalBehavior(db),beforeBehavior));
    tests.sqlTests(db,check,report);
  });
  api=await profileDataApi(db);report.dataApi={image:api.image,publishedPorts:api.publishedPorts,transport:'Existing isolated PostgREST harness, ephemeral synthetic JWTs only'};
  await bounded('Data API',async()=>{const tests=await module();tests.dataApiTests(db,api,check,report,beforeBehavior);});
  check('no remaining synthetic users or network requests and scheduler disabled',()=>{
    assert.ok(db.verify());assert.equal(db.sql('SELECT NOT EXISTS(SELECT FROM public.profiles) AND NOT EXISTS(SELECT FROM net.http_request_queue) AND NOT EXISTS(SELECT FROM net._http_response)').trim(),'t');
  });
  report.complete=true;delete report.failure;
}catch(error){report.failure??={stage:'runner',message:error.message.slice(0,500),sqlstate:error.sqlstate??null};process.exitCode=1;}
finally{
  input.close();report.cleanup={};
  for(const [kind,resource] of [['api',api],['database',db]])if(resource)try{report.cleanup[kind]=resource.close();}catch{report.cleanup[kind]={failed:true};report.complete=false;}
  report.passed=passed.size;report.finishedAt=new Date().toISOString();save();if(!report.complete)process.exitCode=1;
  console.log(JSON.stringify({complete:report.complete,migrations:report.migrationsApplied,passed:report.passed,failure:report.failure??null,cleanup:report.cleanup}));
}
