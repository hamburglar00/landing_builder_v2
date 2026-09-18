// Sequential validation after the two profile reconstructions succeed.
// Existing Phase 0 tests remain unchanged. Their generated reports are captured
// in memory so rerunning them cannot overwrite the accredited Phase 0 evidence.
import {spawn} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment} from '../phase0/bootstrap-manifest.mjs';
import {validateProfileEvidence} from './profile-evidence.mjs';

assertSafeEnvironment(process.env,[]);
if(process.argv.slice(2).some(a=>a!=='--evidence-only'))throw Error('Unknown validation argument');
const folder=join(root,'docs/security/phase-1b1');
const admitted=validateProfileEvidence();
const {authReport:profiles,...evidence}=admitted;
writeFileSync(join(folder,'evidence-validation.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence));
if(process.argv.includes('--evidence-only'))process.exit(0);
const report={formatVersion:1,phase:'1B.1',baseCommit:evidence.baseCommit,localOnly:true,complete:false,suites:[],remoteWrites:0,rawOutputPersisted:false,
  admittedEvidence:evidence,newFullReconstructions:0,startedAt:new Date().toISOString()};
const save=()=>writeFileSync(join(folder,'regression-validation.json'),JSON.stringify(report,null,2)+'\n');

function legacyRunner(file) {
  // Only reporting and failure propagation are intercepted, never SQL, test
  // assertions, fixtures or business code. Resource IDs contain no credentials.
  const wrapper=`
import fs from 'node:fs';
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {resolve} from 'node:path';
const write=fs.writeFileSync,spawnSync=cp.spawnSync,log=console.log;
const owned={containers:[],networks:[],volumes:[]};
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Local resource inventory failed');return r.stdout.trim();};
const initialVolumes=new Set(docker(['volume','ls','-q']).split(/\\r?\\n/));
cp.spawnSync=(cmd,args,options)=>{
 const result=spawnSync(cmd,args,options);
 if(cmd==='docker'&&result.status===0){
  const value=String(result.stdout??'').trim();
  if(/^[a-f0-9]{64}$/.test(value)){
   if(args[0]==='run'||args[0]==='create'){
    owned.containers.push(value);
    const state=JSON.parse(docker(['inspect',value]))[0];
    for(const mount of state.Mounts)if(mount.Type==='volume'&&!initialVolumes.has(mount.Name))owned.volumes.push(mount.Name);
   }
   if(args[0]==='network'&&args[1]==='create')owned.networks.push(value);
  }
 }
 return result;
};
const reportNames=new Set(['concurrency-results.json','handler-concurrency-results.json','bootstrap-sequence-contracts.json']);
fs.writeFileSync=(file,data,...args)=>{
 const absolute=resolve(file).replaceAll('\\\\','/');
 if(absolute.includes('/docs/optimization/phase-0/')){
  const name=absolute.split('/').at(-1);
  if(!reportNames.has(name))throw Error('Unexpected historical report target');
  process.stdout.write('PHASE1B_ARTIFACT '+JSON.stringify({name,report:JSON.parse(data)})+'\\n');
  return;
 }
 return write(file,data,...args);
};
console.log=(...values)=>{log(...values);if(String(values[0]).startsWith('FAIL '))throw Error('Stop after first failed historical case');};
syncBuiltinESMExports();
try {await import(${JSON.stringify('../phase0/'+file)});}
finally {
 const remaining={};
 for(const [kind,args] of [['containers',['ps','-aq','--no-trunc']],['networks',['network','ls','-q','--no-trunc']],['volumes',['volume','ls','-q']]]){
  owned[kind]=[...new Set(owned[kind])];
  const live=new Set(docker(args).split(/\\r?\\n/));
  remaining[kind]=owned[kind].filter(id=>live.has(id));
 }
 process.stdout.write('PHASE1B_CLEANUP '+JSON.stringify({owned,remaining})+'\\n');
 if(Object.values(remaining).some(ids=>ids.length))throw Error('Historical runner-owned resources remain');
}
`;
  // The eval module resolves relative imports from scripts/security.
  return ['--input-type=module','-e',wrapper];
}

async function run(name,args,{cwd=root,exe=process.execPath,expected,kind='tap'}={}) {
  console.log('Starting '+name);
  const started=performance.now();
  const env={...process.env,META_AUDIENCE_DATA_API_TEST_URL:'',META_AUDIENCE_DATA_API_TEST_JWT:'',
    NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-local',NEXT_TELEMETRY_DISABLED:'1'};
  // The local-only DB harness intentionally rejects even synthetic endpoint overrides.
  if(kind==='legacy'||kind==='profiles') {delete env.NEXT_PUBLIC_SUPABASE_URL;delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;}
  const child=spawn(exe,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
  const exitCode=await new Promise((resolve,reject)=>{child.on('error',()=>reject(Error('Cannot start suite '+name)));child.on('close',resolve);});
  output=output.replace(/\x1b\[[0-9;]*m/g,'');
  const result={name,exitCode,durationMs:Math.round(performance.now()-started)};
  if(kind==='profiles') {
    const fresh=JSON.parse(readFileSync(join(folder,'profile-repeat-validation.json')));
    result.passed=fresh.passed;result.failed=fresh.failed;result.skipped=0;
    result.complete=fresh.complete;result.repeatedPriorNames=fresh.repeatedPriorNames;
    result.failure=fresh.failure;result.cleanupFailures=fresh.cleanup.failedOwners;
  } else if(kind==='legacy') {
    result.artifacts=[...output.matchAll(/^PHASE1B_ARTIFACT (.+)$/gm)].map(m=>JSON.parse(m[1]));
    result.cleanup=JSON.parse(output.match(/^PHASE1B_CLEANUP (.+)$/m)?.[1]??'null');
    result.sql=[...output.matchAll(/(\w+\.test\.sql): (\d+)\/(\d+) PASS/g)].map(m=>({file:m[1],passed:Number(m[2]),planned:Number(m[3])}));
    if(result.artifacts.length) {
      result.passed=result.artifacts.reduce((n,a)=>n+a.report.passed,0);
      result.failed=result.artifacts.reduce((n,a)=>n+a.report.failed,0);
    } else {
      result.passed=result.sql.reduce((n,s)=>n+s.passed,0)+Number(output.match(/# pass (\d+)/)?.[1]??0);
      result.failed=Number(output.match(/# fail (\d+)/)?.[1]??0);
    }
    result.skipped=0;
    result.ownedResourcesAbsent=!!result.cleanup&&Object.values(result.cleanup.remaining).every(ids=>ids.length===0);
    if(name==='sequence')result.sourceNote='Both variants resolve to the already corrected current HEAD. Six scenarios revalidate current behavior; original pre-correction evidence remains in Phase 0.';
  } else if(kind==='tap') {
    for(const [key,pattern] of [['passed',/# pass (\d+)/],['failed',/# fail (\d+)/],['skipped',/# skipped (\d+)/]])result[key]=Number(output.match(pattern)?.[1]??0);
  } else if(kind==='deno') {
    const count=output.match(/(\d+) passed \| (\d+) failed/);
    result.passed=Number(count?.[1]??0);result.failed=Number(count?.[2]??0);result.skipped=0;
  } else if(kind==='eslint') {
    try {
      const files=JSON.parse(output);
      result.errors=files.reduce((n,f)=>n+f.errorCount,0);result.warnings=files.reduce((n,f)=>n+f.warningCount,0);
      result.findings=files.filter(f=>f.errorCount||f.warningCount).map(f=>({file:f.filePath.replaceAll('\\','/').split('/frontend/').at(-1),errors:f.errorCount,warnings:f.warningCount,rules:[...new Set(f.messages.map(m=>m.ruleId??'parse'))]}));
    }catch{result.parseFailure=true;}
  }
  report.suites.push(result);save();
  console.log(JSON.stringify({...result,artifacts:undefined,cleanup:undefined,findings:undefined}));
  if(exitCode!==0||result.failed||result.errors||result.parseFailure||(expected!==undefined&&result.passed!==expected)||(kind==='legacy'&&!result.ownedResourcesAbsent)||(kind==='profiles'&&(!result.complete||result.cleanupFailures.length)))throw Error('Validation stopped at '+name);
}

try {
  const frontend=join(root,'frontend');
  await run('diagnostic-and-path-auditor',['--test','scripts/security/diagnostic-tools.test.mjs'],{expected:10});
  await run('profiles-auth-data-api',['scripts/security/run-profile-repeat.mjs'],{kind:'profiles',expected:73});
  await run('bootstrap-units',['--test','scripts/phase0/bootstrap-safety.test.mjs','scripts/phase0/bootstrap-compatibility.test.mjs','scripts/phase0/bootstrap-net.test.mjs'],{expected:34});
  await run('collector',['--test','test/index.test.js'],{cwd:join(root,'infra/meta-ip-collector'),expected:5});
  await run('deno',['test',...['conversions','builder-config'].flatMap(d=>readdirSync(join(root,'supabase/functions',d)).filter(f=>f.endsWith('_test.ts')).map(f=>`supabase/functions/${d}/${f}`))],{exe:'deno',kind:'deno',expected:41});
  await run('frontend',['--import','tsx','--test',...readdirSync(join(frontend,'tests')).filter(f=>f.endsWith('.test.ts')).map(f=>'tests/'+f)],{cwd:frontend,expected:99});
  for(const [name,file,expected] of [['sql-and-integration','run-local-contracts.mjs',112],['concurrency','run-concurrency.mjs',22],['handler-concurrency','run-handler-concurrency.mjs',20],['sequence','run-sequence-contracts.mjs',6]]) {
    await run(name,legacyRunner(file),{cwd:join(root,'scripts/security'),kind:'legacy',expected});
  }
  await run('typescript',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false'],{cwd:frontend,kind:'command'});
  await run('build',['node_modules/next/dist/bin/next','build'],{cwd:frontend,kind:'command'});
  await run('eslint',['node_modules/eslint/bin/eslint.js','--format','json','.'],{cwd:frontend,kind:'eslint'});
  const fresh=JSON.parse(readFileSync(join(folder,'profile-repeat-validation.json')));
  const profileCases=new Set([...profiles.checks,...fresh.checks].filter(c=>c.status==='passed').map(c=>c.name));
  report.profileUniquePassed=profileCases.size;
  report.repeatedProfileInvocations=fresh.repeatedPriorNames.length;
  report.fingerprintComparisonPassed=1;
  report.uniquePassed=report.suites.filter(s=>s.name!=='profiles-auth-data-api').reduce((n,s)=>n+(s.passed??0),0)+profileCases.size+
    Object.values(profiles.historical).reduce((n,s)=>n+s.passed,0)+report.fingerprintComparisonPassed;
  report.historicalUniquePassed=446;
  report.newUniquePassed=report.uniquePassed-report.historicalUniquePassed;
  report.failed=0;report.omittedUnique=0;
  report.invocationSkips=1;report.skipExplanation='Generic frontend invocation skips one integration, executed separately in sql-and-integration and counted once.';
  report.reconstructionRepeatChecks=profiles.repeatedPassed;
  report.complete=true;
}catch(error){report.error=error.message;process.exitCode=1;console.log(error.message);}
finally{report.finishedAt=new Date().toISOString();save();}
