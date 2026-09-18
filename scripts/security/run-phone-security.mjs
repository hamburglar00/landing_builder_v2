// One isolated replay, one attempt, stop at the first failed verification.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment,validateManifest,hash} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {compatibilitySources,applyCompatibility} from '../phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet} from '../phase0/bootstrap-net.mjs';
import {canonical} from '../phase0/compare-schema-metadata.mjs';
import {profileDataApi} from './profile-data-api.mjs';
import {sqlProfileTests,httpProfileTests} from './profile-security-tests.mjs';
import {phoneFixture,phoneSqlTests,phoneDataApiTests,cronBehavior,ids} from './phone-security-tests.mjs';
import {phoneEdgeTests} from './phone-edge-tests.mjs';
import {phoneConcurrencyTests} from './phone-concurrency-tests.mjs';

assertSafeEnvironment();
const folder=join(root,'docs/security/phase-1b3');
const report={phase:'1B.3',localOnly:true,attempts:1,automaticRetries:0,complete:false,checks:[],migrations:[],passed:0,failed:0,remoteWrites:0,productionRequests:0,startedAt:new Date().toISOString()};
const save=()=>writeFileSync(join(folder,'database-validation.json'),JSON.stringify(report,null,2)+'\n');
const passed=name=>{assert.ok(!report.checks.some(x=>x.name===name),'unique verification name');report.checks.push({name,status:'passed'});report.passed++;};
const failed=(name,error)=>{report.checks.push({name,status:'failed',sqlstate:error.sqlstate??null});report.failed++;throw Error('Stopped at '+name);};
const check=(name,fn)=>{try{fn();passed(name);}catch(error){failed(name,error);}finally{save();}};
const asyncCheck=async(name,fn)=>{try{await fn();passed(name);}catch(error){failed(name,error);}finally{save();}};
const cronNames=['cron_reset_phone_operational_daily','cron_sync_phones_all'];
const newFunctions=['prevent_gerencia_owner_reassignment','prevent_phone_owner_reassignment'];
const catalogSql=readFileSync(join(root,'scripts/phase0/bootstrap-catalog.sql'),'utf8');
const cronSql=`SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'settings',p.proconfig,'arguments',pg_get_function_identity_arguments(p.oid),'bodyMd5',md5(replace(p.prosrc,E'\\r','')),'definitionMd5',md5(pg_get_functiondef(p.oid)),'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable) ORDER BY a.grantee) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) ORDER BY p.proname) FROM pg_proc p WHERE p.oid IN ('public.cron_sync_phones_all()'::regprocedure,'public.cron_reset_phone_operational_daily()'::regprocedure)),
 'jobs',(SELECT jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'command',command,'username',username,'database',database,'active',active) ORDER BY jobname) FROM cron.job WHERE jobname IN ('sync-phones-every-5min','reset-phone-operational-daily-argentina-midnight')),
 'otherFunctionConsumers',(SELECT coalesce(jsonb_agg(n.nspname||'.'||p.proname),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname NOT IN ('cron_sync_phones_all','cron_reset_phone_operational_daily') AND (p.prosrc LIKE '%cron_sync_phones_all%' OR p.prosrc LIKE '%cron_reset_phone_operational_daily%'))
);`;
let db,api,beforeCatalog,beforeCron,beforeBehavior,beforeAssignment;
const assignment=()=>JSON.parse(db.sql(`BEGIN; ${phoneFixture} DELETE FROM public.landings_gerencias WHERE landing_id='73000000-0000-4000-8000-000000000001' AND gerencia_id=7303; SET LOCAL ROLE service_role; SELECT public.get_phone_for_landing('phase1b3-synthetic',false); ROLLBACK;`).trim().split(/\r?\n/).at(-1));
try {
  const {entries,sources}=validateManifest();
  console.log('Starting one isolated 271-migration reconstruction');
  db=await createBootstrapDatabase();report.provider=db.provider;report.nativeCompatibility=alignNativePgNet(db);
  db.sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
  for(const [index,entry] of entries.entries()) {
    if(index===268)report.compatibility=applyCompatibility(db,compatibilitySources());
    if(index===270) {
      beforeCatalog=JSON.parse(db.sql(catalogSql));beforeCron=JSON.parse(db.sql(cronSql));report.cronBefore=beforeCron;
      check('preflight existing cron owners definitions ACLs and job executors match accredited catalog',()=>{
        const evidence=JSON.parse(readFileSync(join(root,'docs/security/phase-1a/evidence.json')));
        for(const f of beforeCron.functions) {
          const known=evidence.functions.find(x=>x.name===f.name);
          assert.equal(f.owner,'postgres');assert.equal(f.securityDefiner,true);assert.deepEqual(f.settings,['search_path=public']);assert.equal(f.arguments,'');assert.equal(f.bodyMd5,known.body_md5);
          assert.deepEqual(f.acl.map(x=>x.grantee).sort(),['PUBLIC','anon','authenticated','postgres','service_role'].sort());
          assert.ok(f.acl.every(x=>x.privilege==='EXECUTE'&&x.grantor==='postgres'&&!x.grantable));
        }
        assert.equal(beforeCron.jobs.length,2);assert.deepEqual(beforeCron.otherFunctionConsumers,[]);
        for(const job of beforeCron.jobs){assert.equal(job.username,'postgres');assert.equal(job.database,'postgres');assert.equal(job.active,true);assert.equal(job.schedule,job.name==='sync-phones-every-5min'?'*/5 * * * *':'0 3 * * *');assert.match(job.command,/^select public\.cron_(?:sync_phones_all|reset_phone_operational_daily)\(\)$/);}
      });
      check('preflight legitimate postgres cron behavior with synthetic fixtures',()=>{beforeBehavior=cronBehavior(db);report.cronBehaviorBefore=beforeBehavior;});
      check('preflight public assignment synthetic baseline',()=>{beforeAssignment=assignment();assert.equal(beforeAssignment.phone,'000001');assert.equal(beforeAssignment.phoneId,730101);});
    }
    if(!db.verify())throw Error('Isolated execution gate failed');
    for(const relation of entry.requiredEmptyRelations??[])if(!/^public\.[a-z_]+$/.test(relation)||db.sql(`SELECT NOT EXISTS(SELECT FROM ${relation})`).trim()!=='t')throw Error('Historical empty-table gate failed');
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';
      ${sources.get(entry.file)}
      INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
    report.migrations.push({file:entry.file,sha256:entry.sha256,status:'passed'});save();
    if((index+1)%25===0||index+1===entries.length)console.log(`Reconstruction ${index+1}/${entries.length}`);
  }
  check('complete 271/271 migration ledger',()=>{assert.equal(entries.length,271);assert.equal(report.migrations.length,271);assert.deepEqual(db.sql('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version').trim().split(/\r?\n/),entries.map(x=>x.version).sort());});
  const afterCatalog=JSON.parse(db.sql(catalogSql));report.catalogFingerprint=hash(JSON.stringify(canonical(afterCatalog)));
  check('catalog only approved phone policies guards grants and two cron EXECUTE ACLs change',()=>{
    const strip=c=>({...c,functions:c.functions.filter(x=>!newFunctions.includes(x.name)),policies:c.policies.filter(x=>x.table!=='gerencia_phones'),triggers:c.triggers.filter(x=>!['phone_owner_immutable','gerencia_owner_immutable'].includes(x.name)),
      grants:c.grants.filter(g=>!((g.kind==='function'&&(newFunctions.includes(g.name)||cronNames.includes(g.name)))||(g.kind==='relation'&&g.name==='gerencia_phones'&&['SELECT','INSERT','UPDATE','DELETE'].includes(g.privilege))||(g.kind==='relation'&&g.name==='gerencia_phones_id_seq'&&['SELECT','UPDATE','USAGE'].includes(g.privilege))))});
    assert.deepEqual(canonical(strip(afterCatalog)),canonical(strip(beforeCatalog)));
  });
  const afterCron=JSON.parse(db.sql(cronSql));report.cronAfter=afterCron;
  check('cron jobs names schedules exact commands roles and all other job metadata unchanged',()=>{assert.deepEqual(afterCron.jobs,beforeCron.jobs);assert.deepEqual(afterCatalog.cron,beforeCatalog.cron);});
  for(const f of afterCron.functions) {
    check('cron '+f.name+' only authorized ACL removals',()=>{
      const before=beforeCron.functions.find(x=>x.name===f.name);
      assert.deepEqual({...f,acl:undefined},{...before,acl:undefined});
      assert.deepEqual(f.acl,before.acl.filter(x=>!['PUBLIC','anon','authenticated'].includes(x.grantee)));
    });
    for(const role of ['anon','authenticated'])check('cron '+f.name+' SQL '+role+' cannot execute',()=>{
      assert.equal(db.sql(`SELECT has_function_privilege('${role}','public.${f.name}()','EXECUTE')`).trim(),'f');
      let state=null;try{db.sql(`BEGIN; SET LOCAL ROLE ${role}; SELECT public.${f.name}(); ROLLBACK;`);}catch(e){state=e.sqlstate;}assert.equal(state,'42501');
    });
    check('cron '+f.name+' PUBLIC ACL absent and postgres retained',()=>{assert.ok(!f.acl.some(x=>x.grantee==='PUBLIC'));assert.equal(db.sql(`SELECT has_function_privilege('postgres','public.${f.name}()','EXECUTE')`).trim(),'t');});
  }
  check('postgres cron behavior after migration equals synthetic historical behavior',()=>{report.cronBehaviorAfter=cronBehavior(db);assert.deepEqual(report.cronBehaviorAfter,beforeBehavior);});
  check('public assignment returns exact same synthetic result after migration',()=>assert.deepEqual(assignment(),beforeAssignment));
  phoneSqlTests(db,check);
  sqlProfileTests(db,check);
  check('pgTAP phone administration eight assertions',()=>{
    const out=db.sql(`BEGIN; CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions; ${phoneFixture} ${readFileSync(join(root,'supabase/tests/phone_administration.test.sql'),'utf8')} ROLLBACK;`);
    const ok=out.split(/\r?\n/).filter(x=>/^ok \d+/.test(x));assert.equal(ok.length,8);assert.ok(!/^not ok/m.test(out));report.pgTap={passed:8,failed:0,rolledBack:true};
  });
  api=await profileDataApi(db);report.dataApi={image:api.image,publishedPorts:api.publishedPorts};
  phoneDataApiTests(db,api,check);httpProfileTests(db,api,check);
  await phoneEdgeTests(db,api,asyncCheck);
  await phoneConcurrencyTests(db,asyncCheck);
  check('all synthetic data removed and network queues empty with scheduler disabled',()=>{assert.ok(db.verify());assert.equal(db.sql(`SELECT NOT EXISTS(SELECT FROM public.profiles WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}')) AND NOT EXISTS(SELECT FROM net.http_request_queue) AND NOT EXISTS(SELECT FROM net._http_response)`).trim(),'t');});
  report.complete=true;
} catch(error) {
  report.failure={message:error.message,sqlstate:error.sqlstate??null};process.exitCode=1;
} finally {
  report.cleanup={};
  for(const [kind,resource] of [['api',api],['database',db]])if(resource)try{report.cleanup[kind]=resource.close();}catch{report.cleanup[kind]={failed:true};report.complete=false;process.exitCode=1;}
  report.finishedAt=new Date().toISOString();save();
  console.log(JSON.stringify({complete:report.complete,migrations:report.migrations.length,passed:report.passed,failed:report.failed,failure:report.failure??null,cleanup:report.cleanup}));
}
