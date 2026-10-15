import assert from "node:assert/strict";
import test from "node:test";
import type { StartDependencies } from "../lib/reyDeAses/start.server";
import { createDemoSession, type DemoConfig } from "../lib/reyDeAses/demo.server";
import {
  handleTemplate7PreparationAccount,
  handleTemplate7PreparationComplete,
  handleTemplate7PreparationFinalize,
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

type DependencyTrace = { links: number; handoffs: number };

function deps(trace?: DependencyTrace): StartDependencies {
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
    async linkProviderAccount(_advisor, player, account) {
      if (trace) trace.links += 1;
      return {
        player_provider_account_id: player.player_provider_account_id,
        target_provider: player.target_provider,
        provider_username: account.username,
        provider_external_account_id: null,
      };
    },
    async createHandoff() {
      if (trace) trace.handoffs += 1;
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

test("account muestra solo el usuario y finalize completa el trabajo restante", async () => {
  const token = await prepareToken();
  const trace = { links: 0, handoffs: 0 };
  const dependencies = deps(trace);
  const account = await handleTemplate7PreparationAccount(new Request("https://mkt.example.com/api/template7/preparations/account", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({ token }),
  }), env, dependencies, now + 1000);

  assert.equal(account.status, 200);
  const rawAccount = await account.text();
  assert.doesNotMatch(rawAccount, /secret|password|clave/i);
  const accountBody = JSON.parse(rawAccount) as { username: string; continuation_token: string };
  assert.equal(accountBody.username, "player");
  assert.equal(Object.hasOwn(accountBody, "handoff_url"), false);
  assert.match(accountBody.continuation_token, /^c1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(accountBody.continuation_token, /player|secret/i);
  assert.deepEqual(trace, { links: 0, handoffs: 0 });

  const finalize = await handleTemplate7PreparationFinalize(new Request("https://mkt.example.com/api/template7/preparations/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({ continuation_token: accountBody.continuation_token }),
  }), env, dependencies, now + 2000);
  assert.equal(finalize.status, 200);
  assert.deepEqual(await finalize.json(), { handoff_url: "https://gateway.example.com/start?t=handoff" });
  assert.deepEqual(trace, { links: 1, handoffs: 1 });
});

test("account y finalize protegen autenticacion, integridad y vencimiento", async () => {
  const token = await prepareToken();
  const unauthorized = await handleTemplate7PreparationAccount(new Request("https://mkt.example.com/api/template7/preparations/account", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" },
    body: JSON.stringify({ token }),
  }), env, deps(), now + 1000);
  assert.equal(unauthorized.status, 401);

  const account = await handleTemplate7PreparationAccount(new Request("https://mkt.example.com/api/template7/preparations/account", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({ token }),
  }), env, deps(), now + 1000);
  const { continuation_token: continuationToken } = await account.json() as { continuation_token: string };
  const tamperIndex = Math.floor(continuationToken.length / 2);
  const tampered = continuationToken.slice(0, tamperIndex) +
    (continuationToken[tamperIndex] === "a" ? "b" : "a") + continuationToken.slice(tamperIndex + 1);
  const finalize = (candidate: string, instant: number) => handleTemplate7PreparationFinalize(
    new Request("https://mkt.example.com/api/template7/preparations/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
      body: JSON.stringify({ continuation_token: candidate }),
    }), env, deps(), instant,
  );
  assert.equal((await finalize(tampered, now + 2000)).status, 410);
  assert.equal((await finalize(continuationToken, now + 302_000)).status, 410);
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
  const tamperIndex = Math.floor(token.length / 2);
  const tampered = token.slice(0, tamperIndex) + (token[tamperIndex] === "a" ? "b" : "a") + token.slice(tamperIndex + 1);
  assert.equal((await call(tampered, `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}`, now + 1000)).status, 410);
  assert.equal((await call(token, `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}`, now + 301_000)).status, 410);
});

test("prepare valida formato y fija lb_cid HttpOnly cuando falta", async () => {
  const invalid = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, name: "" }),
  }), env, now);
  assert.equal(invalid.status, 400);
  assert.match(invalid.headers.get("Set-Cookie") || "", /^lb_cid=[0-9a-f-]+; Max-Age=63072000; Path=\/; HttpOnly;/);
});

test("prepare dirige Ganamos+ a su dominio y conserva el origen general de Multi Skin", async () => {
  const response = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `lb_cid=${deviceId}` },
    body: JSON.stringify({ ...payload, attribution: { target_provider: "multi_skin", skin_code: "ganamos_plus" } }),
  }), { ...env, MULTI_SKIN_GATEWAY_ORIGIN: "https://shared.example.workers.dev", GANAMOS_PLUS_GATEWAY_ORIGIN: "https://ganamosnet.global" }, now);
  assert.equal(response.status, 200);
  const body = await response.json() as { handoff_url: string };
  assert.equal(new URL(body.handoff_url).origin, "https://ganamosnet.global");
});

test("prepare dirige ganamos_net exclusivamente al gateway configurado", async () => {
  const response = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `lb_cid=${deviceId}` },
    body: JSON.stringify({ ...payload, attribution: { target_provider: "ganamos_net" } }),
  }), {
    ...env,
    GANAMOS_NET_GATEWAY_ORIGIN: "https://ganamos-net.example.com",
  }, now);
  assert.equal(response.status, 200);
  const body = await response.json() as { handoff_url: string };
  assert.equal(new URL(body.handoff_url).origin, "https://ganamos-net.example.com");
});

for (const provider of ["multi_skin", "ases_del_norte", "ganamos_net"] as const) {
  test(`account devuelve el pase ya vinculado de ${provider} y conserva finalize compatible`, async () => {
    const trace = { links: 0, handoffs: 0 };
    const dependencies = deps(trace);
    const originalLanding = dependencies.db.landing;
    dependencies.db.landing = async (...args) => {
      const landing = await originalLanding(...args);
      assert.ok(landing);
      return { ...landing, config: {
        template: "template7", ctaDestination: "atrio", targetProvider: provider,
        ...(provider === "multi_skin" ? { multiSkinCode: "ganamos_plus" } : {}),
      } };
    };
    const originalPlayer = dependencies.resolvePlayer;
    dependencies.resolvePlayer = async input => ({ ...await originalPlayer(input), target_provider: provider });
    const config: DemoConfig = {
      sessionSecret: "s".repeat(32), landingIds: new Set([landingId]), advisorIds: new Set([advisorId]),
      deviceId, username: "", password: "", multiSkinEnabled: true, asesDelNorteEnabled: true, ganamosNetEnabled: true,
    };
    dependencies.demoConfig = () => config;
    dependencies.resolveAccount = async () => { throw new Error("API2 must not be called"); };
    const originalHandoff = dependencies.createHandoff;
    dependencies.createHandoff = async (...args) => ({
      ...await originalHandoff(...args), provider_username: "gateway-demo",
    });
    let releaseLink!: () => void;
    let linkStarted!: () => void;
    const started = new Promise<void>(resolve => { linkStarted = resolve; });
    const pendingLink = new Promise<void>(resolve => { releaseLink = resolve; });
    const originalLink = dependencies.linkProviderAccount;
    dependencies.linkProviderAccount = async (...args) => {
      linkStarted();
      await pendingLink;
      return originalLink(...args);
    };
    const providerEnv = {
      ...env, MULTI_SKIN_GATEWAY_ORIGIN: env.REY_GATEWAY_ORIGIN,
      ASES_DEL_NORTE_GATEWAY_ORIGIN: env.REY_GATEWAY_ORIGIN, GANAMOS_NET_GATEWAY_ORIGIN: env.REY_GATEWAY_ORIGIN,
    };
    const instant = Date.now();
    const prepared = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Template7-Demo-Context": "testing",
        Cookie: `lb_cid=${deviceId}; t7_demo=${createDemoSession(landingId, payload.landing_slug, config)}`,
      },
      body: JSON.stringify({ ...payload, attribution: {
        target_provider: provider, ...(provider === "multi_skin" ? { skin_code: "ganamos_plus" } : {}),
      } }),
    }), providerEnv, instant);
    assert.equal(prepared.status, 200);
    const { handoff_url } = await prepared.json();
    const privateRequest = (body: unknown) => new Request("https://mkt.example.com/api/template7/preparations/account", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
      body: JSON.stringify(body),
    });
    let responded = false;
    const responsePromise = handleTemplate7PreparationAccount(
      privateRequest({ token: new URL(handoff_url).searchParams.get("t") }), providerEnv, dependencies, instant,
    ).then(response => { responded = true; return response; });
    await started;
    assert.equal(responded, false, "must wait until the provider account is linked");
    releaseLink();
    const response = await responsePromise;
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["continuation_token", "handoff_url", "username"]);
    assert.equal(body.username, "gateway-demo");
    assert.equal(body.handoff_url, "https://gateway.example.com/start?t=handoff");
    assert.deepEqual(trace, { links: 1, handoffs: 1 });
    const legacy = await handleTemplate7PreparationFinalize(
      privateRequest({ continuation_token: body.continuation_token }), providerEnv, dependencies, instant + 1000,
    );
    assert.equal(legacy.status, 200);
    assert.deepEqual(await legacy.json(), { handoff_url: body.handoff_url });
    assert.deepEqual(trace, { links: 1, handoffs: 1 }, "legacy finalize must not issue or link twice");
  });
}
