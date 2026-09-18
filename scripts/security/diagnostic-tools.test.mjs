import test from 'node:test';
import assert from 'node:assert/strict';
import {hasPersonalPath} from './artifact-paths.mjs';
import {sanitizeText,safeCommand,safeInspection,safeOutput} from './bootstrap-diagnostic-trace.mjs';

const old=/(?:[A-Z]:[\\/]Users[\\/][^\s"']+|\/Users\/[^\s"']+|\/home\/[^\s"']+)/i;
const unix=(folder,...parts)=>'/'+[folder,'phase1b-synthetic',...parts].join('/');
const win=separator=>'C:'+separator+['Users','phase1b-synthetic','fixture.txt'].join(separator);
test('Both accredited Auth endpoint false positives are reproduced and excluded syntactically',()=>{
  for(const endpoint of ['/admin/users/{id}','admin/users/${ids.approved}']) {assert.ok(old.test(endpoint));assert.equal(hasPersonalPath(endpoint),false);}
});
test('Windows drive paths including JSON-escaped separators remain detected',()=>{
  for(const separator of ['\\','/','\\\\'])assert.ok(hasPersonalPath(win(separator)));
});
test('macOS and Linux absolute home roots remain detected',()=>{
  for(const folder of ['Users','users','home'])for(const prefix of ['', '/', 'path=', 'path:', 'error: ', '"', '`', 'file://'])assert.ok(hasPersonalPath(prefix+unix(folder,'fixture.txt')));
});
test('An API reference never exempts a real path on the same line',()=>{
  assert.ok(hasPersonalPath('/admin/users/{id} '+unix('home','fixture.txt')));
  assert.ok(hasPersonalPath('/admin/users/{id} '+win('\\')));
});
test('Nested API and HTTP URL components are not filesystem home roots',()=>{
  for(const value of ['/admin/users/123','https://example.invalid/admin/users/123','/api/home/fixture','ordinary text'])assert.equal(hasPersonalPath(value),false);
});
test('Ambiguous bare home roots are still flagged conservatively',()=>{
  assert.ok(hasPersonalPath('/'+'users/{id}'));assert.ok(hasPersonalPath('/'+'home/fixture'));
});
test('Diagnostic commands suppress environment and workdir values',()=>{
  const secret='synthetic-'+'credential-canary';
  assert.ok(!JSON.stringify(safeCommand('docker',['exec','-e','PGPASSWORD='+secret,'owned','psql'])).includes(secret));
  assert.ok(!JSON.stringify(safeCommand(win('\\'),['start','--workdir',unix('home','temporary')])).includes('phase1b-synthetic'));
});
test('Diagnostic text suppresses generated credentials and personal paths',()=>{
  const jwt=['eyJ'+'a'.repeat(20),'b'.repeat(20),'c'.repeat(20)].join('.');
  for(const canary of [jwt,'sb_'+'secret_'+'z'.repeat(24),'Bearer '+'private-synthetic-value','postgresql://synthetic:synthetic@localhost/database',win('\\'),unix('Users','temporary')])assert.ok(!sanitizeText(canary).includes(canary));
});
test('Inspect projection excludes environment, command and health output',()=>{
  const canary='synthetic-sensitive-canary';
  const raw=[{Id:'owned',Name:'/supabase_db_phase0b-synthetic',Config:{Image:'synthetic-image',Env:[canary],Cmd:[canary]},State:{Status:'running',Health:{Status:'healthy',Log:[canary]}},HostConfig:{},NetworkSettings:{Networks:{}},Mounts:[]}];
  assert.ok(!JSON.stringify(safeInspection(JSON.stringify(raw))).includes(canary));
});
test('SQL output and contexts are withheld while SQLSTATE and error remain useful',()=>{
  const result=safeOutput('docker',['exec','psql'],{stdout:'sensitive-query-result',stderr:"ERROR: 42501: permission denied for table profiles\nSTATEMENT: secret-query\nCONTEXT: private-context\nDETAIL: private-detail"});
  assert.ok(!JSON.stringify(result).includes('sensitive-query-result'));
  for(const value of ['secret-query','private-context','private-detail'])assert.ok(!JSON.stringify(result).includes(value));
  assert.match(result.stderr,/42501: permission denied for table profiles/);
});
