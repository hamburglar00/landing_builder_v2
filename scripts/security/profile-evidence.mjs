// Independent admission gates for the existing, immutable report formats.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {hash,validateManifest} from '../phase0/bootstrap-manifest.mjs';
import {compatibilitySources} from '../phase0/bootstrap-compatibility.mjs';
import {canonical} from '../phase0/compare-schema-metadata.mjs';

const folder='docs/security/phase-1b1/';
const base='ba7b3d3f5e60eb0c2cb907a8c281d4462e15d4bb';
const pins={
  'local-validation.json':'290211f5f8af5893117b29dcf9af4d737a173f5783fe5d84843132913167d83c',
  'reconstruction-diagnostic.json':'bb03aae86f7ea824958e42f72428e2f4b578fe448248b98854581809f46526a6',
};
const bytes=file=>readFileSync(join(root,file));
const json=file=>JSON.parse(bytes(file));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const empty=remaining=>assert.deepEqual(remaining,{containers:[],networks:[],volumes:[]});
const sha=value=>assert.match(value,/^[a-f0-9]{64}$/);

export function validateProfileEvidence() {
  assert.equal(git('branch','--show-current'),'main');
  assert.equal(git('rev-parse','HEAD'),base);
  assert.equal(git('diff','--cached','--name-only'),'');
  assert.equal(git('ls-files','-u'),'');
  assert.equal(hash(bytes(folder+'validation-inputs.json')),'225b5b365de9b837174c55787f53992d341a7b7636aa232179da760e354a89b8','Admission snapshot changed');
  const snapshot=json(folder+'validation-inputs.json');
  assert.equal(snapshot.formatVersion,1);assert.equal(snapshot.baseCommit,base);
  const {entries}=validateManifest();assert.equal(entries.length,269);
  const compatibility=compatibilitySources();
  const protectedFiles=snapshot.files.filter(x=>!['README.md','review.json','regression-validation.json'].some(f=>x.file===folder+f)
    &&!['scripts/security/run-profile-regressions.mjs','scripts/security/audit-profile-artifacts.mjs'].includes(x.file));
  // Only orchestration, its new tests/reports, final documentation and inventory may change.
  for(const item of protectedFiles)assert.equal(hash(bytes(item.file)),item.sha256,'Source changed: '+item.file);
  const added=[...['validation-inputs.json','evidence-validation.json','profile-repeat-validation.json'].map(f=>folder+f),
    ...['profile-evidence.mjs','run-profile-repeat.mjs'].map(f=>'scripts/security/'+f)];
  const actual=[...new Set([...git('diff','--name-only').split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))].sort();
  const expected=[...snapshot.inventory.modified,...snapshot.inventory.new];
  for(const file of actual)assert.ok([...expected,...added].includes(file),'Unexpected file: '+file);
  for(const file of expected)assert.ok(actual.includes(file),'Missing inventoried file: '+file);
  const load=(file)=>{assert.equal(hash(bytes(folder+file)),pins[file],file+' seal');return json(folder+file);};
  const auth=load('local-validation.json');
  // Legacy reports lack formatVersion. The exact pinned shape is explicitly v1;
  // do not retrofit success or a source stamp into the historical failed attempt.
  assert.equal(auth.phase,'1B.1');assert.equal(auth.baseCommit,base);
  assert.equal(auth.localOnly,true);assert.equal(auth.remoteWrites,0);
  assert.equal(auth.failed,0);assert.equal(auth.skipped,0);
  assert.equal(auth.complete,false);assert.equal(auth.error,'Local command failed');
  assert.equal(auth.runs.length,2);
  const first=auth.runs[0],failed=auth.runs[1];
  assert.equal(first.complete,true);assert.equal(failed.complete,false);
  assert.equal(failed.migrations.length,11);
  const ledger=rows=>{
    assert.deepEqual(rows.map(m=>[m.version,m.sha256]),entries.map(e=>[e.version,e.sha256]));
    assert.ok(rows.every(m=>m.status==='passed'&&Number.isFinite(m.durationMs)));
  };
  ledger(first.migrations);
  assert.equal(first.compatibility.sourceSha256,compatibility.manifest.sha256);
  assert.equal(first.compatibility.referenceMatched,true);
  assert.equal(first.cleanup.failedOwners.length,0);empty(first.cleanup.database.remaining);
  assert.equal(first.cleanup.auth.remaining,0);assert.equal(first.cleanup.api.remaining,0);
  assert.equal(auth.auth.image,'public.ecr.aws/supabase/gotrue:v2.189.0');
  assert.equal(auth.dataApi.image,'public.ecr.aws/supabase/postgrest:v14.1');
  assert.equal(auth.auth.publishedPorts,0);assert.equal(auth.dataApi.publishedPorts,0);
  assert.equal(auth.checks.length,75);assert.equal(auth.passed,75);assert.equal(auth.uniquePassed,75);
  assert.equal(new Set(auth.checks.map(c=>c.name)).size,75);
  assert.ok(auth.checks.every(c=>c.run===1&&c.status==='passed'));
  for(const name of ['Auth Admin API creates approved synthetic user and profile','Auth-created profile accepts existing backend upsert','Auth Admin API hard deletion cascades to profiles'])assert.ok(auth.checks.some(c=>c.name===name));
  for(const [key,count] of [['securityAccess',61],['netAccess',46],['pgNetIdempotence',1]]){
    assert.equal(auth.historical[key].passed,count);assert.equal(auth.historical[key].failed,0);
  }
  const profile=json(folder+'local-profile-metadata.json');
  assert.equal(hash(JSON.stringify(canonical(profile))),first.securityFingerprint);
  sha(first.catalogFingerprintAfter);sha(first.securityFingerprint);
  const authGate={valid:true,file:folder+'local-validation.json',sha256:pins['local-validation.json'],schema:'pinned legacy profile-report v1',baseCommit:base,
    admittedRun:1,excludedRun:2,profileChecks:75,historicalChecks:108,reportClaimsFullSuccess:false,
    sourceBinding:'Migration hashes and current audited source inventory; legacy report has no execution-time harness hash inventory. No new execution-time provenance is claimed.'};

  const rebuild=load('reconstruction-diagnostic.json');
  assert.equal(rebuild.phase,'1B.1');assert.equal(rebuild.kind,'single controlled reconstruction');
  assert.equal(rebuild.attempts,1);assert.equal(rebuild.automaticRetries,0);
  assert.equal(rebuild.localOnly,true);assert.equal(rebuild.remoteWrites,0);assert.equal(rebuild.complete,true);
  assert.deepEqual(rebuild.reference,{file:'local-validation.json',sha256:pins['local-validation.json'],run:1,
    applicationFingerprint:first.catalogFingerprintAfter,profileSecurityFingerprint:first.securityFingerprint});
  ledger(rebuild.migrations);
  assert.deepEqual(rebuild.migrations.map(m=>m.file),entries.map(e=>e.file));
  assert.equal(rebuild.compatibility.sourceSha256,compatibility.manifest.sha256);
  assert.deepEqual(rebuild.provider,first.provider);
  assert.equal(rebuild.provider.cli,'2.75.0');
  assert.equal(rebuild.provider.image,'public.ecr.aws/supabase/postgres:17.6.1.075');
  assert.equal(rebuild.applicationFingerprint,first.catalogFingerprintAfter);
  assert.equal(rebuild.profileSecurityFingerprint,first.securityFingerprint);
  assert.equal(rebuild.fingerprintsMatch,true);assert.equal(rebuild.cronExecutionDisabled,true);
  assert.equal(rebuild.emptyApplicationAndNetwork,true);assert.equal(rebuild.trace.failures.length,0);
  empty(rebuild.cleanup.remaining);empty(rebuild.remainingOwnedResources);
  const rebuildGate={valid:true,file:folder+'reconstruction-diagnostic.json',sha256:pins['reconstruction-diagnostic.json'],schema:'pinned legacy reconstruction-report v1',
    baseCommit:base,baseCommitProvenance:'SHA256-pinned reference to first report',provider:rebuild.provider,migrations:269,
    applicationFingerprint:rebuild.applicationFingerprint,profileSecurityFingerprint:rebuild.profileSecurityFingerprint,identical:true};
  return {formatVersion:1,phase:'1B.1',baseCommit:base,valid:true,auth:authGate,reconstruction:rebuildGate,
    protectedSourcesChecked:protectedFiles.length,inventorySnapshotSha256:hash(bytes(folder+'validation-inputs.json')),
    newReconstructions:0,authReport:auth};
}
