import assert from "node:assert/strict";
import test from "node:test";
import { handleReyStart, type StartDependencies } from "../lib/reyDeAses/start.server";
import { createProviderHandoff, gatewayReadiness, resolveInternalChatPlayer } from "../lib/reyDeAses/integrations.server";
import { createDemoSession, readDemoConfig } from "../lib/reyDeAses/demo.server";
import type { ResolvedPlayer } from "../lib/reyDeAses/contracts";
import type { TargetProvider } from "../lib/landing/types";

const landingId = "11111111-1111-4111-8111-111111111111";
const clientId = "22222222-2222-4222-8222-222222222222";
const advisorId = "33333333-3333-4333-8333-333333333333";
const deviceId = "44444444-4444-4444-8444-444444444444";
const playerId = "55555555-5555-4555-8555-555555555555";
const providerAccountId = "88888888-8888-4888-8888-888888888888";
const multiSkinAccountId = "99999999-9999-4999-8999-999999999999";
const ownerId = "66666666-6666-4666-8666-666666666666";
const demoDeviceId = "77777777-7777-4777-8777-777777777777";

function resolvedPlayer(provider: TargetProvider = "rey_de_ases", resolvedDeviceId = deviceId): ResolvedPlayer {
  return {
    advisor_id: advisorId, advisor_slug: "gera", player_id: playerId, device_id: resolvedDeviceId,
    created: true, player_provider_account_id: provider === "multi_skin" ? multiSkinAccountId : providerAccountId,
    target_provider: provider, provider_account_created: true,
  };
}

function demoConfig() {
  const config = readDemoConfig({
    TEMPLATE7_DEMO_ENABLED: "true",
    TEMPLATE7_DEMO_SESSION_SECRET: "s".repeat(32), TEMPLATE7_DEMO_LANDING_IDS: landingId,
    TEMPLATE7_DEMO_ADVISOR_IDS: advisorId, TEMPLATE7_DEMO_DEVICE_ID: demoDeviceId,
    TEMPLATE7_DEMO_REY_USERNAME: "demo-user", TEMPLATE7_DEMO_REY_PASSWORD: "demo-pass",
  });
  assert.ok(config);
  return config;
}

const validPayload = {
  landing_id: landingId, landing_slug: "landing-7", name: "Martín",
  atrio_client_id: clientId, advisor_id: advisorId, advisor_slug: "gera", promo_code: "LP-a1b2",
  attribution: { utm_campaign: "campana", fbp: "fb.1.123.abc" },
};

function request(payload: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/rey-de-ases/start", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `lb_cid=${deviceId}`, ...headers }, body: JSON.stringify(payload),
  });
}

function dependencies(status: ReturnType<StartDependencies["api2Status"]> = null, provider: unknown = "rey_de_ases") {
  const calls: string[] = [];
  const deps: StartDependencies = {
    db: {
      async landing(id) { calls.push("landing"); return id === landingId ? {
        id: landingId, name: "landing-7", user_id: ownerId, workspace_currency: "ARS",
        config: { template: "template7", ctaDestination: "atrio", targetProvider: provider }, landing_config: { layout: { template: 7 } },
      } : null; },
      async blocked() { calls.push("plan"); return false; },
      async assignment(id, selectedClient) { calls.push("assignment"); return id === landingId && selectedClient === clientId
        ? { landing_id: landingId, atrio_client_id: clientId, user_id: ownerId } : null; },
      async advisor(id) { calls.push("advisor"); return id === clientId
        ? { id: clientId, user_id: ownerId, workspace_currency: "ARS", slug: "gera", atrio_id: advisorId } : null; },
    },
    api2Status() { calls.push("api2-readiness"); return status; },
    gatewayStatus(targetProvider) { calls.push("gateway-readiness:" + targetProvider); return null; },
    async allowStart() { calls.push("rate-limit"); return true; },
    demoConfig() { calls.push("demo-config"); return null; },
    async resolvePlayer(input) {
      calls.push("internal-chat");
      assert.equal(input.advisor.advisorId, advisorId);
      assert.equal(input.deviceId, deviceId);
      assert.equal(input.targetProvider, provider ?? "rey_de_ases");
      assert.equal(input.name, "Martín");
      assert.deepEqual({ landingId: input.landingId, landingSlug: input.landingSlug, promoCode: input.promoCode },
        { landingId, landingSlug: "landing-7", promoCode: "LP-a1b2" });
      return resolvedPlayer(input.targetProvider, input.deviceId);
    },
    async resolveAccount(accountRequest) {
      calls.push("api2");
      assert.deepEqual(accountRequest, { external_user_id: playerId, name: "Martín", target_provider: provider, advisor_id: advisorId, advisor_slug: "gera" });
      return { username: "secret-user", password: "secret-pass", platform: provider as TargetProvider, created: true };
    },
    async createHandoff(targetProvider, advisor, incomingDeviceId, player, account) {
      calls.push("gateway");
      assert.equal(targetProvider, provider ?? "rey_de_ases");
      assert.equal(advisor.advisorSlug, "gera");
      assert.equal(incomingDeviceId, deviceId);
      assert.equal(player.player_id, playerId);
      assert.equal(player.player_provider_account_id, targetProvider === "multi_skin" ? multiSkinAccountId : providerAccountId);
      assert.equal(account.password, "secret-pass");
      return { handoff_url: "https://gateway.example.com/start?t=token", expires_at: "2026-10-08T12:00:00Z", binding_created: true };
    },
  };
  return { deps, calls };
}

test("start rechaza formato, tipo y tamaño inválidos antes de consultar la base", async () => {
  const { deps, calls } = dependencies();
  for (const payload of [{ ...validPayload, name: " " }, { ...validPayload, landing_id: "invalid" }, { ...validPayload, advisor_id: "invalid" }]) {
    const result = await handleReyStart(request(payload), deps);
    assert.equal(result.status, 400);
  }
  assert.equal((await handleReyStart(request(validPayload, { "Content-Type": "text/plain" }), deps)).status, 415);
  assert.equal((await handleReyStart(request(validPayload, { Origin: "https://evil.example" }), deps)).status, 403);
  assert.equal((await handleReyStart(request({ ...validPayload, promo_code: "x".repeat(5000) }), deps)).status, 413);
  assert.deepEqual(calls, []);
});

test("start verifica en servidor landing, plan y asignación exacta del asesor", async () => {
  const { deps, calls } = dependencies();
  const result = await handleReyStart(request({ ...validPayload, advisor_id: deviceId }), deps);
  assert.equal(result.status, 403);
  assert.deepEqual(calls, ["landing", "plan", "rate-limit", "assignment", "advisor"]);
  assert.deepEqual(await result.json(), { error: "advisor_not_assigned" });
  const unassigned = dependencies();
  const unassignedResult = await handleReyStart(request({ ...validPayload, atrio_client_id: deviceId }), unassigned.deps);
  assert.equal(unassignedResult.status, 403);
  assert.deepEqual(unassigned.calls, ["landing", "plan", "rate-limit", "assignment"]);
});

test("start optimizado resuelve validación, límites y asesor en una sola operación", async () => {
  const { deps, calls } = dependencies();
  deps.resolveContext = async () => {
    calls.push("context-transaction");
    return {
      status: "ok",
      provider: "rey_de_ases",
      landing: {
        id: landingId, name: "landing-7", user_id: ownerId, workspace_currency: "ARS",
        config: { template: "template7", ctaDestination: "atrio", targetProvider: "rey_de_ases" },
        landing_config: { layout: { template: 7 } },
      },
      advisor: {
        id: clientId, user_id: ownerId, workspace_currency: "ARS", slug: "gera", atrio_id: advisorId,
      },
    };
  };

  const result = await handleReyStart(request(validPayload), deps);

  assert.equal(result.status, 200);
  assert.deepEqual(calls, [
    "context-transaction", "gateway-readiness:rey_de_ases", "api2-readiness",
    "internal-chat", "api2", "gateway",
  ]);
});

test("sin API2 devuelve error controlado, no llama al gateway y no expone secretos", async () => {
  const { deps, calls } = dependencies("integration_pending");
  const result = await handleReyStart(request(validPayload), deps);
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await result.json(), { error: "integration_pending" });
  assert.ok(!calls.includes("gateway"));
  assert.ok(!calls.includes("internal-chat"));
});

test("el proveedor lo decide la landing, no un valor adulterado del navegador", async () => {
  const { deps } = dependencies(null, "multi_skin");
  const result = await handleReyStart(request({
    ...validPayload,
    target_provider: "rey_de_ases",
    attribution: { ...validPayload.attribution, target_provider: "rey_de_ases" },
  }), deps);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { handoff_url: "https://gateway.example.com/start?t=token" });
});

test("el mismo jugador conserva player_id y obtiene una relacion diferente por proveedor", async () => {
  const accounts: string[] = [];
  for (const provider of ["rey_de_ases", "multi_skin"] as const) {
    const { deps } = dependencies(null, provider);
    deps.createHandoff = async (_provider, _advisor, _deviceId, player) => {
      assert.equal(player.player_id, playerId);
      assert.equal(player.target_provider, provider);
      accounts.push(player.player_provider_account_id);
      return { handoff_url: "https://gateway.example.com/start?t=token", expires_at: "2026-10-08T12:00:00Z", binding_created: true };
    };
    const response = await handleReyStart(request(validPayload), deps);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { handoff_url: "https://gateway.example.com/start?t=token" });
  }
  assert.deepEqual(accounts, [providerAccountId, multiSkinAccountId]);
});

test("proveedor invalido en la landing se rechaza antes de API2", async () => {
  const { deps, calls } = dependencies(null, "otro_proveedor");
  const result = await handleReyStart(request(validPayload), deps);
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: "integration_pending" });
  assert.deepEqual(calls, ["landing"]);
});

test("Template 7 anterior al selector conserva Rey de Ases", async () => {
  const { deps } = dependencies(null, null);
  deps.resolveAccount = async (accountRequest) => {
    assert.equal(accountRequest.target_provider, "rey_de_ases");
    return { username: "legacy-user", password: "secret-pass", platform: "rey_de_ases", created: false };
  };
  const result = await handleReyStart(request(validPayload), deps);
  assert.equal(result.status, 200);
});

test("Multi Skin permanece pendiente sin inventar un handoff", async () => {
  assert.equal(gatewayReadiness("multi_skin"), "integration_pending");
  const { deps, calls } = dependencies();
  deps.gatewayStatus = gatewayReadiness;
  const result = await handleReyStart(request(validPayload), {
    ...deps,
    db: { ...deps.db, landing: async () => ({
      id: landingId, name: "landing-7", user_id: ownerId, workspace_currency: "ARS",
      config: { template: "template7", ctaDestination: "atrio", targetProvider: "multi_skin" },
      landing_config: { layout: { template: 7 } },
    }) },
  });
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: "integration_pending" });
  assert.ok(!calls.includes("api2"));
  assert.ok(!calls.includes("internal-chat"));
});

test("con toda la cadena disponible el navegador recibe solo handoff_url", async () => {
  const { deps, calls } = dependencies();
  const result = await handleReyStart(request(validPayload), deps);
  assert.equal(result.status, 200);
  const body = await result.text();
  assert.deepEqual(JSON.parse(body), { handoff_url: "https://gateway.example.com/start?t=token" });
  assert.deepEqual(calls, ["landing", "plan", "rate-limit", "assignment", "advisor", "gateway-readiness:rey_de_ases", "api2-readiness", "internal-chat", "api2", "gateway"]);
  assert.doesNotMatch(body, /secret-user|secret-pass|api_key/i);
});

test("device_id adulterado en JSON se ignora; internal-chat y gateway reciben la cookie", async () => {
  const { deps } = dependencies();
  const result = await handleReyStart(request({ ...validPayload, device_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), deps);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("set-cookie"), null);
});

test("dos starts concurrentes para la misma cookie solo avanzan una vez", async () => {
  const { deps, calls } = dependencies();
  const claimed = new Set<string>();
  deps.allowStart = async (_request, id, cid) => {
    const key = `${id}:${cid}`;
    if (claimed.has(key)) return false;
    claimed.add(key);
    return true;
  };
  const [first, second] = await Promise.all([
    handleReyStart(request(validPayload), deps),
    handleReyStart(request(validPayload), deps),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 429]);
  assert.equal(calls.filter((call) => call === "internal-chat").length, 1);
  assert.equal(calls.filter((call) => call === "api2").length, 1);
  assert.equal(calls.filter((call) => call === "gateway").length, 1);
});

test("start sin bootstrap crea lb_cid en servidor y usa ese mismo UUID", async () => {
  const { deps } = dependencies();
  let canonical = "";
  deps.resolvePlayer = async (input) => {
    canonical = input.deviceId;
    return resolvedPlayer(input.targetProvider, input.deviceId);
  };
  deps.createHandoff = async (_provider, _advisor, cid) => {
    assert.equal(cid, canonical);
    return { handoff_url: "https://gateway.example.com/start?t=token", expires_at: "2026-10-08T12:00:00Z", binding_created: true };
  };
  const result = await handleReyStart(request(validPayload, { Cookie: "lb_cid=invalid" }), deps);
  assert.equal(result.status, 200);
  assert.match(canonical, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.match(result.headers.get("set-cookie") || "", new RegExp(`^lb_cid=${canonical};`));
  assert.deepEqual(await result.json(), { handoff_url: "https://gateway.example.com/start?t=token" });
});

test("demo válida mantiene validaciones, limita con lb_cid y solo sustituye API2", async () => {
  const { deps, calls } = dependencies();
  const cfg = demoConfig();
  const token = createDemoSession(landingId, "landing-7", cfg);
  deps.demoConfig = () => { calls.push("demo-config"); return cfg; };
  deps.allowStart = async (_request, id, cid) => { calls.push("rate-limit"); assert.equal(id, landingId); assert.equal(cid, deviceId); return true; };
  deps.api2Status = () => { throw Error("API2 must not be called"); };
  deps.resolveAccount = async () => { throw Error("API2 must not be called"); };
  deps.resolvePlayer = async (input) => {
    calls.push("internal-chat");
    assert.equal(input.deviceId, demoDeviceId);
    assert.equal(input.landingId, landingId);
    assert.equal(input.targetProvider, "rey_de_ases");
    return { ...resolvedPlayer(input.targetProvider, demoDeviceId), created: false, provider_account_created: false };
  };
  deps.createHandoff = async (provider, _advisor, cid, _player, account) => {
    calls.push("gateway");
    assert.equal(provider, "rey_de_ases");
    assert.equal(cid, demoDeviceId);
    assert.deepEqual(account, { username: "demo-user", password: "demo-pass", platform: "rey_de_ases", created: false });
    return { handoff_url: "https://gateway.example.com/start?t=demo", expires_at: "2026-10-08T12:00:00Z", binding_created: true };
  };
  const result = await handleReyStart(request(validPayload, {
    Cookie: `lb_cid=${deviceId}; t7_demo=${token}`, "X-Template7-Demo-Context": "testing",
  }), deps);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { handoff_url: "https://gateway.example.com/start?t=demo" });
  assert.deepEqual(calls, ["landing", "demo-config", "plan", "rate-limit", "assignment", "advisor", "gateway-readiness:rey_de_ases", "internal-chat", "gateway"]);
});

test("ruta normal ignora cookie demo; indicador sin sesión no autoriza", async () => {
  const { deps, calls } = dependencies("integration_pending");
  const token = createDemoSession(landingId, "landing-7", demoConfig());
  const normal = await handleReyStart(request(validPayload, { Cookie: `lb_cid=${deviceId}; t7_demo=${token}` }), deps);
  assert.equal(normal.status, 503);
  assert.deepEqual(await normal.json(), { error: "integration_pending" });
  assert.ok(!calls.includes("demo-config"));
  const spoofed = await handleReyStart(request({ ...validPayload, demo: true }, { "X-Template7-Demo-Context": "testing" }), deps);
  assert.equal(spoofed.status, 403);
  assert.deepEqual(await spoofed.json(), { error: "demo_not_authorized" });
  assert.ok(!calls.includes("demo-config"));
});

test("demo adulterada u otra landing y asesor no permitido no llegan a internal-chat", async () => {
  const cfg = demoConfig();
  const token = createDemoSession(landingId, "landing-7", cfg);
  const { deps, calls } = dependencies();
  deps.demoConfig = () => cfg;
  for (const cookie of [`${token}x`, createDemoSession(landingId, "otra-landing", cfg)]) {
    const result = await handleReyStart(request(validPayload, {
      Cookie: `lb_cid=${deviceId}; t7_demo=${cookie}`, "X-Template7-Demo-Context": "testing",
    }), deps);
    assert.equal(result.status, 403);
  }
  assert.ok(!calls.includes("internal-chat"));
  const noAdvisor = readDemoConfig({
    TEMPLATE7_DEMO_ENABLED: "true",
    TEMPLATE7_DEMO_SESSION_SECRET: "s".repeat(32), TEMPLATE7_DEMO_LANDING_IDS: landingId,
    TEMPLATE7_DEMO_ADVISOR_IDS: deviceId, TEMPLATE7_DEMO_DEVICE_ID: demoDeviceId,
    TEMPLATE7_DEMO_REY_USERNAME: "demo-user", TEMPLATE7_DEMO_REY_PASSWORD: "demo-pass",
  });
  assert.ok(noAdvisor);
  deps.demoConfig = () => noAdvisor;
  const denied = await handleReyStart(request(validPayload, {
    Cookie: `lb_cid=${deviceId}; t7_demo=${token}`, "X-Template7-Demo-Context": "testing",
  }), deps);
  assert.equal(denied.status, 403);
  assert.ok(!calls.includes("internal-chat"));
});

test("demo no omite bloqueo del plan ni asignación real del asesor", async () => {
  const cfg = demoConfig();
  const headers = {
    Cookie: `lb_cid=${deviceId}; t7_demo=${createDemoSession(landingId, "landing-7", cfg)}`,
    "X-Template7-Demo-Context": "testing",
  };
  const blocked = dependencies();
  blocked.deps.demoConfig = () => cfg;
  blocked.deps.db.blocked = async () => true;
  const blockedResult = await handleReyStart(request(validPayload, headers), blocked.deps);
  assert.equal(blockedResult.status, 403);
  assert.ok(!blocked.calls.includes("internal-chat"));

  const unassigned = dependencies();
  unassigned.deps.demoConfig = () => cfg;
  const unassignedResult = await handleReyStart(request({ ...validPayload, atrio_client_id: demoDeviceId }, headers), unassigned.deps);
  assert.equal(unassignedResult.status, 403);
  assert.deepEqual(await unassignedResult.json(), { error: "advisor_not_assigned" });
  assert.ok(!unassigned.calls.includes("internal-chat"));
});

test("Multi Skin nunca usa la cuenta demo de Rey de Ases", async () => {
  const { deps, calls } = dependencies(null, "multi_skin");
  const cfg = demoConfig();
  deps.demoConfig = () => cfg;
  const token = createDemoSession(landingId, "landing-7", cfg);
  const result = await handleReyStart(request(validPayload, {
    Cookie: `lb_cid=${deviceId}; t7_demo=${token}`, "X-Template7-Demo-Context": "testing",
  }), deps);
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: "integration_pending" });
  assert.ok(!calls.includes("internal-chat") && !calls.includes("gateway") && !calls.includes("api2"));
});

test("respuesta de internal-chat con device_id alterado produce upstream_unavailable", async () => {
  const { deps } = dependencies();
  deps.resolvePlayer = async () => resolvedPlayer("rey_de_ases", demoDeviceId);
  const result = await handleReyStart(request(validPayload), deps);
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: "upstream_unavailable" });
});

test("respuesta inconsistente de internal-chat nunca llega a API2 ni al gateway", async () => {
  const invalid: Array<[string, Record<string, unknown>]> = [
    ["advisor_id", { advisor_id: clientId }],
    ["advisor_slug", { advisor_slug: "otro" }],
    ["device_id", { device_id: demoDeviceId }],
    ["player_id", { player_id: "invalid" }],
    ["player_provider_account_id", { player_provider_account_id: "invalid" }],
    ["target_provider", { target_provider: "multi_skin" }],
    ["created", { created: "true" }],
    ["provider_account_created", { provider_account_created: null }],
  ];
  for (const [field, change] of invalid) {
    const { deps, calls } = dependencies();
    deps.resolvePlayer = async () => ({ ...resolvedPlayer(), ...change }) as ResolvedPlayer;
    const response = await handleReyStart(request(validPayload), deps);
    assert.equal(response.status, 503, field);
    assert.deepEqual(await response.json(), { error: "upstream_unavailable" }, field);
    assert.ok(!calls.includes("api2") && !calls.includes("gateway"), field);
  }
});

test("adaptadores usan contrato servidor-servidor y no exponen credenciales", async () => {
  const originalFetch = globalThis.fetch;
  const oldChatOrigin = process.env.INTERNAL_CHAT_ORIGIN;
  const oldChatKey = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
  const oldGatewayOrigin = process.env.REY_GATEWAY_ORIGIN;
  const oldGatewayKey = process.env.REY_GATEWAY_HANDOFF_API_KEY;
  process.env.INTERNAL_CHAT_ORIGIN = "https://chat.example.com";
  process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY = "test-chat-key";
  process.env.REY_GATEWAY_ORIGIN = "https://gateway.example.com";
  process.env.REY_GATEWAY_HANDOFF_API_KEY = "test-gateway-key";
  const advisor = { atrioClientId: clientId, advisorId, advisorSlug: "gera" };
  try {
    for (const provider of ["rey_de_ases", "multi_skin"] as const) {
      globalThis.fetch = async (input, init) => {
        assert.equal(String(input), "https://chat.example.com/api/gateway/players/resolve");
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-chat-key");
        assert.deepEqual(JSON.parse(String(init?.body)), {
          advisor_id: advisorId, advisor_slug: "gera", device_id: deviceId, name: "Martín",
          landing_id: landingId, landing_slug: "landing-7", atrio_client_id: clientId,
          promo_code: "LP-a1b2", target_provider: provider, source: "landing_builder",
        });
        return Response.json(resolvedPlayer(provider));
      };
      const result = await resolveInternalChatPlayer({ advisor, deviceId, name: "Martín", landingId, landingSlug: "landing-7", promoCode: "LP-a1b2", targetProvider: provider });
      assert.equal(result.player_provider_account_id, provider === "rey_de_ases" ? providerAccountId : multiSkinAccountId);
      assert.equal(result.target_provider, provider);
    }
    const player = resolvedPlayer();
    globalThis.fetch = async () => Response.json(resolvedPlayer("rey_de_ases", demoDeviceId));
    await assert.rejects(
      resolveInternalChatPlayer({ advisor, deviceId, name: "Martín", landingId, landingSlug: "landing-7", promoCode: "LP-a1b2", targetProvider: "rey_de_ases" }),
      { code: "upstream_unavailable" },
    );
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://gateway.example.com/api/handoffs");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-gateway-key");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        advisor_id: advisorId, advisor_slug: "gera", device_id: deviceId,
        external_user_id: playerId, player_provider_account_id: providerAccountId,
        target_provider: "rey_de_ases", platform: "rey_de_ases",
        username: "test-user", password: "test-pass", target_path: "/casino/list/home",
      });
      return Response.json({ handoff_url: "https://gateway.example.com/start?t=token", expires_at: "2026-10-08T12:00:00Z", binding_created: true });
    };
    const handoff = await createProviderHandoff("rey_de_ases", advisor, deviceId, player, { username: "test-user", password: "test-pass", platform: "rey_de_ases", created: true });
    assert.equal(handoff.handoff_url, "https://gateway.example.com/start?t=token");
    await assert.rejects(createProviderHandoff("rey_de_ases", advisor, deviceId,
      { ...player, target_provider: "multi_skin" },
      { username: "test-user", password: "test-pass", platform: "rey_de_ases", created: true }),
    { code: "upstream_unavailable" });
    await assert.rejects(createProviderHandoff("rey_de_ases", advisor, deviceId,
      { ...player, player_provider_account_id: "invalid" },
      { username: "test-user", password: "test-pass", platform: "rey_de_ases", created: true }),
    { code: "upstream_unavailable" });
    await assert.rejects(createProviderHandoff("multi_skin", advisor, deviceId, player, { username: "test-user", password: "test-pass", platform: "multi_skin", created: true }), { code: "integration_pending" });
  } finally {
    globalThis.fetch = originalFetch;
    if (oldChatOrigin === undefined) delete process.env.INTERNAL_CHAT_ORIGIN; else process.env.INTERNAL_CHAT_ORIGIN = oldChatOrigin;
    if (oldChatKey === undefined) delete process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY; else process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY = oldChatKey;
    if (oldGatewayOrigin === undefined) delete process.env.REY_GATEWAY_ORIGIN; else process.env.REY_GATEWAY_ORIGIN = oldGatewayOrigin;
    if (oldGatewayKey === undefined) delete process.env.REY_GATEWAY_HANDOFF_API_KEY; else process.env.REY_GATEWAY_HANDOFF_API_KEY = oldGatewayKey;
  }
});
