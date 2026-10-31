import assert from "node:assert/strict";
import test from "node:test";
import type { StartDependencies } from "../lib/reyDeAses/start.server";
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

test("failed account preparation preserves only validated diagnostics and Retry-After", async () => {
  const at = Date.now();
  const context = { flow_id: "99999999-9999-4999-8999-999999999999", landing_id: landingId, template: 7,
    telemetry_origin: "https://landing.panelbotadmin.com", started_at: at };
  const issued = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `lb_cid=${deviceId}` },
    body: JSON.stringify({ ...payload, entry_funnel: context }),
  }), env, at);
  assert.equal(issued.status, 200);
  const token = new URL((await issued.json()).handoff_url).searchParams.get("t");
  const dependencies = deps(); dependencies.allowStart = async () => false;
  const incoming = () => new Request("https://mkt.example.com/api/template7/preparations/account", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({ token }),
  });
  const failed = await handleTemplate7PreparationAccount(incoming(), env, dependencies, at + 1000);
  assert.equal(failed.status, 429);
  assert.match(failed.headers.get("retry-after") || "", /^\d+$/);
  const text = await failed.text();
  assert.deepEqual(JSON.parse(text).entry_funnel, context);
  assert.doesNotMatch(text, /Martin|secret|password|p1\./);
});

test("diagnostic context follows the confirmed account handoff; invalid context never blocks entry", async () => {
  const at = Date.now();
  const context = { flow_id: "99999999-9999-4999-8999-999999999999", landing_id: landingId, template: 7,
    telemetry_origin: "https://landing.panelbotadmin.com", started_at: at };
  for (const candidate of [context, { ...context, landing_id: ownerId }, { ...context, telemetry_origin: "https://evil.test" }]) {
    const issued = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: `lb_cid=${deviceId}` },
      body: JSON.stringify({ ...payload, entry_funnel: candidate }),
    }), env, at);
    assert.equal(issued.status, 200);
    const token = new URL((await issued.json()).handoff_url).searchParams.get("t");
    const dependencies = deps(); let captured: unknown;
    dependencies.createHandoff = async (_provider,_advisor,_device, _player, account,_skin,_promo,entryFunnel) => {
      assert.equal(account.username,"player"); captured = entryFunnel;
      return { handoff_url:"https://gateway.example.com/start?t=handoff",expires_at:"2026-10-30T23:59:59Z",binding_created:false };
    };
    const response = await handleTemplate7PreparationAccount(new Request("https://mkt.example.com/api/template7/preparations/account", {
      method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}`},body:JSON.stringify({token}),
    }),env,dependencies,at+1000);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.username,"player");
    assert.deepEqual(captured,candidate===context?context:undefined);
    assert.deepEqual(body.entry_funnel,candidate===context?context:undefined);
  }
});

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

test("account finaliza en el mismo viaje y finalize compatible no duplica la vinculación", async () => {
  const token = await prepareToken();
  const trace = { links: 0, handoffs: 0 };
  const dependencies = deps(trace);
  const account = await handleTemplate7PreparationAccount(new Request("https://mkt.example.com/api/template7/preparations/account", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({ token }),
  }), env, dependencies, now + 1000);

  assert.equal(account.status, 200);
  assert.match(account.headers.get("Server-Timing") || "", /^t7-account;dur=\d+;desc="recovered", t7-identity;dur=\d+, t7-link;dur=\d+, t7-handoff;dur=\d+, t7-finalize;dur=\d+, t7-total;dur=\d+$/);
  const rawAccount = await account.text();
  assert.doesNotMatch(rawAccount, /secret|password|clave/i);
  const accountBody = JSON.parse(rawAccount) as { username: string; continuation_token: string };
  assert.equal(accountBody.username, "player");
  assert.equal(Object.hasOwn(accountBody, "handoff_url"), true);
  assert.match(accountBody.continuation_token, /^c1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(accountBody.continuation_token, /player|secret/i);
  assert.deepEqual(trace, { links: 1, handoffs: 1 });

  const finalize = await handleTemplate7PreparationFinalize(new Request("https://mkt.example.com/api/template7/preparations/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({ continuation_token: accountBody.continuation_token }),
  }), env, dependencies, now + 2000);
  assert.equal(finalize.status, 200);
  assert.deepEqual(await finalize.json(), { handoff_url: "https://gateway.example.com/start?t=handoff", username: "player" });
  assert.deepEqual(trace, { links: 1, handoffs: 1 });
});

test("renewing an expired pass preserves the account and never resolves or provisions a player again", async () => {
  const token = await prepareToken();
  const trace = { links: 0, handoffs: 0 }, dependencies = deps(trace);
  const account = await handleTemplate7PreparationAccount(new Request("https://mkt.example.com/api/template7/preparations/account", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({token}),
  }), env, dependencies, now + 1000);
  const {continuation_token} = await account.json() as {continuation_token:string};
  dependencies.resolvePlayer = async () => { throw Error("must not resolve another identity"); };
  dependencies.resolveAccount = async () => { throw Error("must not create another account"); };
  dependencies.createHandoff = async (_provider, _advisor, _device, player, selected) => {
    assert.equal(player.player_id, playerId); assert.equal(player.player_provider_account_id, providerAccountId);
    assert.equal(selected.username, "player"); trace.handoffs++;
    return {handoff_url:"https://gateway.example.com/start?t=fresh-pass",expires_at:"2026-10-29T23:00:00Z",binding_created:false};
  };
  const renewed = await handleTemplate7PreparationFinalize(new Request("https://mkt.example.com/api/template7/preparations/finalize", {
    method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}`},
    body:JSON.stringify({continuation_token,renew_handoff:true}),
  }), env, dependencies, now + 2000);
  assert.equal(renewed.status,200);
  assert.deepEqual(await renewed.json(),{handoff_url:"https://gateway.example.com/start?t=fresh-pass",username:"player"});
  assert.deepEqual(trace,{links:2,handoffs:2});
});

test("finalize and renewal ignore unrelated parameters while preserving the signed account and strict access fields", async () => {
  const token = await prepareToken();
  for (const suffix of ["&ef=e1.diagnostic", "&ef=e1.one&ef=e1.two", "&fbclid=foreign", "&new_meta_field=x&new_meta_field=y&provider=evil&advisor_id=foreign&return_to=https://evil.test", "#unexpected"]) {
    const valid = !suffix.includes('ef=e1.two') && !suffix.startsWith('#');
    const dependencies = deps();
    let handoffs = 0;
    dependencies.createHandoff = async () => {
      handoffs++;
      return { handoff_url: `https://gateway.example.com/start?t=pass-${handoffs}${suffix}`, expires_at: "2026-10-30T23:59:59Z", binding_created: false };
    };
    const account = await handleTemplate7PreparationAccount(new Request("https://mkt.example.com/api/template7/preparations/account", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
      body: JSON.stringify({ token }),
    }), env, dependencies, now + 1000);
    assert.equal(account.status, 200);
    const { continuation_token } = await account.json();
    dependencies.resolvePlayer = async () => { throw Error("must preserve player"); };
    dependencies.resolveAccount = async () => { throw Error("must preserve account"); };
    for (const renew_handoff of [false, true]) {
      const response = await handleTemplate7PreparationFinalize(new Request("https://mkt.example.com/api/template7/preparations/finalize", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
        body: JSON.stringify({ continuation_token, renew_handoff }),
      }), env, dependencies, now + 2000);
      if (valid) {
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { handoff_url: `https://gateway.example.com/start?t=pass-${renew_handoff ? 2 : 1}${suffix === '&ef=e1.diagnostic' ? suffix : ''}`, username: "player" });
      } else assert.equal(response.status, 410);
    }
    assert.equal(handoffs, valid ? 2 : 1);
  }
});

test("stage timings preserve parallel link and handoff work and never expose identity or credentials", { timeout: 1000 }, async () => {
  const token = await prepareToken();
  const dependencies = deps();
  dependencies.resolveContext = async () => ({
    status: "ok",
    landing: (await dependencies.db.landing(landingId))!,
    provider: "rey_de_ases",
    advisor: (await dependencies.db.advisor(clientId))!,
  });
  let releaseLink!: () => void;
  const handoffStarted = new Promise<void>(resolve => { releaseLink = resolve; });
  const originalLink = dependencies.linkProviderAccount;
  const originalHandoff = dependencies.createHandoff;
  let links = 0, handoffs = 0;
  dependencies.linkProviderAccount = async (...args) => {
    links++;
    await handoffStarted;
    return originalLink(...args);
  };
  dependencies.createHandoff = async (...args) => {
    handoffs++;
    releaseLink();
    return originalHandoff(...args);
  };
  const response = await handleTemplate7PreparationAccount(new Request("https://mkt.example.com/api/template7/preparations/account", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TEMPLATE7_PREPARATION_API_KEY}` },
    body: JSON.stringify({ token }),
  }), env, dependencies, now + 1000);
  assert.equal(response.status, 200);
  assert.equal(links, 1);
  assert.equal(handoffs, 1);
  const timing = response.headers.get("Server-Timing") || "";
  assert.match(timing, /^t7-account;dur=\d+;desc="recovered", t7-context;dur=\d+, t7-identity;dur=\d+, t7-link;dur=\d+, t7-handoff;dur=\d+, t7-finalize;dur=\d+, t7-total;dur=\d+$/);
  assert.doesNotMatch(timing, /player|secret|gera|11111111|33333333/);
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

test("Bet30 preparation uses the generic gateway and carries only a cosmetic skin hint", async () => {
  const response = await handleTemplate7Prepare(new Request("https://mkt.example.com/api/template7/prepare", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `lb_cid=${deviceId}` },
    body: JSON.stringify({ ...payload, attribution: { target_provider: "multi_skin", skin_code: "bet30" } }),
  }), { ...env, MULTI_SKIN_GATEWAY_ORIGIN: "https://shared.example.workers.dev", GANAMOS_PLUS_GATEWAY_ORIGIN: "https://plus.example" }, now);
  assert.equal(response.status, 200);
  const url = new URL((await response.json()).handoff_url);
  assert.equal(url.origin, 'https://shared.example.workers.dev');
  assert.equal(url.searchParams.get('skin'), 'bet30');
  assert.match(url.searchParams.get('t') || '', /^p1\./);
  assert.equal(url.searchParams.size, 2);
});
