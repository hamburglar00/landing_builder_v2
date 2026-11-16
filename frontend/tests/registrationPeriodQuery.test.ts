import assert from 'node:assert/strict';
import test from 'node:test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture';
const range = { start: new Date('2026-11-16T03:00:00Z'), end: new Date('2026-11-17T02:59:59.999Z') };
const before = '2026-11-16T02:59:00Z', confirmed = '2026-11-16T03:01:00Z';
const row = (id: string, extra = {}) => ({ id, user_id:'owner', landing_id:'landing', promo_code:'PROMO-1',
  atrio_id:'advisor', source_platform:'landing', created_at:before, contact_event_id:'cta-'+id,
  contact_event_time:Date.parse(before)/1000, contact_payload_raw:'{"cta_destination":"atrio"}', ...extra });
const outcome = (id: string, extra = {}) => ({id,user_id:'owner',landing_id:'landing',promo_code:'PROMO-1',created_at:confirmed,agency_id:42,...extra});
function fixture(conversions: any[], registrations: any[]) {
  const calls: any[] = [];
  const client = { from(table: string) {
    let values = table === 'conversions' ? [...conversions] : [...registrations];
    const call: any = {table,filters:[]}; calls.push(call);
    const q: any = {
      select:()=>q, order:()=>q,
      eq:(k:string,v:any)=>{call.filters.push([k,v]);values=values.filter(r=>r[k]===v);return q;},
      gte:(k:string,v:any)=>{values=values.filter(r=>r[k]>=v);return q;},
      lte:(k:string,v:any)=>{values=values.filter(r=>r[k]<=v);return q;},
      in:(k:string,v:any[])=>{values=values.filter(r=>v.includes(r[k]));return q;},
      or:()=>{call.eventRange=true;values=values.filter(r=>r.created_at>=range.start.toISOString()&&r.created_at<=range.end.toISOString());return q;},
      range:(a:number,b:number)=>{call.offset=a;return Promise.resolve({data:values.slice(a,b+1),error:null});},
      then:(resolve:any)=>resolve({data:values,error:null}),
    }; return q;
  }};
  return {client:client as never,calls};
}
test('includes an account confirmed today with yesterday CTA, and counts only the registration today', async()=>{
  const {fetchConversionRowsWithClient}=await import('../lib/conversionsDb');
  const {scopeStatisticsStages}=await import('../lib/conversionJourneyStats');
  const f=fixture([row('old')],[outcome('account')]);
  const rows=await fetchConversionRowsWithClient(f.client,{userId:'owner',range});
  assert.equal(rows.length,1); assert.equal(rows[0].confirmed_registration_event_time,Date.parse(confirmed)/1000);
  const scoped=scopeStatisticsStages(rows,range);
  assert.equal(scoped.length,1); assert.equal(scoped[0].registration_event_id,'internal-account:account');
  assert.equal(scoped[0].contact_event_id,''); assert.equal(scoped[0].lead_event_id,'');
});
test('matches owner, landing and complete promo together; deduplicates the existing row',async()=>{
  const {fetchConversionRowsWithClient}=await import('../lib/conversionsDb');
  const f=fixture([row('correct',{created_at:confirmed}),row('other-owner',{user_id:'another'}),row('other-landing',{landing_id:'other'}),row('not-atrio',{atrio_id:null})],[outcome('account')]);
  const rows=await fetchConversionRowsWithClient(f.client,{range});
  assert.deepEqual(rows.map(r=>r.id),['correct']);
});
test('preserves explicit tenant, visibility cutoff and limit',async()=>{
  const {fetchConversionRowsWithClient}=await import('../lib/conversionsDb');
  const f=fixture([row('old')],[outcome('account')]);
  assert.deepEqual(await fetchConversionRowsWithClient(f.client,{userId:'owner',range,visibleFrom:confirmed}),[]);
  assert.ok(f.calls.filter(c=>c.table==='conversions').every(c=>c.filters.some(([k,v]:any[])=>k==='user_id'&&v==='owner')));
  const empty=fixture([row('old')],[outcome('account')]);
  assert.deepEqual(await fetchConversionRowsWithClient(empty.client,{range,limit:0}),[]);
});
test('excludes confirmations outside the period and preserves unbounded reporting',async()=>{
  const {fetchConversionRowsWithClient}=await import('../lib/conversionsDb');
  const f=fixture([row('old')],[outcome('account',{created_at:before})]);
  assert.deepEqual(await fetchConversionRowsWithClient(f.client,{range}),[]);
  assert.equal((await fetchConversionRowsWithClient(f.client,{}))[0].confirmed_registration_event_id,'internal-account:account');
});
test('paginates more than 1000 account confirmations and journey lookups',async()=>{
  const {fetchConversionRowsWithClient}=await import('../lib/conversionsDb');
  const all=Array.from({length:1001},(_,i)=>row(String(i),{promo_code:'PROMO-'+i}));
  const outcomes=all.map((r,i)=>outcome(String(i),{promo_code:r.promo_code}));
  const f=fixture(all,outcomes),rows=await fetchConversionRowsWithClient(f.client,{userId:'owner',range});
  assert.equal(rows.length,1001); assert.ok(rows.every(r=>r.confirmed_registration_event_id));
  assert.ok(f.calls.some(c=>c.table==='conversion_account_registrations'&&c.offset===1000));
});
