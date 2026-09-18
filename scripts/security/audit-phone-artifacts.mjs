// Local content/integrity audit. Never loads environment files or prints matches.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {hash,validateManifest} from '../phase0/bootstrap-manifest.mjs';
import {hasPersonalPath} from './artifact-paths.mjs';

const folder='docs/security/phase-1b3/',output=folder+'audit.json',reviewPath=folder+'implementation-review.json';
const read=file=>readFileSync(join(root,file));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const base='d7d57637032b02f93639481d8483b1800ad1bac3';
const migration='20260918140931_protect_phone_administration.sql';
const review=JSON.parse(read(reviewPath));
if(!existsSync(join(root,output)))writeFileSync(join(root,output),'{}\n');
const files=[...new Set([...git(['diff','--name-only','HEAD']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean))].sort();
const allowed=new Set([
  'frontend/app/(panel)/admin/tests/page.tsx','frontend/components/telefonos/TelefonosPageContent.tsx',
  'frontend/lib/phones/administrationClient.ts','frontend/tests/phoneAdministrationClient.test.ts',
  'supabase/functions/_shared/phone-administration.ts',
  ...['sync-phones','reset-phone-counters','reset-phone-messages'].map(x=>'supabase/functions/'+x+'/index.ts'),
  'supabase/bootstrap/incremental-manifest.json','supabase/migrations/'+migration,'supabase/tests/phone_administration.test.sql',
  ...['phone-security-tests.mjs','phone-edge-tests.mjs','phone-concurrency-tests.mjs','phone-data-api.mjs','phone-upsert-diagnostic.mjs','run-phone-pending.mjs','run-phone-security.mjs','run-phone-validation.mjs','audit-phone-artifacts.mjs'].map(x=>'scripts/security/'+x),
  ...['README.md','access-model.md','consumers.json','review.json','implementation.md','implementation-review.json','database-validation.json','pending-validation.json','validation.json','audit.json'].map(x=>folder+x),
]);
const findings=[],hashes=[];
for(const file of files) {
  if(!allowed.has(file)){findings.push({file,kind:'scope'});continue;}
  if([output,reviewPath].includes(file))continue;
  const bytes=read(file),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);hashes.push({file,sha256:hash(bytes)});
  if(hasPersonalPath(text))findings.push({file,kind:'personal-path'});
  if(/(?:sb_secret_|sbp_)[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push({file,kind:'credential-pattern'});
  const emails=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)??[];
  if(emails.some(x=>!x.endsWith('.invalid')))findings.push({file,kind:'non-synthetic-email'});
  if(/https?:\/\/[^\s/]+:[^\s/]+@/.test(text))findings.push({file,kind:'url-credential'});
  if(text.split('\n').some(line=>/[ \t]+\r?$/.test(line)))findings.push({file,kind:'trailing-whitespace'});
}
const check=(kind,fn)=>{try{fn();}catch{findings.push({kind});}};
const normalized=s=>s.replaceAll('\r\n','\n');
const old=file=>normalized(git(['show',base+':'+file]));
const current=file=>normalized(read(file).toString()).trimEnd();
check('historical-migrations',()=>{
  const historical=readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')&&x!==migration).sort().map(file=>({file,sha256:hash(read('supabase/migrations/'+file))}));
  assert.equal(historical.length,270);assert.equal(hash(JSON.stringify(historical)),'f4f3c2f2a6ffce00e6d0220ed8943987cab47e90703e2dfaa2cce096b9f8a953');assert.equal(validateManifest().entries.length,271);
});
check('phone-business-algorithms',()=>{
  for(const name of ['sync-phones','reset-phone-counters','reset-phone-messages']){
    const file='supabase/functions/'+name+'/index.ts',a=old(file),b=current(file);
    const boundary=name==='sync-phones'?'    // 1) Obtener gerencias':'    let query = supabaseAdmin';
    assert.ok(a.includes(boundary)&&b.includes(boundary));assert.equal(b.slice(b.indexOf(boundary)),a.slice(a.indexOf(boundary)));
    if(name==='sync-phones'){
      const start='    let isCronMode = false;';
      assert.equal(b.slice(b.indexOf(start),b.indexOf('    if (!isCronMode)')),a.slice(a.indexOf(start),a.indexOf('    if (!isCronMode && !userId)')));
    }
  }
});
check('excluded-frontend-actions',()=>{
  const screen='frontend/components/telefonos/TelefonosPageContent.tsx',boundary='  const handleAutoResetToggle';
  assert.equal(current(screen).slice(current(screen).indexOf(boundary)),old(screen).slice(old(screen).indexOf(boundary)));
  const page='frontend/app/(panel)/admin/tests/page.tsx',a=old(page),b=current(page);
  const strip=s=>s.replace('import { phoneAdministrationHeaders } from "@/lib/phones/administrationClient";\n','').replace(/  const handleTestSync = [\s\S]*?(?=  const handleTestCapi)/,'');
  assert.equal(strip(b),strip(a));
});
check('cron-migration-only-exact-revokes',()=>{
  const sql=read('supabase/migrations/'+migration).toString();
  assert.ok(!/SECURITY\s+DEFINER|CREATE\s+OR\s+REPLACE|cron\.(?:schedule|unschedule)|ALTER\s+(?:FUNCTION|ROLE|SYSTEM)/i.test(sql.replace(/--[^\n]*/g,'')));
  const lines=sql.split(/\r?\n/).filter(x=>/cron_(?:sync_phones_all|reset_phone_operational_daily)/.test(x));
  assert.deepEqual(lines,[
    'REVOKE ALL ON FUNCTION public.cron_sync_phones_all() FROM PUBLIC, anon, authenticated;',
    'REVOKE ALL ON FUNCTION public.cron_reset_phone_operational_daily() FROM PUBLIC, anon, authenticated;',
  ]);
});
check('inventory',()=>assert.deepEqual(files,review.inventory.files.map(x=>x.file).sort()));
check('review-hashes',()=>{for(const item of review.inventory.files)if(item.sha256!==null)assert.equal(hash(read(item.file)),item.sha256);});
check('completed-validation-evidence',()=>{
  const baseline=JSON.parse(read(folder+'database-validation.json'));
  const pending=JSON.parse(read(folder+'pending-validation.json'));
  const validation=JSON.parse(read(folder+'validation.json'));
  assert.equal(pending.baseline.sha256,hash(read(folder+'database-validation.json')));
  assert.equal(baseline.migrations.length,271);assert.ok(baseline.migrations.every(x=>x.status==='passed'));
  assert.deepEqual(pending.provisioning,baseline.migrations.map(({file,sha256})=>({file,sha256})));
  assert.equal(pending.catalogFingerprint,baseline.catalogFingerprint);
  assert.equal(pending.complete,true);assert.equal(pending.instrumentationRemoved,true);
  assert.equal(pending.cleanup.api.remaining,0);
  assert.ok(Object.values(pending.cleanup.database.remaining).every(x=>x.length===0));
  const latest=new Map(pending.checks.map(x=>[x.name,x.status]));
  assert.ok([...latest.values()].every(x=>x==='passed'));
  assert.equal(latest.get('Data API own manual insert and upsert contract'),'passed');
  for(const {cause} of pending.corrections)assert.ok(pending.corrections.filter(x=>x.cause===cause).length<=2);
  assert.equal(validation.complete,true);
  assert.ok(validation.suites.every(x=>x.exitCode===0&&!x.failed&&!x.errors&&!x.parseFailure));
  assert.ok(validation.bundle.files>0);assert.equal(validation.bundle.findings.length,0);
});
check('git-base-index-conflicts',()=>{assert.equal(git(['branch','--show-current']),'main');assert.equal(git(['rev-parse','HEAD']),base);assert.equal(git(['diff','--cached','--name-only']),'');assert.equal(git(['ls-files','-u']),'');});
const env={present:existsSync(join(root,'.env')),ignored:spawnSync('git',['check-ignore','--quiet','--','.env'],{cwd:root,windowsHide:true}).status===0,tracked:!!git(['ls-files','--','.env']),contentRead:false};
if(!env.present||!env.ignored||env.tracked)findings.push({kind:'environment-file'});
const result={phase:'1B.3',passed:findings.length===0,scope:'Source/artifact audit; behavioral validation remains separately reported.',files,hashes,hashExclusions:[output,reviewPath],environmentFile:env,findings,remoteWrites:0,realSecretValuesRead:0};
writeFileSync(join(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,files:files.length,findings}));if(!result.passed)process.exitCode=1;
