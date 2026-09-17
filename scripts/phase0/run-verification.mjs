// Repeatable suite summary; no raw output, JWTs or absolute machine paths are saved.
import { spawn } from 'node:child_process';
import { readdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { root } from './local-runtime.mjs';
const report=[];
async function run(name,args,cwd=root,exe=process.execPath){
  const start=performance.now();
  const env={...process.env,META_AUDIENCE_DATA_API_TEST_URL:'',META_AUDIENCE_DATA_API_TEST_JWT:'',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-local'};
  const child=spawn(exe,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  const result={name,exitCode:code,durationMs:performance.now()-start};
  if(name==='eslint'){
    try{
      const files=JSON.parse(output);
      result.errors=files.reduce((s,f)=>s+f.errorCount,0);result.warnings=files.reduce((s,f)=>s+f.warningCount,0);
      result.findings=files.filter(f=>f.errorCount||f.warningCount).map(f=>({file:f.filePath.replaceAll('\\','/').split('/frontend/').at(-1),errors:f.errorCount,warnings:f.warningCount,rules:[...new Set(f.messages.map(m=>m.ruleId??'parse'))]}));
    }catch{result.parseFailure=true;}
  }else if(name==='deno'){
    const clean=output.replace(/\x1b\[[0-9;]*m/g,'');const m=clean.match(/(\d+) passed \| (\d+) failed/);
    if(m){result.passed=Number(m[1]);result.failed=Number(m[2]);result.skipped=0;}
  }else if(name==='frontend'||name==='collector'){
    for(const [key,pattern] of [['passed',/# pass (\d+)/],['failed',/# fail (\d+)/],['skipped',/# skipped (\d+)/]])result[key]=Number(output.match(pattern)?.[1]??0);
  }else if(name==='sql-and-integration'){
    result.sql=[...output.matchAll(/(\w+\.test\.sql): (\d+)\/(\d+) PASS/g)].map(m=>({file:m[1],passed:Number(m[2]),planned:Number(m[3])}));
    result.passed=result.sql.reduce((s,x)=>s+x.passed,0)+Number(output.match(/# pass (\d+)/)?.[1]??0);
    result.failed=Number(output.match(/# fail (\d+)/)?.[1]??0);result.skipped=0;
  }else if(name==='concurrency'||name==='handler-concurrency'){
    const m=output.match(/\{"passed":(\d+),"failed":(\d+)\}/);if(m){result.passed=Number(m[1]);result.failed=Number(m[2]);result.skipped=0;}
  }
  report.push(result);console.log(JSON.stringify({...result,findings:undefined}));
  writeFileSync(join(root,'docs/optimization/phase-0/verification-results.json'),JSON.stringify({completed:false,suites:report},null,2)+'\n');
}
const frontend=join(root,'frontend');
const outcomes=await Promise.allSettled([
  run('sql-and-integration',['scripts/phase0/run-local-contracts.mjs']),
  run('concurrency',['scripts/phase0/run-concurrency.mjs']),
  run('handler-concurrency',['scripts/phase0/run-handler-concurrency.mjs']),
  run('frontend',['--import','tsx','--test',...readdirSync(join(frontend,'tests')).filter(f=>f.endsWith('.test.ts')).map(f=>'tests/'+f)],frontend),
  run('deno',['test',...['conversions','builder-config'].flatMap(d=>readdirSync(join(root,'supabase/functions',d)).filter(f=>f.endsWith('_test.ts')).map(f=>`supabase/functions/${d}/${f}`))],root,'deno'),
  run('collector',['--test','test/index.test.js'],join(root,'infra/meta-ip-collector')),
  run('typescript',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false'],frontend),
  run('eslint',['node_modules/eslint/bin/eslint.js','--format','json','.'],frontend),
]);
if(outcomes.some(r=>r.status==='rejected'))throw new Error('Suite process failed to start');
writeFileSync(join(root,'docs/optimization/phase-0/verification-results.json'),JSON.stringify({completed:true,suites:report},null,2)+'\n');
if(report.some(r=>r.exitCode!==0))process.exitCode=1;
