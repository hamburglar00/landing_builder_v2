import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTemplate8Cover, template8Provider, template8SkinCode } from "../lib/landing/template8";
import { configuredSkinCode } from "../lib/reyDeAses/start.server";
import { MULTI_SKIN_CODES } from "../lib/multi-skin-catalog";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import { switchLandingTemplate } from "../lib/landing/templateVariants";
import { handleTemplate7Destination, type DestinationResolutionBackend } from "../lib/atrio/template7Destination.server";
import { parseTemplate7StartPayload } from "../lib/reyDeAses/start-payload.server";
import { renderPublicLandingHtml, renderClassicTemplate7InlineHtml } from "../components/public-landing/renderPublicLandingHtml";
import { template7RuntimeAsset } from "../components/public-landing/template7RuntimeAsset";
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cover = normalizeTemplate8Cover();
const config = { ...DEFAULT_CONFIG, template: "template8" as const, ctaDestination: "atrio" as const, template8Cover: cover };
test("Template 8 preserves independent drafts, enforces 1–6 cards and compiles Atrio only", () => {
  for (const n of [1,2,3,4,5,6]) assert.equal(normalizeTemplate8Cover({ cardCount: n }).cardCount, n);
  assert.equal(normalizeTemplate8Cover({ cardCount: 99 }).cardCount, 6);
  assert.equal(normalizeTemplate8Cover({ cardCount: 0 }).cardCount, 1);
  assert.equal(normalizeTemplate8Cover({ cardCount: 1.5 }).cardCount, 4);
  const edited = { ...config, template8Cover: { ...cover, headerText: "Own header", cardCount: 3 } };
  const restored = switchLandingTemplate(switchLandingTemplate(edited, "template6"), "template8");
  assert.equal(restored.template8Cover?.headerText, "Own header");
  assert.equal(restored.ctaDestination, "atrio");
  const payload = buildLandingConfig({ id: id(1), name: "test8", comment: "", pixelId: "123", postUrl: "", landingTag: "TEST", config: edited });
  assert.equal(payload.layout.template, 8);
  assert.equal(payload.tracking.ctaDestination, "atrio");
  assert.equal(payload.content?.template8?.cards.length, 3);
  assert.equal(payload.leadCapture?.enabled, false);
  for (const classic of [false,true]) {
    const html = classic ? renderClassicTemplate7InlineHtml({slug:"test8", config:payload as never}, `function getOrCreateDeviceId(){return '${id(8)}';}`) : renderPublicLandingHtml({slug:"test8",config:payload as never});
    assert.equal((html.match(/data-template8-card-index="\d"/g) || []).length, 3);
    assert.match(html, /data-template8-entry hidden/);
    assert.doesNotMatch(html, /data-template7-reentry/);
    assert.doesNotMatch(html, /landing-runtime-v6.js/);
  }
});
test("server page selection rejects malformed/missing cards rather than defaulting to a casino", () => {
  assert.equal(template8Provider(config, 1), "ganamos_net");
  assert.equal(template8Provider(config, 2), "multi_skin");
  for (const index of [undefined, null, "1", 0, 1.5, 5, 99]) assert.equal(template8Provider(config, index), null);
  assert.equal(template8Provider({template:"template7",template8Cover:cover},1), null);
});
test("destination prewarm reserves by saved card; selection commits once; Ganamos+ and invalid scopes fail closed", async () => {
  const calls: Record<string,unknown>[] = [];
  const advisor = {id:id(2),atrio_id:id(3),slug:"ana",user_id:id(4),workspace_currency:"ARS"};
  const backend: DestinationResolutionBackend = {
    context: async () => ({allowed:true,blocked:false,landing:{id:id(1),name:"test8",user_id:id(4),workspace_currency:"ARS",config},advisors:[advisor]}),
    resolve: async input => {calls.push(input as Record<string,unknown>); return {advisor_id:id(3),advisor_slug:"ana",target_provider:"ganamos_net",connection_id:id(5),preparation_ready:true};},
    fallback: async () => { throw new Error("Template 8 must never use the single-advisor fallback"); },
  };
  const request = (data: object) => new Request("https://builder.test/api/template7/destination", { method:"POST",headers:{Origin:"https://builder.test","Content-Type":"application/json"},body:JSON.stringify({landing_id:id(1),landing_slug:"test8",...data}) });
  assert.equal((await handleTemplate7Destination(request({card_index:1}),id(8),backend)).status,200);
  assert.equal(calls[0].reserve_only,true); assert.equal(calls[0].target_provider,"ganamos_net");
  assert.equal((await handleTemplate7Destination(request({card_index:1,commit:true}),id(8),backend)).status,200);
  assert.equal(calls[1].reserve_only,false);
  // Multi Skin is available, but a NET assignment must never satisfy its scope.
  assert.equal((await handleTemplate7Destination(request({card_index:2}),id(8),backend)).status,403);
  for (const data of [{}, {card_index:0}, {card_index:"1"}, {card_index:9}, {card_index:1,target_provider:"rey_de_ases"}, {card_index:1,commit:"true"}]) assert.ok((await handleTemplate7Destination(request(data),id(8),backend)).status>=400);
  assert.equal(calls.length,3);
  assert.equal((await handleTemplate7Destination(request({card_index:1}),null,backend)).status,409);
});
test("shared preparation token payload preserves the selected card with strict validation", () => {
  const payload = {landing_id:id(1),landing_slug:"test8",atrio_client_id:id(2),advisor_id:id(3),advisor_slug:"ana",name:"Visitor",promo_code:"TEST-abc",card_index:3,attribution:{card_index:"3",utm_campaign:"campaign"}};
  assert.equal(parseTemplate7StartPayload(payload)?.card_index,3);
  assert.equal(parseTemplate7StartPayload(payload)?.attribution?.card_index,"3");
  assert.equal(parseTemplate7StartPayload({...payload,card_index:"3"}),null);
});

test("each Multi Skin card preserves its own skin through editor drafts and both public renderers", () => {
  for (const skin of MULTI_SKIN_CODES) {
    const cards = [...cover.cards];
    cards[1] = { ...cards[1], multiSkinCode: skin };
    cards[3] = { ...cards[3], targetProvider: "multi_skin", multiSkinCode: "ganamos_plus" };
    const saved = { ...config, multiSkinCode: "jugamos" as const, template8Cover: normalizeTemplate8Cover({ ...cover, cards }) };
    const restored = switchLandingTemplate(switchLandingTemplate(saved, "template7"), "template8");
    assert.equal(restored.template8Cover?.cards[1].multiSkinCode, skin);
    assert.equal(template8SkinCode(saved, 2), skin);
    assert.equal(template8SkinCode(saved, 4), "ganamos_plus");
    const row = { id:id(1),name:"test8",user_id:id(4),workspace_currency:"ARS",config:saved,landing_config:{} };
    assert.equal(configuredSkinCode(row, "multi_skin", 2), skin);
    const payload = buildLandingConfig({ id:id(1),name:"test8",comment:"",pixelId:"123",postUrl:"",landingTag:"TEST",config:saved });
    assert.equal(payload.content?.template8?.cards[1].multiSkinCode, skin);
    for (const classic of [false, true]) {
      const html = classic ? renderClassicTemplate7InlineHtml({ slug:"test8",config:payload as never }, `function getOrCreateDeviceId(){return '${id(8)}';}`) : renderPublicLandingHtml({ slug:"test8",config:payload as never });
      assert.ok(html.includes(`"multiSkinCode":"${skin}"`));
      assert.ok(template7RuntimeAsset(8,classic).source.includes("cfg.skinCode = card.multiSkinCode"));
    }
  }
});

test("legacy cards stay on Ganamos+ regardless of Template 7's skin and malformed card skins fail closed", () => {
  const legacy = { ...config, multiSkinCode:"bet30" };
  const cards = cover.cards.map(card => { const copy = {...card}; delete copy.multiSkinCode; return copy; });
  assert.equal(template8SkinCode({ ...legacy, template8Cover:{ ...cover,cards } }, 2), "ganamos_plus");
  for (const skin of [null, "foreign-domain", "https://bet30e.lat", ""]) {
    const invalid = { ...config, template8Cover:{ ...cover,cards:cards.map((card,i) => i===1 ? {...card,multiSkinCode:skin} : card) } };
    assert.equal(template8SkinCode(invalid, 2), null);
  }
  for (const index of [undefined, 0, "2", 9]) assert.equal(template8SkinCode(config, index), null);
});
