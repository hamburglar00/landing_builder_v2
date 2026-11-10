import { freezeLandingCtaEvent, frozenLandingCtaEvent, landingCtaCapiEnabled, serializeLandingCtaCapture, landingCtaStoragePatch, capiEventStorage } from './landing_cta_event.ts';
import { buildMetaRequest } from './shared.ts';
function assert(value: unknown, message = 'assertion failed'): asserts value { if (!value) throw Error(message); }
const payload = { source_platform: 'landing', cta_destination: 'atrio', event_id: 'cta-original', lead_capture_form: true, form_fn: 'Fixture', cta_meta_event:'Lead' };
const published = (template: number, event = 'Lead') => ({layout:{template},tracking:{ctaMetaEvent:event}});
function row(capture: unknown) { return { country:'',st:'',ct:'',zip:'',contact_event_id:'cta-original',contact_payload_raw:JSON.stringify(capture),external_id:'fixture',event_source_url:'https://landing.fixture.test/test',currency:'ARS' } as any; }
const config = {user_id:'owner',pixel_id:'123',meta_access_token:'fixture',meta_api_version:'v25.0',send_contact_capi:true} as any;
Deno.test('canonical storage and delivery status match the frozen CTA event without changing its capture identity',()=>{
  for(const event of ['Lead','CompleteRegistration'] as const) {
    const captured={...row(freezeLandingCtaEvent({...payload,cta_meta_event:event},published(9,event))),contact_event_time:1234567890};
    const before=JSON.stringify(captured),patch=landingCtaStoragePatch(captured),stage=event==='Lead'?'lead':'registration';
    assert(patch.estado===stage);
    assert(patch[`${stage}_event_id`]===captured.contact_event_id);
    assert(patch[`${stage}_event_time`]===1234567890);
    assert(patch[`${stage}_payload_raw`]===captured.contact_payload_raw);
    assert(capiEventStorage('Contact',captured).statusField===`${stage}_status_capi`);
    assert(capiEventStorage('Contact',captured).eventName===event);
    assert(JSON.stringify(captured)===before);
    assert(capiEventStorage('Purchase',captured).statusField==='purchase_status_capi');
  }
  assert(Object.keys(landingCtaStoragePatch(row(payload))).length===0);
  assert(capiEventStorage('Contact',row(payload)).statusField==='contact_status_capi');
});
Deno.test('only published T7/T8/T9 select a CTA event; browser markers and invalid forms cannot override it',()=>{
  for(const template of [7,8,9]){
    const result = freezeLandingCtaEvent({...payload,cta_meta_event:'CompleteRegistration',landing_cta_meta_event:'Purchase'},published(template,'CompleteRegistration'));
    assert(frozenLandingCtaEvent(row(result))==='CompleteRegistration');
    assert(frozenLandingCtaEvent(row(freezeLandingCtaEvent(payload,published(template))))==='Lead');
  }
  for(const template of [1,2,3,4,5,6]) assert(frozenLandingCtaEvent(row(freezeLandingCtaEvent({...payload,landing_cta_event_version:1,landing_cta_meta_event:'Purchase'},published(template))))===null);
  assert(frozenLandingCtaEvent(row(freezeLandingCtaEvent({...payload,form_fn:''},published(9))))===null);
});
Deno.test('selected event is frozen across retries and remains bound to the original event ID',async()=>{
  const frozen = row(freezeLandingCtaEvent({...payload,cta_meta_event:'CompleteRegistration'},published(9,'CompleteRegistration')));
  const first = await buildMetaRequest(config,frozen,'Contact','cta-original',1234567890);
  const retry = await buildMetaRequest(config,structuredClone(frozen),'Contact','cta-original',1234567890);
  assert(JSON.stringify(first.body)===JSON.stringify(retry.body));
  assert(first.eventPayload.event_name==='CompleteRegistration');
  assert((first.eventPayload.custom_data as Record<string, unknown>).status==='registered');
  assert(first.eventPayload.event_id==='cta-original');
  assert(frozenLandingCtaEvent({...frozen,contact_event_id:'other'})===null);
});
Deno.test('legacy Contact, ordinary Lead, Purchase and CAPI opt-outs retain their contracts',async()=>{
  const legacy = await buildMetaRequest(config,row(payload),'Contact','cta-original',1234567890);
  assert(legacy.eventPayload.event_name==='Contact');
  const frozen = row(freezeLandingCtaEvent(payload,published(7)));
  assert((await buildMetaRequest(config,frozen,'Purchase','purchase',1234567890,{currency:'ARS',value:1000})).eventPayload.event_name==='Purchase');
  assert(!landingCtaCapiEnabled({send_lead_capi:false},'Contact',frozen));
  const registration = row(freezeLandingCtaEvent({...payload,cta_meta_event:'CompleteRegistration'},published(8,'CompleteRegistration')));
  assert(!landingCtaCapiEnabled({},'Contact',registration));
  assert(landingCtaCapiEnabled({send_complete_registration_capi:true},'Contact',registration));
});
Deno.test('old tabs retain Contact, and stale browser configuration cannot generate a different server conversion',()=>{
  const old = {...payload,cta_meta_event:undefined};
  assert(frozenLandingCtaEvent(row(freezeLandingCtaEvent(old,published(7))))===null);
  const stale=row(freezeLandingCtaEvent(payload,published(7,'CompleteRegistration')));
  assert(!landingCtaCapiEnabled({send_complete_registration_capi:true},'Contact',stale));
});
Deno.test('a capture over the old raw limit preserves a valid frozen retry identity without truncating identifiers',()=>{
  const frozen=freezeLandingCtaEvent({...payload,utm_campaign:'x'.repeat(9000)},published(7));
  const raw=serializeLandingCtaCapture(frozen,JSON.stringify(frozen).slice(0,4000));
  assert(raw.length<4000);assert(JSON.parse(raw).raw_payload_truncated===true);
  assert(frozenLandingCtaEvent({contact_event_id:'cta-original',contact_payload_raw:raw})==='Lead');
  assert(!landingCtaCapiEnabled({},'Contact',{contact_event_id:'foreign',contact_payload_raw:raw}));
});
