import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { buildLandingPhoneRequestFactoryScript } from "../lib/landing/landingPhoneRequest.client";
import { canUseCachedLandingPhone } from "../lib/landing/phoneCachePolicy";

const config = { slug: "fixture", supabaseUrl: "https://synthetic.invalid/", supabaseAnonKey: "synthetic-public-key" };
const payload = { phone: "5491100000000", gerenciaId: 17, assignedGerenciaName: "fixture" };
const drain = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function fixture(legacy?: Promise<unknown>) {
  let now = 100000, sequence = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const requests: Array<{ url: string; init: RequestInit; resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];
  const context: Record<string, any> = {
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback: () => void, delay: number) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: (id: number) => timers.delete(id),
    fetch: (url: string, init: RequestInit) => new Promise((resolve, reject) => requests.push({ url, init, resolve, reject })),
    __PUBLIC_LANDING_PHONE_PROMISES: legacy ? { fixture: legacy } : undefined,
  };
  context.window = context;
  vm.createContext(context);
  const install = () => vm.runInContext(`(${buildLandingPhoneRequestFactoryScript()})()`, context);
  const client = install();
  return { context, requests, client, install,
    advance: async (ms: number) => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } await drain(); },
    respond: (index: number, data: unknown = payload, status = 200) => requests[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => data }),
  };
}

test("prewarm, journey and clicks share one pending request with the same endpoint and authentication", async () => {
  const f = fixture(), first = f.client.request(config);
  assert.equal(f.install(), f.client);
  assert.equal(f.client.request(config, true), first);
  assert.equal(f.client.reset(config.slug), false);
  await drain();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, "https://synthetic.invalid/functions/v1/landing-phone?name=fixture");
  assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].init)), { method: "GET", headers: { apikey: config.supabaseAnonKey, Authorization: "Bearer " + config.supabaseAnonKey }, cache: "default", keepalive: true });
  f.respond(0);
  assert.equal((await first.promise).outcome, "ready");
  assert.deepEqual(await f.context.__PUBLIC_LANDING_PHONE_PROMISES.fixture, payload);
  assert.equal(f.client.request(config, true), first, "a successful assignment is reused until the explicit return reset");
});

test("a 15s visual timeout does not abort or replace a pending assignment; another wait receives its late result", async () => {
  const f = fixture(), first = f.client.request(config);
  const wait = f.client.wait(first, 15000);
  await drain(); await f.advance(15000);
  assert.equal((await wait).outcome, "timeout");
  assert.equal(first.settled, false);
  assert.equal(f.client.request(config, true), first);
  const next = f.client.wait(first, 15000);
  f.respond(0); await drain();
  assert.equal((await next).outcome, "ready");
  assert.equal(f.requests.length, 1);
  assert.equal((await first.promise).duration_ms, 15000);
});

for (const mode of ["empty", "http_error", "network_error", "invalid_response"] as const) test(`closed ${mode} result is retained; only a subsequent manual request retries`, async () => {
  const f = fixture(), first = f.client.request(config); await drain();
  if (mode === "network_error") f.requests[0].reject(new Error("private-network-detail"));
  else if (mode === "http_error") f.respond(0, { error: "private-upstream-detail" }, 503);
  else if (mode === "invalid_response") f.requests[0].resolve({ ok: true, status: 200, json: async () => { throw Error("private-body"); } });
  else f.respond(0, { phone: null });
  const result = await first.promise;
  assert.equal(result.outcome, mode);
  assert.equal(result.status, mode === "network_error" ? undefined : mode === "http_error" ? 503 : 200);
  assert.ok(!JSON.stringify(result).includes("private-"));
  assert.equal(f.client.request(config), first);
  assert.equal(f.requests.length, 1);
  const next = f.client.request(config, true); await drain();
  assert.notEqual(next, first); assert.equal(f.requests.length, 2);
  assert.equal(f.client.request(config, true), next);
  f.respond(1); assert.equal((await next.promise).outcome, "ready");
});

test("legacy cached prewarm promises remain compatible and their missing error cause is not invented", async () => {
  let resolve!: (data: unknown) => void;
  const legacy = new Promise<unknown>(done => { resolve = done; });
  const f = fixture(legacy), request = f.client.request(config, true); await drain();
  assert.equal(f.requests.length, 0);
  assert.equal(f.context.__PUBLIC_LANDING_PHONE_PROMISES.fixture, legacy);
  assert.equal(f.client.reset(config.slug), false);
  resolve(null);
  assert.equal((await request.promise).outcome, "legacy_unknown");
  assert.equal(request.result.status, undefined);
  assert.equal(request.result.duration_ms, undefined);
  f.client.request(config, true); await drain(); assert.equal(f.requests.length, 1);
});

test("legacy successful prewarm and fresh initial data retain the selected number without another request", async () => {
  const f = fixture(Promise.resolve(payload));
  assert.equal((await f.client.request(config).promise).outcome, "ready");
  assert.equal(f.requests.length, 0);
  const fresh = fixture();
  const result = await fresh.client.request({ ...config, initialPhone: { ...payload, cacheRefreshedAt: new Date(100000).toISOString() } }).promise;
  assert.equal(result.outcome, "ready"); assert.equal(result.duration_ms, undefined);
  assert.equal(fresh.requests.length, 0);
});

test("explicit return reset permits a new completed assignment and never invalidates an active one", async () => {
  const f = fixture(), first = f.client.request(config); await drain();
  assert.equal(f.client.reset(config.slug), false);
  f.respond(0); await first.promise;
  assert.equal(f.client.reset(config.slug), true);
  const next = f.client.request(config); await drain();
  assert.equal(f.requests.length, 2); assert.notEqual(next, first);
});

test("SSR and prewarm cache policy bypass fair and weighted quota without extending freshness", async () => {
  const initial = { ...payload, cacheRefreshedAt: new Date(100000).toISOString() };
  assert.equal(canUseCachedLandingPhone(initial, 100000), true);
  assert.equal(canUseCachedLandingPhone(initial, 190001), false);
  for (const policy of [{ phoneMode: "fair" }, { gerenciaSelectionMode: "fair" }, { gerenciaSelectionMode: "weighted_quota" }]) {
    assert.equal(canUseCachedLandingPhone({ ...initial, ...policy }, 100000), false);
    const f = fixture(), request = f.client.request({ ...config, initialPhone: { ...initial, ...policy } });
    await drain(); assert.equal(f.requests.length, 1);
    f.respond(0); await request.promise;
  }
});

test("diagnostic UUID and original navigation correlate whitelisted server phases with actual completion", async () => {
  const f = fixture();
  const requestId = "11111111-1111-4111-8111-111111111111";
  f.context.crypto = { randomUUID: () => requestId };
  f.context.__ENTRY_FUNNEL_NAVIGATION__ = { id: "22222222-2222-4222-8222-222222222222", started_at: 90000 };
  const request = f.client.request(config); await drain();
  assert.equal((f.requests[0].init.headers as Record<string, string>)["x-entry-request-id"], requestId);
  await f.advance(250);
  f.requests[0].resolve({ ok: false, status: 503, headers: new Headers({ "X-Landing-Phone-Outcome": "no_phones",
    "Server-Timing": 'phone-owner;dur=12.5, phone-select;dur=123.1, phone-total;dur=200, secret;desc="private", phone-plan;dur=999999999' }) });
  const result = await request.promise;
  assert.equal(result.outcome, "empty"); assert.equal(result.status, 503);
  assert.equal(result.duration_ms, 250); assert.equal(result.completed_at, 100250);
  assert.deepEqual(JSON.parse(JSON.stringify(result.server_timings)), { phone_owner: 13, phone_select: 123, phone_total: 200 });
  assert.equal(request.navigation_id, "22222222-2222-4222-8222-222222222222");
  assert.ok(!JSON.stringify(result).includes("private"));
});

test("upgrade adopts the previous client's pending promise instead of issuing another assignment", async () => {
  let resolve!: (data: unknown) => void;
  const f = fixture(new Promise(done => { resolve = done; }));
  f.context.__PUBLIC_LANDING_PHONE_CLIENT__ = { version: 1 };
  const client = f.install();
  const request = client.request(config); await drain();
  assert.equal(request.legacy, true); assert.equal(f.requests.length, 0);
  resolve(payload); assert.equal((await request.promise).outcome, "ready");
  assert.equal(client.version, 2);
});
