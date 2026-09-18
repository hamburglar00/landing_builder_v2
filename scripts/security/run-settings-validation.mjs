// Local validation only. No dotenv loading, target overrides, retries or prior-report writes.
import {spawn} from 'node:child_process';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,copyFileSync,symlinkSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment} from '../phase0/bootstrap-manifest.mjs';

assertSafeEnvironment();
const folder=join(root,'docs/security/phase-1b2');
const report={phase:'1B.2',complete:false,localOnly:true,rawOutputPersisted:false,remoteWrites:0,productionRequests:0,suites:[],startedAt:new Date().toISOString()};
const save=()=>writeFileSync(join(folder,'implementation-validation.json'),JSON.stringify(report,null,2)+'\n');
const baseEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|pathext|comspec|userprofile|homedrive|homepath|appdata|localappdata|programfiles(?:\(x86\))?|number_of_processors|processor_architecture)$/i.test(key)));
Object.assign(baseEnv,{DO_NOT_TRACK:'1',NEXT_TELEMETRY_DISABLED:'1'});
const syntheticEnv={...baseEnv,NODE_ENV:'test',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',
  SUPABASE_SERVICE_ROLE_KEY:'phase1b2-local-service-canary-0000000000000000',REVALIDATION_ENV:'local',REVALIDATION_LOCAL_SYNTHETIC:'1'};

async function run(name,args,{cwd=root,env=baseEnv,kind='command'}={}) {
  console.log('Starting '+name);
  const started=Date.now();
  const child=spawn(process.execPath,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',chunk=>{
    const value=chunk.toString();output+=value;
    if(kind==='database')for(const line of value.split(/\r?\n/))if(/^Reconstruction \d+\/\d+$/.test(line))console.log(line);
  });
  child.stderr.on('data',chunk=>{output+=chunk;});
  const exitCode=await new Promise((resolve,reject)=>{child.on('error',()=>reject(Error('Could not start '+name)));child.on('close',resolve);});
  const result={name,exitCode,durationMs:Date.now()-started};
  output=output.replace(/\x1b\[[0-9;]*m/g,'');
  if(kind==='tap') {
    result.passed=Number(output.match(/# pass (\d+)/)?.[1]??0);
    result.failed=Number(output.match(/# fail (\d+)/)?.[1]??0);
    result.skipped=Number(output.match(/# skipped (\d+)/)?.[1]??0);
    result.failedCases=[...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(m=>m[1]);
  }
  if(kind==='database') {
    const data=JSON.parse(readFileSync(join(folder,'implementation-database-validation.json')));
    result.complete=data.complete;result.passed=data.passed;result.failed=data.failed;result.migrations=data.migrations.length;result.failure=data.failure??null;
  }
  if(kind==='typescript'&&exitCode!==0) result.diagnostics=[...output.matchAll(/(?:^|\n)([^\r\n]+?)\((\d+),(\d+)\): error (TS\d+):/g)].map(m=>({file:m[1].replaceAll('\\','/'),line:Number(m[2]),column:Number(m[3]),code:m[4]}));
  if(kind==='eslint') {
    try {
      const files=JSON.parse(output);result.errors=files.reduce((n,f)=>n+f.errorCount,0);result.warnings=files.reduce((n,f)=>n+f.warningCount,0);
      result.findings=files.filter(f=>f.errorCount||f.warningCount).map(f=>({file:f.filePath.replaceAll('\\','/').split('/frontend/').at(-1),errors:f.errorCount,warnings:f.warningCount,rules:[...new Set(f.messages.map(m=>m.ruleId))]}));
    }catch{result.parseFailure=true;}
  }
  report.suites.push(result);save();console.log(JSON.stringify(result));
  if(exitCode!==0||result.failed||result.errors||result.parseFailure||(kind==='database'&&!result.complete))throw Error('Validation stopped at '+name);
}

try {
  await run('reconstruction-settings-profiles-data-api',['scripts/security/run-settings-security.mjs'],{kind:'database'});
  const frontend=join(root,'frontend');
  await run('revalidation-security-and-client',['--import','tsx','--import','./tests/revalidation-server-loader.mjs','--test','--test-concurrency=1','tests/revalidationSecurity.test.ts','tests/revalidationClient.test.ts'],{cwd:frontend,env:syntheticEnv,kind:'tap'});
  await run('historical-bootstrap-safety',['--test','scripts/phase0/bootstrap-safety.test.mjs','scripts/phase0/bootstrap-compatibility.test.mjs','scripts/phase0/bootstrap-net.test.mjs'],{kind:'tap'});
  await run('historical-landing-contracts',['--import','tsx','--test','--test-concurrency=1',...['phase0LandingContracts','landingTemplateVariants','publicLandingHtml'].map(n=>'tests/'+n+'.test.ts')],{cwd:frontend,env:syntheticEnv,kind:'tap'});

  // Compile a fresh frontend copy, excluding all environment files and local deployment metadata.
  const build=mkdtempSync(join(tmpdir(),'phase1b2-build-'));
  report.buildCopy={directory:basename(build),outsideRepository:true,environmentFilesCopied:0,retained:true};save();
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
  const files=[...new Set([...git(['ls-files','frontend']),...git(['ls-files','--others','--exclude-standard','frontend'])])];
  for(const file of files) {
    const relative=file.slice('frontend/'.length);
    if(relative.split('/').some(part=>part.startsWith('.env')||['.vercel','.next','node_modules'].includes(part)))continue;
    const target=join(build,relative);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,file),target);
  }
  symlinkSync(join(frontend,'node_modules'),join(build,'node_modules'),process.platform==='win32'?'junction':'dir');
  writeFileSync(join(build,'next-env.d.ts'),'/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
  await run('typescript',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false'],{cwd:build,env:syntheticEnv,kind:'typescript'});
  await run('build',['node_modules/next/dist/bin/next','build','--webpack'],{cwd:build,env:{...syntheticEnv,NODE_ENV:'production'},kind:'build'});
  const chunks=[];
  const scan=dir=>{for(const item of readdirSync(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())scan(file);else if(/\.(js|map|html|json)$/.test(item.name))chunks.push(file);}};
  if(!existsSync(join(build,'.next/static')))throw Error('Browser bundle missing');
  scan(join(build,'.next/static'));
  const forbidden=['revalidate_secret','SUPABASE_SERVICE_ROLE_KEY','phase1b2-local-service-canary-0000000000000000','phase1b2-local-only-synthetic-0000000000000000'];
  const findings=chunks.filter(file=>forbidden.some(value=>readFileSync(file,'utf8').includes(value))).map(file=>file.slice(build.length+1).replaceAll('\\','/'));
  report.bundle={files:chunks.length,findings,secretValuesUsed:'synthetic only',browserContainsSecretTransport:findings.length>0};save();
  if(findings.length)throw Error('Browser bundle audit failed');
  await run('eslint',['node_modules/eslint/bin/eslint.js','--format','json','.'],{cwd:frontend,env:syntheticEnv,kind:'eslint'});
  report.complete=true;
} catch(error) {
  report.failure=error.message;process.exitCode=1;
} finally {
  report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({complete:report.complete,suites:report.suites.length,failure:report.failure??null}));
}
