// Recreates the disposed test environment, retaining the earlier SQL evidence.
// Keeps only this run's isolated resources while bounded diagnostics are retried.
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
import {phoneDataApi} from './phone-data-api.mjs';

assertSafeEnvironment();
const folder=join(root,'docs/security/phase-1b3');
const baselineBytes=readFileSync(join(folder,'database-validation.json')),baseline=JSON.parse(baselineBytes);
const priorPassed=new Set(baseline.checks.filter(x=>x.status==='passed').map(x=>x.name));
const passed=new Set();
const report={phase:'1B.3',complete:false,localOnly:true,baseline:{file:'docs/security/phase-1b3/database-validation.json',sha256:hash(baselineBytes),reusedPassedChecks:baseline.passed,reconstruction:271},provisioning:[],checks:[],attempts:[],diagnostics:[],corrections:[],remoteWrites:0,productionRequests:0,startedAt:new Date().toISOString()};
const save=()=>writeFileSync(join(folder,'pending-validation.json'),JSON.stringify(report,null,2)+'\n');
const input=createInterface({input:process.stdin,terminal:false});const iterator=input[Symbol.asyncIterator]();
let db,api,revision=0;
const check=(name,fn)=>{
  if(priorPassed.has(name)||passed.has(name))return;
  try{fn();passed.add(name);report.checks.push({name,status:'passed'});}
  catch(error){report.checks.push({name,status:'failed',code:error.code??null,sqlstate:error.sqlstate??null});error.caseName=name;throw error;}
  finally{save();}
};
const asyncCheck=async(name,fn)=>{
  if(priorPassed.has(name)||passed.has(name))return;
  try{await fn();passed.add(name);report.checks.push({name,status:'passed'});}
  catch(error){report.checks.push({name,status:'failed',code:error.code??null,sqlstate:error.sqlstate??null});error.caseName=name;throw error;}
  finally{save();}
};
try {
  const {entries,sources}=validateManifest();
  assert.equal(entries.length,271);assert.deepEqual(entries.map(x=>({file:x.file,sha256:x.sha256,status:'passed'})),baseline.migrations);
  console.log('Recreating disposed isolated test environment; previously passed SQL suites will not run');
  db=await createBootstrapDatabase();report.provider=db.provider;report.nativeCompatibility=alignNativePgNet(db);
  db.sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
  for(const [index,entry] of entries.entries()){
    if(index===268)report.compatibility=applyCompatibility(db,compatibilitySources());
    if(!db.verify())throw Error('Isolated environment gate failed');
    for(const relation of entry.requiredEmptyRelations??[])if(!/^public\.[a-z_]+$/.test(relation)||db.sql(`SELECT NOT EXISTS(SELECT FROM ${relation})`).trim()!=='t')throw Error('Empty relation gate failed');
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';
      ${sources.get(entry.file)}
      INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
    report.provisioning.push({file:entry.file,sha256:entry.sha256});save();
    if((index+1)%50===0||index+1===entries.length)console.log(`Environment ${index+1}/${entries.length}`);
  }
  const catalog=JSON.parse(db.sql(readFileSync(join(root,'scripts/phase0/bootstrap-catalog.sql'),'utf8')));
  report.catalogFingerprint=hash(JSON.stringify(canonical(catalog)));assert.equal(report.catalogFingerprint,baseline.catalogFingerprint);
  // Test instrumentation only: own request identity, no table access or definer.
  // No application-object grant is added; this function is dropped before cleanup.
  db.sql(`CREATE FUNCTION public.phase1b3_test_identity() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('role',current_user,'authUid',auth.uid()) $$;`);
  api=await phoneDataApi(db);report.dataApi={image:api.image,publishedPorts:api.publishedPorts};save();
  let stage='diagnostic',diagnosticAttempts=0;
  while(true){
    try {
      if(stage==='diagnostic'){
        diagnosticAttempts++;
        const {diagnoseOwnUpsert}=await import(`./phone-upsert-diagnostic.mjs?revision=${revision++}`);
        diagnoseOwnUpsert(db,api,evidence=>{report.diagnostics.push({attempt:diagnosticAttempts,...evidence});save();});
        report.attempts.push({stage,status:'passed',attempt:diagnosticAttempts});
        passed.add('Data API own manual insert and upsert contract');report.checks.push({name:'Data API own manual insert and upsert contract',status:'passed'});
        stage='pending';save();console.log('Targeted own-phone insert/upsert/CRUD passed; continuing pending checks');
      }
      const {phoneDataApiTests}=await import(`./phone-security-tests.mjs?revision=${revision++}`);
      phoneDataApiTests(db,api,check);
      const {httpProfileTests}=await import('./profile-security-tests.mjs');httpProfileTests(db,api,check);
      const {phoneEdgeTests}=await import(`./phone-edge-tests.mjs?revision=${revision++}`);await phoneEdgeTests(db,api,asyncCheck);
      const {phoneConcurrencyTests}=await import(`./phone-concurrency-tests.mjs?revision=${revision++}`);await phoneConcurrencyTests(db,asyncCheck);
      assert.ok(db.verify());assert.equal(db.sql('SELECT NOT EXISTS(SELECT FROM public.profiles) AND NOT EXISTS(SELECT FROM net.http_request_queue) AND NOT EXISTS(SELECT FROM net._http_response)').trim(),'t');
      report.complete=true;report.failure=null;break;
    }catch(error){
      const safeAssertion=typeof error.actual==='number'||typeof error.actual==='boolean'?{actual:error.actual,expected:error.expected,operator:error.operator}:null;
      report.attempts.push({stage,status:'failed',case:error.caseName??'own-manual-insert-upsert',code:error.code??null,sqlstate:error.sqlstate??null,assertion:safeAssertion});
      report.failure=report.attempts.at(-1);save();console.log(JSON.stringify({paused:true,...report.failure}));
      // The operator/model classifies evidence and makes at most two corrections
      // per cause. A same-cause third correction is never accepted here.
      const answer=await iterator.next();
      if(answer.done||answer.value==='close')break;
      const command=JSON.parse(answer.value);
      if(command.action!=='retry'||![1,2].includes(command.classification)||!command.cause)throw Error('Invalid bounded retry request');
      if(report.corrections.filter(x=>x.cause===command.cause).length>=2)throw Error('Two corrections exhausted for this cause');
      report.corrections.push({cause:command.cause,classification:command.classification,correction:command.correction});save();
    }
  }
}catch(error){report.failure={stage:'environment',message:error.message,sqlstate:error.sqlstate??null};process.exitCode=1;}
finally{
  input.close();report.cleanup={};
  if(db&&api)try{db.sql('DROP FUNCTION public.phase1b3_test_identity();');report.instrumentationRemoved=true;}catch{report.instrumentationRemoved=false;}
  for(const [kind,resource] of [['api',api],['database',db]])if(resource)try{report.cleanup[kind]=resource.close();}catch{report.cleanup[kind]={failed:true};report.complete=false;}
  report.finishedAt=new Date().toISOString();report.passed=[...passed].length;save();
  if(!report.complete)process.exitCode=1;
  console.log(JSON.stringify({complete:report.complete,passed:report.passed,failure:report.failure??null,cleanup:report.cleanup}));
}
