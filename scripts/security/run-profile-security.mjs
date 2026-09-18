// No destination arguments or remote environment overrides are accepted.
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment,validateManifest,hash} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {compatibilitySources,applyCompatibility,testSecurityAccess} from '../phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet,testNetAccess} from '../phase0/bootstrap-net.mjs';
import {canonical} from '../phase0/compare-schema-metadata.mjs';
import {baselineEscalation,sqlProfileTests,httpProfileTests,authAdminTests} from './profile-security-tests.mjs';
import {profileDataApi} from './profile-data-api.mjs';
import {profileAuthApi} from './profile-auth-api.mjs';

assertSafeEnvironment();
const {entries,sources}=validateManifest();
const compatibility=compatibilitySources();
const folder=join(root,'docs/security/phase-1b1');
const report={phase:'1B.1',baseCommit:'ba7b3d3f5e60eb0c2cb907a8c281d4462e15d4bb',localOnly:true,remoteWrites:0,runs:[],checks:[],passed:0,failed:0,skipped:0,complete:false};
const save=()=>writeFileSync(join(folder,'local-validation.json'),JSON.stringify(report,null,2)+'\n');
let activeRun;
const check=(name,fn)=>{
  try {fn();report.checks.push({name,run:activeRun?.number??null,status:'passed'});report.passed++;}
  catch(error){report.checks.push({name,run:activeRun?.number??null,status:'failed',sqlstate:error.sqlstate??null,
    expected:typeof error.expected==='string'||typeof error.expected==='number'?error.expected:undefined,
    actual:typeof error.actual==='string'||typeof error.actual==='number'?error.actual:undefined});report.failed++;throw Error(`Stopped at check: ${name}`);}
  finally {save();}
};
const resources=()=>{
  const values={};
  for(const [kind,args] of [['containers',['ps','-aq','--no-trunc']],['networks',['network','ls','-q','--no-trunc']],['volumes',['volume','ls','-q']]]){
    const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true});
    if(r.status!==0)throw Error('Cannot inventory local Docker resources');
    values[kind]=r.stdout.trim().split(/\r?\n/).filter(Boolean).sort();
  }
  return values;
};
const initialResources=resources();
const profileQuery=readFileSync(join(root,'scripts/security/profile-metadata.sql'),'utf8');
const catalogQuery=readFileSync(join(root,'scripts/phase0/bootstrap-catalog.sql'),'utf8');
const remote=JSON.parse(readFileSync(join(folder,'remote-profile-metadata.json'))).metadata;
const roleQuery=`SELECT jsonb_build_object(
  'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'bypassRls',rolbypassrls) ORDER BY rolname) FROM pg_roles),
  'memberships',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'grantor',pg_get_userbyid(grantor),'admin',admin_option,'inherit',inherit_option,'set',set_option) ORDER BY roleid,member,grantor) FROM pg_auth_members));`;
try {
 for(let number=1;number<=2;number++) {
  activeRun={number,migrations:[],complete:false};report.runs.push(activeRun);save();
  let db,api,auth,beforeCatalog,beforeProfile;
  try {
   console.log(`Starting profile reconstruction ${number}/2`);
   db=await createBootstrapDatabase();
   activeRun.provider=db.provider;activeRun.target=db.target;activeRun.bootstrapMs=db.bootstrapMs;
   activeRun.pgNetInstallation=alignNativePgNet(db);
   const rolesBefore=JSON.parse(db.sql(roleQuery));
   db.sql('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);');
   for(const [index,entry] of entries.entries()) {
    if(index===268) {
      activeRun.compatibility=applyCompatibility(db,compatibility);
      beforeProfile=JSON.parse(db.sql(profileQuery));
      beforeCatalog=JSON.parse(db.sql(catalogQuery));
      check('Historical profiles security matches read-only remote metadata',()=>{
        for(const key of ['columns','security','policies','columnAcl','roleGrants'])assert.deepEqual(canonical(beforeProfile[key]),canonical(remote[key]));
      });
      check('Historical escalation reproduced and rolled back',()=>baselineEscalation(db));
    }
    const start=performance.now();
    if(!db.verify())throw Error('Cron execution gate unexpectedly enabled');
    for(const relation of entry.requiredEmptyRelations??[]) {
      if(!/^public\.[a-z_]+$/.test(relation)||db.sql(`select not exists(select from ${relation})`).trim()!=='t')throw Error('Historical empty-table gate failed');
    }
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';\n${sources.get(entry.file)}\nINSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
    activeRun.migrations.push({version:entry.version,sha256:entry.sha256,status:'passed',durationMs:Math.round(performance.now()-start)});save();
    if((index+1)%25===0||index+1===entries.length)console.log(`Local reconstruction ${number}: ${index+1}/${entries.length}`);
  }
  check('Complete historical and incremental migration ledger',()=>{
    assert.equal(entries.length,269);assert.equal(activeRun.migrations.length,269);
    assert.deepEqual(db.sql('select version from supabase_migrations.schema_migrations order by version').trim().split(/\r?\n/),entries.map(e=>e.version).sort());
  });
  const afterProfile=JSON.parse(db.sql(profileQuery));
  const afterCatalog=JSON.parse(db.sql(catalogQuery));
  check('Only profiles DML grants and UPDATE policy changed in application catalog',()=>{
    const strip=c=>({...c,
      grants:c.grants.filter(g=>!(g.kind==='relation'&&g.schema==='public'&&g.name==='profiles'&&['INSERT','UPDATE','DELETE'].includes(g.privilege)&&['PUBLIC','anon','authenticated','service_role'].includes(g.grantee))),
      policies:c.policies.map(p=>p.schema==='public'&&p.table==='profiles'&&p.name==='Update own profile'?{...p,roles:['authenticated']}:p),
    });
    assert.deepEqual(canonical(strip(beforeCatalog)),canonical(strip(afterCatalog)));
    assert.deepEqual(beforeProfile.triggerFunctions,afterProfile.triggerFunctions);
    assert.deepEqual(beforeProfile.profileReferences,afterProfile.profileReferences);
    assert.deepEqual(beforeProfile.columns,afterProfile.columns);
  });
  writeFileSync(join(folder,'local-profile-metadata.json'),JSON.stringify(afterProfile,null,2)+'\n');
  activeRun.catalogFingerprintBefore=hash(JSON.stringify(canonical(beforeCatalog)));
  activeRun.catalogFingerprintAfter=hash(JSON.stringify(canonical(afterCatalog)));
  activeRun.securityFingerprint=hash(JSON.stringify(canonical(afterProfile)));
  check('No role memberships or role attributes added by reconstruction',()=>assert.deepEqual(JSON.parse(db.sql(roleQuery)),rolesBefore));
  if(number===1) {
    report.grants=sqlProfileTests(db,check);
    api=await profileDataApi(db);
    report.dataApi={image:api.image,dbLogin:api.dbLogin,publishedPorts:api.publishedPorts};
    auth=await profileAuthApi(db);
    report.auth={image:auth.image,dbLogin:auth.dbLogin,publishedPorts:auth.publishedPorts,method:'Real local Admin API; signed ephemeral service_role JWT; existing approval and cascade triggers'};
    authAdminTests(db,auth,api,check);
    check('Auth service and tests preserve application schema, grants and role memberships',()=>{
      assert.deepEqual(canonical(JSON.parse(db.sql(catalogQuery))),canonical(afterCatalog));
      assert.deepEqual(canonical(JSON.parse(db.sql(profileQuery))),canonical(afterProfile));
      assert.deepEqual(JSON.parse(db.sql(roleQuery)),rolesBefore);
    });
    httpProfileTests(db,api,check);
    // Historical cases run once; repeating a reconstruction does not inflate counts.
    report.historical={securityAccess:testSecurityAccess(db),netAccess:testNetAccess(db)};
    assert.ok(alignNativePgNet(db).alreadyExact);
    report.historical.pgNetIdempotence={passed:1,failed:0};
  }
  check('Cron stopped, no queued HTTP, no synthetic profiles left',()=>{
    assert.ok(db.verify());
    assert.equal(db.sql("select not exists(select from net.http_request_queue) and not exists(select from net._http_response) and not exists(select from public.profiles)").trim(),'t');
  });
  activeRun.cronExecutionDisabled=true;activeRun.network='internal Docker network; Auth and Data API have no published ports';
  activeRun.complete=true;
  } finally {
    // Each owner verifies its exact resources disappeared. Unrelated resources
    // are diagnostic only; default bridge recreation is not a cleanup failure.
    const errors=[];activeRun.cleanup={};
    for(const [kind,service] of [['auth',auth],['api',api],['database',db]])if(service) {
      try {activeRun.cleanup[kind]=service.close();}catch{errors.push(kind);}
    }
    activeRun.cleanup.failedOwners=errors;
    save();
    if(errors.length)throw Error('Runner-owned cleanup failed: '+errors.join(', '));
  }
 }
 activeRun=null;
 check('Two clean reconstructions have identical application and profiles security fingerprints',()=>{
   assert.equal(report.runs.length,2);
   assert.equal(report.runs[0].catalogFingerprintAfter,report.runs[1].catalogFingerprintAfter);
   assert.equal(report.runs[0].securityFingerprint,report.runs[1].securityFingerprint);
 });
 report.complete=true;
}catch(error){
  report.complete=false;report.error=error.message;process.exitCode=1;
  console.log(`Profile validation stopped: ${error.message}`);
}finally {
  const finalResources=resources();
  report.globalResourceDiagnostics=Object.fromEntries(Object.keys(initialResources).map(kind=>[kind,{
    added:finalResources[kind].filter(id=>!initialResources[kind].includes(id)),
    removed:initialResources[kind].filter(id=>!finalResources[kind].includes(id)),
  }]));
  report.cleanup=report.runs.every(run=>run.cleanup?.failedOwners.length===0)?'all runner-owned resources verified absent':'failed; inspect recorded owners';
  report.uniquePassed=new Set(report.checks.filter(c=>c.status==='passed').map(c=>c.name)).size;
  report.repeatedPassed=report.passed-report.uniquePassed;
  save();console.log(JSON.stringify({complete:report.complete,migrations:report.runs.map(r=>r.migrations.length),passed:report.passed,uniquePassed:report.uniquePassed,failed:report.failed,skipped:report.skipped,cleanup:report.cleanup}));
}
