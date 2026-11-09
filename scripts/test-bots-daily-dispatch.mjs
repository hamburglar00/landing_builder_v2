import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const ts=require('typescript');
const source=(await readFile(new URL('../supabase/functions/reset-bots-daily/index.ts',import.meta.url),'utf8')).replace(/^import .*\n/,'');
const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
let handler,delivered=[],acks=[],pending=[{advisor_id:'95000000-0000-4000-8000-000000000001',reset_date:'2026-11-09'}],upstream='ok',ackError=false;
const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{value:'synthetic-cron-secret'}})})})}),rpc:async(name,args)=>{
 if(name==='read_bot_daily_resets')return {data:pending};
 if(name==='ack_bot_daily_resets'){acks.push(args.p_items);if(ackError)return {error:Error('ack unavailable')};pending=[];return {error:null}}
 throw Error('unexpected RPC');
}};
new Function('Deno','createClient','fetch','AbortSignal',javascript)({
 env:{get:key=>({SUPABASE_URL:'https://fixture.invalid',SERVICE_ROLE_KEY:'synthetic-service-key',ATRIO_DIRECTORY_ORIGIN:'https://atrio.fixture.invalid',ATRIO_DAILY_RESET_KEY:'synthetic-bridge-key'})[key]},
 serve:value=>{handler=value},
},()=>db,async(url,init)=>{
 assert.equal(String(url),'https://atrio.fixture.invalid/api/gateway/manager-destinations/reset_daily');
 assert.equal(init.headers.Authorization,'Bearer synthetic-bridge-key');
 delivered.push(JSON.parse(init.body));
 if(upstream==='network')throw Error('lost response');
 return Response.json({ok:upstream==='ok'},{status:upstream==='ok'?200:503});
},AbortSignal);
const request=(secret='synthetic-cron-secret')=>new Request('https://fixture.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cron_secret:secret,advisor_id:'untrusted-input-is-ignored'})});
assert.equal((await handler(request('invalid'))).status,401);assert.equal(delivered.length,0);
upstream='network';assert.equal((await handler(request())).status,503);assert.equal(acks.length,0);assert.equal(pending.length,1);
upstream='unavailable';assert.equal((await handler(request())).status,503);assert.equal(acks.length,0);
upstream='ok';ackError=true;assert.equal((await handler(request())).status,503);assert.equal(pending.length,1);
ackError=false;const result=await handler(request());assert.equal(result.status,200);assert.equal((await result.json()).completed,1);assert.equal(pending.length,0);
assert.deepEqual(delivered[0],delivered.at(-1),'retries carry the identical advisor/date idempotency key');
console.log('Daily dispatcher: unauthorized requests, lost response, upstream rejection, failed acknowledgement and identical retry delivery passed.');
