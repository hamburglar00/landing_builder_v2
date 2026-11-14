import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const modulePath=process.argv.find(v=>v.startsWith('--pglite-module='))?.split('=').slice(1).join('=');
const {PGlite}=await import(modulePath?pathToFileURL(modulePath).href:'@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table conversions(id uuid primary key default gen_random_uuid(),user_id uuid default '11111111-1111-4111-8111-111111111111',
contact_event_id text default '',contact_event_time bigint,contact_payload_raw text default '',
lead_event_id text default '',lead_event_time bigint,lead_payload_raw text default '',purchase_event_id text default '',purchase_event_time bigint,
fbc text default '',ctwa_clid text default '',source_platform text default '',utm_campaign text default '',promo_code text default '',from_meta_ads boolean default false,
lead_status_capi text default '',registration_event_id text default '',registration_status_capi text default '',purchase_type text,estado text default 'contact');
create table conversions_config(id integer,meta_ads_only_capi boolean default false);
create table conversions_pixel_configs(id integer,meta_ads_only_capi boolean default false);
insert into conversions_config values (1,false); insert into conversions_pixel_configs values (1,false);
insert into conversions(id,utm_campaign,from_meta_ads,lead_event_id,lead_event_time) values ('22222222-2222-4222-8222-222222222222','email-campaign',true,'legacy-human',100);
insert into conversions(id,contact_event_id,contact_payload_raw,lead_event_id,lead_event_time) values
 ('55555555-5555-4555-8555-555555555555','old-ad-cta','{"landing_cta_event_version":1,"source_platform":"landing","cta_destination":"atrio","landing_cta_meta_event":"Lead","event_id":"old-ad-cta"}','old-ad-cta',100);
insert into conversions(id,contact_event_id,purchase_event_id,purchase_type,estado) values
 ('66666666-6666-4666-8666-666666666666','old-cta-no-time','old-purchase-no-time','first','purchase');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20261114185220_internal_journey_and_meta_origin_evidence.sql',import.meta.url),'utf8'));
await db.exec(`create trigger trg_set_conversions_from_meta_ads before insert or update on conversions for each row execute function set_conversions_from_meta_ads();`);
const scalar=async sql=>(await db.query(sql)).rows[0];
assert.equal((await scalar(`select internal_events_version from conversions where id='22222222-2222-4222-8222-222222222222'`)).internal_events_version,null,'migration never rewrites history');
await db.exec(`update conversions set lead_status_capi='enviado' where id='22222222-2222-4222-8222-222222222222'`);
assert.equal((await scalar(`select from_meta_ads from conversions where id='22222222-2222-4222-8222-222222222222'`)).from_meta_ads,true,'unrelated status update preserves historical classification');
await db.exec(`update conversions set lead_status_capi='enviado' where id='55555555-5555-4555-8555-555555555555'`);
const historicalCta=await scalar(`select * from conversions where id='55555555-5555-4555-8555-555555555555'`);
assert.equal(historicalCta.internal_events_version,null,'a status update cannot establish historical human-message measurement');
assert.equal(historicalCta.conversation_started_event_id,null,'advertising CTA remains excluded from human messages');
await db.exec(`update conversions set conversation_started_event_id='atrio-conversation:66666666-6666-4666-8666-666666666666',conversation_started_event_time=1794672000 where id='66666666-6666-4666-8666-666666666666'`);
const missingTimes=await scalar(`select * from conversions where id='66666666-6666-4666-8666-666666666666'`);
assert.equal(missingTimes.internal_events_version,1);
assert.equal(missingTimes.cta_clicked_event_id,'old-cta-no-time');
assert.equal(missingTimes.purchase_confirmed_event_id,'old-purchase-no-time','promotion must not erase an evidenced historical purchase');
assert.equal(missingTimes.cta_clicked_event_time,null);
assert.equal(missingTimes.purchase_confirmed_event_time,null,'legacy unknown timestamps stay unknown');
assert.equal(missingTimes.purchase_event_id,'old-purchase-no-time');
assert.equal(missingTimes.purchase_type,'first');
const now=1794672000;
for(const selected of ['Lead','CompleteRegistration']) {
 const id=selected==='Lead'?'33333333-3333-4333-8333-333333333333':'44444444-4444-4444-8444-444444444444';
 const capture={landing_cta_event_version:1,source_platform:'landing',cta_destination:'atrio',landing_cta_meta_event:selected,event_id:`cta-${selected}`};
 await db.query(`insert into conversions(id,contact_event_id,contact_event_time,contact_payload_raw,lead_event_id,lead_event_time,registration_event_id,lead_status_capi,registration_status_capi,estado)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,`cta-${selected}`,now,JSON.stringify(capture),selected==='Lead'?`cta-${selected}`:'',selected==='Lead'?now:null,selected==='CompleteRegistration'?`cta-${selected}`:'',selected==='Lead'?'enviado':'',selected==='CompleteRegistration'?'enviado':'',selected==='Lead'?'lead':'registration']);
 let row=await scalar(`select * from conversions where id='${id}'`);
 assert.equal(row.cta_clicked_event_id,`cta-${selected}`);assert.equal(row.conversation_started_event_id,null,'CTA cannot invent a human message');
 const publicBefore={lead:row.lead_event_id,registration:row.registration_event_id,leadStatus:row.lead_status_capi,registrationStatus:row.registration_status_capi};
 await db.query(`update conversions set conversation_started_event_id=$1,conversation_started_event_time=$2 where id=$3`,[`atrio-conversation:${id}`,now+600,id]);
 row=await scalar(`select * from conversions where id='${id}'`);
 assert.equal(row.conversation_started_event_time,now+600);
 assert.deepEqual({lead:row.lead_event_id,registration:row.registration_event_id,leadStatus:row.lead_status_capi,registrationStatus:row.registration_status_capi},publicBefore,'internal first message cannot alter accepted Meta receipt');
 await db.query(`update conversions set purchase_event_id=$1,purchase_event_time=$2,purchase_type='first',estado='purchase' where id=$3`,[`purchase-${selected}`,now+900,id]);
 row=await scalar(`select * from conversions where id='${id}'`);
 assert.equal(row.purchase_confirmed_event_id,`purchase-${selected}`);assert.equal(row.conversation_started_event_time,now+600);assert.equal(row.purchase_type,'first');
}
const unknown=await db.query(`insert into conversions(utm_campaign,fbc,contact_event_time) values('newsletter','',${now}) returning *`);
assert.equal(unknown.rows[0].from_meta_ads,false);assert.equal(unknown.rows[0].meta_origin_evidence.method,'no_supported_evidence');
const paid=await db.query(`insert into conversions(fbc,contact_event_time) values($1,$2) returning *`,[`fb.1.${now*1000}.testclick`,now]);
assert.equal(paid.rows[0].from_meta_ads,true);assert.deepEqual(paid.rows[0].meta_origin_evidence.parameters,['fbc']);
await db.exec(`insert into conversions_config(id) values(2);insert into conversions_pixel_configs(id) values(2);`);
for(const table of ['conversions_config','conversions_pixel_configs']) assert.deepEqual((await db.query(`select meta_ads_only_capi from ${table} order by id`)).rows.map(x=>x.meta_ads_only_capi),[false,true]);
// Old repeated public IDs cannot make unrelated updates fail under a new global unique constraint.
await db.exec(`insert into conversions(lead_event_id,lead_event_time) values('legacy-human',100);`);
const executions=await db.query(`select has_function_privilege('anon','public.capture_internal_conversion_milestones()','execute') as exposed`);
assert.equal(executions.rows[0].exposed,false);
await db.close();
console.log('PASS: internal milestones vs accepted Meta, late message time, Purchase lineage, no historical replay/rewrite, explicit origin evidence, defaults and restricted functions');
