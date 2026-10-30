import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleManagerDestinations, type DestinationBackend } from "../lib/atrio/managerDestinations.server";
import { handleTemplate7Destination, productionDestinationBackend, type DestinationContext, type DestinationResolutionBackend } from "../lib/atrio/template7Destination.server";
import { template7WarmRateLimitKeys } from "../lib/reyDeAses/rateLimit.server";

const ids = {
  landing: "11111111-1111-4111-8111-111111111111", client: "22222222-2222-4222-8222-222222222222",
  advisor: "33333333-3333-4333-8333-333333333333", otherAdvisor: "44444444-4444-4444-8444-444444444444",
  connection: "55555555-5555-4555-8555-555555555555", device: "66666666-6666-4666-8666-666666666666",
};
const client = { id: ids.client, atrio_id: ids.advisor, slug: "gera", user_id: "owner", workspace_currency: "ARS" };
const landing = { id: ids.landing, name: "test", user_id: "owner", workspace_currency: "ARS", config: { template: "template7", ctaDestination: "atrio", targetProvider: "ganamos_net" } };
const request = (body: object) => new Request("https://builder.test/api/atrio/manager-destinations", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "https://builder.test", Authorization: "Bearer test" }, body: JSON.stringify(body),
});
const calls: { action: string; input: unknown }[] = [];
function backend(overrides: Partial<DestinationBackend> = {}): DestinationBackend {
  return {
    authenticate: async () => true, clients: async () => [client], landing: async () => landing, workspaceClients: async () => [client],
    call: async (action, input) => { calls.push({ action, input }); return { ok: true }; },
    assign: async () => {}, ...overrides,
  };
}
const configure = { action: "configure", landingId: ids.landing, targetProvider: "ganamos_net", mode: "fixed", criterion: "usage_count", destinations: [{ connection_id: ids.connection, weight: 1 }] };

test("configuration derives all allowed advisors from the owned workspace, never client supplied IDs", async () => {
  calls.length = 0;
  const response = await handleManagerDestinations(request({ ...configure, allowed_advisor_ids: [ids.otherAdvisor] }), backend());
  assert.equal(response.status, 200);
  assert.deepEqual((calls[0].input as { allowed_advisor_ids: string[] }).allowed_advisor_ids, [ids.advisor]);
});
test("directory denies IDs filtered out by actor ownership", async () => {
  let contacted = false;
  const response = await handleManagerDestinations(request({ action: "directory", clientIds: [ids.client] }), backend({ clients: async () => [], call: async () => { contacted = true; return {}; } }));
  assert.equal(response.status, 403); assert.equal(contacted, false);
});

test("metric resets derive advisor scope from owned clients and cannot reset another actor", async () => {
  calls.length = 0;
  const payload = { action: "reset", clientIds: [ids.client], metric: "messages_received", advisor_ids: [ids.otherAdvisor] };
  assert.equal((await handleManagerDestinations(request(payload), backend())).status, 200);
  assert.deepEqual(calls, [{ action: "reset", input: { advisor_ids: [ids.advisor], metric: "messages_received" } }]);
  calls.length = 0;
  assert.equal((await handleManagerDestinations(request(payload), backend({ clients: async () => [] }))).status, 403);
  assert.equal((await handleManagerDestinations(request(payload), backend({ authenticate: async () => false }))).status, 401);
  for (const invalid of [{ ...payload, metric: "messages" }, { ...payload, clientIds: [] }, { ...payload, clientIds: ["invalid"] }]) {
    assert.equal((await handleManagerDestinations(request(invalid), backend())).status, 400);
  }
  const crossOrigin = request(payload); crossOrigin.headers.set("origin", "https://elsewhere.test");
  assert.equal((await handleManagerDestinations(crossOrigin, backend())).status, 403);
  assert.equal(calls.length, 0);
});
test("configuration rejects wrong landing casino and no backend write occurs", async () => {
  calls.length = 0;
  assert.equal((await handleManagerDestinations(request({ ...configure, targetProvider: "rey_de_ases" }), backend())).status, 409);
  assert.equal(calls.length, 0);
});

test("an owned editor can read another casino's destinations before saving a casino change", async () => {
  calls.length = 0;
  const response = await handleManagerDestinations(request({ action: "configuration", landingId: ids.landing, targetProvider: "rey_de_ases" }), backend());
  assert.equal(response.status, 200);
  const call = calls.find(call => call.action === "configuration")!;
  assert.equal((call.input as { target_provider: string }).target_provider, "rey_de_ases");
  assert.deepEqual((call.input as { allowed_advisor_ids: string[] }).allowed_advisor_ids, [ids.advisor]);
  assert.ok(calls.every(call => call.action !== "configure"));
});

test("a newly created Template 1 landing can load all Atrio destinations before its first save", async () => {
  calls.length = 0;
  let assignments = 0;
  const fresh = { ...landing, config: { template: "template1", ctaDestination: "whatsapp" } };
  const deps = backend({
    landing: async () => fresh,
    call: async (action, input) => { calls.push({ action, input }); return action === "configuration" ? { configuration: null } : { advisors: [] }; },
    assign: async () => { assignments++; },
  });
  const targetProviders = ["ganamos_net", "rey_de_ases", "ases_del_norte"];
  const response = await handleManagerDestinations(request({ action: "configurations", landingId: ids.landing, targetProviders, allowed_advisor_ids: [ids.otherAdvisor] }), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { configurations: Object.fromEntries(targetProviders.map(provider => [provider, null])), directory: { advisors: [] } });
  assert.equal(calls.filter(call => call.action === "directory").length, 1);
  assert.equal(calls.filter(call => call.action === "configuration").length, 3);
  for (const call of calls.filter(call => call.action === "configuration")) {
    assert.equal((call.input as { landing_id: string }).landing_id, ids.landing);
    assert.deepEqual((call.input as { allowed_advisor_ids: string[] }).allowed_advisor_ids, [ids.advisor]);
  }
  assert.deepEqual((calls.find(call => call.action === "directory")!.input as { advisor_ids: string[] }).advisor_ids, [ids.advisor]);
  assert.equal(assignments, 0);
  calls.length = 0;
  assert.equal((await handleManagerDestinations(request({ action: "configuration", landingId: ids.landing, targetProvider: "ganamos_net" }), deps)).status, 200);
  calls.length = 0;
  assert.equal((await handleManagerDestinations(request(configure), deps)).status, 409);
  assert.equal(calls.length, 0);
  assert.equal(assignments, 0);
});

test("batch configuration preserves saved pools and rejects invalid casinos or unavailable ownership scope", async () => {
  const payload = { action: "configurations", landingId: ids.landing, targetProviders: ["ganamos_net", "rey_de_ases"] };
  const saved = { target_provider: "ganamos_net", mode: "fair", criterion: "messages_received", destinations: [{ connection_id: ids.connection, weight: 3 }] };
  const response = await handleManagerDestinations(request(payload), backend({ call: async (action, input) => action === "directory" ? { advisors: [client] } : (input as { target_provider: string }).target_provider === "ganamos_net" ? saved : { configuration: null } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { configurations: { ganamos_net: saved, rey_de_ases: null }, directory: { advisors: [client] } });
  calls.length = 0;
  for (const targetProviders of [undefined, null, [], ["ganamos_net", "ganamos_net"], ["unknown"], "ganamos_net"]) {
    assert.equal((await handleManagerDestinations(request({ ...payload, targetProviders }), backend())).status, 400);
  }
  assert.equal((await handleManagerDestinations(request(payload), backend({ authenticate: async () => false }))).status, 401);
  assert.equal((await handleManagerDestinations(request(payload), backend({ landing: async () => null }))).status, 403);
  assert.equal((await handleManagerDestinations(request(payload), backend({ workspaceClients: async () => [] }))).status, 409);
  const crossOrigin = request(payload); crossOrigin.headers.set("origin", "https://other.test");
  assert.equal((await handleManagerDestinations(crossOrigin, backend())).status, 403);
  assert.equal(calls.length, 0);
});
test("Multi Skin has its own manager pool and never selects the NET provider", async () => {
  calls.length=0;
  const response=await handleManagerDestinations(request({ ...configure, targetProvider: "multi_skin" }),
    backend({landing:async()=>({...landing,config:{...(landing.config as object),targetProvider:"multi_skin"}})}));
  assert.equal(response.status,200);
  assert.ok(calls.some(call=>JSON.stringify(call).includes('multi_skin')));
});
test("fixed mode cannot silently include multiple managers", async () => {
  assert.equal((await handleManagerDestinations(request({ ...configure, destinations: [...configure.destinations, { connection_id: ids.otherAdvisor, weight: 1 }] }), backend())).status, 400);
});
test("pool does not write on anonymous or cross-origin requests", async () => {
  calls.length = 0;
  const crossOrigin = request(configure); crossOrigin.headers.set("origin", "https://elsewhere.test");
  assert.equal((await handleManagerDestinations(crossOrigin, backend())).status, 403);
  assert.equal((await handleManagerDestinations(request(configure), backend({ authenticate: async () => false }))).status, 401);
  assert.equal(calls.length, 0);
});
test("a rejected pool cannot expand advisors on a legacy landing", async () => {
  let assigned = false;
  const response = await handleManagerDestinations(request(configure), backend({
    call: async () => { throw new Error("cross tenant"); },
    assign: async () => { assigned = true; },
  }));
  assert.equal(response.status, 503); assert.equal(assigned, false);
});
function resolutionBackend(overrides: Partial<DestinationResolutionBackend> = {}): DestinationResolutionBackend {
  return {
    context: async () => ({ allowed: true, landing, blocked: false, advisors: [client] }),
    resolve: async () => ({ advisor_id: ids.advisor, advisor_slug: "gera", connection_id: ids.connection, target_provider: "ganamos_net", manager_id: 1041, manager_type: "mkt" }),
    fallback: async () => ({ atrioClientId: client.id, atrioId: ids.advisor, atrioSlug: client.slug }),
    ...overrides,
  };
}
const selection = { landing_id: ids.landing, landing_slug: "test" };
test("public selection returns correct advisor before Contact and never exposes device identity", async () => {
  const response = await handleTemplate7Destination(request(selection), ids.device, resolutionBackend());
  assert.equal(response.status, 200);
  const text = await response.text(); const result = JSON.parse(text);
  assert.equal(result.atrioId, ids.advisor); assert.equal(result.managerId, 1041); assert.equal(result.managerDestination, true);
  assert.equal(text.includes(ids.device), false);
  const timing = response.headers.get("Server-Timing") || "";
  for (const stage of ["scope", "resolve", "total"]) {
    assert.match(timing, new RegExp(`t7-destination-${stage};dur=\\d+`));
  }
  assert.doesNotMatch(timing, /advisor|gera|owner/);
  assert.equal(timing.includes(ids.device), false);
});
test("public selection rejects a returned advisor outside the trusted owner workspace", async () => {
  const response = await handleTemplate7Destination(request(selection), ids.device, resolutionBackend({
    resolve: async () => ({ advisor_id: ids.otherAdvisor, advisor_slug: "other", connection_id: ids.connection, target_provider: "ganamos_net" }),
  }));
  assert.equal(response.status, 403);
});
test("new selection waits for stable identity without generating a competing identity", async () => {
  let called = false;
  const response = await handleTemplate7Destination(request(selection), null, resolutionBackend({ context: async () => { called = true; return { allowed: true, landing, blocked: false, advisors: [client] }; } }));
  assert.equal(response.status, 409); assert.equal(called, false);
});
test("legacy landings without a saved pool retain their prior assignment", async () => {
  const response = await handleTemplate7Destination(request(selection), ids.device, resolutionBackend({ resolve: async () => ({ configuration: null }) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).atrioId, ids.advisor);
  assert.match(response.headers.get("Server-Timing") || "", /t7-destination-fallback;dur=\d+/);
});
test("blocked landing cannot reserve a destination", async () => {
  let reserved = false;
  const response = await handleTemplate7Destination(request(selection), ids.device, resolutionBackend({ context: async () => ({ allowed: true, landing, blocked: true, advisors: [] }), resolve: async () => { reserved = true; return {}; } }));
  assert.equal(response.status, 403); assert.equal(reserved, false);
});
test("rate limited selection cannot access a destination", async () => {
  let resolved = false;
  const response = await handleTemplate7Destination(request(selection), ids.device, resolutionBackend({
    context: async () => ({ allowed: false, landing: null, blocked: true, advisors: [] }),
    resolve: async () => { resolved = true; return {}; },
  }));
  assert.equal(response.status, 429); assert.equal(resolved, false);
  assert.deepEqual(await response.json(), { error: "rate_limited" });
});

test("consolidated context keeps exact landing, provider and workspace checks before selection", async () => {
  const cases = [
    { context: { landing: { ...landing, id: ids.client }, blocked: false, advisors: [client] }, status: 404 },
    { context: { landing: { ...landing, name: "other" }, blocked: false, advisors: [client] }, status: 404 },
    { context: { landing, blocked: false, advisors: [{ ...client, user_id: "foreign" }] }, status: 403 },
    { context: { landing, blocked: false, advisors: [{ ...client, workspace_currency: "PYG" }] }, status: 403 },
    { context: { landing, blocked: false, advisors: [] }, status: 403 },
  ];
  for (const item of cases) {
    let reserved = false;
    const response = await handleTemplate7Destination(request(selection), ids.device, resolutionBackend({
      context: async (landingId, slug) => {
        assert.equal(landingId, ids.landing); assert.equal(slug, "test");
        return { allowed: true, ...item.context };
      },
      resolve: async () => { reserved = true; return {}; },
    }));
    assert.equal(response.status, item.status);
    assert.equal(reserved, false);
  }
});

test("a missing or failed context RPC fails closed instead of restoring separate unchecked reads", async () => {
  let reserved = false;
  const response = await handleTemplate7Destination(request(selection), ids.device, resolutionBackend({
    context: async () => { throw new Error("missing migration"); },
    resolve: async () => { reserved = true; return {}; },
  }));
  assert.equal(response.status, 503);
  assert.equal(reserved, false);
  assert.deepEqual(await response.json(), { error: "destination_unavailable" });
});

test("missing or malformed quota results fail closed before reserving a destination", async () => {
  for (const allowed of [undefined, null, 1, "true", {}]) {
    let resolved = false;
    const response = await handleTemplate7Destination(request(selection), ids.device, resolutionBackend({
      context: async () => ({ allowed, landing, blocked: false, advisors: [client] } as DestinationContext),
      resolve: async () => { resolved = true; return {}; },
    }));
    assert.equal(response.status, 503);
    assert.equal(resolved, false);
  }
});

test("scope receives server identity and engine semantics; the browser cannot supply quota keys or limits", async () => {
  for (const classic of [false, true]) {
    let scoped = false;
    const response = await handleTemplate7Destination(request({ ...selection, ...(classic ? { device_id: ids.device } : {}) }), ids.device, resolutionBackend({
      context: async (landingId, slug, deviceId, receivedRequest, isClassic) => {
        scoped = true;
        assert.equal(landingId, ids.landing); assert.equal(slug, "test");
        assert.equal(deviceId, ids.device); assert.equal(isClassic, classic);
        assert.equal(receivedRequest.headers.get("origin"), "https://builder.test");
        return { allowed: true, landing, blocked: false, advisors: [client] };
      },
    }), classic);
    assert.equal(response.status, 200); assert.equal(scoped, true);
  }
  for (const key of ["p_ip_bucket_key", "p_device_bucket_key", "p_max_hits", "p_consume_device_on_ip_denial"]) {
    let scoped = false;
    const response = await handleTemplate7Destination(request({ ...selection, [key]: "override" }), ids.device, resolutionBackend({
      context: async () => { scoped = true; return { allowed: true, landing, blocked: false, advisors: [client] }; },
    }));
    assert.equal(response.status, 400); assert.equal(scoped, false);
  }
});

test("warm quota keys retain the durable HMAC namespaces and trusted proxy precedence", () => {
  const previous = process.env.TEMPLATE7_RATE_LIMIT_HMAC_KEY;
  process.env.TEMPLATE7_RATE_LIMIT_HMAC_KEY = "unit-test-only-key";
  try {
    const input = request(selection);
    input.headers.set("x-vercel-forwarded-for", "203.0.113.7");
    input.headers.set("x-forwarded-for", "198.51.100.9");
    const hmac = (value: string) => createHmac("sha256", "unit-test-only-key").update(value).digest("hex");
    assert.deepEqual(template7WarmRateLimitKeys(input, ids.device), {
      ip: hmac("warm-ip:203.0.113.7"), device: hmac(`warm-device:${ids.device}`),
    });
  } finally {
    if (previous === undefined) delete process.env.TEMPLATE7_RATE_LIMIT_HMAC_KEY;
    else process.env.TEMPLATE7_RATE_LIMIT_HMAC_KEY = previous;
  }
});

test("production scope makes exactly one database request with server quotas and fails closed on a wrong RPC schema", async () => {
  const envNames = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TEMPLATE7_RATE_LIMIT_HMAC_KEY"] as const;
  const previousEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  const previousFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://scope-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-only-service-key";
  process.env.TEMPLATE7_RATE_LIMIT_HMAC_KEY = "unit-test-only-hmac-key";
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  let responseBody: unknown = { allowed: true, landing, blocked: false, advisors: [client] };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json(responseBody);
  }) as typeof fetch;
  try {
    const sourceRequest = request(selection);
    const scope = productionDestinationBackend();
    for (const classic of [false, true]) {
      requests.length = 0;
      assert.equal((await scope.context(ids.landing, "test", ids.device, sourceRequest, classic)).allowed, true);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, "https://scope-test.supabase.co/rest/v1/rpc/resolve_template7_limited_destination_context");
      const keys = template7WarmRateLimitKeys(sourceRequest, ids.device);
      assert.deepEqual(requests[0].body, {
        p_landing_id: ids.landing, p_landing_slug: "test",
        p_ip_bucket_key: keys.ip, p_device_bucket_key: keys.device,
        p_consume_device_on_ip_denial: !classic,
      });
    }
    for (const malformed of [null, [], {}, { allowed: true, blocked: false }, { allowed: true, blocked: null, advisors: [] }]) {
      responseBody = malformed;
      await assert.rejects(scope.context(ids.landing, "test", ids.device, sourceRequest, false), /invalid context/);
    }
  } finally {
    globalThis.fetch = previousFetch;
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  }
});
