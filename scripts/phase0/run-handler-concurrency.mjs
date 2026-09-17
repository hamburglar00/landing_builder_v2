import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { root,localDatabase,read } from './local-runtime.mjs';
import { localApi } from './local-api.mjs';
import { handlerSchema } from './handler-schema.mjs';
import { handlerRuntime } from './handler-runtime.mjs';
const owner='19000000-0000-0000-0000-000000000001',landing='19000000-0000-0000-0000-000000000002';
const results=[],observations=[];const db=await localDatabase();let api,app;
const scalar=q=>db.sql(q).trim().split(/\r?\n/).at(-1);
const check=async(name,fn)=>{try{await fn();results.push({name,status:'passed'});console.log('PASS '+name);}catch(e){results.push({name,status:'failed',reason:e.message});console.log('FAIL '+name+': '+e.message);}};
const reset=()=>{db.sql('truncate public.conversion_inbox,public.purchase_event_claim_keys,public.purchase_event_claims,public.conversion_logs,public.conversions cascade;');app.sent.length=0;app.dbErrors.length=0;app.setMode('success');};
const post=p=>app.request('conversions',p);
const retry=()=>app.request('retry-failed-conversions',{cron_secret:'synthetic-cron'});
const base=(currency='ARS')=>({landing_id:landing,landing_name:'synthetic-landing',phone:'00000001',email:'buyer@example.invalid',meta_pixel_id:'19000001',pixel_id:'19000001',currency,event_source_url:'https://example.invalid/synthetic',event_time:Math.floor(Date.now()/1000)});
const burst=(fn,n=8)=>Promise.all(Array.from({length:n},(_,i)=>fn(i)));
try{
 handlerSchema(db);
 db.sql(`insert into auth.users(id) values ('${owner}');insert into public.profiles values ('${owner}','client','synthetic-client');
 insert into public.landings values ('${landing}','synthetic-landing','${owner}','ARS','19000001','SYNTHETIC');
 insert into public.conversions_config(user_id,pixel_id,meta_access_token,send_contact_capi,send_lead_capi,send_purchase_capi,send_first_purchase_capi,send_repeat_purchase_capi,send_geo_capi,geo_use_ipapi,meta_ads_only_capi) values ('${owner}','19000001','synthetic-meta',true,true,true,true,true,false,false,false);`);
 api=await localApi(db,'service_role',owner);app=await handlerRuntime(api);
 await check('HTTP validation: invalid action and unauthorized retry cannot send CAPI',async()=>{
  assert.equal((await post({...base(),action:'INVALID'})).status,400);
  assert.equal((await app.request('retry-failed-conversions',{})).status,401);assert.equal(app.sent.length,0);
 });
 for(const currency of ['ARS','PYG']){
  await check(`${currency}: 8 simultaneous Contact requests persist once and send once`,async()=>{
   reset();db.sql(`update public.landings set workspace_currency='${currency}';update public.conversions_config set meta_currency='${currency}'`);
   const responses=await burst(()=>post({...base(currency),action:'CONTACT',event_id:'synthetic-contact',promo_code:'SYNTHETIC-CONTACT'}));
   assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses));
   assert.equal(scalar('select count(*) from public.conversions'),'1');assert.equal(app.sent.length,1);
   assert.equal(scalar('select contact_status_capi from public.conversions'),'enviado');
   assert.equal(app.dbErrors.length,0,JSON.stringify(app.dbErrors));
   assert.equal(scalar("select count(*) from public.conversion_inbox where status in ('received','error')"),'0');
  });
  await check(`${currency}: simultaneous Lead requests characterize duplicate outbound sends on one journey`,async()=>{
   const release=app.barrier(8),releaseReads=app.readBarrier(8);let responses,arrivals,reads;
   try{responses=await burst(()=>post({...base(currency),action:'LEAD',action_event_id:'synthetic-lead',promo_code:'SYNTHETIC-CONTACT'}));}finally{arrivals=release();reads=releaseReads();}
   assert.ok(reads>=8,'all prechecks completed before permitting inbox inserts');
   assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses));
   assert.equal(scalar('select count(*) from public.conversions'),'1');
   const sends=app.sent.filter(s=>s.events.some(e=>e.event_name==='Lead'));
   observations.push({currency,action:'LEAD',scenario:'simultaneous-handler',workers:8,barrierArrivals:arrivals,outboundRequests:sends.length,distinctEventIds:new Set(sends.flatMap(s=>s.events.map(e=>e.event_id))).size,exactlyOnce:sends.length===1});
   assert.equal(sends.length,8,'current handler continues after inbox uniqueness conflict');
   assert.equal(scalar('select lead_status_capi from public.conversions'),'enviado');
   assert.equal(app.dbErrors.length,0,JSON.stringify(app.dbErrors));
  });
  await check(`${currency}: 8 simultaneous Purchase requests elect one claim and send once`,async()=>{
   const responses=await burst(i=>post({...base(currency),action:'PURCHASE',action_event_id:`synthetic-purchase-${i}`,transaction_id:'synthetic-transaction',amount:10000,promo_code:'SYNTHETIC-CONTACT'}));
   assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses));
   assert.equal(scalar("select count(*) from public.conversions where estado='purchase'"),'1');
   assert.equal(app.sent.filter(s=>s.events.some(e=>e.event_name==='Purchase')).length,1);
   assert.equal(scalar('select count(*) from public.purchase_event_claims'),'1');
   assert.equal(scalar("select count(*) from public.purchase_event_claims where status='processing'"),'0');
   assert.equal(app.dbErrors.length,0,JSON.stringify(app.dbErrors));
  });
 }
 await check('Replay of a processed Purchase keeps the same CAPI identity without sending again',async()=>{
  const before=app.sent.length;
  const r=await post({...base('PYG'),action:'PURCHASE',action_event_id:'synthetic-replay',transaction_id:'synthetic-transaction',amount:10000});
  assert.equal(r.status,200);assert.equal(app.sent.length,before);
 });
 // Prepare pending events through the real handler (no hand-written conversion rows).
 const prepareFailure=async(action,currency)=>{
  reset();db.sql(`update public.landings set workspace_currency='${currency}';update public.conversions_config set meta_currency='${currency}'`);
  const payload={...base(currency),promo_code:'SYNTHETIC-RETRY'};
  if(action!=='CONTACT')assert.equal((await post({...payload,action:'CONTACT',event_id:'synthetic-contact-retry'})).status,200);
  app.sent.length=0;app.setMode('failure');
  assert.equal((await post({...payload,action,event_id:'synthetic-contact-retry',action_event_id:'synthetic-action-retry',transaction_id:action==='PURCHASE'?'synthetic-retry-transaction':undefined,amount:action==='PURCHASE'?10000:undefined})).status,200);
  assert.equal(scalar(`select ${action.toLowerCase()}_status_capi from public.conversions`),'error');
  assert.ok(app.sent.length>0,'the handler reached the simulated CAPI service');
  assert.equal(new Set(app.sent.flatMap(s=>s.events.map(e=>e.event_id))).size,1,'inline retries keep identity');
  const identity=app.sent[0].events[0].event_id;
  app.sent.length=0;app.setMode('success');return identity;
 };
 for(const currency of ['ARS','PYG'])for(const action of ['CONTACT','LEAD','PURCHASE']){
  await check(`${currency} ${action}: transient failure then 4 concurrent CAPI retries (current behavior)`,async()=>{
   const identity=await prepareFailure(action,currency);
   const release=app.barrier(4);let responses,arrivals;
   try{responses=await burst(retry,4);}finally{arrivals=release();}
   assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses));
   const sends=app.sent.flatMap(s=>s.events);observations.push({currency,action,scenario:'concurrent-retry',workers:4,barrierArrivals:arrivals,outboundRequests:app.sent.length,distinctEventIds:new Set(sends.map(e=>e.event_id)).size,exactlyOnce:app.sent.length===1});
   // Characterization, not an assertion that duplicate sends are acceptable.
   assert.equal(arrivals,4,'all workers reached CAPI before any response was released');
   assert.equal(app.sent.length,4,'current retry worker has no atomic claim');
   assert.ok(sends.every(e=>e.event_id===identity),'retry identity remains stable despite duplicate delivery');
   assert.equal(scalar(`select ${action.toLowerCase()}_status_capi from public.conversions`),'enviado');
   if(action!=='PURCHASE'){
    const persisted=Number(scalar(`select ${action.toLowerCase()}_capi_retry_count from public.conversions`));
    observations.push({currency,action,scenario:'concurrent-retry-counter',actualRequests:4,persistedRetryCount:persisted});
    assert.equal(persisted,1,'current read/update sequence loses concurrent counter increments');
   }
   const before=app.sent.length;assert.equal((await retry()).status,200);assert.equal(app.sent.length,before,'next worker does not resend completed event');
   assert.equal(scalar("select count(*) from public.conversion_inbox where status in ('received','deferred','error')"),'0');
   assert.equal(app.dbErrors.length,0,JSON.stringify([...new Set(app.dbErrors.map(e=>e.message))]));
  });
 }
 for(const action of ['CONTACT','LEAD'])await check(`${action}: failed retry, five-minute backoff and recovery preserve identity`,async()=>{
  const identity=await prepareFailure(action,'ARS'),field=action.toLowerCase();app.setMode('network-error');
  assert.equal((await retry()).status,200);assert.equal(app.sent.length,1);
  assert.equal(scalar(`select ${field}_capi_retry_count from public.conversions`),'1');
  assert.equal((await retry()).status,200);assert.equal(app.sent.length,1,'backoff blocks immediate retry');
  db.sql(`update public.conversions set ${field}_capi_last_retry_at=now()-interval '6 minutes'`);app.setMode('success');
  assert.equal((await retry()).status,200);assert.equal(app.sent.length,2);
  assert.ok(app.sent.every(s=>s.events.every(e=>e.event_id===identity)));
  assert.equal(scalar(`select ${field}_status_capi from public.conversions`),'enviado');
 });
 await check('Contact: retry budget terminates at six attempts',async()=>{
  await prepareFailure('CONTACT','ARS');app.setMode('failure');
  for(let i=1;i<=6;i++){
   db.sql("update public.conversions set contact_capi_last_retry_at=now()-interval '6 minutes'");
   assert.equal((await retry()).status,200);assert.equal(scalar('select contact_capi_retry_count from public.conversions'),String(i));
  }
  assert.equal(scalar('select contact_capi_retryable from public.conversions'),'f');
  const before=app.sent.length;await retry();assert.equal(app.sent.length,before);
 });
 await check('Purchase: network failure during retry remains pending, recovers with identical event ID and then drains',async()=>{
  const identity=await prepareFailure('PURCHASE','ARS');app.setMode('network-error');
  assert.equal((await retry()).status,200);assert.equal(scalar('select purchase_status_capi from public.conversions'),'error');
  app.setMode('success');assert.equal((await retry()).status,200);
  assert.equal(scalar('select purchase_status_capi from public.conversions'),'enviado');
  assert.ok(app.sent.every(s=>s.events.every(e=>e.event_id===identity)));
  const before=app.sent.length;await retry();assert.equal(app.sent.length,before);
 });
 await check('Deferred Lead: concurrent workers drain an aged local inbox through the real HTTP handler',async()=>{
  reset();const responses=await burst(()=>post({...base(),action:'LEAD',action_event_id:'synthetic-deferred'}));
  assert.ok(responses.every(r=>[200,202].includes(r.status)));
  assert.equal(scalar("select count(*) from public.conversion_inbox where status='deferred'"),'1');
  db.sql("update public.conversion_inbox set created_at=now()-interval '2 hours'");
  const retries=await burst(retry,4);assert.ok(retries.every(r=>r.status===200),JSON.stringify(retries));
  assert.equal(scalar("select count(*) from public.conversion_inbox where status in ('received','deferred')"),'0');
  const rows=Number(scalar('select count(*) from public.conversions'));
  observations.push({scenario:'deferred-lead',workers:4,rows,outboundRequests:app.sent.length,distinctEventIds:new Set(app.sent.flatMap(s=>s.events.map(e=>e.event_id))).size,exactlyOnce:rows===1&&app.sent.length===1});
 });
 await check('No forbidden external IO or unexpected database errors',async()=>{assert.deepEqual(app.blocked,[]);assert.deepEqual(app.dbErrors,[]);});
}finally{
 if(app)await app.close();if(api)api.close();db.close();
 const report={scope:'Entire unchanged HTTP callbacks and local modules; real disposable Postgres/PostgREST, scoped dependency schema; simulated Meta transport; no external service IO',
  sourceHashes:Object.fromEntries(['conversions/index.ts','conversions/shared.ts','conversions/pixel_attribution.ts','conversions/event_attribution.ts','conversions/inbound_tracking.ts','retry-failed-conversions/index.ts'].map(f=>[f,createHash('sha256').update(read('supabase/functions/'+f)).digest('hex')])),
  limitation:'Deno.serve and environment are injected in a Node VM; application TypeScript is transpiled unchanged. Scoped schema is not full RLS/trigger/Edge-isolate parity. Passing characterizations include known delivery defects, not exactly-once guarantees.',
  results,observations,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length};
 writeFileSync(join(root,'docs/optimization/phase-0/handler-concurrency-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
