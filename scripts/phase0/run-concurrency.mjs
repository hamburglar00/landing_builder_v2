import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { localDatabase, root, read, delay } from './local-runtime.mjs';
import { localApi } from './local-api.mjs';

const require=createRequire(join(root,'frontend/package.json'));
const ts=require('typescript');
const {createClient}=require('@supabase/supabase-js');
const owner='16000000-0000-0000-0000-000000000001', landing='16000000-0000-0000-0000-000000000002';
const db=await localDatabase(); let api;
const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'passed'});console.log(`PASS ${name}`);}catch(e){results.push({name,status:'failed',reason:e.message});console.log(`FAIL ${name}: ${e.message}`);}}
const value=q=>db.sql(q).trim().split(/\r?\n/).at(-1);
// Start workers behind an advisory lock held by a separate connection. This verifies
// simultaneous contention rather than merely submitting promises in a tight loop.
async function race(makeQuery,n=8){
  const blocker=db.concurrentSql("set application_name='phase0-race-gate'; set statement_timeout='30s'; begin; select pg_advisory_xact_lock(160009); select pg_sleep(25); commit;");
  let ready=false;
  for(let i=0;i<30;i++){if(value("select count(*) from pg_locks where locktype='advisory' and objid=160009 and granted")==='1'){ready=true;break;}await delay(20);}
  assert.ok(ready,'barrier acquired');
  const workers=Array.from({length:n},(_,i)=>db.concurrentSql(`begin; select pg_advisory_xact_lock_shared(160009); ${makeQuery(i)}; commit;`));
  let waiting=0;
  for(let i=0;i<50;i++){
    waiting=Number(value("select count(*) from pg_locks where locktype='advisory' and objid=160009 and not granted"));
    if(waiting===n)break;await delay(50);
  }
  // Cancel only our named gate connection, releasing its transaction lock once
  // every contender has reached it. Cancellation is harness control, not a test failure.
  db.sql("select pg_cancel_backend(pid) from pg_stat_activity where datname=current_database() and application_name='phase0-race-gate'");
  const responses=await Promise.all(workers);await blocker;
  assert.equal(waiting,n,'all concurrent sessions reached the gate before release');
  return responses;
}
const success=responses=>responses.filter(r=>r.code===0);
try {
  db.sql(read('scripts/phase0/local-schema.sql'));
  db.sql(read('scripts/phase0/concurrency-schema.sql'));
  for(const name of ['20260326235900_conversion_inbox.sql','20260427200000_conversions_contact_dedupe_unique_indexes.sql',
    '20260506103000_purchase_coelsa_id_dedupe.sql','20260514120000_purchase_transaction_id_dedupe.sql']) db.sql(read(`supabase/migrations/${name}`));
  db.sql("alter table public.conversion_inbox add column action_event_id text default ''");
  for(const name of ['20260609120000_lead_inbox_dedupe_by_promo.sql','20260609123000_purchase_inbox_dedupe_by_promo_without_strong_ids.sql',
    '20260728163000_purchase_event_atomic_claims.sql']) db.sql(read(`supabase/migrations/${name}`));
  // Exact prefix defines the table, RLS, grants and current counter functions. The
  // remaining DO block patches legacy RPCs outside this fixture's dependency set.
  const scoped=read('supabase/migrations/20260821232500_scoped_phone_assignment_metrics.sql');
  assert.ok(scoped.includes('do $$'));db.sql(scoped.slice(0,scoped.indexOf('do $$')));
  db.sql(read('supabase/migrations/20260905012831_fair_message_assignment_reservations.sql'));
  const wa=read('supabase/migrations/20260810172000_whatsapp_cloud_api_module.sql');
  const a=wa.indexOf('create table if not exists public.whatsapp_cloud_api_webhook_events');
  const b=wa.indexOf('create table if not exists public.whatsapp_cloud_api_contacts');
  assert.ok(a>=0 && b>a);db.sql(wa.slice(a,b));
  const trackingMigration=read('supabase/migrations/20260629190000_constructor_tracking_queue.sql');
  db.sql(trackingMigration.slice(trackingMigration.indexOf('create table if not exists public.tracking_queue'),trackingMigration.indexOf('create table if not exists public.cron_config')));
  db.sql(`insert into auth.users(id) values ('${owner}');
    insert into public.landings values ('${landing}','synthetic-concurrency','${owner}','fair','messages_received');
    insert into public.gerencias values (1,'${owner}',1,'messages_received'),(2,'${owner}',2,'messages_received');
    insert into public.gerencia_phones(id,gerencia_id,phone,kind) values (1,1,'000001','carga'),(2,2,'000002','carga');
    insert into public.landings_gerencias values ('${landing}',1,1,'fair','carga',null,null),('${landing}',2,1,'fair','carga',null,null);`);
  await check('phone reservations: 8 concurrent assignments preserve 8 distinct reservations and balance 4/4',async()=>{
    const r=await race(()=>"select public.get_phone_for_landing('synthetic-concurrency',true)");
    assert.equal(success(r).length,8,r.find(x=>x.code)?.stderr);
    assert.equal(value('select count(distinct id) from public.landing_phone_assignment_reservations'),'8');
    assert.equal(value('select string_agg(n::text,\',\' order by phone_id) from (select phone_id,count(*) n from public.landing_phone_assignment_reservations group by phone_id) s'),'4,4');
  });
  await check('phone warmup: concurrent reads create no additional reservation',async()=>{
    assert.equal(success(await race(()=>"select public.get_phone_for_landing('synthetic-concurrency',false)")).length,8);
    assert.equal(value('select count(*) from public.landing_phone_assignment_reservations'),'8');
  });
  await check('phone confirmation: concurrent extensions preserve one reservation identity',async()=>{
    const id=value('select id from public.landing_phone_assignment_reservations where phone_id=1 limit 1');
    assert.equal(success(await race(()=>`select public.extend_landing_phone_assignment_reservation('${id}','${landing}',1,'000001')`)).length,8);
    assert.equal(value(`select status from public.landing_phone_assignment_reservations where id='${id}'`),'clicked');
  });
  await check('phone counters: no lost increments in global or scope UPSERT',async()=>{
    assert.equal(success(await race(()=>`select public.increment_phone_assignment_scope_usage(1,'landing','${landing}')`,16)).length,16);
    assert.equal(value('select usage_count from public.gerencia_phones where id=1'),'16');
    assert.equal(value('select usage_count from public.phone_assignment_scope_metrics where phone_id=1'),'16');
  });
  for(const field of ['contact_event_id','promo_code']) await check(`Contact simultaneous duplicates: unique ${field}`,async()=>{
    const r=await race(()=>`insert into public.conversions(user_id,estado,${field}) values ('${owner}','contact','synthetic-${field}')`);
    assert.equal(success(r).length,1);assert.ok(r.filter(x=>x.code!==0).every(x=>x.stderr.includes('duplicate key')));
  });
  for(const action of ['LEAD','PURCHASE']) for(const promo of ['', 'synthetic-promo']) await check(`${action} inbox simultaneous duplicates: ${promo?'with':'without'} promo`,async()=>{
    const r=await race(()=>`insert into public.conversion_inbox(user_id,action,action_event_id,promo_code) values ('${owner}','${action}','synthetic-${action}-${promo}','${promo}')`);
    assert.equal(success(r).length,1);assert.ok(r.filter(x=>x.code!==0).every(x=>x.stderr.includes('duplicate key')));
  });
  for(const field of ['purchase_transaction_id','purchase_coelsa_id']) await check(`Purchase simultaneous duplicates: strong ${field}`,async()=>{
    const r=await race(()=>`insert into public.conversions(user_id,estado,${field}) values ('${owner}','purchase','synthetic-${field}')`);
    assert.equal(success(r).length,1);assert.ok(r.filter(x=>x.code!==0).every(x=>x.stderr.includes('duplicate key')));
  });
  let claimId;
  await check('Purchase claims: overlapping keys in reversed order elect one owner without deadlock',async()=>{
    const r=await race(i=>`select row_to_json(c) from public.claim_purchase_event('${owner}',array[${i%2?"'payment:a','action:a'":"'action:a','payment:a'"}],'synthetic-event-${i}') c`);
    assert.equal(success(r).length,8);
    const claims=r.map(x=>JSON.parse(x.stdout.split(/\r?\n/).find(l=>l.startsWith('{'))));
    assert.equal(claims.filter(c=>c.claimed).length,1);assert.equal(new Set(claims.map(c=>c.event_id)).size,1);claimId=claims[0].claim_id;
  });
  await check('Purchase retry after failure: concurrent reclaim elects one worker and retains event ID',async()=>{
    const before=value(`select event_id from public.purchase_event_claims where id='${claimId}'`);
    db.sql(`select public.complete_purchase_event_claim('${claimId}',null,'error')`);
    const r=await race(i=>`select row_to_json(c) from public.claim_purchase_event('${owner}',array['payment:a'],'synthetic-retry-${i}') c`);
    assert.equal(success(r).length,8);
    const claims=r.map(x=>JSON.parse(x.stdout.split(/\r?\n/).find(l=>l.startsWith('{'))));
    assert.equal(claims.filter(c=>c.claimed).length,1);assert.ok(claims.every(c=>c.event_id===before));
  });
  await check('Purchase processed: all concurrent replays rejected',async()=>{
    db.sql(`select public.complete_purchase_event_claim('${claimId}',null,'processed')`);
    const r=await race(()=>`select claimed from public.claim_purchase_event('${owner}',array['action:a'],'synthetic-replay')`);
    assert.equal(success(r).length,8);assert.ok(r.every(x=>x.stdout.split(/\r?\n/).includes('f')));
  });
  db.sql('grant all on public.whatsapp_cloud_api_webhook_events, public.tracking_queue to service_role');
  api=await localApi(db,'service_role',owner);
  const client=createClient(api.url,'synthetic-local',{auth:{persistSession:false,autoRefreshToken:false},global:{
    headers:{Authorization:`Bearer ${api.jwt}`},fetch:(input,init)=>fetch(String(input).replace('/rest/v1/','/'),init)}});
  // Execute the actual worker functions, selected by the TypeScript AST. No business
  // implementation is duplicated and no remote delivery handler is called.
  const source=ts.createSourceFile('worker.ts',read('supabase/functions/whatsapp-cloud-worker/index.ts'),ts.ScriptTarget.Latest,true);
  const names=['claimEvent','requeueStaleProcessingEvents','finalizeEvent'];
  const selected=source.statements.filter(s=>ts.isFunctionDeclaration(s)&&names.includes(s.name?.text)).map(s=>s.getText(source));
  assert.equal(selected.length,3);
  const compiled=ts.transpileModule(selected.join('\n')+'\nexports.api={claimEvent,requeueStaleProcessingEvents,finalizeEvent};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context={exports:{},Date,console};runInNewContext(compiled,context);const worker=context.exports.api;
  const queueId='16000000-0000-0000-0000-000000000003';
  db.sql(`insert into public.whatsapp_cloud_api_webhook_events(id,user_id) values ('${queueId}','${owner}')`);
  await check('WhatsApp queue actual claimEvent: 8 concurrent API workers elect one',async()=>{
    const r=await Promise.all(Array.from({length:8},()=>worker.claimEvent(client,{id:queueId,attempts:0})));
    assert.equal(r.filter(Boolean).length,1);assert.equal(value(`select attempts from public.whatsapp_cloud_api_webhook_events where id='${queueId}'`),'1');
  });
  await check('WhatsApp stale requeue: concurrent sweepers move event once, retry is singly claimed',async()=>{
    db.sql(`update public.whatsapp_cloud_api_webhook_events set processing_started_at=now()-interval '6 minutes' where id='${queueId}'`);
    const r=await Promise.all(Array.from({length:8},()=>worker.requeueStaleProcessingEvents(client)));
    assert.equal(r.reduce((a,b)=>a+b,0),1);
    const claims=await Promise.all(Array.from({length:8},()=>worker.claimEvent(client,{id:queueId,attempts:1})));
    assert.equal(claims.filter(Boolean).length,1);assert.equal(value(`select attempts from public.whatsapp_cloud_api_webhook_events where id='${queueId}'`),'2');
  });
  await check('WhatsApp max attempts: concurrent sweepers fail instead of requeue',async()=>{
    db.sql(`update public.whatsapp_cloud_api_webhook_events set attempts=5,processing_started_at=now()-interval '6 minutes' where id='${queueId}'`);
    await Promise.all(Array.from({length:8},()=>worker.requeueStaleProcessingEvents(client)));
    assert.equal(value(`select status from public.whatsapp_cloud_api_webhook_events where id='${queueId}'`),'failed');
  });
  const trackingSource=ts.transpileModule(read('frontend/lib/tracking/queue.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const trackingContext={exports:{},Date,console,process:{env:{NEXT_PUBLIC_SUPABASE_URL:api.url}},require:(name)=>{
    assert.equal(name,'@/lib/supabase/server');return {getSupabaseServerClient:()=>client};
  }};
  runInNewContext(trackingSource,trackingContext);const tracking=trackingContext.exports;let trackId;
  await check('Tracking queue actual persist: concurrent identical events create one row',async()=>{
    const r=await Promise.all(Array.from({length:8},()=>tracking.persistTrackEvent({postUrl:'https://example.invalid',payload:{event_id:'synthetic-track'}})));
    assert.ok(r.every(x=>x.ok));assert.equal(r.filter(x=>x.isNew).length,1);assert.equal(new Set(r.map(x=>x.id)).size,1);trackId=r[0].id;
  });
  await check('Tracking queue actual claim: concurrent workers return the pending item once',async()=>{
    const r=await Promise.all(Array.from({length:8},()=>tracking.claimPendingTrackEvents(50)));
    assert.equal(r.flat().length,1);assert.equal(r.flat()[0].id,trackId);
  });
  await check('Tracking retries: backoff excludes future work; due work claimed once',async()=>{
    await tracking.scheduleTrackEventRetry({id:trackId,attemptCount:0,reason:'synthetic failure',upstreamStatus:503});
    assert.equal(value(`select attempt_count from public.tracking_queue where id='${trackId}'`),'1');
    assert.equal((await tracking.claimPendingTrackEvents(50)).length,0);
    db.sql(`update public.tracking_queue set next_attempt_at=now()-interval '1 second' where id='${trackId}'`);
    const r=await Promise.all(Array.from({length:8},()=>tracking.claimPendingTrackEvents(50)));
    assert.equal(r.flat().length,1);
  });
  await check('Tracking delivered: concurrent persistence replays retain sent identity',async()=>{
    await tracking.markTrackEventDelivered(trackId);
    const r=await Promise.all(Array.from({length:8},()=>tracking.persistTrackEvent({postUrl:'https://example.invalid',payload:{event_id:'synthetic-track'}})));
    assert.ok(r.every(x=>x.alreadyDelivered&&!x.isNew&&x.id===trackId));
  });
} finally {
  api?.close();db.close();
  const report={scope:'synthetic local dependency schema; production SQL definitions and actual WhatsApp claim/requeue functions',passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,results};
  writeFileSync(join(root,'docs/optimization/phase-0/concurrency-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
