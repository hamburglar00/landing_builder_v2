import test from "node:test";
import assert from "node:assert/strict";
import { isAtrioGatewayCta } from "../lib/atrio/gatewayCta";

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const journey = { id: id(1), user_id: id(2), atrio_id: id(3), landing_id: id(4), promo_code: "ads-one",
  atrio_players_id:null, cta_clicked_event_id:"cta", cta_clicked_event_time:Date.parse("2026-10-01T12:00Z")/1000,
  contact_event_time:null, source_platform:"landing", contact_payload_raw:'{"cta_destination":"atrio","target_provider":"multi_skin","skin_code":"ganamos_plus"}' };

test("a WhatsApp CTA enriched later with an Atrio advisor never becomes a gateway entry", () => {
  assert.equal(isAtrioGatewayCta(journey),true);
  assert.equal(isAtrioGatewayCta({...journey,contact_payload_raw:'{"cta_destination":"whatsapp"}'}),false);
  assert.equal(isAtrioGatewayCta({...journey,contact_payload_raw:"{}",
    source_platform:"whatsapp_cloud_api"}),false);
  assert.equal(isAtrioGatewayCta({...journey,contact_payload_raw:"{}",telefono_asignado:"fixture"}),false);
  assert.equal(isAtrioGatewayCta({...journey,contact_payload_raw:"broken"}),false);
});

test("normal reporting route scopes every batch to visible rows and matches both landing and directory owners", async t => {
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="fixture";
  process.env.INTERNAL_CHAT_ORIGIN="https://fixture.atrio.test";
  process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY="x".repeat(32);
  const {POST}=await import("../app/api/atrio/gateway-entries/route");
  const request = (ids: string[], token = "viewer") => new Request("https://builder.test/api/atrio/gateway-entries", {
    method:"POST",headers:{"Content-Type":"application/json",...(token ? {Authorization:`Bearer ${token}`} : {})},body:JSON.stringify(ids),
  });
  assert.equal((await POST(request([journey.id],""))).status,401);
  assert.equal((await POST(request(["invalid"]))).status,400);
  const calls: string[]=[];
  let receipt: "positive" | "negative" | "unknown" | "unavailable" = "positive";
  t.mock.method(globalThis,"fetch",async (input: RequestInfo | URL, init?: RequestInit) => {
    const url=new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.pathname);
    if (url.pathname==="/auth/v1/user") return Response.json({id:id(2),email:"test@example.invalid",role:"authenticated"});
    if (url.pathname==="/rest/v1/conversions") return Response.json([journey,
      {...journey,id:id(6),user_id:id(7)}, // a row whose advisor is owned by another workspace
      {...journey,id:id(9),landing_id:id(10)}, // an unowned landing
      {...journey,id:id(11),contact_payload_raw:'{"cta_destination":"whatsapp"}'},
      {...journey,id:id(13),contact_payload_raw:'{"cta_destination":"atrio","skin_code":123}'},
      {...journey,id:id(14),contact_payload_raw:'{"cta_destination":"atrio","target_provider":"obsolete"}'},
      {...journey,id:id(15),cta_clicked_event_time:-10}]);
    if (url.pathname==="/rest/v1/landings") return Response.json([{id:id(4),user_id:id(2)}]);
    if (url.pathname==="/rest/v1/atrio_clients") return Response.json([{atrio_id:id(3),user_id:id(2)}]);
    assert.equal(url.href,"https://fixture.atrio.test/api/internal/landing-gateway-entries");
    assert.deepEqual(JSON.parse(String(init?.body)),[{
      conversion_id:id(1),landing_id:id(4),advisor_id:id(3),player_id:null,promo_code:"ads-one",
      cta_time:journey.cta_clicked_event_time,target_provider:"multi_skin",skin_code:"ganamos_plus",
    }]);
    if (receipt==="unavailable") return new Response(null,{status:503});
    return Response.json({entries:receipt==="unknown" ? [] : [{conversion_id:id(1),
      message_id:receipt==="positive" ? id(12) : null,event_time:receipt==="positive" ? journey.cta_clicked_event_time+20 : null}]});
  });
  const read = () => POST(request([id(1),id(6),id(9),id(11),id(13),id(14),id(15)]));
  assert.deepEqual(await (await read()).json(),{measured:[id(1)],entries:[{
    conversion_id:id(1),message_id:id(12),event_time:journey.cta_clicked_event_time+20}]});
  receipt="negative"; assert.deepEqual(await (await read()).json(),{measured:[id(1)],entries:[]});
  receipt="unknown"; assert.deepEqual(await (await read()).json(),{measured:[],entries:[]});
  receipt="unavailable"; assert.equal((await read()).status,503);
  assert.equal(calls.some(path=>path.includes("conversions?name") || path.startsWith("/functions/")),false);
});
