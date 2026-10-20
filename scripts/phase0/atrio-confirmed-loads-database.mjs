import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localDatabase } from './local-runtime.mjs';

const db=await localDatabase();
const ids=Array.from({length:9},(_,i)=>`${i+1}`.repeat(8)+'-'+`${i+1}`.repeat(4)+'-4'+`${i+1}`.repeat(3)+'-8'+`${i+1}`.repeat(3)+'-'+`${i+1}`.repeat(12));
const [advisor,otherAdvisor,admin,player,otherPlayer,account,conversation,otherAccount,otherConversation]=ids;
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const checks=[];
const call=(id,{source='manual',amount=1000,adv=advisor,conv=conversation,acc=account,payload={}}={})=>
 `select (public.record_pbadmin_confirmed_load(${quote(`api2:${source}:${id}`)},'${adv}','${conv}','${acc}',${quote(source)},${amount},now(),${quote(JSON.stringify(payload))}::jsonb)).id`;
try {
 db.sql(`
 create schema auth;create schema app_private;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.profiles(id uuid primary key,role text,admin_id uuid);
 create function app_private.current_profile_role() returns text language sql stable as $$ select role from public.profiles where id=auth.uid() $$;
 create table public.players(id uuid primary key,advisor_id uuid);
 create table public.player_provider_accounts(id uuid primary key,player_id uuid,provider_external_account_id text);
 create table public.conversations(id uuid primary key,advisor_id uuid,player_id uuid,player_provider_account_id uuid);
 create table public.messages(id uuid primary key,conversation_id uuid,sender text,type text,content text,created_at timestamptz default now());
 create table public.receipt_analyses(id uuid primary key default gen_random_uuid(),advisor_id uuid,player_id uuid,conversation_id uuid,
  message_id uuid unique,detected boolean,amount numeric,currency text,payer_name text,receiver_name text,transaction_id text,coelsa_id text);
 create type public.integration_event_action as enum ('LEAD','PURCHASE','EXTERNAL_REQUEST');
 create type public.integration_event_status as enum ('pending','sent','failed','skipped');
 create table public.integration_event_deliveries(id uuid primary key default gen_random_uuid(),
  action public.integration_event_action,integration_key text,advisor_id uuid,admin_id uuid,player_id uuid,conversation_id uuid,
  status public.integration_event_status,payload jsonb,idempotency_key text unique,attempts integer default 0,
  created_at timestamptz default now(),updated_at timestamptz default now(),sent_at timestamptz,
  response_status integer,response_body text,error text);
 create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
 create trigger set_updated before update on public.integration_event_deliveries for each row execute function public.set_updated_at();
 create publication supabase_realtime;
 grant usage on schema auth,app_private to authenticated,service_role;
 grant select on public.profiles,public.players,public.conversations,public.player_provider_accounts to authenticated,service_role;
 grant all on public.integration_event_deliveries to service_role;
 grant select on public.messages,public.receipt_analyses to service_role;
 insert into public.profiles values ('${advisor}','advisor','${admin}'),('${otherAdvisor}','advisor',null),('${admin}','admin',null);
 insert into public.players values('${player}','${advisor}'),('${otherPlayer}','${otherAdvisor}');
 insert into public.player_provider_accounts values('${account}','${player}','external-1'),('${otherAccount}','${otherPlayer}','external-2');
 insert into public.conversations values('${conversation}','${advisor}','${player}','${account}'),('${otherConversation}','${otherAdvisor}','${otherPlayer}','${otherAccount}');`);
 db.sql(readFileSync(new URL('../../../internal-chat/supabase/migrations/20261016224432_pbadmin_confirmed_loads.sql',import.meta.url),'utf8'));
 db.sql(readFileSync(new URL('../../../internal-chat/supabase/migrations/20261016231845_enrich_atrio_tracking_events.sql',import.meta.url),'utf8'));
 db.sql(readFileSync(new URL('../../../internal-chat/supabase/migrations/20261017183201_manual_receipt_link_atomic.sql',import.meta.url),'utf8'));
 const read=query=>db.sql(query).trim();
 const run=statement=>db.sql('set role service_role;'+statement);
 const results=await Promise.all([db.concurrentSql('set role service_role;'+call(1)),db.concurrentSql('set role service_role;'+call(1))]);
 assert.ok(results.every(r=>r.code===0),JSON.stringify(results));
 assert.equal(read('select count(*) from pbadmin_confirmed_loads'),'1');
 assert.equal(read('select count(*) from integration_event_deliveries'),'1');checks.push('concurrent replay records one load and one PURCHASE');
 assert.throws(()=>run(call(1,{amount:900})),/conflict/);checks.push('immutable amount rejects a conflicting replay');
 assert.throws(()=>run(call(2,{adv:otherAdvisor})),/context mismatch/);
 assert.throws(()=>run(call(2,{acc:otherAccount})),/context mismatch/);checks.push('advisor and provider account cannot cross tenants');
 for(const amount of [0,-1,1000000000,0.00001]) assert.throws(()=>run(call(2,{amount})),/invalid confirmed load/);
 checks.push('invalid or over-precision money is rejected');
 run(call(1,{source:'automatic',amount:500}));
 assert.equal(read('select sum(amount) from pbadmin_confirmed_loads'),'1500.0000');checks.push('manual and automatic IDs are independent');
 db.sql(`create function fail_purchase() returns trigger language plpgsql as $$ begin if current_setting('fixture.fail_outbox',true)='1' then raise exception 'fixture delivery insert failure';end if;return new;end $$;
 create trigger fail_purchase before insert on integration_event_deliveries for each row execute function fail_purchase();`);
 assert.throws(()=>run(`begin;select set_config('fixture.fail_outbox','1',true);${call(3)};commit;`),/fixture delivery insert failure/);
 assert.equal(read("select count(*) from pbadmin_confirmed_loads where operation_key='api2:manual:3'"),'0');
 run(call(3));checks.push('ledger and delivery roll back together then recover on the same operation');
 const roleCount=id=>read(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select count(*) from pbadmin_confirmed_loads;`).split('\n').at(-1);
 assert.equal(roleCount(advisor),'3');assert.equal(roleCount(admin),'3');assert.equal(roleCount(otherAdvisor),'0');checks.push('RLS allows advisor and admin but hides another tenant');
 assert.throws(()=>db.sql('set role anon;select * from pbadmin_confirmed_loads'),/permission denied/);
 assert.throws(()=>db.sql('set role authenticated;'+call(4)),/permission denied/);checks.push('public and advisor clients cannot invent confirmations');
 const payload=JSON.parse(read("select payload::text from integration_event_deliveries where idempotency_key='pbadmin-purchase:api2:manual:1'"));
 assert.equal(payload.atrio_id,advisor);assert.equal(payload.players_id,player);assert.equal(payload.amount,1000);
 assert.equal(payload.emitter_platform,'atrio');assert.equal(payload.confirmation_source,'api2');checks.push('PURCHASE records actual amount and advisor/player identities');
 const claims=await Promise.all(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'].map(token=>
   db.concurrentSql(`set role service_role;select count(*) from public.claim_confirmed_purchase_deliveries('${token}','${advisor}','api2:manual:1',20);`)));
 assert.ok(claims.every(c=>c.code===0));assert.equal(claims.reduce((n,r)=>n+Number(r.stdout.trim().split('\n').at(-1)),0),1);
 checks.push('two delivery workers cannot claim the same event');
 db.sql("update integration_event_deliveries set status='failed',delivery_claim_token=null,delivery_claimed_until=null");
 assert.equal(read('select sum(amount) from pbadmin_confirmed_loads'),'2500.0000');checks.push('tracking failure does not remove real loaded money');
 db.sql(`insert into pbadmin_confirmed_loads(operation_key,advisor_id,admin_id,player_id,conversation_id,player_provider_account_id,source,amount,confirmed_at)
  select 'api2:manual:'||n,'${advisor}','${admin}','${player}','${conversation}','${account}','manual',1000.25,now() from generate_series(10000,11500)n;`);
 assert.equal(Number(read(`set role authenticated;select set_config('request.jwt.claim.sub','${advisor}',false);select amount from get_pbadmin_loaded_totals(array['${player}'::uuid]);`).split('\n').at(-1)),2500+1501*1000.25);
 checks.push('totals include more than 1000 loads without REST row-limit truncation');
 const prepare=(operation,source='manual')=>{
   const key='pbadmin-purchase:api2:'+source+':'+operation;
   const delivery=read(`select id from integration_event_deliveries where idempotency_key=${quote(key)}`);
   const lease='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
   db.sql(`update integration_event_deliveries set delivery_claim_token='${lease}' where id='${delivery}'`);
   return JSON.parse(run(`select prepare_confirmed_purchase_payload('${delivery}','${lease}')`).trim().split('\n').at(-1));
 };
 let receiptIndex=0;
 const receipt=(amount,{file,analyzed=true,detected=true,conv=conversation,adv=advisor,who=player}={})=>{
   const id='eeeeeeee-eeee-4eee-8eee-'+String(++receiptIndex).padStart(12,'0');
   db.sql(`insert into messages values('${id}','${conv}','cliente','imagen',${quote(file??'https://files.test/'+id)},now());`);
   if(analyzed) analyze(id,amount,{detected,conv,adv,who});
   return id;
 };
 const analyze=(id,amount,{detected=true,conv=conversation,adv=advisor,who=player}={})=>db.sql(`insert into receipt_analyses
 (message_id,advisor_id,player_id,conversation_id,detected,amount,currency,payer_name,receiver_name,transaction_id,coelsa_id)
 values('${id}','${adv}','${who}','${conv}',${detected},${amount},'ARS','Nombre del remitente','Nombre del destinatario','BANCO-${id}','COELSA-${id}')`);
 const beforeReceiptOnly=read('select count(*) from pbadmin_confirmed_loads');
 const firstReceipt=receipt(1234.5);
 assert.equal(read('select count(*) from pbadmin_confirmed_loads'),beforeReceiptOnly);checks.push('AI extraction alone never creates a confirmed load');
 run(call(201,{amount:1234.5,payload:{manager_id:1035,agency_id:21,is_valid_receipt:null}}));
 const prepared=prepare(201);assert.equal(prepared.ready,true);
 assert.equal(prepared.payload.full_name,'Nombre del remitente');assert.equal(prepared.payload.is_valid_receipt,true);
 assert.equal(prepared.payload.transaction_id,'BANCO-'+firstReceipt);assert.equal(prepared.payload.coelsa_id,'COELSA-'+firstReceipt);
 assert.equal(prepared.payload.receipt_message_id,firstReceipt);assert.equal(prepared.payload.manager_id,1035);
 assert.equal(prepared.payload.amount,1234.5);assert.equal(prepared.payload.timestamp,Date.parse(prepared.payload.dateTime));
 assert.ok(prepared.payload.pbadmin_transaction_id);assert.equal('bot_phone' in prepared.payload,false);
 checks.push('manual PURCHASE uses the payer and bank IDs from its exact matching AI receipt');
 db.sql(`update receipt_analyses set payer_name='Changed',transaction_id='Changed' where message_id='${firstReceipt}'`);
 assert.deepEqual(prepare(201).payload,prepared.payload);checks.push('retry keeps the complete original payload and timestamps immutable');
 run(call(202,{amount:1234.5}));assert.equal(prepare(202).payload.full_name,null);checks.push('one receipt cannot be attributed to two confirmed loads');
 receipt(2222);receipt(2222);run(call(203,{amount:2222}));assert.equal(prepare(203).payload.receipt_message_id,null);
 checks.push('multiple candidate receipts do not leak an arbitrary name or bank reference');
 const pendingFile='https://files.test/pending';const pendingReceipt=receipt(3333,{file:pendingFile,analyzed:false});
 run(call(204,{source:'automatic',amount:3333,payload:{receipt_file_url:pendingFile}}));
 assert.equal(prepare(204,'automatic').ready,false);
 analyze(pendingReceipt,3333);const afterAi=prepare(204,'automatic');assert.equal(afterAi.ready,true);
 assert.equal(afterAi.payload.receipt_message_id,pendingReceipt);assert.equal(afterAi.payload.is_valid_receipt,true);
 assert.equal('receipt_file_url' in afterAi.payload,false);checks.push('a confirmation arriving before AI waits then enriches the same PURCHASE without exposing file URLs');
 const badFile='https://files.test/not-a-receipt';receipt(4444,{file:badFile,detected:false});
 run(call(205,{source:'automatic',amount:4444,payload:{receipt_file_url:badFile}}));
 const invalid=prepare(205,'automatic').payload;assert.equal(invalid.is_valid_receipt,false);
 assert.equal(invalid.full_name,null);assert.equal(invalid.coelsa_id,null);checks.push('a non-receipt is false without inventing a payer or transaction');
 const trustedFile='https://files.test/trusted';receipt(5555,{file:trustedFile});
 run(call(206,{source:'automatic',amount:5555,payload:{receipt_file_url:trustedFile,transaction_id:'VERIFIED-BANK',coelsa_id:'VERIFIED-COELSA',full_name:'Verified payer',is_valid_receipt:true}}));
 const trusted=prepare(206,'automatic').payload;assert.equal(trusted.transaction_id,'VERIFIED-BANK');assert.equal(trusted.full_name,'Verified payer');
 checks.push('authoritative API2 banking data is preserved over AI extraction');
 const otherFile='https://files.test/other';receipt(6666,{file:otherFile,conv:otherConversation,adv:otherAdvisor,who:otherPlayer});
 run(call(207,{source:'automatic',amount:6666,payload:{receipt_file_url:otherFile}}));assert.equal(prepare(207,'automatic').payload.full_name,null);
 checks.push('receipt enrichment cannot cross conversations or advisors');
 const reviewedFile='https://files.test/reviewed';const reviewed=receipt(7777,{file:reviewedFile});receipt(7777);
 run(call(208,{amount:9000,payload:{receipt_file_url:reviewedFile,receipt_message_id:reviewed}}));
 assert.equal(read("select receipt_message_id from pbadmin_confirmed_loads where operation_key='api2:manual:208'"),reviewed);
 const reviewedPayload=prepare(208).payload;assert.equal(reviewedPayload.receipt_message_id,reviewed);assert.equal(reviewedPayload.transaction_id,'BANCO-'+reviewed);assert.equal(reviewedPayload.amount,9000);
 checks.push('reviewed receipt is linked atomically before PURCHASE can be claimed, even with an edited amount');
 assert.throws(()=>run(call(209,{amount:9000,payload:{receipt_file_url:reviewedFile,receipt_message_id:reviewed}})),/duplicate key|unique/);
 checks.push('the same reviewed message cannot back two distinct confirmed operations');
 assert.throws(()=>db.sql("set role authenticated;select prepare_confirmed_purchase_payload(gen_random_uuid(),gen_random_uuid())"),/permission denied/);
 checks.push('advisor clients cannot prepare or edit server tracking payloads');
 console.log(JSON.stringify({postgresChecks:checks.length,checks,financialProviderCalls:0},null,2));
} finally {db.close();}
