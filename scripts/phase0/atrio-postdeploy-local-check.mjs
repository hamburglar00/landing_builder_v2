// Repeatable integration regressions. No production credentials or financial calls.
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const {values}=parseArgs({options:{api2:{type:'string'},'with-databases':{type:'boolean',default:false}}});
if(!values.api2) throw Error('Usage: node scripts/phase0/atrio-postdeploy-local-check.mjs --api2 <repository> [--with-databases]');
const root=fileURLToPath(new URL('../../',import.meta.url));
const api2=resolve(values.api2),atrio=resolve(root,'../internal-chat');
await Promise.all([access(resolve(api2,'tests/helpers/atrio_confirmed_load_test_bootstrap.mjs')),access(resolve(atrio,'tests/player-resolve.test.mjs'))]);
const checks=[
  {name:'API2 integration',cwd:api2,args:['--import','./tests/helpers/atrio_confirmed_load_test_bootstrap.mjs','--test',
    'tests/isolated/atrio_player_provision.test.ts','tests/isolated/atrio_full_carga.test.ts',
    'tests/isolated/atrio_automatic_confirmed_load.test.ts','tests/isolated/atrio_adapter_resilience.test.ts','tests/isolated/atrio_integration_latency.test.ts','tests/isolated/rey_financial_confirmation.test.ts']},
  {name:'Atrio contracts and workflows',cwd:atrio,args:['--experimental-strip-types','--test',
    ...['player-resolve','provider-account-link','manager-connection-contract','manager-sync','landing-manager-route',
      'inbox-provider-filter','pbadmin-player-operations','pbadmin-full-carga','confirmed-load-contract','tracking-payload',
      'client-withdrawal-balance','manual-request-actions','client-intent-tagging','manager-connection-read','meta-lead-retries'].map(n=>'tests/'+n+'.test.mjs')]},
];
if(values['with-databases']) checks.push(
  {name:'Manager isolation and concurrent SQL',cwd:root,args:['scripts/phase0/atrio-manager-database-check.mjs']},
  {name:'Builder conversion handler and attribution',cwd:root,args:['scripts/phase0/atrio-builder-origin.mjs']},
);
async function run(check) {
  const child=spawn(process.execPath,check.args,{cwd:check.cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',part=>{output=(output+part).slice(-200000);});
  const code=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',done);});
  const count=Number(output.match(/^# tests (\d+)$/m)?.[1]??output.match(/"builderHttpChecks":\s*(\d+)/)?.[1]??0);
  const result={name:check.name,passed:code===0,checks:count,skipped:Number(output.match(/^# skipped (\d+)$/m)?.[1]??0)};
  if(code!==0) result.details=output.slice(-2000);
  console.log(JSON.stringify(result));return result;
}
const settled=await Promise.allSettled(checks.map(run));
const results=settled.map((r,i)=>r.status==='fulfilled'?r.value:{name:checks[i].name,passed:false,error:String(r.reason)});
const report={at:new Date().toISOString(),productionWrites:0,realProviderCalls:0,results};
await mkdir(resolve(root,'.vercel'),{recursive:true});
await writeFile(resolve(root,'.vercel/atrio-postdeploy-local-latest.json'),JSON.stringify(report,null,2)+'\n');
if(results.some(r=>!r.passed))process.exitCode=1;
