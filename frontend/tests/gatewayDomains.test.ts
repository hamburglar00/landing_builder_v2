import assert from "node:assert/strict";
import test from "node:test";
import { gatewayOriginFor } from "../lib/reyDeAses/gatewayOrigins";
import { createProviderHandoff } from "../lib/reyDeAses/integrations.server";

const origins = {
  REY_GATEWAY_ORIGIN: "https://www.reydeases.fun",
  ASES_DEL_NORTE_GATEWAY_ORIGIN: "https://www.asesdelnorte.online",
  GANAMOS_NET_GATEWAY_ORIGIN: "https://www.ganamosnet.icu",
  MULTI_SKIN_GATEWAY_ORIGIN: "https://shared.example.workers.dev",
  GANAMOS_PLUS_GATEWAY_ORIGIN: "https://ganamosnet.global",
};

test("Ganamos+ uses its own domain without assigning it to other skins", () => {
  assert.equal(gatewayOriginFor("multi_skin", "ganamos_plus", origins), origins.GANAMOS_PLUS_GATEWAY_ORIGIN);
  assert.equal(gatewayOriginFor("multi_skin", "another_skin", origins), origins.MULTI_SKIN_GATEWAY_ORIGIN);
  assert.equal(gatewayOriginFor("multi_skin", undefined, origins), origins.MULTI_SKIN_GATEWAY_ORIGIN);
  assert.equal(gatewayOriginFor("multi_skin", "ganamos_plus", { MULTI_SKIN_GATEWAY_ORIGIN: origins.MULTI_SKIN_GATEWAY_ORIGIN }), origins.MULTI_SKIN_GATEWAY_ORIGIN);
  assert.equal(gatewayOriginFor("ganamos_net", "ganamos_plus", origins), origins.GANAMOS_NET_GATEWAY_ORIGIN);
});

test("Ganamos+ sends the handoff to its domain and rejects a response on the shared origin", async () => {
  const saved = { ...process.env }, originalFetch = globalThis.fetch;
  Object.assign(process.env, origins, { MULTI_SKIN_GATEWAY_HANDOFF_API_KEY: "testing-key" });
  const advisor = { atrioClientId: "11111111-1111-4111-8111-111111111111", advisorId: "22222222-2222-4222-8222-222222222222", advisorSlug: "demo" };
  const deviceId = "33333333-3333-4333-8333-333333333333";
  const player = { advisor_id: advisor.advisorId, advisor_slug: advisor.advisorSlug,
    player_id: "44444444-4444-4444-8444-444444444444", device_id: deviceId, created: false,
    player_provider_account_id: "55555555-5555-4555-8555-555555555555", target_provider: "multi_skin" as const,
    provider_account_created: false };
  let returnedOrigin = origins.GANAMOS_PLUS_GATEWAY_ORIGIN;
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), origins.GANAMOS_PLUS_GATEWAY_ORIGIN + "/api/handoffs");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer testing-key");
      assert.equal(JSON.parse(String(init?.body)).skin_code, "ganamos_plus");
      return Response.json({ handoff_url: returnedOrigin + "/start?t=sealed&new_meta_field=x&fbclid=click&return_to=https://evil.test&provider=evil", expires_in: 120, provider_username: "demo-user" });
    };
    const run = () => createProviderHandoff("multi_skin", advisor, deviceId, player,
      { username: "fixture-user", password: "fixture-password", platform: "multi_skin", created: false }, "ganamos_plus");
    assert.equal((await run()).handoff_url, origins.GANAMOS_PLUS_GATEWAY_ORIGIN + "/start?t=sealed");
    returnedOrigin = origins.MULTI_SKIN_GATEWAY_ORIGIN;
    await assert.rejects(run(), { code: "upstream_unavailable" });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(origins).concat("MULTI_SKIN_GATEWAY_HANDOFF_API_KEY")) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
