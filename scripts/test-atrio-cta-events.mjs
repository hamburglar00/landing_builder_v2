// Actual Edge handlers + disposable Postgres/PostgREST. Meta is intercepted; no production IO.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {root,localDatabase,read} from './phase0/local-runtime.mjs';
import {localApi} from './phase0/local-api.mjs';
import {handlerSchema} from './phase0/handler-schema.mjs';
import {handlerRuntime} from './phase0/handler-runtime.mjs';
const require=createRequire(join(root,'frontend/package.json'));
const {createClient}=require('@supabase/supabase-js');
const owner='19000000-0000-4000-8000-000000000001',landing='19000000-0000-4000-8000-000000000003';
const advisor='19000000-0000-4000-8000-000000000004',builderClient='19000000-0000-4000-8000-000000000005';
const migrations=['supabase/migrations/20261110021406_atrio_cta_canonical_event_history.sql','supabase/migrations/20261110022534_normalize_atrio_cta_event_history.sql'];
const migrationSql=()=>migrations.map(read).join('\n');
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const db=await localDatabase();let api,app,passed=0;
const scalar=q=>db.sql(q).trim().split(/\r?\n/).filter(x=>!/^INSERT \d+ \d+$/.test(x)).at(-1);
const object=q=>JSON.parse(scalar(`select row_to_json(x) from (${q}) x`));
const capture=(id,event='Lead')=>({source_platform:'landing',cta_destination:'atrio',landing_cta_event_version:1,landing_cta_meta_event:event,event_id:id});
const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{passed++;console.log('PASS '+name);});
try{
 handlerSchema(db);
 db.sql('alter table public.conversion_inbox add column purchase_ingest_job_id uuid;');
 db.sql(`alter table public.landings add column landing_config jsonb;
 insert into auth.users(id) values('${owner}');
 insert into public.profiles values('${owner}','client','synthetic-client');
 insert into public.landings(id,name,user_id,workspace_currency,pixel_id) values('${landing}','synthetic-landing','${owner}','ARS','19000001');
 insert into public.conversions_config(user_id,pixel_id,meta_access_token,meta_api_version,meta_currency,send_contact_capi,send_lead_capi,send_complete_registration_capi,send_purchase_capi,send_first_purchase_capi,send_repeat_purchase_capi,send_geo_capi,geo_use_ipapi,meta_ads_only_capi)
 values('${owner}','19000001','synthetic-meta','v25.0','ARS',true,true,true,true,true,true,false,false,false);`);
 const history=(id,event,status='enviado',extra='')=>scalar(`insert into public.conversions(user_id,currency,estado,source_platform,contact_event_id,contact_event_time,contact_payload_raw,contact_status_capi,observaciones,contact_capi_retryable${extra?',purchase_event_id':''})
 values('${owner}','ARS',${extra?"'purchase'":"'contact'"},'landing',${quote(id)},1700000000,${quote(JSON.stringify(capture(id,event)))},${quote(status)},'CONTACT OK',false${extra?','+quote(extra):''}) returning id`);
 const lead=history('history-lead','Lead'),registration=history('history-reg','CompleteRegistration'),purchase=history('history-purchase','Lead','enviado','already-purchased');
 const omitted=history('history-organic','Lead','skipped_not_meta_ads'),unproven=history('history-unproven','Lead');
 const conflicting=history('history-conflict','Lead','error');
 db.sql(`update public.conversions set lead_event_id='real-message' where id='${conflicting}';`);
 for(const [id,event,eventId] of [[lead,'Lead','history-lead'],[registration,'CompleteRegistration','history-reg'],[purchase,'Lead','history-purchase']]){
  db.sql(`insert into public.conversion_logs(user_id,conversion_id,function_name,level,message,payload_meta,response_meta) values('${owner}','${id}','sendToMetaCAPI','INFO','Meta CAPI respuesta',${quote(JSON.stringify({data:[{event_name:event,event_id:eventId}]}))},'{"events_received":1}')`);
 }
 const whatsapp=scalar(`insert into public.conversions(user_id,currency,estado,source_platform,contact_event_id,contact_payload_raw,contact_status_capi) values('${owner}','ARS','contact','landing','whatsapp','{"cta_destination":"whatsapp"}','enviado') returning id`);
 await check('history repair requires accepted-event evidence, preserves purchases/conflicts and never classifies WhatsApp',()=>{
  db.sql(migrationSql());
  assert.equal(scalar(`select estado||':'||lead_status_capi||':'||contact_status_capi from conversions where id='${lead}'`),'lead:enviado:');
  assert.equal(scalar(`select estado||':'||registration_status_capi from conversions where id='${registration}'`),'registration:enviado');
  assert.equal(scalar(`select estado||':'||purchase_event_id from conversions where id='${purchase}'`),'purchase:already-purchased');
  assert.equal(scalar(`select lead_status_capi from conversions where id='${omitted}'`),'skipped_not_meta_ads');
  assert.equal(scalar(`select estado from conversions where id='${unproven}'`),'contact');
  assert.equal(scalar(`select lead_event_id from conversions where id='${conflicting}'`),'real-message');
  assert.equal(scalar(`select estado||':'||contact_status_capi from conversions where id='${whatsapp}'`),'contact:enviado');
  assert.equal(scalar('select count(*) from private.atrio_cta_event_corrections'),'4');
  assert.equal(scalar("select has_table_privilege('anon','private.atrio_cta_event_corrections','SELECT')"),'f');
  assert.equal(scalar(`select previous_fields->>'estado' from private.atrio_cta_event_corrections where conversion_id='${lead}'`),'contact');
  const before=scalar('select md5(jsonb_agg(to_jsonb(c) order by id)::text) from conversions c');
  db.sql(migrationSql());assert.equal(scalar('select md5(jsonb_agg(to_jsonb(c) order by id)::text) from conversions c'),before);
 });
 db.sql('truncate public.conversion_logs,public.conversions cascade;');
 api=await localApi(db,'service_role',owner);
 const client=createClient(api.url,api.jwt,{auth:{persistSession:false},global:{fetch:(input,init)=>{const u=new URL(typeof input==='string'?input:input.url);assert.equal(u.origin,api.url);u.pathname=u.pathname.replace(/^\/rest\/v1/,'');return fetch(u,init);}}});
 const file=resolve(root,'supabase/functions/conversions/index.ts');
 app=await handlerRuntime(api,{sourceOverrides:new Map([[file,read('supabase/functions/conversions/index.ts')+'\nexport {handleContact};']])});
 const cfg={user_id:owner,pixel_id:'19000001',meta_access_token:'synthetic-meta',meta_api_version:'v25.0',meta_currency:'ARS',send_contact_capi:true,send_lead_capi:true,send_complete_registration_capi:true,send_geo_capi:false,geo_use_ipapi:false,meta_ads_only_capi:false};
 let n=0;
 const invoke=async({template=9,event='Lead',provider='rey_de_ases',config=cfg,meta=true,legacy=false}={})=>{
  const id='synthetic-cta-'+(++n),p={action:'CONTACT',event_id:id,source_platform:'landing',landing_id:landing,landing_name:'synthetic-landing',cta_destination:legacy?'whatsapp':'atrio',cta_meta_event:event,lead_capture_form:true,form_fn:'Synthetic',fn:'Synthetic',target_provider:provider,atrio_id:advisor,atrio_client_id:builderClient,from_meta_ads:meta,event_time:Math.floor(Date.now()/1000),event_source_url:'https://example.invalid/synthetic-landing',meta_pixel_id:'19000001',currency:'ARS'};
  const l={id:landing,name:'synthetic-landing',user_id:owner,workspace_currency:'ARS',pixel_id:'19000001',landing_config:{layout:{template},tracking:{ctaMetaEvent:event}}};
  const r=await app.modules.conversions.handleContact(client,p,l,config,[]);assert.equal(r.status,200,await r.text());
  return {row:object(`select * from conversions where contact_event_id=${quote(id)}`),p,l};
 };
 for(const template of [7,8,9])for(const event of ['Lead','CompleteRegistration'])for(const provider of ['rey_de_ases','ases_del_norte','ganamos_net','ganamos_plus'])await check(`T${template} ${provider}: ${event} storage, CAPI result and duplicate identity`,async()=>{
  const before=app.sent.length,{row,p,l}=await invoke({template,event,provider}),stage=event==='Lead'?'lead':'registration';
  assert.equal(row.estado,stage);assert.equal(row[stage+'_event_id'],p.event_id);assert.equal(row[stage+'_status_capi'],'enviado');
  assert.equal(row.contact_status_capi,'');assert.equal(row.contact_event_id,p.event_id);
  assert.equal(app.sent.length,before+1);assert.equal(app.sent.at(-1).events[0].event_name,event);assert.equal(app.sent.at(-1).events[0].event_id,p.event_id);
  assert.match(row.observaciones,new RegExp(event.toUpperCase()+' OK'));assert.doesNotMatch(row.observaciones,/CONTACT OK/);
  const duplicate=await app.modules.conversions.handleContact(client,p,l,cfg,[]);assert.equal(duplicate.status,200);assert.equal(app.sent.length,before+1);
 });
 for(const event of ['Lead','CompleteRegistration'])await check(event+': organic traffic and disabled switches record the correct omitted milestone',async()=>{
  const before=app.sent.length,stage=event==='Lead'?'lead':'registration';
  const {row}=await invoke({event,meta:false,config:{...cfg,meta_ads_only_capi:true}});
  assert.equal(row[stage+'_status_capi'],'skipped_not_meta_ads');assert.equal(row.contact_status_capi,'');
  const off=await invoke({event,config:{...cfg,send_lead_capi:false,send_complete_registration_capi:false}});
  assert.match(off.row[stage+'_status_capi'],/^skipped_/);assert.equal(app.sent.length,before);
 });
 for(const event of ['Lead','CompleteRegistration'])await check(event+': existing cron recovers a transient failure once, with the same event ID and canonical status',async()=>{
  app.setMode('transient');const {row,p}=await invoke({event}),stage=event==='Lead'?'lead':'registration';
  assert.equal(row[stage+'_status_capi'],'error');assert.equal(row.contact_capi_retryable,true);
  const before=app.sent.length;app.setMode('success');
  const retry=await app.request('retry-failed-conversions',{cron_secret:'synthetic-cron'});assert.equal(retry.status,200,retry.body);
  const current=object(`select * from conversions where id='${row.id}'`);
  assert.equal(current[stage+'_status_capi'],'enviado');assert.equal(current.contact_status_capi,'');assert.equal(current.contact_capi_retryable,false);
  assert.equal(app.sent.length,before+1);assert.equal(app.sent.at(-1).events[0].event_id,p.event_id);assert.equal(app.sent.at(-1).events[0].event_name,event);
  await app.request('retry-failed-conversions',{cron_secret:'synthetic-cron'});assert.equal(app.sent.length,before+1);
 });
 for(const template of [1,2,3,4,5,6])await check(`WhatsApp T${template} preserves Contact storage and delivery`,async()=>{
  const {row}=await invoke({template,legacy:true});assert.equal(row.estado,'contact');assert.equal(row.contact_status_capi,'enviado');assert.equal(app.sent.at(-1).events[0].event_name,'Contact');
 });
 assert.deepEqual(app.blocked,[]);assert.deepEqual(app.dbErrors,[]);
 console.log(JSON.stringify({passed,externalRequests:0,productionWrites:0},null,2));
}finally{await app?.close();await api?.close();db.close();}
