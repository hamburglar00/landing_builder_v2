// Exactly one fully isolated replay. Stop on the first failure; never touch prior reports.
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
import {settingsSqlTests,settingsDataApiTests} from './settings-security-tests.mjs';

assertSafeEnvironment();
const {entries,sources}=validateManifest();
const folder=join(root,'docs/security/phase-1b2');
const report={phase:'1B.2',localOnly:true,attempts:1,automaticRetries:0,complete:false,checks:[],migrations:[],passed:0,failed:0,remoteWrites:0,productionRequests:0,startedAt:new Date().toISOString()};
const save=()=>writeFileSync(join(folder,'implementation-database-validation.json'),JSON.stringify(report,null,2)+'\n');
const check=(name,fn)=>{
  try {fn();report.checks.push({name,status:'passed'});report.passed++;}
  catch(error){report.checks.push({name,status:'failed',sqlstate:error.sqlstate??null});report.failed++;throw Error('Stopped at '+name);}
  finally {save();}
};
const catalogSql=readFileSync(join(root,'scripts/phase0/bootstrap-catalog.sql'),'utf8');
const profileSql=readFileSync(join(root,'scripts/security/profile-metadata.sql'),'utf8');
let db,api,beforeCatalog,beforeProfile;
try {
  console.log('Starting one isolated 270-migration reconstruction');
  db=await createBootstrapDatabase();
  report.provider=db.provider;
  report.nativeCompatibility=alignNativePgNet(db);
  db.sql('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);');
  for(const [index,entry] of entries.entries()) {
    if(index===268)report.compatibility=applyCompatibility(db,compatibilitySources());
    if(index===269){beforeCatalog=JSON.parse(db.sql(catalogSql));beforeProfile=JSON.parse(db.sql(profileSql));}
    if(!db.verify())throw Error('Existing isolated execution gate failed');
    for(const relation of entry.requiredEmptyRelations??[])if(!/^public\.[a-z_]+$/.test(relation)||db.sql(`select not exists(select from ${relation})`).trim()!=='t')throw Error('Historical empty-table gate failed');
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';
      ${sources.get(entry.file)}
      INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
    report.migrations.push({file:entry.file,sha256:entry.sha256,status:'passed'});save();
    if((index+1)%25===0||index+1===entries.length)console.log(`Reconstruction ${index+1}/${entries.length}`);
  }
  check('complete 270/270 migration ledger',()=>{
    assert.equal(entries.length,270);assert.equal(report.migrations.length,270);
    assert.deepEqual(db.sql('select version from supabase_migrations.schema_migrations order by version').trim().split(/\r?\n/),entries.map(x=>x.version).sort());
  });
  const afterCatalog=JSON.parse(db.sql(catalogSql));
  check('catalog changes restricted to settings DML and verifier permissions',()=>{
    const strip=c=>({...c,grants:c.grants.filter(g=>!(g.schema==='public'&&(
      (g.kind==='relation'&&g.name==='settings'&&['SELECT','INSERT','UPDATE','DELETE','REFERENCES'].includes(g.privilege))
      ||(g.kind==='function'&&g.name==='verify_revalidate_secret'&&g.privilege==='EXECUTE'))))});
    assert.deepEqual(canonical(strip(beforeCatalog)),canonical(strip(afterCatalog)));
    assert.deepEqual(JSON.parse(db.sql(profileSql)),beforeProfile);
  });
  report.catalogFingerprint=hash(JSON.stringify(canonical(afterCatalog)));
  settingsSqlTests(db,check);
  sqlProfileTests(db,check);
  api=await profileDataApi(db);
  report.dataApi={image:api.image,publishedPorts:api.publishedPorts};
  settingsDataApiTests(db,api,check);
  httpProfileTests(db,api,check);
  check('isolated execution remains disabled and synthetic users removed',()=>{
    assert.ok(db.verify());assert.equal(db.sql('select not exists(select from public.profiles) and not exists(select from net.http_request_queue) and not exists(select from net._http_response)').trim(),'t');
  });
  report.complete=true;
} catch(error) {
  report.failure={message:error.message,sqlstate:error.sqlstate??null};process.exitCode=1;
} finally {
  report.cleanup={};
  for(const [kind,resource] of [['api',api],['database',db]])if(resource)try {report.cleanup[kind]=resource.close();}catch{report.cleanup[kind]={failed:true};report.complete=false;process.exitCode=1;}
  report.finishedAt=new Date().toISOString();save();
  console.log(JSON.stringify({complete:report.complete,migrations:report.migrations.length,passed:report.passed,failed:report.failed,failure:report.failure??null,cleanup:report.cleanup}));
}
