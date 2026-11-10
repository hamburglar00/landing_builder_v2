import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { handleClassicTemplate7Prepare } from "../lib/reyDeAses/classic-preparation-issue.server";
import { decryptClaims } from "../lib/reyDeAses/preparation-issue.server";

const compiled = createRequire(import.meta.url)("../../../landing-prueba-1/lib/template7/preparation.cjs") as {
  handleClassicTemplate7Prepare: typeof handleClassicTemplate7Prepare;
};
const device = "44444444-4444-4444-8444-444444444444";
const now = Date.now();
const environment = {
  TEMPLATE7_PREPARATION_TOKEN_KEY: "isolated-preparation-key-" + "x".repeat(40),
  REY_GATEWAY_ORIGIN: "https://rey.fixture.test",
  ASES_DEL_NORTE_GATEWAY_ORIGIN: "https://ases.fixture.test",
  GANAMOS_NET_GATEWAY_ORIGIN: "https://net.fixture.test",
  GANAMOS_PLUS_GATEWAY_ORIGIN: "https://plus.fixture.test",
};
const payload = {
  landing_id: "11111111-1111-4111-8111-111111111111", landing_slug: "fixture",
  atrio_client_id: "22222222-2222-4222-8222-222222222222",
  advisor_id: "33333333-3333-4333-8333-333333333333", advisor_slug: "advisor",
  device_id: device, name: "Nombre final", promo_code: "LP-fixture", card_index: 2,
  entry_funnel: { landing_id: "11111111-1111-4111-8111-111111111111", flow_id: "55555555-5555-4555-8555-555555555555",
    template: 8, started_at: now, telemetry_origin: "https://landing.panelbotadmin.com", engine: "classic", release: "abcdef1234", environment: "development", source: "synthetic" },
  attribution: { target_provider: "rey_de_ases", fbc: "fb.1.123.test", utm_campaign: "fixture" },
};
function request(body: unknown, origin = "https://classic.fixture.test") {
  return new Request("https://classic.fixture.test/api/template7/prepare", {
    method: "POST", headers: { "content-type": "application/json", origin,
      cookie: "lb_cid=99999999-9999-4999-8999-999999999999", "x-vercel-forwarded-for": "192.0.2.1" },
    body: JSON.stringify(body),
  });
}

for (const [implementation, issue] of [["canonical", handleClassicTemplate7Prepare], ["classic artifact", compiled.handleClassicTemplate7Prepare]] as const) {
  test(`${implementation}: opaque preparation preserves classic identity and attribution for all providers`, async () => {
    for (const [provider, host] of [["rey_de_ases", "rey"], ["ases_del_norte", "ases"], ["ganamos_net", "net"], ["multi_skin", "plus"]]) {
      const body = { ...payload, attribution: { ...payload.attribution, target_provider: provider,
        ...(provider === "multi_skin" ? { skin_code: "ganamos_plus" } : {}) } };
      const response = await issue(request(body), environment, now);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("set-cookie"), null);
      const result = await response.json();
      assert.deepEqual(Object.keys(result), ["handoff_url"]);
      const destination = new URL(result.handoff_url);
      assert.equal(destination.origin, `https://${host}.fixture.test`);
      assert.equal(destination.pathname, "/prepare");
      const claims = decryptClaims(destination.searchParams.get("t")!, environment, now);
      assert.equal(claims.identity.deviceId, device);
      assert.equal(claims.identity.needsCookie, false);
      assert.equal(claims.payload.card_index, 2);
      assert.equal(claims.payload.name, payload.name);
      assert.equal(claims.payload.advisor_id, payload.advisor_id);
      assert.deepEqual(claims.payload.attribution, body.attribution);
      assert.deepEqual(claims.payload.entry_funnel, payload.entry_funnel);
      assert.equal(claims.client_ip, "192.0.2.1");
      assert.throws(() => decryptClaims(destination.searchParams.get("t")!, environment, now + 300_001));
    }
  });
  test(`${implementation}: malformed identity/name, foreign origins and absent keys cannot issue an entry`, async () => {
    for (const device_id of [undefined, "", "not-a-uuid", "<script>"]) {
      assert.equal((await issue(request({ ...payload, device_id }), environment, now)).status, 400);
    }
    assert.equal((await issue(request({ ...payload, name: " " }), environment, now)).status, 400);
    assert.equal((await issue(request(payload, "https://foreign.fixture.test"), environment, now)).status, 403);
    assert.equal((await issue(request(payload), { ...environment, TEMPLATE7_PREPARATION_TOKEN_KEY: "" }, now)).status, 503);
  });
}
