// Exactly one reconstruction, no retry and no application regression suites.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment,validateManifest,hash} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {compatibilitySources,applyCompatibility} from '../phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet} from '../phase0/bootstrap-net.mjs';
import {canonical} from '../phase0/compare-schema-metadata.mjs';
import {createDiagnosticTrace,sanitizeText} from './bootstrap-diagnostic-trace.mjs';

assertSafeEnvironment();
const {entries,sources}=validateManifest();
const folder=join(root,'docs/security/phase-1b1');
const previousBytes=readFileSync(join(folder,'local-validation.json'));
const previous=JSON.parse(previousBytes),reference=previous.runs[0];
assert.equal(previous.baseCommit,'ba7b3d3f5e60eb0c2cb907a8c281d4462e15d4bb');
assert.ok(reference.complete&&reference.migrations.length===269);
assert.deepEqual(reference.migrations.map(m=>[m.version,m.sha256]),entries.map(e=>[e.version,e.sha256]));
const report={phase:'1B.1',kind:'single controlled reconstruction',attempts:1,automaticRetries:0,localOnly:true,remoteWrites:0,remainingRegressionChecksExecuted:0,complete:false,
  reference:{file:'local-validation.json',sha256:hash(previousBytes),run:1,applicationFingerprint:reference.catalogFingerprintAfter,profileSecurityFingerprint:reference.securityFingerprint},
  migrations:[],startedAt:new Date().toISOString(),timeouts:{commandMs:120000,cliStartMs:180000,sqlStatementMs:45000,sqlLockMs:5000,diagnosticReadMs:15000},
  auditFalsePositives:{originalRule:'Unanchored case-insensitive Unix home-directory component',occurrences:[
    {file:'docs/security/phase-1b1/README.md',originalLine:75,sanitizedText:'/admin/users/{id}'},
    {file:'scripts/security/profile-security-tests.mjs',originalLine:82,sanitizedText:'admin/users/${ids.approved}'},
  ],classification:'Auth endpoints; not filesystem roots',adjustment:'Recognize Unix home roots only at path boundaries or file URI roots; keep Windows drive roots; no line/file exclusions',positiveAndNegativeTests:{file:'scripts/security/diagnostic-tools.test.mjs',passed:10,failed:0},applied:true},
};
const save=()=>writeFileSync(join(folder,'reconstruction-diagnostic.json'),JSON.stringify(report,null,2)+'\n');
const trace=createDiagnosticTrace(root,value=>{report.trace=value;save();});
const compatible=compatibilitySources();
let db;
try {
  trace.snapshot('before sole attempt');
  trace.setStage('bootstrap.start');
  console.log('Starting the only authorized clean reconstruction');
  db=await createBootstrapDatabase({diagnostics:trace});
  report.provider=db.provider;report.bootstrapMs=db.bootstrapMs;
  trace.snapshot('database started; before historical replay');
  trace.setStage('bootstrap.native-extension-alignment');
  report.nativePgNet=alignNativePgNet(db);
  trace.setStage('bootstrap.local-ledger');
  db.sql('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);');
  for(const [index,entry] of entries.entries()) {
    trace.setStage('migration.prepare',{migration:entry.version,migrationFile:entry.file,migrationOrdinal:index+1,statementTimeoutMs:null,lockTimeoutMs:null});
    if(index===268) {
      trace.setStage('post-historical.compatibility');
      report.compatibility=applyCompatibility(db,compatible);
    }
    const started=performance.now();
    trace.setStage('migration.cron-gate');
    if(!db.verify())throw Error('Cron execution gate unexpectedly enabled');
    for(const relation of entry.requiredEmptyRelations??[]) {
      trace.setStage('migration.empty-table-gate');
      if(!/^public\.[a-z_]+$/.test(relation)||db.sql(`select not exists(select from ${relation})`).trim()!=='t')throw Error('Historical empty-table gate failed');
    }
    trace.setStage('migration.transaction',{statementTimeoutMs:45000,lockTimeoutMs:5000});
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';\n${sources.get(entry.file)}\nINSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
    report.migrations.push({version:entry.version,file:entry.file,sha256:entry.sha256,status:'passed',durationMs:Math.round(performance.now()-started),lastCommand:trace.data.commandCount});
    trace.setStage('migration.completed',{lastCompletedMigration:entry.version});
    if((index+1)%25===0||index+1===entries.length) {
      console.log(`Diagnostic reconstruction: ${index+1}/${entries.length}`);
      trace.snapshot('checkpoint after migration '+(index+1));
    }
  }
  trace.setStage('verification.local-ledger',{migration:null,statementTimeoutMs:null,lockTimeoutMs:null});
  assert.equal(report.migrations.length,269);
  const ledger=db.sql('select version from supabase_migrations.schema_migrations order by version').trim().split(/\r?\n/);
  assert.deepEqual(ledger,entries.map(e=>e.version).sort());
  trace.setStage('verification.application-fingerprint');
  const catalog=JSON.parse(db.sql(readFileSync(join(root,'scripts/phase0/bootstrap-catalog.sql'),'utf8')));
  report.applicationFingerprint=hash(JSON.stringify(canonical(catalog)));
  trace.setStage('verification.profile-security-fingerprint');
  const profile=JSON.parse(db.sql(readFileSync(join(root,'scripts/security/profile-metadata.sql'),'utf8')));
  report.profileSecurityFingerprint=hash(JSON.stringify(canonical(profile)));
  assert.equal(report.applicationFingerprint,report.reference.applicationFingerprint);
  assert.equal(report.profileSecurityFingerprint,report.reference.profileSecurityFingerprint);
  report.fingerprintsMatch=true;
  trace.setStage('verification.residue-and-isolation');
  report.cronExecutionDisabled=db.verify();
  assert.ok(report.cronExecutionDisabled);
  report.emptyApplicationAndNetwork=db.sql('select not exists(select from public.profiles) and not exists(select from net.http_request_queue) and not exists(select from net._http_response)').trim()==='t';
  assert.ok(report.emptyApplicationAndNetwork);
  report.complete=true;
  trace.snapshot('successful comparison; before cleanup');
}catch(error) {
  report.complete=false;
  report.failure={context:{...trace.data.context},message:sanitizeText(error.message),sqlstate:error.sqlstate??null,command:error.diagnostic??trace.data.failures.at(-1)??null,identifiedCause:false};
  try {trace.snapshot('failure before cleanup; no retry');}catch(snapshotError){report.failure.snapshotError=sanitizeText(snapshotError.message);}
  process.exitCode=1;
  console.log('Diagnostic reconstruction stopped; inspect sanitized evidence');
}finally {
  trace.setStage('cleanup.owned-resources');
  if(db) {
    try {report.cleanup=db.close();}catch(error){report.cleanupError={message:sanitizeText(error.message),command:error.diagnostic??null};report.complete=false;process.exitCode=1;}
  }
  try {
    report.remainingOwnedResources=trace.remainingResources();
    assert.ok(Object.values(report.remainingOwnedResources).every(items=>items.length===0));
  }catch(error){report.residueCheckError=sanitizeText(error.message);report.complete=false;process.exitCode=1;}
  report.finishedAt=new Date().toISOString();save();
  console.log(JSON.stringify({complete:report.complete,attempts:report.attempts,migrations:report.migrations.length,fingerprintsMatch:report.fingerprintsMatch??false,remainingOwnedResources:report.remainingOwnedResources}));
}
