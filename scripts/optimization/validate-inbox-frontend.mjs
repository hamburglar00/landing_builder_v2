// Build outside the repository with synthetic configuration; never load .env files.
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,readdirSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from '../phase0/local-runtime.mjs';
import {hash} from '../phase0/bootstrap-manifest.mjs';
const frontend=join(root,'frontend');
const sources=['frontend/components/whatsapp-cloud-api/WhatsAppCloudApiInboxPageContent.tsx','frontend/lib/whatsappCloudApiDb.ts','frontend/lib/whatsappInboxMessages.ts','frontend/tests/inboxLoading.test.ts'];
const report={syntheticOnly:true,environmentFilesCopied:0,sourceHashes:Object.fromEntries(sources.map(file=>[file,hash(readFileSync(join(root,file)))])),typescript:null,build:null,bundle:null,eslint:null};
const save=()=>writeFileSync(join(root,'docs/optimization/inbox/frontend-validation.json'),JSON.stringify(report,null,2)+'\n');
const node=(args,options={})=>spawnSync(process.execPath,args,{cwd:frontend,encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:16*1024*1024,...options});
let result=node(['--import','tsx','--test','tests/inboxLoading.test.ts','tests/supabaseRealtimeAuth.test.ts']);
report.unitTests={exitCode:result.status,tests:Number(result.stdout.match(/# tests (\d+)/)?.[1]),passed:Number(result.stdout.match(/# pass (\d+)/)?.[1]),failed:Number(result.stdout.match(/# fail (\d+)/)?.[1])};save();
if(result.status!==0){console.log(result.stdout);throw Error('Inbox unit or Realtime regression failed');}
result=node(['node_modules/typescript/bin/tsc','--noEmit','--incremental','false']);
report.typescript={exitCode:result.status};save();
if(result.status!==0){console.log(result.stdout);throw Error('TypeScript failed');}
const directory=mkdtempSync(join(tmpdir(),'inbox-build-'));
cpSync(frontend,directory,{recursive:true,filter:source=>{
  const parts=relative(frontend,source).split(/[\\/]/);
  return !parts.some(p=>['node_modules','.next','.vercel','.git'].includes(p)||p.startsWith('.env')||p.endsWith('.tsbuildinfo'));
}});
symlinkSync(join(frontend,'node_modules'),join(directory,'node_modules'),'junction');
const secret='SYNTHETIC-INBOX-PRIVATE-SECRET-NEVER-PUBLIC';
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:9',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-inbox-public',SUPABASE_URL:'http://127.0.0.1:9',SUPABASE_SERVICE_ROLE_KEY:secret,REVALIDATE_SECRET:secret};
for(const key of Object.keys(env))if(/(?:TOKEN|SECRET|API_KEY|DATABASE_URL|^NEXT_PUBLIC_)/i.test(key)&&!Object.hasOwn({NEXT_PUBLIC_SUPABASE_URL:1,NEXT_PUBLIC_SUPABASE_ANON_KEY:1,SUPABASE_SERVICE_ROLE_KEY:1,REVALIDATE_SECRET:1},key))delete env[key];
result=node([join(frontend,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:directory,env});
report.build={exitCode:result.status,bundler:'webpack',isolatedTemporaryCopy:true,environmentFilesCopied:0};save();
if(result.status!==0){console.log(result.stdout);console.log(result.stderr);throw Error('Build failed');}
const files=[];const visit=path=>{for(const entry of readdirSync(path,{withFileTypes:true})){const child=join(path,entry.name);if(entry.isDirectory())visit(child);else files.push(child);}};
visit(join(directory,'.next/static'));
const assets=files.filter(x=>/\.(?:js|css|map)$/.test(x));
let summaries=0,details=0,legacy=0;
for(const file of assets){const text=readFileSync(file,'utf8');assert(!text.includes(secret));summaries+=Number(text.includes('get_whatsapp_cloud_api_inbox_summaries'));details+=Number(text.includes('get_whatsapp_cloud_api_inbox_messages'));legacy+=Number(text.includes('get_whatsapp_cloud_api_inbox_threads_page'));}
assert(summaries>0&&details>0);assert.equal(legacy,0);
report.bundle={scope:'.next/static browser assets',serverArtifactsExcluded:'.next/server',files:assets.length,privateSyntheticMarkerFound:false,newSummaryRpcAssets:summaries,newDetailRpcAssets:details,legacyPreloadRpcAssets:legacy};save();
result=node(['node_modules/eslint/bin/eslint.js','.','--format','json']);
const lint=JSON.parse(result.stdout||'[]');
report.eslint={exitCode:result.status,errors:lint.reduce((n,r)=>n+r.errorCount,0),warnings:lint.reduce((n,r)=>n+r.warningCount,0),findings:lint.filter(x=>x.messages.length).map(x=>({file:relative(frontend,x.filePath).replaceAll('\\','/'),messages:x.messages.map(m=>({rule:m.ruleId,line:m.line,severity:m.severity,message:m.message}))}))};save();
if(result.status!==0)throw Error('ESLint failed; sanitized findings recorded');
console.log(JSON.stringify({typescript:report.typescript,build:report.build,bundle:report.bundle,eslint:{errors:report.eslint.errors,warnings:report.eslint.warnings},temporaryCopyRetained:true}));
