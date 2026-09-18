// Read source/report contents only; never load .env or contact a database.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {hash,validateManifest} from '../phase0/bootstrap-manifest.mjs';
import {hasPersonalPath} from './artifact-paths.mjs';

const folder='docs/security/phase-1b4/',reviewPath=folder+'review.json',output=folder+'audit.json';
const read=file=>readFileSync(join(root,file));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const scope=JSON.parse(read(folder+'scope.json')),review=JSON.parse(read(reviewPath)),validation=JSON.parse(read(folder+'validation.json'));
if(!existsSync(join(root,output)))writeFileSync(join(root,output),'{}\n');
const files=[...new Set([...git(['diff','--name-only','HEAD']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean))].sort();
const allowed=[...['README.md','scope.json','review.json','validation.json','audit.json'].map(x=>folder+x),
  ...['internal-privileges-tests.mjs','run-internal-privileges.mjs','audit-internal-privileges.mjs'].map(x=>'scripts/security/'+x),
  'supabase/tests/internal_privileges.test.sql',scope.migration.file,'supabase/bootstrap/incremental-manifest.json'].sort();
const findings=[],hashes=[];
const check=(name,fn)=>{try{fn();}catch{findings.push({name});}};
check('exact scope and inventory',()=>{assert.deepEqual(files,allowed);assert.deepEqual(files,review.inventory.files.map(x=>x.file));});
for(const file of files){
  if(!allowed.includes(file)){findings.push({file,kind:'outside-scope'});continue;}
  const bytes=read(file),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  // The two manifests are scanned too, but excluded from the hash graph.
  if(![output,reviewPath].includes(file))hashes.push({file,sha256:hash(bytes)});
  if(hasPersonalPath(text))findings.push({file,kind:'personal-path'});
  if(/(?:sb_secret_|sbp_)[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push({file,kind:'private-credential-pattern'});
  if((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)??[]).some(x=>!x.endsWith('.invalid')))findings.push({file,kind:'non-synthetic-email'});
  if(/https?:\/\/[^\s/]+:[^\s/]+@/.test(text))findings.push({file,kind:'url-credential'});
  if(text.split('\n').some(x=>/[ \t]+\r?$/.test(x)))findings.push({file,kind:'trailing-whitespace'});
  if(/(?:\r?\n){2}$/.test(text))findings.push({file,kind:'extra-blank-at-eof'});
}
check('raw file hashes',()=>{for(const item of review.inventory.files)if(item.sha256!==null)assert.equal(hash(read(item.file)),item.sha256);});
check('271 historical migrations intact and exactly one new migration',()=>{
  const historical=readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')&&!scope.migration.file.endsWith('/'+x)).sort().map(file=>({file,sha256:hash(read('supabase/migrations/'+file))}));
  assert.equal(historical.length,271);assert.equal(hash(JSON.stringify(historical)),review.historicalMigrations.sha256);
  assert.equal(git(['diff','--name-only',scope.baseCommit,'--','supabase/migrations']),'');
  assert.equal(validateManifest().entries.length,272);assert.equal(hash(read(scope.migration.file)),scope.migration.sha256);assert.equal(validation.migration.sha256,scope.migration.sha256);
});
check('only classified revokes and the approved authentication guard',()=>{
  const functions=['enforce_landing_plan_limit','prevent_landing_name_change','prevent_landing_tag_change','set_atrio_clients_updated_at','set_client_subscriptions_updated_at','set_landings_atrio_clients_owner','set_landings_updated_at','set_promotions_updated_at','cron_process_due_promotions','consume_ai_assistant_quota','get_notification_bot_username','get_home_overview_stats'];
  assert.deepEqual(scope.functions.map(x=>x.name),functions);
  const known=JSON.parse(read('docs/security/phase-1a/evidence.json'));
  const fortyTwo=known.relations.filter(x=>x.kind==='r'&&['anon','authenticated'].every(role=>x.grants.some(g=>g[0]===role&&g[1]==='TRUNCATE'))).map(x=>x.name).sort();
  assert.deepEqual([...scope.truncateTables,...scope.deferredTruncate].sort(),fortyTwo);
  const sql=read(scope.migration.file).toString();
  const old=read('supabase/migrations/20260514183000_home_overview_inferred_leads.sql').toString().replaceAll('\r\n','\n');
  const declaration=old.slice(0,old.indexOf('\n$$;')+4);
  const guard="  if v_auth_uid is null then\n    raise exception 'Authentication required' using errcode = '42501';\n  end if;\n\n";
  assert.equal(sql.slice(sql.indexOf('create or replace function')).trimEnd(),declaration.replace('begin\n','begin\n'+guard));
  const prefix=sql.slice(0,sql.indexOf('create or replace function')).replace(/--[^\n]*/g,'').trim();
  const expected=[...scope.truncateTables.map(x=>`REVOKE TRUNCATE ON TABLE public.${x} FROM PUBLIC, anon, authenticated;`),
    'REVOKE SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.cron_config FROM PUBLIC, anon, authenticated;',
    ...scope.functions.map(x=>`REVOKE ALL ON FUNCTION public.${x.name}(${x.args}) FROM ${x.remove.join(', ')};`)].join(' ');
  assert.equal(prefix.replace(/\s+/g,' '),expected);
});
check('completed directed evidence',()=>{
  assert.equal(validation.complete,true);assert.equal(validation.migrationsApplied,272);assert.equal(validation.reconstructions,1);assert.equal(validation.addedAclRows,0);
  assert.ok([...new Map(validation.checks.map(x=>[x.name,x.status])).values()].every(x=>x==='passed'));
  assert.equal(validation.pgTap.passed,8);assert.equal(validation.pgTap.failed,0);
  assert.equal(validation.cleanup.api.remaining,0);assert.ok(Object.values(validation.cleanup.database.remaining).every(x=>x.length===0));
  for(const {cause} of validation.corrections)assert.ok(validation.corrections.filter(x=>x.cause===cause).length<=2);
});
check('Git base and empty index',()=>{assert.equal(git(['branch','--show-current']),'main');assert.equal(git(['rev-parse','HEAD']),scope.baseCommit);assert.equal(git(['diff','--cached','--name-only']),'');assert.equal(git(['ls-files','-u']),'');});
const env={present:existsSync(join(root,'.env')),ignored:spawnSync('git',['check-ignore','--quiet','--','.env'],{cwd:root,windowsHide:true}).status===0,tracked:!!git(['ls-files','--','.env']),contentRead:false};
if(!env.present||!env.ignored||env.tracked)findings.push({kind:'environment-file'});
const result={phase:'1B.4',passed:findings.length===0,files,hashes,hashExclusions:[output,reviewPath],environmentFile:env,findings,realSecretValuesRead:0,remoteWrites:0};
writeFileSync(join(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,files:files.length,findings}));if(!result.passed)process.exitCode=1;
