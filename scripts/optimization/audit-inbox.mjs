// Checkpoint audit: exact local scope, evidence, hashes, privacy and Git. No .env reads.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {join,dirname,resolve} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {hash,validateManifest} from '../phase0/bootstrap-manifest.mjs';
import {hasPersonalPath} from '../security/artifact-paths.mjs';

const base='ad436ff1ee3a329c1d6c702d0ce2cbfd05f92981',folder='docs/optimization/inbox/';
const auditFile=folder+'audit.json',inventoryFile=folder+'inventory.json';
const read=file=>readFileSync(join(root,file));
const json=file=>JSON.parse(read(file));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
if(!existsSync(join(root,auditFile)))writeFileSync(join(root,auditFile),'{}\n');
const files=[...new Set([...git(['diff','--name-only','HEAD']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean))].sort();
const allowed=[
  ...['README.md','audit.json','browser.json','frontend-validation.json','inventory.json','measurements.json','remote-reproduction.json','rollback.md','sql-measurements.json','synthetic-diagnostic.json','tests.json','validation.md'].map(x=>folder+x),
  ...['audit-inbox.mjs','diagnose-inbox.mjs','inbox-browser.mjs','inbox-diagnostic-fixture.sql','inbox-functional-fixture.sql','inbox-measure.mjs','inbox-pgtap.sql','inbox-tests.mjs','run-inbox.mjs','validate-inbox-frontend.mjs'].map(x=>'scripts/optimization/'+x),
  'frontend/components/whatsapp-cloud-api/WhatsAppCloudApiInboxPageContent.tsx','frontend/lib/whatsappCloudApiDb.ts','frontend/lib/whatsappInboxMessages.ts','frontend/tests/inboxLoading.test.ts',
  'supabase/bootstrap/incremental-manifest.json','supabase/migrations/20260918194918_optimize_whatsapp_cloud_api_inbox_loading.sql',
].sort();
const findings=[],hashes=[],review=json(inventoryFile),validation=json(folder+'tests.json');
const check=(name,fn)=>{try{fn();}catch{findings.push({kind:name});}};
check('exact inventory',()=>{assert.deepEqual(files,allowed);assert.deepEqual(review.inventory.files.map(x=>x.file),allowed);});
let manifest;
check('273 historical migrations intact and 274 registered',()=>{
  manifest=validateManifest();assert.equal(manifest.entries.length,274);
  const previous=JSON.parse(git(['show',base+':supabase/bootstrap/incremental-manifest.json']));
  assert.deepEqual(json('supabase/bootstrap/incremental-manifest.json').entries.slice(0,5),previous.entries);
  assert.equal(validation.migrationSha256,manifest.entries[273].sha256);
  assert.equal(validation.historicalMigrationsSha256,hash(JSON.stringify(manifest.entries.slice(0,273).map(x=>({file:x.file,sha256:x.sha256})))));
});
const versions=new Set(manifest?.entries.map(x=>x.version)??[]);
for(const file of files){
  if(!allowed.includes(file)){findings.push({file,kind:'outside-scope'});continue;}
  const bytes=read(file),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(![auditFile,inventoryFile].includes(file))hashes.push({file,sha256:hash(bytes)});
  if(hasPersonalPath(text))findings.push({file,kind:'personal-path'});
  if(/(?:sb_secret_|sbp_)[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push({file,kind:'private-credential-pattern'});
  if((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)??[]).some(value=>!value.endsWith('.invalid')))findings.push({file,kind:'non-synthetic-email'});
  if(/https?:\/\/[^\s/]+:[^\s/]+@/.test(text))findings.push({file,kind:'url-credential'});
  for(const match of text.matchAll(/["'`](\+?\d[\d .()-]{8,}\d)["'`]/g)){
    const digits=match[1].replace(/\D/g,'');
    if(digits.length>=10&&digits.length<=16&&!versions.has(match[1]))findings.push({file,kind:'unclassified-phone-shaped-literal'});
  }
  if(/[ \t]+$/m.test(text)||/(?:\r?\n){2}$/.test(text)||text.includes('\r'))findings.push({file,kind:'whitespace'});
  if(file.endsWith('.md'))for(const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
    const target=match[1].split('#')[0];if(!target||/^https?:\/\//.test(target))continue;
    if(!existsSync(resolve(root,dirname(file),target)))findings.push({file,kind:'broken-internal-reference'});
  }
  check('diff-check '+file,()=>{const result=spawnSync('git',['diff','--no-index','--check','--','NUL',file],{cwd:root,encoding:'utf8',windowsHide:true});assert([0,1].includes(result.status));assert.equal(result.stdout.trim(),'');});
}
check('inventory hashes',()=>{for(const item of review.inventory.files)if(item.sha256!==null&&!['audit.json','inventory.json'].some(name=>item.file===folder+name))assert.equal(hash(read(item.file)),item.sha256);});
check('complete reconstruction SQL Data API pgTAP and cleanup',()=>{
  assert.equal(validation.complete,true);assert.equal(validation.migrationsApplied,274);assert.equal(validation.finalReconstructionRequired??false,false);
  assert.equal(validation.checks.length,36);assert(validation.checks.every(x=>x.status==='passed'));assert.equal(validation.pgTap.assertions,10);assert.equal(validation.pgTap.passed,true);
  assert.equal(validation.dataApi.publishedPorts,0);assert.equal(validation.dataApiCleanup.remaining,0);
  assert(Object.values(validation.cleanup.remaining).every(x=>x.length===0));
  assert(validation.rpcMeasurements.summaries.sqlMs<8000);assert(validation.rpcMeasurements.selectedDetail.sqlMs<8000);
});
check('frontend tests build lint assets and source hashes',()=>{
  const result=json(folder+'frontend-validation.json');
  assert.equal(result.typescript.exitCode,0);assert.equal(result.build.exitCode,0);assert.equal(result.eslint.errors,0);assert.equal(result.unitTests.passed,11);assert.equal(result.unitTests.failed,0);
  assert.equal(result.bundle.privateSyntheticMarkerFound,false);assert.equal(result.bundle.legacyPreloadRpcAssets,0);
  const browser=json(folder+'browser.json');assert.equal(browser.checks.length,12);assert.equal(browser.after.initial.normalizedMessages,0);assert.equal(browser.after.selection.normalizedMessages,50);assert(browser.after.initial.rpcBytes<browser.before.initial.rpcBytes);assert.equal(browser.after.browserErrors,0);
  for(const evidence of [result,browser])for(const [file,digest]of Object.entries(evidence.sourceHashes))assert.equal(hash(read(file)),digest);
});
check('read-only migration scope',()=>{
  const sql=read('supabase/migrations/20260918194918_optimize_whatsapp_cloud_api_inbox_loading.sql').toString().replace(/--[^\n]*/g,'');
  assert(!/\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate\b|alter\s+table|create\s+table|create\s+trigger|drop\s+table|grant\s+[^;]+\bon\s+table)\b/i.test(sql));
});
check('Git base conflicts and permitted index',()=>{
  assert.equal(git(['branch','--show-current']),'main');assert.equal(git(['rev-parse','HEAD']),base);assert.equal(git(['ls-files','-u']),'');
  const staged=git(['diff','--cached','--name-only']).split('\n').filter(Boolean).sort();if(staged.length)assert.deepEqual(staged,allowed);
  assert.equal(spawnSync('git',['diff','--check'],{cwd:root,windowsHide:true}).status,0);
});
const environment={present:existsSync(join(root,'.env')),ignored:spawnSync('git',['check-ignore','--quiet','--','.env'],{cwd:root,windowsHide:true}).status===0,tracked:!!git(['ls-files','--','.env']),contentRead:false};
if(!environment.present||!environment.ignored||environment.tracked)findings.push({kind:'environment-file'});
const output={passed:findings.length===0,files,hashes,hashExclusions:[auditFile,inventoryFile],environment,findings,productionPersonalRowsPersisted:false,realCredentialValuesReadFromEnvironmentFiles:false,remoteWrites:0};
writeFileSync(join(root,auditFile),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:output.passed,files:files.length,findings}));if(!output.passed)process.exitCode=1;
