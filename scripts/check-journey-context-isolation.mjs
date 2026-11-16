// Execute the real handlers. Database and HTTP are simulated; no real events.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(new URL('./check-meta-receipts.mjs',import.meta.url),'utf8');
const boundary=source.indexOf('const cases = [');assert.ok(boundary>0);
let setup=source.slice(0,boundary)
 .replace("const root = fileURLToPath(new URL('../', import.meta.url));",`const root = ${JSON.stringify(root)};`)
 .replace('exports.fixtureApi={sendToMetaCAPI,','exports.fixtureApi={handleLead,sendToMetaCAPI,');
setup+='\nexport {h};';
const {h}=await import('data:text/javascript;base64,'+Buffer.from(setup).toString('base64'));
const aCode='CAMPA-0123456789ab',bCode='CAMPB-abcdef123456';
function fixture(){
 const s=h.fixture('rey_de_ases');h.activate(s);
 s.tables.gerencias.push({id:1,user_id:h.owner,gerencia_id:147,workspace_currency:'ARS',source_type:'pbadmin'});
 const a=s.tables.conversions[0];
 Object.assign(a,{atrio_id:'',promo_code:aCode,estado:'lead',lead_event_id:'lead-A',lead_event_time:h.now-500,
  lead_agency_id:'147',assigned_gerencia_id:1,lead_gerencia_id:1,telefono_asignado:'00000002',lead_bot_phone:'00000002',
  fbc:`fb.1.${(h.now-1200)*1000}.CampaignA`,fbp:`fb.1.${(h.now-1200)*1000}.11111111`,
  meta_origin_evidence:{version:1,from_meta_ads:true,method:'fbc'},client_ip:'192.0.2.10',agent_user:'Browser A',
  form_email:'a@example.invalid'});
 return {s,a};
}
const landing=s=>({...s.landing,id:'',name:''});
const input=(action,promo,id)=>({action,promo_code:promo,phone:'00000001',agency_id:147,manager_id:635,
 bot_phone:'00000002',action_event_id:id,event_time:h.now-100,dateTime:new Date((h.now-100)*1000).toISOString()});
let checks=0;
for(const onlyAds of [true,false]){
 const {s,a}=fixture();const before=structuredClone(a),ctx={};
 const res=await h.api.handleLead(s.db,input('LEAD',bCode,'new-B'),landing(s),{...h.config,send_lead_capi:true,meta_ads_only_capi:onlyAds},[{...h.config,pixel_id:'19000002'}],ctx);
 assert.equal(res.status,200);const b=s.tables.conversions.find(x=>x.promo_code===bCode);assert.ok(b);
 for(const field of ['fbc','fbp','pixel_id','meta_pixel_id','client_ip','agent_user','form_email']) assert.ok(!b[field],`unmatched B cannot borrow ${field}`);
 assert.notEqual(b.external_id,a.external_id);assert.equal(b.from_meta_ads,false);
 assert.ok(!b.pixel_attribution_conversion_id);assert.equal(b.estado,'lead');assert.ok(b.lead_event_id);
 assert.deepEqual(a,before,'A stays intact');assert.equal(s.sent.length,0,'unattributed B cannot invent a configured pixel');
 const cfg={...h.config,send_lead_capi:true,meta_ads_only_capi:onlyAds},pixels=[{...h.config,pixel_id:'19000002'}];
 const duplicate=await h.api.handleLead(s.db,input('LEAD',bCode,'new-B'),landing(s),cfg,pixels,{});
 assert.equal(duplicate.status,200);assert.equal(s.tables.conversions.filter(x=>x.promo_code===bCode).length,1);
 const purchase=await h.api.handlePurchase(s.db,{...input('PURCHASE',bCode,'purchase-B'),amount:1000,transaction_id:'purchase-B'},landing(s),cfg,pixels,{});
 assert.equal(purchase.status,200);assert.equal(b.estado,'purchase');assert.equal(b.promo_code,bCode);
 for(const field of ['fbc','fbp','client_ip','agent_user','form_email'])assert.ok(!b[field],`B purchase cannot borrow ${field} from A`);
 assert.deepEqual(a,before,'Later B purchase leaves A intact');checks++;
}
for(const destination of ['whatsapp','atrio']){
 const {s,a}=fixture();
 if(destination==='atrio')a.atrio_id='19000000-0000-4000-8000-000000000004';
 Object.assign(a,{estado:'purchase',purchase_event_id:'first-A',purchase_event_time:h.now-550,lead_event_time:h.now-570});
 const b={...structuredClone(a),id:'19000000-0000-4000-8000-000000000099',promo_code:bCode,
  contact_event_id:'contact-B',contact_event_time:h.now-400,lead_event_id:'lead-B',lead_event_time:h.now-150,
  purchase_event_id:'first-B',purchase_event_time:h.now-100,created_at:new Date((h.now-400)*1000).toISOString(),
  fbc:`fb.1.${(h.now-1000)*1000}.CampaignB`,fbp:`fb.1.${(h.now-1000)*1000}.22222222`,
  client_ip:'192.0.2.20',agent_user:'Browser B',external_id:'identity-B',form_email:'b@example.invalid'};
 s.tables.conversions.push(b);const original=structuredClone(s.tables.conversions),ctx={};
 const p={...input('PURCHASE',aCode,'late-A-'+destination),amount:1000,transaction_id:'payment-A-'+destination,
  event_time:h.now-250,dateTime:new Date((h.now-250)*1000).toISOString(),
  ...(destination==='atrio'?{source_platform:'atrio',atrio_id:a.atrio_id}:{})};
 const res=await h.api.handlePurchase(s.db,p,landing(s),h.config,[],ctx);assert.equal(res.status,200);
 const repeat=s.tables.conversions.find(x=>!original.some(y=>y.id===x.id));assert.ok(repeat);assert.equal(repeat.promo_code,aCode);
 for(const field of ['fbc','fbp','client_ip','agent_user','external_id','form_email','landing_id','event_source_url'])assert.equal(repeat[field],a[field],`${destination}: ${field} belongs to A`);
 assert.equal(repeat.purchase_type,'repeat');assert.equal(repeat.purchase_event_time,h.now-250);
 assert.equal(s.sent.length,1);assert.equal(s.sent[0].payload.data[0].user_data.fbc,a.fbc);
 assert.deepEqual(s.tables.conversions.slice(0,2),original,'Both source journeys stay intact');checks++;
}
console.log(`PASS ${checks} actual-handler journey context scenarios`);
