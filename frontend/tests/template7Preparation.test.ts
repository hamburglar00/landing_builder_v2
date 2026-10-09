import assert from "node:assert/strict";
import test from "node:test";
import type { StartDependencies } from "../lib/reyDeAses/start.server";
import {
  handleTemplate7PreparationComplete,
  handleTemplate7Prepare,
} from "../lib/reyDeAses/preparation.server";

const landingId = "11111111-1111-4111-8111-111111111111";
const clientId = "22222222-2222-4222-8222-222222222222";
const advisorId = "33333333-3333-4333-8333-333333333333";
const deviceId = "44444444-4444-4444-8444-444444444444";
const playerId = "55555555-5555-4555-8555-555555555555";
const ownerId = "66666666-6666-4666-8666-666666666666";
const providerAccountId = "88888888-8888-4888-8888-888888888888";
const now = 1_791_446_400_000;
const env = {
  REY_GATEWAY_ORIGIN: "https://gateway.example.com",
  TEMPLATE7_PREPARATION_TOKEN_KEY: "token-key-" + "x".repeat(40),
  TEMPLATE7_PREPARATION_API_KEY: "api-key-" + "y".repeat(40),
};
const payload = {
  landing_id: landingId,
  landing_slug: "landing-7",
  name: "Martin",
  atrio_client_id: clientId,
  advisor_id: advisorId,
  advisor_slug: "gera",
  promo_code: "LP-demo",
  attribution: { target_provider: "rey_de_ases" },
};

function deps(): StartDependencies {
  return {
    db: {
      async landing() {
        return {
          id: landingId, name: "landing-7", user_id: ownerId, workspace_currency: "ARS",
          config: { template: "template7", ctaDestination: "atrio", targetProvider: "rey_de_ases" },
          landing_config: { layout: { template: 7 } },
        };
      },
      async blocked() { return false; },
      async assignment() { return { landing_id: landingId, atrio_client_id: clientId, user_id: ownerId }; },
      async advisor() { return { id: clientId, user_id: ownerId, workspace_currency: "ARS", slug: "gera", atrio_id: advisorId }; },
    },
    api2Status() { return null; },
    gatewayStatus() { return null; },
    async allowStart(_request, _landingId, incomingDeviceId, needsCookie) {
      assert.equal(incomingDeviceId, deviceId);
      assert.equal(needsCookie, false);
      return true;
    },
    demoConfig() { return null; },
    async resolvePlayer(input) {
      assert.equal(input.deviceId, deviceId);
      return {
        advisor_id: advisorId, advisor_slug: "gera", player_id: playerId, device_id: deviceId,
        created: false, player_provider_account_id: providerAccountId, target_provider: "rey_de_ases",
        provider_account_created: false,
      };
    },
    async resolveAccount() { return { username: "player", password: "secret", platform: "rey_de_ases", created: false }; },
    async createHandoff() {
      return { handoff_url: "https://gateway.example.com/start?t=handoff", expires_at: "2026-10-08T12:00:00Z", binding_created: false };
    },
  };
}

async function prepareToken(): Promise<string> {
  const response = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `lb_cid=${deviceId}`,
      "X-Vercel-Forwarded-For": "200.1.2.3",
    },
    body: JSON.stringify(payload),
  }), env, now);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json() as { handoff_url: string };
  const url = new URL(body.handoff_url);
  assert.equal(url.origin, "https://gateway.example.com");
  assert.equal(url.pathname, "/prepare");
  assert.equal(url.searchParams.size, 1);
  const token = url.searchParams.get("t") || "";
  assert.ok(token.length > 100);
  assert.doesNotMatch(token, /Mart|landing-7|player|secret/);
  return token;
}

test("prepare responde de inmediato con un pase opaco y complete conserva identidad", async () => {
  const token = await prepareToken();
  const response = await handleTemplate7PreparationComplete(new Request("https://mkt.example.com/api/template7/preparations/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({ token }),
  }), env, deps(), now + 1000);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { handoff_url: "https://gateway.example.com/start?t=handoff" });
});

test("complete rechaza autenticacion, adulteracion y vencimiento", async () => {
  const token = await prepareToken();
  const call = (candidate: string, authorization: string, instant: number) => handleTemplate7PreparationComplete(
    new Request("https://mkt.example.com/api/template7/preparations/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify({ token: candidate }),
    }), env, deps(), instant,
  );
  assert.equal((await call(token, "Bearer wrong", now + 1000)).status, 401);
  assert.equal((await call(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}`, now + 1000)).status, 410);
  assert.equal((await call(token, `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}`, now + 301_000)).status, 410);
});

test("prepare valida formato y fija lb_cid HttpOnly cuando falta", async () => {
  const invalid = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, name: "" }),
  }), env, now);
  assert.equal(invalid.status, 400);
  assert.match(invalid.headers.get("Set-Cookie") || "", /^lb_cid=[0-9a-f-]+; Max-Age=63072000; Path=\/; HttpOnly;/);
});
