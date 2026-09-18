// Fresh, scoped integration fixture. Never replays the 269-migration ledger.
// All fixture SQL comes unmodified from validated sources; no replacement schema.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment,validateManifest,hash} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {canonical} from '../phase0/compare-schema-metadata.mjs';
import {validateProfileEvidence} from './profile-evidence.mjs';
import {baselineEscalation,sqlProfileTests,authAdminTests,httpProfileTests} from './profile-security-tests.mjs';
import {profileDataApi} from './profile-data-api.mjs';
import {profileAuthApi} from './profile-auth-api.mjs';

assertSafeEnvironment();
const evidence=validateProfileEvidence();
const {entries,sources}=validateManifest();
const folder=join(root,'docs/security/phase-1b1');
const report={formatVersion:1,phase:'1B.1',kind:'fresh scoped profiles/Auth fixture',baseCommit:evidence.baseCommit,localOnly:true,
  remoteWrites:0,fullReconstructions:0,complete:false,checks:[],fixtureSources:[],sourceHashes:[],cleanup:{},startedAt:new Date().toISOString()};
const save=()=>writeFileSync(join(folder,'profile-repeat-validation.json'),JSON.stringify(report,null,2)+'\n');
for(const file of ['scripts/security/run-profile-repeat.mjs','scripts/security/profile-security-tests.mjs','scripts/security/profile-auth-api.mjs',
  'scripts/security/profile-data-api.mjs','scripts/security/profile-metadata.sql','scripts/phase0/bootstrap-runtime.mjs'])report.sourceHashes.push({file,sha256:hash(readFileSync(join(root,file)))});
const check=(name,fn)=>{
  try{fn();report.checks.push({name,status:'passed'});}
  catch(error){report.checks.push({name,status:'failed',sqlstate:error.sqlstate??null});throw Error('Stopped at check: '+name);}
  finally{save();}
};
const metadataSql=readFileSync(join(root,'scripts/security/profile-metadata.sql'),'utf8');
const accredited=JSON.parse(readFileSync(join(folder,'local-profile-metadata.json')));
const remote=JSON.parse(readFileSync(join(folder,'remote-profile-metadata.json'))).metadata;
const profileKeys=['columns','security','policies','columnAcl','roleGrants','triggerFunctions'];
const projection=(actual,expected)=>{
  for(const key of profileKeys)assert.deepEqual(canonical(actual[key]),canonical(expected[key]),'Fixture differs: '+key);
  // Consumers outside this deliberately scoped fixture are covered by the two
  // admitted full reconstructions; no full application fingerprint is claimed.
  assert.equal(actual.profileReferences.length,1);
  assert.deepEqual(actual.profileReferences[0],expected.profileReferences.find(f=>f.name==='handle_new_user'));
};
const roleSql="select jsonb_build_object('roles',(select jsonb_agg(row(rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls) order by rolname) from pg_roles),'members',(select jsonb_agg(row(pg_get_userbyid(roleid),pg_get_userbyid(member),admin_option,inherit_option,set_option) order by roleid,member,grantor) from pg_auth_members));";
let db,api,auth;
try {
  console.log('Starting clean scoped profiles/Auth integration fixture; no full reconstruction');
  db=await createBootstrapDatabase();report.provider=db.provider;
  assert.deepEqual(report.provider,evidence.reconstruction.provider);
  const roles=db.sql(roleSql);
  const versions=['0001','20260228000000','20260808120000','20260818170134','20260902154745','20260917183837'];
  for(const version of versions) {
    const entry=entries.find(e=>e.version===version);assert.ok(entry);
    if(version==='20260917183837'){
      const before=JSON.parse(db.sql(metadataSql));
      check('Scoped pre-migration profiles metadata matches accredited baseline',()=>projection(before,remote));
      check('Historical escalation reproduced and rolled back',()=>baselineEscalation(db));
    }
    assert.ok(db.verify());
    db.sql("BEGIN; SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='5s';\n"+sources.get(entry.file)+'\nCOMMIT;');
    report.fixtureSources.push({version,file:entry.file,sha256:entry.sha256});save();
  }
  const after=JSON.parse(db.sql(metadataSql));
  check('Scoped post-migration profiles metadata matches complete reconstruction',()=>projection(after,accredited));
  report.scopedProfileFingerprint=hash(JSON.stringify(canonical(Object.fromEntries(profileKeys.map(k=>[k,after[k]])))));
  console.log('Scoped fixture metadata matches; starting SQL profiles and effective grants');
  report.grants=sqlProfileTests(db,check);
  console.log('SQL profiles passed; starting real local Auth Admin and Data API');
  api=await profileDataApi(db);auth=await profileAuthApi(db);
  report.api={image:api.image,publishedPorts:api.publishedPorts};report.auth={image:auth.image,publishedPorts:auth.publishedPorts};
  authAdminTests(db,auth,api,check);httpProfileTests(db,api,check);
  check('Scoped Auth and API preserve schema and role attributes/memberships',()=>{
    assert.deepEqual(canonical(JSON.parse(db.sql(metadataSql))),canonical(after));assert.equal(db.sql(roleSql),roles);
  });
  check('Cron stopped, no queued HTTP, no synthetic profiles left',()=>{
    assert.ok(db.verify());
    assert.equal(db.sql('select not exists(select from public.profiles) and not exists(select from public.auth_signup_approvals) and not exists(select from auth.users) and not exists(select from net.http_request_queue) and not exists(select from net._http_response)').trim(),'t');
  });
  report.complete=true;
}catch(error){
  report.complete=false;report.failure={message:error.message,sqlstate:error.sqlstate??null};
  process.exitCode=1;console.log('Scoped integration stopped: '+error.message);
}finally{
  const errors=[];
  for(const [kind,service] of [['auth',auth],['api',api],['database',db]])if(service){
    try{report.cleanup[kind]=service.close();}catch{errors.push(kind);}
  }
  report.cleanup.failedOwners=errors;
  if(errors.length){report.complete=false;process.exitCode=1;}
  report.passed=report.checks.filter(c=>c.status==='passed').length;
  report.failed=report.checks.filter(c=>c.status==='failed').length;
  report.repeatedPriorNames=report.checks.filter(c=>evidence.authReport.checks.some(p=>p.name===c.name)).map(c=>c.name);
  report.finishedAt=new Date().toISOString();save();
  console.log(JSON.stringify({complete:report.complete,passed:report.passed,failed:report.failed,cleanupFailures:errors}));
}
