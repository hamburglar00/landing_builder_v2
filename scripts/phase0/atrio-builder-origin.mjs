import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { localDatabase } from './local-runtime.mjs';
import { localApi } from './local-api.mjs';
import { handlerSchema } from './handler-schema.mjs';
import { handlerRuntime } from './handler-runtime.mjs';
const owner='19000000-0000-4000-8000-000000000001',landing='19000000-0000-4000-8000-000000000002';
const advisor='19817f1f-a0a4-4cd9-a8a9-d9c6733dda41',client='e000376d-b56e-452b-ad17-63f45d41658c',player='801bf600-575e-4348-8d04-98e031af30ae';
const db=await localDatabase();let api,app;const checks=[];
const scalar=q=>db.sql(q).trim().split(/\r?\n/).at(-1);
const attribution={landing_resolution:'automatic',facebook:'Facebook Norte',portofolio:'Portofolio Córdoba',cp:'001234567890123456789',campana:'Campaña Octubre',conjunto:'Conjunto A',anuncio:'Anuncio 1'};
const assertAttribution=()=>{
 const rows=JSON.parse(scalar('select json_agg(json_build_object(\'landing_resolution\',landing_resolution,\'facebook\',facebook,\'portofolio\',portofolio,\'cp\',cp,\'campana\',campana,\'conjunto\',conjunto,\'anuncio\',anuncio)) from conversions'));
 assert.ok(rows.length);for(const row of rows)assert.deepEqual(row,attribution);
};
try {
 handlerSchema(db);
 db.sql('alter table public.gerencias add column nombre text; alter table public.ar_name_inferred_sex add column name_key text, add column inferred_sex text');
 db.sql(`create table public.atrio_clients(id uuid primary key,user_id uuid,atrio_id text,slug text,workspace_currency text);
 insert into public.atrio_clients values('${client}','${owner}','${advisor}','fixture-advisor','ARS');
 insert into auth.users(id) values('${owner}');insert into public.profiles values('${owner}','client','synthetic-client');
 insert into public.landings values('${landing}','synthetic-landing','${owner}','ARS','19000001','SYNTHETIC');
 insert into public.conversions_config(user_id,pixel_id,meta_access_token,send_contact_capi,send_lead_capi,send_purchase_capi,send_first_purchase_capi,send_repeat_purchase_capi,send_geo_capi,geo_use_ipapi,meta_ads_only_capi)
 values('${owner}','19000001','synthetic-meta',true,true,true,true,true,false,false,false);
 grant all on public.atrio_clients to service_role;`);
 api=await localApi(db,'service_role',owner);app=await handlerRuntime(api);
 const base={landing_id:landing,landing_name:'synthetic-landing',phone:'5491112345678',meta_pixel_id:'19000001',pixel_id:'19000001',currency:'ARS',
  promo_code:'SYNTHETIC-ATRIO123456',atrio_id:advisor,atrio_client_id:client,players_id:player,event_source_url:'https://example.invalid/template7'};
 const contact=await app.request('conversions',{...base,...attribution,action:'CONTACT',event_id:'fixture-contact-atrio',source_platform:'landing'});
 assert.equal(contact.status,200,JSON.stringify(contact));
 assert.equal(scalar('select source_platform from conversions'),'landing');assertAttribution();checks.push('Template 7 Contact records Landing acquisition and advertising origin');
 const lead=await app.request('conversions',{...base,action:'LEAD',action_event_id:'fixture-lead-atrio',source_platform:'atrio',emitter_platform:'atrio',
   landing_resolution:'path',facebook:'Later Facebook',portofolio:'Later portfolio',cp:'99999999',
   manager_id:1035,agency_id:21,player_username:'casino-user',email:'client@example.test',timestamp:Date.now(),dateTime:new Date().toISOString()});
 assert.equal(lead.status,200,JSON.stringify(lead));
 assert.equal(scalar('select source_platform from conversions'),'landing');
 assert.equal(scalar('select lead_atrio_id from conversions'),advisor);assert.equal(scalar('select lead_atrio_players_id from conversions'),player);
 assertAttribution();checks.push('Lead preserves original advertising origin despite conflicting later values');
 assert.equal(scalar("select lead_payload_raw::jsonb->>'emitter_platform' from conversions"),'atrio');checks.push('correct advisor/player LEAD attaches to Contact and retains the emitter');
 const registration=await app.request('conversions',{...base,action:'COMPLETEREGISTRATION',action_event_id:'fixture-registration-atrio',
   source_platform:'atrio',emitter_platform:'atrio',player_username:'casino-user',cp:'99999999'});
 assert.equal(registration.status,200,JSON.stringify(registration));
 assert.ok(scalar('select registration_event_id from conversions'));assertAttribution();checks.push('CompleteRegistration inherits the original advertising origin');
 const eventDate=new Date().toISOString();
 const purchase=(id,amount)=>({...base,action:'PURCHASE',action_event_id:`pbadmin-purchase:api2:manual:${id}`,transaction_id:`BANK-${id}`,coelsa_id:`COELSA-${id}`,
   pbadmin_transaction_id:`pbadmin:api2:manual:${id}`,manager_id:1035,agency_id:21,player_username:'casino-user',full_name:'Nombre Remitente',
   email:'client@example.test',is_valid_receipt:true,timestamp:Date.parse(eventDate),dateTime:eventDate,
   amount,source_platform:'atrio',emitter_platform:'atrio',confirmation_source:'api2'});
 const first=await app.request('conversions',purchase(1,1000.25));assert.equal(first.status,200,JSON.stringify(first));
 assert.equal(scalar('select source_platform from conversions'),'landing');assert.equal(scalar('select valor from conversions'),'1000.25');assertAttribution();
 checks.push('first confirmed Purchase updates the original Landing journey');
 assert.equal(scalar('select purchase_player_username from conversions'),'casino-user');
 const stored=JSON.parse(scalar('select purchase_payload_raw from conversions'));
 assert.equal(stored.full_name,'Nombre Remitente');assert.equal(stored.transaction_id,'BANK-1');assert.equal(stored.coelsa_id,'COELSA-1');
 assert.equal(stored.manager_id,1035);assert.equal(stored.agency_id,21);assert.equal(stored.is_valid_receipt,true);
 assert.equal(stored.timestamp,Date.parse(stored.dateTime));assert.equal('bot_phone' in stored,false);
 checks.push('builder accepts and retains the complete receipt and operational payload');
 const metaPurchase=app.sent.flatMap(item=>item.events??[]).find(event=>event.event_name==='Purchase');
 const hash=value=>createHash('sha256').update(value).digest('hex');
 assert.ok(metaPurchase);assert.equal(metaPurchase.user_data.em,hash('client@example.test'));
 assert.equal(metaPurchase.user_data.fn,hash('nombre'));assert.equal(metaPurchase.user_data.ln,hash('remitente'));
 checks.push('builder includes the available email and payer name in hashed Meta user_data');
 const repeat=await app.request('conversions',purchase(2,2000));assert.equal(repeat.status,200,JSON.stringify(repeat));
 assert.equal(scalar('select count(*) from conversions'),'2');assert.equal(scalar("select count(*) from conversions where source_platform='landing'"),'2');
 assert.equal(scalar('select sum(valor) from conversions'),'3000.25');assertAttribution();checks.push('repeat Purchase inherits Landing and advertising origin while preserving its Atrio payload');
 const before=app.sent.length;const replay=await app.request('conversions',purchase(1,1000.25));assert.equal(replay.status,200,JSON.stringify(replay));
 assert.equal(scalar('select count(*) from conversions'),'2');assert.equal(app.sent.length,before);checks.push('replayed confirmed operation does not duplicate CAPI or revenue');
 assert.deepEqual(app.blocked,[]);assert.deepEqual(app.dbErrors,[]);
 console.log(JSON.stringify({builderHttpChecks:checks.length,checks,productionWrites:0,realMetaCalls:0},null,2));
} finally {if(app)await app.close();if(api)api.close();db.close();}
