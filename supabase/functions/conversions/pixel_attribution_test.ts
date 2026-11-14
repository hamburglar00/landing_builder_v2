import {
  choosePurchasePixelAttribution,
  resolvePurchasePixelAttribution,
  type PurchasePixelCandidate,
} from "./pixel_attribution.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

const PIXEL_A = "880464554785896";
const PIXEL_B = "989122687083119";
Deno.test('a Purchase on November 10 cannot use a November 13 CTA or rescue it through another fallback',()=>{
  const eventTime=Date.parse('2026-11-10T12:00:00Z')/1000;
  const future={id:'future',contact_event_id:'cta',contact_event_time:Date.parse('2026-11-13T12:00:00Z')/1000,pixel_id:PIXEL_A};
  for(const context of [{currentRow:future},{currentRow:future,inboundPixelId:PIXEL_A},
    {promoRoots:[future]},{promoRoots:[future],inboundPixelId:PIXEL_A},
    {promoRoots:[future,{contact_event_id:'older',contact_event_time:eventTime-3600,pixel_id:PIXEL_B}]}]) {
    assert(choosePurchasePixelAttribution({...context,eventTime,landingById:{pixel_id:PIXEL_A},configuredPixelIds:[PIXEL_A,PIXEL_B]})===null);
  }
});
Deno.test('derived Purchase inherits chronology through evidence even without Contact fields',()=>{
  const eventTime=Date.parse('2026-11-10T12:00:00Z')/1000;
  const currentRow={id:'purchase',pixel_id:PIXEL_A,pixel_attribution_source:'stored_attribution',pixel_attribution_conversion_id:'cta-root',
    meta_origin_evidence:{version:1,observed_at:'2026-11-13T12:00:00Z',classification:'meta_ads'}};
  assert(choosePurchasePixelAttribution({currentRow,eventTime,configuredPixelIds:[PIXEL_A]})===null);
  assert(choosePurchasePixelAttribution({currentRow,eventTime:Date.parse('2026-11-14T12:00:00Z')/1000,configuredPixelIds:[PIXEL_A]})?.pixelId===PIXEL_A);
});
Deno.test('late ingestion, missing historical timing and five-minute clock tolerance preserve valid attribution',()=>{
  const eventTime=Date.parse('2026-11-10T12:00:00Z')/1000;
  for(const currentRow of [
    {contact_event_id:'cta',contact_event_time:eventTime-3600,created_at:'2026-11-14T12:00:00Z',pixel_id:PIXEL_A},
    {contact_event_id:'cta',contact_payload_raw:JSON.stringify({event_id:'cta',event_time:eventTime-3600,pixel_id:PIXEL_A}),created_at:'2026-11-14T12:00:00Z'},
    {contact_event_id:'cta',contact_event_time:eventTime+300,pixel_id:PIXEL_A},
    {contact_event_id:'legacy',pixel_id:PIXEL_A},
  ]) assert(choosePurchasePixelAttribution({currentRow,eventTime,configuredPixelIds:[PIXEL_A]})?.pixelId===PIXEL_A);
});
Deno.test('an exact valid promo can resolve independently of a later unrelated current journey',async()=>{
  const eventTime=Date.parse('2026-11-10T12:00:00Z')/1000;
  const root={id:'correct-root',promo_code:'REAL-promo',contact_event_id:'earlier',contact_event_time:eventTime-3600,pixel_id:PIXEL_B};
  const db={from(table:string){const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},ilike(){return q;},
    then(resolve:(v:unknown)=>unknown){return Promise.resolve({data:table==='conversions'?[root]:[],error:null}).then(resolve);}};return q;}};
  const result=await resolvePurchasePixelAttribution(db as never,{userId:'owner',promoCode:'REAL-promo',eventTime,
    currentRow:{promo_code:'OTHER-promo',pixel_id:PIXEL_A,contact_event_id:'later',contact_event_time:eventTime+3*86400},configuredPixelIds:[PIXEL_A,PIXEL_B]});
  assert(result?.pixelId===PIXEL_B);assert(result?.sourceConversionId==='correct-root');
});
Deno.test('removing a captured pixel cannot reroute its journey to the remaining pixel',()=>{
  const root={pixel_id:PIXEL_A,contact_event_id:'original'};
  for(const context of [
    {currentRow:root},
    {promoRoots:[root]},
    {promoRoots:[root,{pixel_id:PIXEL_B,contact_event_id:'conflict'}]},
    {landingById:{pixel_id:PIXEL_A}},
    {landingTagMatches:[{pixel_id:PIXEL_A},{pixel_id:PIXEL_B}]},
  ]) assert(choosePurchasePixelAttribution({...context,configuredPixelIds:[PIXEL_B]})===null,'deleted or conflicting destination must remain unresolved');
});
Deno.test('a conflicting promo identity cannot be rescued by the single configured pixel',()=>{
  assert(choosePurchasePixelAttribution({currentRow:{phone:'123'},promoRoots:[{phone:'999',pixel_id:PIXEL_A,contact_event_id:'other'}],configuredPixelIds:[PIXEL_A]})===null);
});
Deno.test('an explicit foreign pixel cannot silently fall back to the single configured destination',()=>{
  assert(choosePurchasePixelAttribution({inboundPixelId:PIXEL_B,configuredPixelIds:[PIXEL_A]})===null);
});
Deno.test('a later webhook cannot replace the captured pixel even with another configured pixel',()=>{
  const currentRow={pixel_id:PIXEL_B,contact_event_id:'original',contact_payload_raw:JSON.stringify({event_id:'original',meta_pixel_id:PIXEL_A})};
  assert(choosePurchasePixelAttribution({currentRow,inboundPixelId:PIXEL_B,configuredPixelIds:[PIXEL_A,PIXEL_B]})===null);
  assert(choosePurchasePixelAttribution({currentRow,configuredPixelIds:[PIXEL_A,PIXEL_B]})?.pixelId===PIXEL_A);
});
Deno.test('promo roots never cross a known player, agency or Atrio identity and ambiguous pixels are not guessed',()=>{
  for(const conflict of [{phone:'999'},{assigned_gerencia_id:2},{atrio_id:'other'},{atrio_players_id:'other'}]) {
    const result=choosePurchasePixelAttribution({currentRow:{phone:'123',assigned_gerencia_id:1,atrio_id:'advisor',atrio_players_id:'player'},
      promoRoots:[{...conflict,id:'root',pixel_id:PIXEL_A,contact_event_id:'cta'}],configuredPixelIds:[PIXEL_A,PIXEL_B]});
    assert(result===null,'conflicting journey must not supply its pixel');
  }
  assert(choosePurchasePixelAttribution({promoRoots:[{pixel_id:PIXEL_A,contact_event_id:'a'},{pixel_id:PIXEL_B,contact_event_id:'b'}],configuredPixelIds:[PIXEL_A,PIXEL_B]})===null,'ambiguous roots must stay unresolved');
});

Deno.test("repeat resolves pixel from the Contact root of the same promo", () => {
  const latestRepeat: PurchasePixelCandidate = {
    id: "latest-repeat",
    pixel_id: PIXEL_A,
    contact_event_id: "",
    contact_payload_raw: "",
    source_platform: "landing",
  };
  const contactRoot: PurchasePixelCandidate = {
    id: "contact-root",
    pixel_id: PIXEL_A,
    contact_event_id: "contact-event",
    contact_payload_raw: JSON.stringify({ meta_pixel_id: PIXEL_A }),
    source_platform: "landing",
    created_at: "2026-07-08T16:39:09Z",
  };

  const result = choosePurchasePixelAttribution({
    currentRow: latestRepeat,
    promoRoots: [latestRepeat, contactRoot],
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });

  assert(result?.pixelId === PIXEL_A, "must recover the Contact pixel");
  assert(result?.source === "promo_root", "must record promo_root");
  assert(
    result?.sourceConversionId === "contact-root",
    "must preserve root traceability",
  );
});

Deno.test("explicit pixel wins for a new promo tied to another ad", () => {
  const result = choosePurchasePixelAttribution({
    inboundPixelId: PIXEL_B,
    promoRoots: [{
      id: "old-root",
      pixel_id: PIXEL_A,
      contact_event_id: "old-contact",
    }],
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });

  assert(result?.pixelId === PIXEL_B, "explicit pixel must win");
  assert(
    result?.source === "explicit_payload",
    "source must be explicit_payload",
  );
});

Deno.test("unique landing tag resolves a pixel but ambiguous tags do not", () => {
  const unique = choosePurchasePixelAttribution({
    landingTagMatches: [
      { id: "landing-1", pixel_id: PIXEL_B },
      { id: "landing-2", pixel_id: PIXEL_B },
    ],
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });
  assert(unique?.pixelId === PIXEL_B, "same unique pixel is safe");
  assert(unique?.source === "landing_tag", "source must be landing_tag");

  const ambiguous = choosePurchasePixelAttribution({
    landingTagMatches: [
      { id: "landing-1", pixel_id: PIXEL_A },
      { id: "landing-2", pixel_id: PIXEL_B },
    ],
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });
  assert(
    ambiguous === null,
    "ambiguous multi-pixel attribution must be skipped",
  );
});

Deno.test("single configured pixel is a safe final fallback", () => {
  const result = choosePurchasePixelAttribution({
    configuredPixelIds: [PIXEL_A],
  });
  assert(result?.pixelId === PIXEL_A, "single configured pixel must resolve");
  assert(
    result?.source === "single_configured_pixel",
    "source must explain the safe fallback",
  );
});

Deno.test("stored attribution keeps the original root conversion", () => {
  const result = choosePurchasePixelAttribution({
    currentRow: {
      id: "latest-repeat",
      pixel_id: PIXEL_A,
      pixel_attribution_source: "promo_root",
      pixel_attribution_conversion_id: "contact-root",
    },
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });

  assert(result?.pixelId === PIXEL_A, "stored trusted pixel must be reused");
  assert(
    result?.sourceConversionId === "contact-root",
    "the Contact root must survive across repeat purchases",
  );
});
