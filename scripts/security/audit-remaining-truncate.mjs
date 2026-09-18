// Checkpoint auditor: source and sanitized reports only, no .env contents or DB access.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {hash,validateManifest} from '../phase0/bootstrap-manifest.mjs';
import {hasPersonalPath} from './artifact-paths.mjs';

const folder='docs/security/phase-1b4/',output=folder+'truncate-audit.json',reviewPath=folder+'truncate-review.json';
const read=file=>readFileSync(join(root,file));
const json=file=>JSON.parse(read(file));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const scope=json(folder+'truncate-scope.json'),review=json(reviewPath),validation=json(folder+'truncate-validation.json');
if(!existsSync(join(root,output)))writeFileSync(join(root,output),'{}\n');
const files=[...new Set([...git(['diff','--name-only','HEAD']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean))].sort();
const allowed=[...['README.md','truncate-scope.json','truncate-review.json','truncate-validation.json','truncate-audit.json'].map(x=>folder+x),
  ...['truncate-privileges-tests.mjs','run-remaining-truncate.mjs','audit-remaining-truncate.mjs'].map(x=>'scripts/security/'+x),
  'supabase/tests/remaining_truncate_privileges.test.sql',scope.migration.file,'supabase/bootstrap/incremental-manifest.json'].sort();
const findings=[],hashes=[];
const check=(name,fn)=>{try{fn();}catch{findings.push({name});}};
check('exact continuation inventory',()=>{assert.deepEqual(files,allowed);assert.deepEqual(files,review.inventory.files.map(x=>x.file));});
for(const file of files){
  if(!allowed.includes(file)){findings.push({file,kind:'outside-scope'});continue;}
  const bytes=read(file),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(![output,reviewPath].includes(file))hashes.push({file,sha256:hash(bytes)});
  if(hasPersonalPath(text))findings.push({file,kind:'personal-path'});
  if(/(?:sb_secret_|sbp_)[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push({file,kind:'private-credential-pattern'});
  if((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)??[]).some(x=>!x.endsWith('.invalid')))findings.push({file,kind:'non-synthetic-email'});
  if(/https?:\/\/[^\s/]+:[^\s/]+@/.test(text))findings.push({file,kind:'url-credential'});
  if(text.split('\n').some(x=>/[ \t]+\r?$/.test(x)))findings.push({file,kind:'trailing-whitespace'});
  if(/(?:\r?\n){2}$/.test(text))findings.push({file,kind:'extra-blank-at-eof'});
}
check('file and evidence hashes',()=>{
  for(const item of [...review.inventory.files,...review.evidenceReferences])if(item.sha256!==null)assert.equal(hash(read(item.file)),item.sha256);
  assert.equal(hash(read(scope.source.file)),scope.source.sha256);
});
check('272 historical migrations intact and exactly 273 entries',()=>{
  const historical=readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')&&!scope.migration.file.endsWith('/'+x)).sort().map(file=>({file,sha256:hash(read('supabase/migrations/'+file))}));
  assert.equal(historical.length,272);assert.equal(hash(JSON.stringify(historical)),review.historicalMigrations.sha256);
  assert.equal(git(['diff','--name-only',scope.baseCommit,'--','supabase/migrations']),'');
  const manifest=validateManifest();assert.equal(manifest.entries.length,273);
  assert.equal(hash(read(scope.migration.file)),scope.migration.sha256);assert.equal(validation.migration.sha256,scope.migration.sha256);
});
check('migration only revokes TRUNCATE on the exact pending 29',()=>{
  const original=json(scope.source.file),evidence=json('docs/security/phase-1a/evidence.json');
  const expected42=evidence.relations.filter(x=>x.kind==='r'&&['anon','authenticated'].every(role=>x.grants.some(g=>g[0]===role&&g[1]==='TRUNCATE'))).map(x=>x.name).sort();
  assert.deepEqual(scope.pendingTables,original.deferredTruncate);assert.equal(scope.pendingTables.length,29);
  assert.deepEqual(scope.allTables,[...original.truncateTables,...original.deferredTruncate].sort());assert.deepEqual(scope.allTables,expected42);
  assert.equal(read(scope.migration.file).toString().replace(/--[^\n]*/g,'').trim(),scope.pendingTables.map(t=>`REVOKE TRUNCATE ON TABLE public.${t} FROM PUBLIC, anon, authenticated;`).join('\n'));
});
check('one completed reconstruction and all directed checks passed',()=>{
  assert.equal(validation.complete,true);assert.equal(validation.reconstructions,1);assert.equal(validation.migrationsApplied,273);
  const latest=new Map(validation.checks.map(x=>[x.name,x.status]));assert.equal(latest.size,93);assert.ok([...latest.values()].every(x=>x==='passed'));
  assert.equal(validation.passed,93);assert.equal(validation.pgTap.passed,169);assert.equal(validation.pgTap.failed,0);
  assert.equal(validation.preflight.verified,true);assert.equal(validation.preflight.atMigration,272);
  assert.ok(Object.values(validation.cleanup.remaining).every(x=>x.length===0));
  for(const {cause} of validation.corrections)assert.ok(validation.corrections.filter(x=>x.cause===cause).length<=2);
  assert.equal(validation.catalogBefore,json(folder+'validation.json').catalogAfter);
});
check('42 of 42 denied while every other ACL and schema snapshot remains identical',()=>{
  const snapshots=validation.snapshots;
  assert.equal(snapshots.nonTruncateAclBefore,snapshots.nonTruncateAclAfter);assert.equal(snapshots.structureBefore,snapshots.structureAfter);
  assert.deepEqual(snapshots.addedAcl,[]);assert.ok(snapshots.removedAcl.length>0);
  assert.ok(snapshots.removedAcl.every(x=>x.kind==='relation'&&scope.pendingTables.some(t=>x.object==='public.'+t)&&x.privilege==='TRUNCATE'&&scope.roles.includes(x.grantee)));
  assert.equal(snapshots.after.length,42);assert.deepEqual(snapshots.before,validation.preflight.matrix);
  for(const item of Object.values(snapshots.structureSections))assert.equal(item.before,item.after);
  for(const row of snapshots.after){
    assert.ok(!row.truncateGrants.some(x=>scope.roles.includes(x.grantee)));
    const before=snapshots.before.find(x=>x.table===row.table);assert.ok(before);assert.equal(row.owner,before.owner);
    for(const role of row.roles){
      const expected={...before.roles.find(x=>x.role===role.role).privileges};
      if(['anon','authenticated'].includes(role.role))expected.TRUNCATE=false;
      assert.deepEqual(role.privileges,expected);
    }
  }
});
check('Git base and empty index',()=>{assert.equal(git(['branch','--show-current']),'main');assert.equal(git(['rev-parse','HEAD']),scope.baseCommit);assert.equal(git(['diff','--cached','--name-only']),'');assert.equal(git(['ls-files','-u']),'');});
const env={present:existsSync(join(root,'.env')),ignored:spawnSync('git',['check-ignore','--quiet','--','.env'],{cwd:root,windowsHide:true}).status===0,tracked:!!git(['ls-files','--','.env']),contentRead:false};
if(!env.present||!env.ignored||env.tracked)findings.push({kind:'environment-file'});
const result={phase:'1B.4',continuation:'remaining TRUNCATE',passed:findings.length===0,files,hashes,hashExclusions:[output,reviewPath],environmentFile:env,findings,realSecretValuesRead:0,remoteWrites:0};
writeFileSync(join(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,files:files.length,findings}));if(!result.passed)process.exitCode=1;
