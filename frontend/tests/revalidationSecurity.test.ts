import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { destinationFor, environmentFromServer, validateDestination, isPublicAddress, type RevalidationEnvironment } from "../lib/revalidation/catalog.server";
import { handlePanelRevalidation, handleConstructorRevalidation, type Actor, type RevalidationBackend } from "../lib/revalidation/service.server";
import { postRevalidation, pinnedLookup, warmConstructor } from "../lib/revalidation/transport.server";
import { revalidationBackend } from "../lib/revalidation/supabase.server";

const canary = "phase1b2-local-only-synthetic-0000000000000000";
const client: Actor = { id: "71000000-0000-4000-8000-000000000001", role: "client" };
const admin: Actor = { id: "71000000-0000-4000-8000-000000000003", role: "admin" };
const landing = { id: "72000000-0000-4000-8000-000000000001", user_id: client.id, name: "synthetic", publish_target: "classic" as const };
const action = { action: "publish", landingId: landing.id, publishTarget: "classic" };
const incoming = (body: unknown = action, token = "synthetic-session") => new Request("http://localhost:3001/api/landings/revalidate", {
  method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
});
function dependencies(actor: Actor | null = client) {
  const calls: { secret: number; send: number; target?: string } = { secret: 0, send: 0 };
  const backend: RevalidationBackend = {
    async authenticate(token) { return token === "synthetic-session" ? actor : null; },
    async landing() { return { ...landing }; },
    async secret() { calls.secret++; return canary; },
  };
  return { environment: "local" as const, backend, calls,
    async send(destination: ReturnType<typeof destinationFor>, name: string, secret: string) {
      calls.send++; calls.target = destination.url;
      assert.equal(name, landing.name); assert.equal(secret, canary);
      return { ok: true, revalidated: true, details: canary };
    },
  };
}
async function clean(response: Response, status: number) {
  assert.equal(response.status, status);
  const text = await response.text();
  assert.ok(!text.includes(canary)); assert.ok(!text.includes("revalidate_secret"));
  assert.equal(response.headers.get("cache-control"), "no-store");
  return JSON.parse(text);
}

test("only explicitly configured production/local environments are enabled", () => {
  assert.equal(environmentFromServer({ REVALIDATION_ENV: "production", NODE_ENV: "production", VERCEL_ENV: "production" }), "production");
  assert.equal(environmentFromServer({ REVALIDATION_ENV: "local", NODE_ENV: "test", REVALIDATION_LOCAL_SYNTHETIC: "1" }), "local");
  const rejectedEnvironments: NodeJS.ProcessEnv[] = [{ NODE_ENV: "test" }, { NODE_ENV: "test", REVALIDATION_ENV: "staging" }, { NODE_ENV: "test", REVALIDATION_ENV: "preview" },
    { REVALIDATION_ENV: "production", NODE_ENV: "production", VERCEL_ENV: "preview" },
    { REVALIDATION_ENV: "local", NODE_ENV: "production", REVALIDATION_LOCAL_SYNTHETIC: "1" },
    { REVALIDATION_ENV: "local", NODE_ENV: "test" }];
  for (const env of rejectedEnvironments) assert.throws(() => environmentFromServer(env));
});

test("production catalog contains only the two approved exact destinations", () => {
  assert.equal(destinationFor("production", "classic").url, "https://landing.panelbotadmin.com/api/revalidate");
  assert.equal(destinationFor("production", "constructor").url, "https://mkt.panelbotadmin.com/api/revalidate");
  for (const environment of ["staging", "preview", "unknown"]) assert.throws(() => destinationFor(environment as RevalidationEnvironment, "classic"));
  for (const url of ["http://landing.panelbotadmin.com/api/revalidate", "https://landing.panelbotadmin.com:444/api/revalidate",
    "https://landing.panelbotadmin.com/api/revalidate/", "https://landing.panelbotadmin.com/other", "https://landing.panelbotadmin.com/api/revalidate?x=1",
    "https://landing.panelbotadmin.com/api/revalidate#x", "https://landing.panelbotadmin.com.example.invalid/api/revalidate",
    "https://user@landing.panelbotadmin.com/api/revalidate", "http://localhost:3000/api/revalidate", "https://127.0.0.1/api/revalidate"]) {
    assert.throws(() => validateDestination({ ...destinationFor("production", "classic"), url }));
  }
});

test("all non-public address families are denied; DNS is pinned to validated results", async () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1",
    "198.18.0.1", "224.0.0.1", "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "2002:a00:1::1", "2001:db8::1"]) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("8.8.8.8"), true); assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  let resolves = 0;
  const pinned = await pinnedLookup("production", "landing.panelbotadmin.com", async () => { resolves++; return [{ address: "8.8.8.8", family: 4 }]; });
  for (let i = 0; i < 2; i++) await new Promise<void>((resolve, reject) => pinned("landing.panelbotadmin.com", { all: true }, (error, addresses) => {
    if (error) return reject(error); assert.deepEqual(addresses, [{ address: "8.8.8.8", family: 4 }]); resolve();
  }));
  assert.equal(resolves, 1);
  await assert.rejects(pinnedLookup("production", "landing.panelbotadmin.com", async () => [{ address: "8.8.8.8", family: 4 }, { address: "::1", family: 6 }]));
  await assert.rejects(pinnedLookup("local", "localhost", async () => [{ address: "8.8.8.8", family: 4 }]));
});

test("session, role, ownership and persisted publication target precede secret access", async () => {
  for (const token of ["", "expired"]) { const d = dependencies(); await clean(await handlePanelRevalidation(incoming(action, token), d), token ? 403 : 401); assert.equal(d.calls.secret, 0); }
  const noActor = dependencies(null); await clean(await handlePanelRevalidation(incoming(), noActor), 403);
  const other = dependencies({ ...client, id: admin.id }); await clean(await handlePanelRevalidation(incoming(), other), 403); assert.equal(other.calls.secret, 0);
  const mismatched = dependencies(); await clean(await handlePanelRevalidation(incoming({ ...action, publishTarget: "constructor" }), mismatched), 409); assert.equal(mismatched.calls.secret, 0);
  const good = dependencies(); assert.deepEqual(await clean(await handlePanelRevalidation(incoming(), good), 200), { ok: true, revalidated: true });
  assert.equal(good.calls.send, 1); assert.equal(good.calls.target, "http://localhost:3000/api/revalidate");
});

test("arbitrary URLs, targets, secret writes and mixed request payloads are rejected", async () => {
  for (const body of [{ ...action, url: "https://example.invalid" }, { ...action, target: "production" },
    { ...action, publishTarget: "unknown" }, { ...action, environment: "local" }, { ...action, revalidate_secret: canary },
    { ...action, secret: canary }, { ...action, landingId: "../synthetic" }, { ...action, name: "synthetic" }]) {
    const d = dependencies(); await clean(await handlePanelRevalidation(incoming(body), d), 400); assert.equal(d.calls.secret, 0); assert.equal(d.calls.send, 0);
  }
});

test("administrative classic diagnostic validates landing access without changing its motor", async () => {
  const d = dependencies(admin); d.backend.landing = async () => ({ ...landing, publish_target: "constructor" });
  await clean(await handlePanelRevalidation(incoming({ ...action, action: "test-classic" }), d), 200);
  assert.equal(d.calls.target, destinationFor("local", "classic").url);
  await clean(await handlePanelRevalidation(incoming({ ...action, action: "test-classic" }), dependencies()), 403);
});

test("configuration status is an admin-only boolean, including the empty state", async () => {
  const req = () => new Request("http://localhost:3001/api/landings/revalidate", { headers: { Authorization: "Bearer synthetic-session" } });
  await clean(await handlePanelRevalidation(req(), dependencies()), 403);
  const d = dependencies(admin); assert.deepEqual(await clean(await handlePanelRevalidation(req(), d), 200), { configured: true });
  d.backend.secret = async () => "";
  assert.deepEqual(await clean(await handlePanelRevalidation(req(), d), 200), { configured: false });
});

test("all backend and upstream errors are projected without details or canary", async () => {
  const d = dependencies(); d.send = async () => { throw new Error(canary); };
  await clean(await handlePanelRevalidation(incoming(), d), 502);
  d.backend.secret = async () => { throw new Error(canary); };
  await clean(await handlePanelRevalidation(incoming(), d), 502);
  d.backend.secret = async () => "not-a-synthetic-credential";
  await clean(await handlePanelRevalidation(incoming(), d), 502); assert.equal(d.calls.send, 0);
});

test("constructor receiver verifies in backend and never reflects incoming bodies", async () => {
  let invalidations = 0;
  const d = { environment: "local" as const, secret: async () => canary, invalidate: () => { invalidations++; }, warm: async () => true };
  const req = (body: unknown) => new Request("http://localhost:3001/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await clean(await handleConstructorRevalidation(req({ name: "synthetic", secret: "wrong" }), d), 401);
  await clean(await handleConstructorRevalidation(req({ name: "../other", secret: canary }), d), 400);
  assert.equal(invalidations, 0);
  await clean(await handleConstructorRevalidation(req({ name: "synthetic", secret: canary }), d), 200); assert.equal(invalidations, 1);
  d.warm = async () => false;
  await clean(await handleConstructorRevalidation(req({ name: "synthetic", secret: canary }), d), 502);
  d.invalidate = () => { throw new Error(canary); };
  await clean(await handleConstructorRevalidation(req({ name: "synthetic", secret: canary }), d), 503);
  const broken = new Request("http://localhost:3001/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"secret":"' + canary });
  await clean(await handleConstructorRevalidation(broken, d), 400);
});

test("backend requires synthetic local database address and scopes user lookups", async t => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service" };
  assert.throws(() => revalidationBackend("local", { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }));
  assert.throws(() => revalidationBackend("production", env));
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); paths.push(url.pathname);
    assert.equal(url.origin, "http://127.0.0.1:54321"); assert.equal(init?.redirect, "error");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: client.id, is_anonymous: false, user_metadata: { role: "admin" } });
    if (url.pathname === "/rest/v1/profiles") return Response.json({ id: client.id, role: "client" });
    if (url.pathname === "/rest/v1/landings") { assert.equal(url.searchParams.get("user_id"), "eq." + client.id); return Response.json(landing); }
    if (url.pathname === "/rest/v1/settings") {
      assert.equal(url.searchParams.get("select"), "revalidate_secret"); assert.equal(new Headers(init?.headers).get("apikey"), "synthetic-service");
      return Response.json({ revalidate_secret: canary });
    }
    throw new Error("Unexpected local synthetic request");
  };
  const backend = revalidationBackend("local", env);
  assert.deepEqual(await backend.authenticate("synthetic-session"), client);
  assert.deepEqual(await backend.landing(client, "synthetic-session", landing.id), landing);
  assert.equal(await backend.secret(), canary);
  assert.deepEqual(paths, ["/auth/v1/user", "/rest/v1/profiles", "/rest/v1/landings", "/rest/v1/settings"]);
});

test("real local HTTP retains classic contract, blocks redirects and sanitizes responses", async () => {
  let responseMode: number | "valid" | "invalid" | "error" = "valid";
  let classicCalls = 0, constructorCalls = 0, warmCalls = 0;
  const received: unknown[] = [];
  const classic = createServer(async (req, res) => {
    classicCalls++;
    let body = ""; for await (const chunk of req) body += chunk;
    received.push(JSON.parse(body));
    assert.equal(req.method, "POST"); assert.equal(req.url, "/api/revalidate");
    assert.equal(req.headers.authorization, undefined); assert.equal(req.headers.cookie, undefined);
    if (typeof responseMode === "number") { res.writeHead(responseMode, { Location: "http://localhost:3001/capture" }); res.end(canary); return; }
    if (responseMode === "error") { res.writeHead(500); res.end(JSON.stringify({ details: canary })); return; }
    if (responseMode === "invalid") { res.end(canary); return; }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ revalidated: true, path: "/synthetic", warmedConfig: true, warmedPage: false, warmedPageRetry: true, details: canary }));
  });
  const constructor = createServer((req, res) => {
    constructorCalls++;
    if (req.url === "/l/synthetic") { warmCalls++; res.end("synthetic page".repeat(5000)); return; }
    res.end(JSON.stringify({ ok: true }));
  });
  const close = (server: Server) => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
  try {
    classic.listen(3000, "localhost"); await once(classic, "listening");
    constructor.listen(3001, "localhost"); await once(constructor, "listening");
    const result = await postRevalidation(destinationFor("local", "classic"), "synthetic", canary);
    assert.deepEqual(result, { ok: true, revalidated: true, warmed: { config: true, page: false, retried: true } });
    assert.deepEqual(received[0], { name: "synthetic", secret: canary }); assert.ok(!JSON.stringify(result).includes(canary));
    for (const status of [301, 302, 303, 307, 308]) { responseMode = status; await assert.rejects(postRevalidation(destinationFor("local", "classic"), "synthetic", canary)); }
    assert.equal(constructorCalls, 0);
    for (const mode of ["invalid", "error"] as const) { responseMode = mode; await assert.rejects(postRevalidation(destinationFor("local", "classic"), "synthetic", canary), error => !String(error).includes(canary)); }
    assert.deepEqual(await postRevalidation(destinationFor("local", "constructor"), "synthetic", canary), { ok: true, revalidated: true });
    assert.equal(await warmConstructor("local", "synthetic"), true); assert.equal(warmCalls, 1);
    assert.equal(classicCalls, 8);
  } finally { await close(classic); await close(constructor); }
});
