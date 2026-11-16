// Real sender/retry handlers, simulated DB and HTTP only. Never calls Meta.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(new URL('./check-meta-receipts.mjs',import.meta.url),'utf8');
const boundary=source.indexOf('const cases = [');assert.ok(boundary>0);
let setup=source.slice(0,boundary)
 .replace("const root = fileURLToPath(new URL('../', import.meta.url));",`const root = ${JSON.stringify(root)};`)
 .replace('return new Response(receipt.raw, { status: receipt.status });',
  "if(receipt.throw)throw Error('Synthetic network failure'); return new Response(receipt.raw, { status: receipt.status, headers: receipt.headers });");
setup+='\nexport { h };';
const {h}=await import('data:text/javascript;base64,'+Buffer.from(setup).toString('base64'));
let checks=0;
const accepted={status:201,raw:'{"events_received":1,"messages":[],"fbtrace_id":"synthetic"}',headers:{'facebook-api-version':'v27.0'}};
const cases=[['201 accepted',[accepted],201,1,true],['202 accepted',[{...accepted,status:202}],202,1,true],
 ['429 then accepted',[{status:429,raw:'{"error":{"code":4}}'},accepted],201,2,true],
 ['network errors',Array(3).fill({throw:true}),null,3,false],
 ['ambiguous then accepted',[{status:200,raw:'{}'},accepted],201,2,true]];
for(const event of ['Contact','Lead','CompleteRegistration','Purchase'])for(const [label,responses,status,attempt,ok] of cases){
 const state=h.fixture('rey_de_ases'),row=state.tables.conversions[0];h.activate(state);
 state.responses=[...responses];
 const cfg={...h.config,meta_ads_only_capi:false,send_contact_capi:true,send_lead_capi:true,send_complete_registration_capi:true};
 const eventId='transport-'+event;
 const result=await h.api.sendToMetaCAPI(state.db,cfg,[],row,row.id,event,eventId,h.now-60,event==='Purchase'?{value:1000,currency:'ARS'}:undefined);
 assert.equal(result,ok,`${event}/${label}`);
 const logs=state.tables.conversion_logs.filter(l=>l.function_name==='sendToMetaCAPI'&&l.meta_attempt);
 const final=logs.findLast(l=>l.message===(ok?'Meta CAPI respuesta':'Meta CAPI fallo'));
 assert.ok(final,`${event}/${label}: result log exists`);
 assert.equal(final.meta_http_status,status);assert.equal(final.meta_attempt,attempt);
 assert.equal(final.meta_api_version,ok?'v27.0':'v26.0');
 if(ok){assert.match(final.detail,new RegExp('HTTP '+status));assert.equal(final.response_meta,accepted.raw);}
 assert.deepEqual([...new Set(logs.map(l=>l.meta_attempt))],Array.from({length:attempt},(_,i)=>i+1));
 for(const log of logs)assert.ok(!JSON.stringify({version:log.meta_api_version,status:log.meta_http_status,attempt:log.meta_attempt}).includes('fixture-not-a-token'));
 for(const sent of state.sent){assert.equal(sent.payload.data[0].event_id,eventId);assert.equal(sent.payload.data[0].event_time,h.now-60);}
 checks++;
}
for(const event of ['Contact','Lead'])for(const response of [accepted,{status:400,raw:'{"error":{"code":190}}'},{throw:true}]){
 const state=h.fixture('rey_de_ases'),row=state.tables.conversions[0];h.activate(state);
 const stage=event.toLowerCase();
 Object.assign(row,{[`${stage}_event_id`]:'cron-'+event,[`${stage}_event_time`]:h.now-60,[`${stage}_status_capi`]:'error',[`${stage}_capi_retryable`]:true,[`${stage}_capi_retry_count`]:2});
 state.response=response;
 const cfg={...h.config,meta_ads_only_capi:false,send_contact_capi:true,send_lead_capi:true};
 const stats=Object.fromEntries(['contact','lead'].flatMap(k=>['Retried','Succeeded','Failed','Skipped'].map(v=>[k+v,0])));
 await h.retry(state.db,row,event,new Map([[h.owner,cfg]]),new Map(),new Map(),new Map(),stats);
 const log=state.tables.conversion_logs.findLast(l=>l.function_name==='retry-failed-conversions');assert.ok(log);
 assert.equal(log.meta_attempt,1,'A new cron invocation starts at HTTP attempt 1, independently of retry_count');
 assert.equal(log.meta_http_status,response.throw?null:response.status);
 assert.equal(log.meta_api_version,response===accepted?'v27.0':'v26.0');checks++;
}
for(const response of [accepted,{status:503,raw:'{"error":{"code":2}}'},{throw:true}]){
 const state=h.fixture('rey_de_ases'),row=state.tables.conversions[0];h.activate(state);state.response=response;
 Object.assign(row,{estado:'purchase',purchase_status_capi:'error',purchase_type:'first',purchase_event_id:'cron-purchase',purchase_event_time:h.now-60,valor:1000});
 const req=new Request('https://database.example.invalid/functions/v1/retry-failed-conversions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cron_secret:'synthetic-cron'})});
 assert.equal((await h.handlers['retry-failed-conversions'](req)).status,200);
 const log=state.tables.conversion_logs.findLast(l=>l.message.startsWith('Meta CAPI retry Purchase'));assert.ok(log);
 assert.equal(log.meta_attempt,1);assert.equal(log.meta_http_status,response.throw?null:response.status);
 assert.equal(log.meta_api_version,response===accepted?'v27.0':'v26.0');checks++;
}
console.log(JSON.stringify({status:'passed',senderAndRetryMetadataScenarios:checks,realNetworkRequests:0}));
