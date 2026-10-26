// Entire Edge entrypoints + real disposable Postgres/PostgREST. Meta is intercepted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {root,localDatabase,read} from './phase0/local-runtime.mjs';
import {localApi} from './phase0/local-api.mjs';
import {handlerSchema} from './phase0/handler-schema.mjs';
import {handlerRuntime} from './phase0/handler-runtime.mjs';
const require=createRequire(join(root,'frontend/package.json'));
const {createClient}=require('@supabase/supabase-js');
const owner='19000000-0000-4000-8000-000000000001',other='19000000-0000-4000-8000-000000000002',landing='19000000-0000-4000-8000-000000000003';
const db=await localDatabase();let api,app;
const scalar=q=>db.sql(q).trim().split(/\r?\n/).filter(line=>!/^INSERT \d+ \d+$/.test(line)).at(-1);
const asOwner=q=>db.sql(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';${q};commit;`);
const denied=q=>assert.throws(()=>asOwner(q));
const columns={Contact:'contact_status_capi',Lead:'lead_status_capi',CompleteRegistration:'registration_status_capi',Purchase:'purchase_status_capi'};
const results=[];
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name);}
try{
 handlerSchema(db);
 db.sql('alter table public.conversions_config drop column capi_workspace_settings;');
 db.sql(read('supabase/migrations/20261026202514_workspace_capi_control.sql'));
 db.sql(`insert into auth.users(id) values('${owner}'),('${other}');insert into public.profiles values('${owner}','client','synthetic-client'),('${other}','client','synthetic-other');
 insert into public.landings values('${landing}','synthetic-landing','${owner}','ARS','19000001','SYNTHETIC');
 insert into public.conversions_config(user_id,pixel_id,meta_access_token,send_contact_capi,send_lead_capi,send_purchase_capi,send_first_purchase_capi,send_repeat_purchase_capi,send_geo_capi,geo_use_ipapi,meta_ads_only_capi) values('${owner}','19000001','synthetic-meta',true,true,true,true,true,false,false,false);
 grant select,insert,update on public.conversions_config to authenticated;grant select on public.profiles to authenticated;`);
 await check('owner can toggle only one workspace; legacy defaults remain enabled',async()=>{
  asOwner(`select public.set_workspace_capi_enabled('${owner}','PYG',false)`);
  assert.equal(scalar(`select capi_workspace_settings::text from public.conversions_config where user_id='${owner}'`),'{"PYG": false}');
  denied(`select public.set_workspace_capi_enabled('${other}','PYG',false)`);
  denied(`select public.set_workspace_capi_enabled('${owner}','USD',false)`);
  assert.equal(scalar(`select count(*) from public.conversions_config where user_id='${other}'`),'0');
  assert.equal(scalar("select has_function_privilege('anon','public.set_workspace_capi_enabled(uuid,text,boolean)','EXECUTE')"),'f');
 });
 await check('concurrent workspace edits preserve both values',async()=>{
  const r=await Promise.all(['ARS','PYG'].map(currency=>db.concurrentSql(`set role authenticated;set request.jwt.claim.sub='${owner}';select public.set_workspace_capi_enabled('${owner}','${currency}',false);`)));
  assert.ok(r.every(x=>x.code===0));
  assert.deepEqual(JSON.parse(scalar(`select capi_workspace_settings from public.conversions_config where user_id='${owner}'`)),{ARS:false,PYG:false});
  asOwner(`select public.set_workspace_capi_enabled('${owner}','ARS',true)`);
 });
 api=await localApi(db,'service_role',owner);
 const file=resolve(root,'supabase/functions/conversions/index.ts');
 app=await handlerRuntime(api,{sourceOverrides:new Map([[file,read('supabase/functions/conversions/index.ts')+'\nexport {sendToMetaCAPI};']])});
 const client=createClient(api.url,api.jwt,{auth:{persistSession:false},global:{fetch:(input,init)=>{const url=new URL(typeof input==='string'?input:input.url);assert.equal(url.origin,api.url);url.pathname=url.pathname.replace(/^\/rest\/v1/,'');return fetch(url,init);}}});
 const cfg={user_id:owner,pixel_id:'19000001',meta_access_token:'synthetic-meta',meta_currency:'ARS',capi_workspace_settings:{PYG:false}};
 await check('all four event types and transport origins stop before Meta and preserve the internal row',async()=>{
  for(const source of ['landing','atrio','chatrace','whatsapp_cloud_api'])for(const event of Object.keys(columns)){
   const id=scalar(`insert into public.conversions(user_id,currency,estado,valor) values('${owner}','PYG','purchase',12345) returning id`);
   await app.modules.conversions.sendToMetaCAPI(client,cfg,[],{id,user_id:owner,currency:'PYG',source_platform:source},id,event,'synthetic-'+event,Math.floor(Date.now()/1000));
   assert.equal(scalar(`select ${columns[event]} from public.conversions where id='${id}'`),'skipped_workspace_capi_disabled');
   assert.equal(scalar(`select valor from public.conversions where id='${id}'`),'12345');
  }
  assert.equal(app.sent.length,0);
 });
 const base=currency=>({landing_id:landing,landing_name:'synthetic-landing',phone:'00000001',email:'buyer@example.invalid',meta_pixel_id:'19000001',pixel_id:'19000001',currency,event_source_url:'https://example.invalid/synthetic',event_time:Math.floor(Date.now()/1000)});
 const reset=()=>{db.sql('truncate public.conversion_inbox,public.purchase_event_claim_keys,public.purchase_event_claims,public.conversion_logs,public.conversions cascade;');app.sent.length=0;app.dbErrors.length=0;};
 for(const currency of ['PYG','ARS'])await check(`${currency}: real Contact/Lead/Purchase requests retain internal conversions and apply the correct workspace`,async()=>{
  reset();db.sql(`update public.landings set workspace_currency='${currency}';`);
  for(const action of ['CONTACT','LEAD','PURCHASE']){
   const r=await app.request('conversions',{...base(currency),action,event_id:'synthetic-contact-'+currency,action_event_id:'synthetic-'+currency+'-'+action,promo_code:'SYNTHETIC-'+currency,...(action==='PURCHASE'?{amount:12345,transaction_id:'synthetic-'+currency}: {})});
   assert.equal(r.status,200,JSON.stringify(r));
  }
  assert.equal(scalar("select count(*) from public.conversions where estado='purchase'"),'1');
  const status=currency==='PYG'?'skipped_workspace_capi_disabled':'enviado';
  assert.equal(scalar('select purchase_status_capi from public.conversions'),status);
  assert.equal(app.sent.length,currency==='PYG'?0:3);
  assert.deepEqual(app.dbErrors,[]);
 });
 await check('cron cannot send pending PYG purchases, Contact or Lead; reenabling does not replay omitted events',async()=>{
  reset();db.sql(`insert into public.conversions(user_id,currency,estado,valor,pixel_id,source_platform,phone,email,fn,ln,ct,st,zip,country,fbp,fbc,client_ip,agent_user,external_id,event_source_url,purchase_event_id,purchase_event_time,purchase_status_capi,contact_event_id,contact_event_time,contact_status_capi,contact_capi_retryable,contact_capi_retry_count,lead_event_id,lead_event_time,lead_status_capi,lead_capi_retryable,lead_capi_retry_count)
  values('${owner}','PYG','purchase',12000,'19000001','landing','000001','buyer@example.invalid','','','','','','','','','','','synthetic','https://example.invalid/','synthetic-purchase',extract(epoch from now()),'error','synthetic-contact',extract(epoch from now()),'error',true,0,'synthetic-lead',extract(epoch from now()),'error',true,0);`);
  const r=await app.request('retry-failed-conversions',{cron_secret:'synthetic-cron'});assert.equal(r.status,200,r.body);assert.equal(app.sent.length,0);
  for(const column of ['contact_status_capi','lead_status_capi','purchase_status_capi'])assert.equal(scalar('select '+column+' from public.conversions'),'skipped_workspace_capi_disabled');
  asOwner(`select public.set_workspace_capi_enabled('${owner}','PYG',true)`);
  assert.equal((await app.request('retry-failed-conversions',{cron_secret:'synthetic-cron'})).status,200);assert.equal(app.sent.length,0);
 });
 console.log(JSON.stringify({passed:results.length,realMetaRequests:0,productionWrites:0}));
}finally{if(app)await app.close();if(api)api.close();db.close();}
