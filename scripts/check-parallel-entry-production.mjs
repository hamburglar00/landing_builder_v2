// Read-only HTTP only: no activated tickets, account creation, messages or conversions.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const targets=[['landing-autologuin','https://www.reydeases.fun'],['ases-gateway','https://www.asesdelnorte.online'],['ganamos-gateway','https://www.ganamosnet.icu'],['multi-skin-gateway','https://ganamosnet.global'],['multi-skin-gateway','https://multi-skin-gateway.vercel.app']];
const hash=value=>createHash('sha256').update(value.replaceAll('\r\n','\n')).digest('hex');
const results=[];
for(const[repo,origin]of targets){
 const source=await readFile(path.join(workspace,repo,'public/gateway-client.js'),'utf8');
 const script=await fetch(origin+'/gateway-client.js?v=entry-parallel-2',{signal:AbortSignal.timeout(15000)});
 assert.equal(script.status,200);assert.equal(script.headers.has('set-cookie'),false);
 const deployed=await script.text();assert.equal(hash(deployed),hash(source));assert.ok(deployed.includes('gateway-casino-frame'));
 const entry=await fetch(origin+'/entry',{redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(entry.status,303);assert.equal(new URL(entry.headers.get('location'),origin).pathname,'/');
 const health=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(15000)});assert.equal(health.status,200);
 results.push({repo,origin,scriptMatches:true,scriptSha256:hash(deployed),entryRequiresSession:true,health:health.status});
}
for(const origin of ['https://mkt.panelbotadmin.com','https://landing.panelbotadmin.com']){
 const prefix=origin.includes('mkt.')?'/l/':'/';
 for(const slug of ['diana','goldencjs']){
  const response=await fetch(origin+prefix+slug,{signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200);const html=await response.text();
  const sharedEntryRuntime=/template-entry\/(?:t7|t8)-/.test(html);
  // Goldencjs can use another configured template. Never change its saved UI
  // merely to make it conform to the Diana T7 smoke fixture.
  if(slug==='diana'){
   assert.ok(sharedEntryRuntime,'Diana uses the shared hashed T7 entry runtime');
   const script=html.match(/src="([^\"]*template-entry\/t7-[^\"]+\.js)"/);
   assert.ok(script);const response=await fetch(new URL(script[1],origin));assert.equal(response.status,200);
   const runtime=await response.text();assert.ok(runtime.includes('attempt_started'));assert.ok(runtime.includes('casino_navigation'));
  }
  results.push({origin,path:prefix+slug,status:response.status,sharedEntryRuntime});
 }
 for(const provider of ['ganamos_net','rey_de_ases','bet30']){
  const response=await fetch(origin+'/public-assets/template9/'+provider+'.webp',{signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/webp/);
 }
}
for(const route of ['/api/gateway/chat/prepare','/api/internal/entry-catalog/reconcile']){
 const response=await fetch('https://www.atrio.website'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,401);results.push({route,requiresAuthorization:true});
}
const directory=new URL('../docs/validation/entry-parallel-20261103/',import.meta.url);await mkdir(directory,{recursive:true});
await writeFile(new URL('public-smoke.json',directory),JSON.stringify({at:new Date().toISOString(),activatedTickets:0,createdAccounts:0,financialOperations:0,results},null,2)+'\n');
console.log(JSON.stringify({checks:results.length,allPassed:true,cloudflareIncluded:true,activatedTickets:0,createdAccounts:0,financialOperations:0}));
