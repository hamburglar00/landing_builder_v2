import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  handleTemplate7Prepare, handleTemplate7PreparationAccount, handleTemplate7PreparationFinalize,
} from "../lib/reyDeAses/preparation.server";
import type { StartDependencies } from "../lib/reyDeAses/start.server";
import {
  api2Readiness, gatewayReadiness, resolveInternalChatPlayer, resolveTargetAccount,
  linkInternalChatProviderAccount, createProviderHandoff,
} from "../lib/reyDeAses/integrations.server";
import { FlowFixture, ids, origins, secrets, type FaultPoint } from "./template7-local-flow/fixture";
import { LocalHttp } from "./template7-local-flow/local-http";
import { loadGateway, loadAtrio, loadApi2 } from "./template7-local-flow/source-loader";

type Row = Record<string, unknown>;
type Handler = (request: Request) => Promise<Response>;
type Gateway = Record<"handoff" | "prepare" | "resume" | "start" | "complete" | "finalize" | "proxyToRey", Handler> & {
  NextRequest: new (request: Request) => Request;
};
type Atrio = {
  createPlayerResolveHandler: (deps: { getSecret(): string; resolve(input: Row): Promise<unknown> }) => Handler;
  resolvePlayerIdentity(input: Row, repository: FlowFixture["playerRepository"]): Promise<unknown>;
  createProviderAccountLinkHandler: (deps: { getSecret(): string; link(input: Row): Promise<unknown> }) => Handler;
  ProviderAccountLinkFailure: new (code: string) => Error;
  verifyGatewayEmbedToken(token: string): Row | null;
};
type ApiContext = { request: { all(): Row; input(name: string): unknown; header(name: string): string | undefined; param(name: string): string | undefined };
  response: { status(code: number): ApiContext["response"]; header(name: string, value: string): ApiContext["response"]; send(body: unknown): void } };
type Api2 = { LocalPlayerController: new () => { apiExternalPlayerCreate(ctx: ApiContext): Promise<unknown> };
  LocalApiKeyMiddleware: new () => { handle(ctx: ApiContext, next: () => Promise<unknown>): Promise<unknown> } };
const json = (body: unknown, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers });
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(frontend, "../..");
const api2Arg = process.argv.indexOf("--api2-repo");
assert.ok(api2Arg >= 0 && process.argv[api2Arg + 1], "Usage: npx tsx scripts/template7-local-flow-check.ts --api2-repo <local-api2-checkout>");

async function main() {
  const envBefore = { ...process.env };
  const infoBefore = console.info;
  console.info = () => {}; // Hide routine per-stage timing; retain errors and the final report.
  const http = new LocalHttp();
  let fixture = new FlowFixture();
  let landingCookie = "";
  const activate = () => { Object.assign(globalThis, { __TEMPLATE7_LOCAL_FLOW__: fixture }); };
  const passed: string[] = [];
  const failures: { scenario: string; reason: string; counts: ReturnType<FlowFixture["counts"]> }[] = [];
  const reset = async () => { await http.idle(); await fixture.drainBackground(); fixture = new FlowFixture(); landingCookie = ""; activate(); };
  const test = async (name: string, run: () => Promise<void>) => {
    await reset();
    try { await run(); await fixture.drainBackground(); assert.deepEqual(fixture.errors, []); passed.push(name); }
    catch (error) {
      failures.push({ scenario: name, reason: (error instanceof Error ? error.message : "Unknown failure") +
        (fixture.gateway.failures.length ? "; storage: " + fixture.gateway.failures.join("; ") : "") +
        "; last HTTP: " + JSON.stringify(fixture.trace.slice(-5)), counts: fixture.counts() });
    }
  };
  try {
    // This process never reads .env files. All credentials below are synthetic.
    for (const key of Object.keys(process.env)) {
      if (/^(?:DATABASE_|SUPABASE_|NEXT_PUBLIC_SUPABASE_|REY_|GATEWAY_|INTERNAL_CHAT_|API2_|TEMPLATE7_|HANDOFF_|SESSION_ENCRYPTION_|ATRIO_CREDENTIALS_|ENABLE_TEST_LOGIN)/.test(key)) delete process.env[key];
    }
    Object.assign(process.env, {
      NODE_ENV: "production", VERCEL_ENV: "development", GATEWAY_PUBLIC_ORIGIN: origins.gateway,
      REY_PUBLIC_ORIGIN: origins.provider, SESSION_ENCRYPTION_KEY: secrets.session, HANDOFF_API_KEY: secrets.handoff,
      LANDING_BUILDER_ORIGIN: origins.builder, TEMPLATE7_PREPARATION_API_KEY: secrets.preparation,
      TEMPLATE7_PREPARATION_TOKEN_KEY: secrets.token, INTERNAL_CHAT_ORIGIN: origins.atrio,
      INTERNAL_CHAT_PLAYER_RESOLVE_KEY: secrets.resolve, INTERNAL_CHAT_EMBED_URL: origins.atrio + "/embed/local-e2e",
      INTERNAL_CHAT_GATEWAY_SECRET: secrets.chat, INTERNAL_CHAT_GATEWAY_ORIGINS: origins.gateway,
      TEMPLATE7_API2_PLAYER_CREATION_ENABLED: "true",
      API2_ORIGIN: origins.api2, API2_API_KEY: secrets.apiKey, API2_API_SECRET: secrets.apiSecret,
      REY_GATEWAY_ORIGIN: origins.gateway, REY_GATEWAY_HANDOFF_API_KEY: secrets.handoff,
      TEMPLATE7_LANDING_ORIGINS: origins.builder,
    });
    activate();
    http.install();
    const gateway = await loadGateway(path.join(workspace, "landing-autologuin")) as Gateway;
    const atrio = await loadAtrio(path.join(workspace, "internal-chat")) as Atrio;
    const api2 = await loadApi2(path.resolve(process.argv[api2Arg + 1])) as Api2;
    const deps: StartDependencies = {
      db: {
        landing: async id => id === ids.landing ? { id, name: "local-e2e", user_id: ids.owner, workspace_currency: "ARS",
          config: { template: "template7", ctaDestination: "atrio", targetProvider: "rey_de_ases" }, landing_config: { layout: { template: 7 } } } : null,
        assignment: async (landing, client) => landing === ids.landing && client === ids.client
          ? { landing_id: landing, atrio_client_id: client, user_id: ids.owner } : null,
        advisor: async client => client === ids.client ? { id: client, user_id: ids.owner, workspace_currency: "ARS", slug: "local-e2e", atrio_id: ids.advisor } : null,
        blocked: async () => false,
      },
      api2Status: api2Readiness, gatewayStatus: gatewayReadiness, allowStart: async () => true,
      resolvePlayer: resolveInternalChatPlayer, resolveAccount: resolveTargetAccount,
      linkProviderAccount: linkInternalChatProviderAccount, createHandoff: createProviderHandoff,
    };
    const resolve = atrio.createPlayerResolveHandler({ getSecret: () => secrets.resolve,
      resolve: async input => ({
        ...await atrio.resolvePlayerIdentity(input, fixture.playerRepository) as Row,
        // Model the manager scope returned by Atrio's current transactional RPC.
        // The local in-memory repository does not execute PostgreSQL functions.
        manager_id: fixture.manager.id, agency_id: fixture.manager.operationalAgencyId,
      }) });
    const link = atrio.createProviderAccountLinkHandler({ getSecret: () => secrets.resolve, link: async input => {
      const player = [...fixture.players.values()].find(row => row.id === input.playerId && row.advisor_id === input.advisorId);
      const account = fixture.providerAccounts.get(`${input.playerId}:${input.targetProvider}`);
      if (!player || !account || account.id !== input.playerProviderAccountId || input.advisorSlug !== "local-e2e") throw new atrio.ProviderAccountLinkFailure("context_mismatch");
      if (account.provider_username && account.provider_username !== input.providerUsername) throw new atrio.ProviderAccountLinkFailure("identity_conflict");
      Object.assign(account, { provider_username: input.providerUsername, provider_external_account_id: input.providerExternalAccountId ?? null });
      return { player_provider_account_id: account.id, target_provider: account.target_provider,
        provider_username: account.provider_username, provider_external_account_id: account.provider_external_account_id };
    } });
    const traced = (component: string, handler: Handler): Handler => async request => {
      const response = await handler(request);
      fixture.trace.push({ component, path: new URL(request.url).pathname, status: response.status });
      return response;
    };
    const loseResponse = (response: Response, point: FaultPoint) => response.ok && fixture.fault(point)
      ? json({ error: "simulated_lost_response" }, 503) : response;

    await http.serve(origins.builder, traced("builder", async request => {
      switch (new URL(request.url).pathname) {
        case "/api/template7/prepare": return handleTemplate7Prepare(request);
        case "/api/template7/preparations/account": return handleTemplate7PreparationAccount(request, process.env, deps);
        case "/api/template7/preparations/finalize": return handleTemplate7PreparationFinalize(request, process.env, deps);
        default: return json({ error: "not_found" }, 404);
      }
    }));
    await http.serve(origins.atrio, traced("atrio", async request => {
      switch (new URL(request.url).pathname) {
        case "/api/gateway/players/resolve": return loseResponse(await resolve(request), "atrio-response");
        case "/api/gateway/provider-accounts/link": return loseResponse(await link(request), "link-response");
        default: return json({ error: "not_found" }, 404);
      }
    }));
    await http.serve(origins.api2, traced("api2", async request => {
      const match = new URL(request.url).pathname.match(/^\/api\/v1\/bot\/managers\/([^/]+)\/players$/);
      if (!match) return json({ error: "not_found" }, 404);
      fixture.apiCalls++;
      const payload = await request.json() as Row;
      let status = 200;
      let body: unknown = null;
      const response: ApiContext["response"] = { status(code) { status = code; return this; }, header() { return this; }, send(value) { body = value; } };
      const context: ApiContext = { response, request: { all: () => payload,
        input: name => payload[name],
        header: name => request.headers.get(name) ?? undefined, param: name => name === "manager_id" ? match[1] : undefined } };
      const controller = Object.assign(new api2.LocalPlayerController(), {
        managerService: fixture.managerService, playerService: fixture.playerService, credentialService: fixture.credentialService,
        reyDeAsesClient: { createPlayer: async (username: string, password: string) => {
          const result = await fetch(origins.provider + "/test-provider/players", { method: "POST",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
          return result.ok;
        } },
      });
      try { await new api2.LocalApiKeyMiddleware().handle(context, () => controller.apiExternalPlayerCreate(context)); }
      catch { status = 500; body = { error: "simulated_storage_failure" }; }
      return loseResponse(json(body, status), "api2-response");
    }));
    await http.serve(origins.gateway, traced("gateway", async request => {
      const routes: Record<string, Handler> = { "/api/handoffs": gateway.handoff, "/prepare": gateway.prepare,
        "/resume": gateway.resume, "/start": gateway.start, "/api/preparations/complete": gateway.complete,
        "/api/preparations/finalize": gateway.finalize };
      const response = await (routes[new URL(request.url).pathname] ?? gateway.proxyToRey)(new gateway.NextRequest(request));
      return new URL(request.url).pathname === "/api/handoffs" ? loseResponse(response, "handoff-response") : response;
    }));
    await http.serve(origins.provider, traced("provider", async request => {
      const route = new URL(request.url).pathname;
      if (route === "/test-provider/players") {
        const account = await request.json() as { username: string; password: string };
        if (fixture.casinoAccounts.has(account.username)) return json({ error: "username_taken" }, 409);
        fixture.casinoAccounts.set(account.username, account); fixture.providerCreations++;
        return json({ success: true }, 201);
      }
      if (route === "/api/user/login") {
        fixture.loginCalls++;
        if (fixture.fault("login")) return json({ status: 1 }, 502);
        const input = await request.json() as { username: string; password: string };
        if (fixture.casinoAccounts.get(input.username)?.password !== input.password) return json({ status: 1 }, 401);
        const session = randomUUID(); fixture.casinoSessions.set(session, input.username);
        return json({ status: 0, result: { username: input.username } }, 200, { "set-cookie": `session=${session}; Path=/; HttpOnly; Secure` });
      }
      const session = request.headers.get("cookie")?.match(/(?:^|;\s*)session=([^;]+)/)?.[1] ?? "";
      const username = fixture.casinoSessions.get(session);
      if (route === "/api/user/check") return json({ status: username ? 0 : 1, result: { username } });
      if (route === "/casino/list/home") return new Response(`<!doctype html><html><head><script>function getBrand(){return 'local'}; const host = location.hostname; const brand = getBrand(host);</script></head><body><main>${username ? "SIGNED_IN" : "ANONYMOUS"}</main></body></html>`, { headers: { "content-type": "text/html" } });
      return json({ error: "not_found" }, 404);
    }));

    const post = (origin: string, route: string, body: unknown, headers: HeadersInit = {}) => fetch(origin + route, {
      method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
    });
    const payload = { landing_id: ids.landing, landing_slug: "local-e2e",
        name: "Local Flow", atrio_client_id: ids.client, advisor_id: ids.advisor, advisor_slug: "local-e2e", promo_code: "LP-local-flow",
        attribution: { target_provider: "rey_de_ases", utm_campaign: "local-only" } };
    const prepare = async () => {
      const response = await post(origins.builder, "/api/template7/prepare", payload, landingCookie ? { cookie: landingCookie } : {});
      assert.equal(response.status, 200, "Preparation must succeed");
      if (!landingCookie) {
        const cookie = response.headers.get("set-cookie") ?? "";
        assert.match(cookie, /lb_cid=.*HttpOnly.*SameSite=Lax/i);
        landingCookie = cookie.split(";")[0];
      }
      const result = await response.json() as { handoff_url: string };
      return new URL(result.handoff_url).searchParams.get("t")!;
    };
    const account = (token: string) => post(origins.gateway, "/api/preparations/complete", { token });
    const complete = async (token: string) => {
      const response = await account(token);
      assert.equal(response.status, 200, "Account resolution must succeed");
      const result = await response.json() as { username: string; continuation_token: string; handoff_url: string };
      assert.deepEqual(Object.keys(result).sort(), ["continuation_token", "handoff_url", "username"]);
      const handoff = new URL(result.handoff_url);
      assert.equal(handoff.origin, origins.gateway);
      assert.equal(handoff.pathname, "/start");
      assert.equal(handoff.searchParams.size, 1);
      assert.ok(handoff.searchParams.get("t"));
      return result;
    };
    const finalize = async (continuation: string) => {
      const response = await post(origins.gateway, "/api/preparations/finalize", { continuation_token: continuation });
      assert.equal(response.status, 200, "Handoff finalization must succeed");
      return (await response.json() as { handoff_url: string }).handoff_url;
    };
    const assertSingleAccount = () => assert.deepEqual(fixture.counts(), { atrioPlayers: 1, providerLinks: 1,
      api2Players: 1, credentials: 1, casinoAccounts: 1, providerCreations: 1, gatewayBindings: 1 }, "Retries must preserve one complete account");

    await test("full-flow-and-session-reentry", async () => {
      const token = await prepare();
      const preparationPage = await fetch(origins.gateway + "/prepare?t=" + token);
      assert.equal(preparationPage.status, 200);
      const ready = await complete(token);
      const handoff = await finalize(ready.continuation_token);
      const start = await fetch(handoff, { headers: { "X-Gateway-Preactivate": "1" } });
      assert.equal(start.status, 200, "Preparation page must be able to preactivate the gateway session");
      const destination = await start.json() as { redirect_url: string; recovery_token: string };
      assert.deepEqual(Object.keys(destination).sort(), ["recovery_token", "redirect_url"]);
      assert.equal(typeof destination.recovery_token, "string");
      assert.ok(destination.recovery_token.length > 32, "Preactivation must preserve the opaque browser recovery credential");
      const cookie = start.headers.getSetCookie().find(value => value.startsWith("gw_session="));
      assert.ok(cookie && /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie));
      const headers = { cookie: cookie.split(";")[0] };
      const home = await fetch(destination.redirect_url, { headers });
      assert.equal(home.status, 200);
      const html = await home.text();
      assert.match(html, /SIGNED_IN/);
      assert.ok(!html.includes([...fixture.casinoAccounts.values()][0].password), "Casino password must not be rendered");
      const embed = html.match(/https:\/\/atrio-flow\.test\/embed\/[^"'<>\s]+/)?.[0]?.replaceAll("&amp;", "&");
      assert.ok(embed, "Authenticated Atrio widget must be injected");
      const claims = atrio.verifyGatewayEmbedToken(new URL(embed).searchParams.get("token") ?? "");
      assert.ok(claims, "Atrio must validate the gateway chat token");
      assert.equal(claims.playerId, [...fixture.players.values()][0].id);
      assert.equal([...fixture.providerAccounts.values()][0].provider_external_account_id, claims.playerId,
        "The advisor inbox must retain API2's external identity for player operations");
      assert.equal(claims.playerProviderAccountId, [...fixture.providerAccounts.values()][0].id);
      assert.equal(claims.targetProvider, "rey_de_ases");
      assert.equal([...fixture.players.values()][0].device_id, landingCookie.split("=")[1]);
      assert.equal((await fetch(handoff)).status, 410, "Consumed handoff must not authenticate another browser");
      assert.equal((await fetch(handoff, { headers })).status, 303, "Same browser can recover with its existing session");
      assert.equal(fixture.loginCalls, 1, "Reusing a consumed handoff must not repeat the provider login");
      const before = fixture.apiCalls;
      const returnTo = origins.builder + "/l/local-e2e?__t7_resume=" + randomUUID();
      const resumed = await fetch(origins.gateway + "/resume?return_to=" + encodeURIComponent(returnTo), { headers });
      assert.equal(resumed.status, 303);
      assert.equal(new URL(resumed.headers.get("location")!, origins.gateway).pathname, "/");
      const directEntry = await fetch(origins.gateway + "/", { headers });
      assert.equal(directEntry.status, 303);
      assert.equal(new URL(directEntry.headers.get("location")!, origins.gateway).pathname, "/casino/list/home");
      const resumeUrl = origins.gateway + "/resume?return_to=" + encodeURIComponent(returnTo);
      for (const invalidCookie of ["", "gw_session=gs1.invalid"]) {
        const fallback = await fetch(resumeUrl, { headers: new Headers(invalidCookie ? { cookie: invalidCookie } : {}) });
        assert.equal(fallback.status, 200);
        assert.equal(fallback.headers.get("cache-control"), "private, no-store");
        const probe = await fallback.text();
        assert.ok(probe.includes('fetch("/api/session/recover"'), "Try the browser recovery credential before falling back");
        assert.ok(probe.includes(JSON.stringify(returnTo)), "Recovery failure must return to the same selected landing");
      }
      await fixture.drainBackground();
      for (const session of fixture.gateway.sessions.values()) session.expires_at = new Date(Date.now() - 1);
      const expired = await fetch(resumeUrl, { headers });
      assert.equal(expired.status, 200);
      assert.ok((await expired.text()).includes(JSON.stringify(returnTo)));
      assert.equal(fixture.apiCalls, before, "Reentry must not create/resolve another casino account");
      assertSingleAccount();
    });
    await test("new-preparation-same-device", async () => {
      const first = await complete(await prepare());
      const second = await complete(await prepare());
      assert.equal(first.username, second.username);
      await finalize(second.continuation_token); assertSingleAccount();
    });
    await test("repeat-same-preparation", async () => {
      const token = await prepare(); const first = await complete(token); const second = await complete(token);
      assert.equal(first.username, second.username);
      await finalize(second.continuation_token); assertSingleAccount();
    });
    for (const fault of ["atrio-response", "api2-response"] as const) await test("retry-after-" + fault, async () => {
      const token = await prepare(); fixture.faults.set(fault, 1);
      assert.equal((await account(token)).status, 503);
      const ready = await complete(token); await finalize(ready.continuation_token); assertSingleAccount();
    });
    for (const fault of ["link-response", "handoff-response"] as const) await test("retry-after-" + fault, async () => {
      // Link and handoff now finish in /account. Inject the lost response there,
      // before the current optimized boundary, and retry the same preparation.
      const token = await prepare(); fixture.faults.set(fault, 1);
      assert.equal((await account(token)).status, 503);
      const ready = await complete(token);
      await finalize(ready.continuation_token); assertSingleAccount();
    });
    await test("retry-after-provider-login-failure", async () => {
      const token = await prepare(); const first = await complete(token);
      const handoff = await finalize(first.continuation_token); fixture.faults.set("login", 1);
      assert.equal((await fetch(handoff)).status, 502);
      const second = await complete(token); assert.equal(second.username, first.username);
      const retry = await fetch(await finalize(second.continuation_token)); assert.equal(retry.status, 303); assertSingleAccount();
    });
    await test("invalid-tokens-and-private-auth", async () => {
      assert.equal((await account("p1.invalid")).status, 503);
      assert.equal((await post(origins.builder, "/api/template7/preparations/account", { token: "p1.invalid" })).status, 401);
      const unauthorized = await post(origins.api2, `/api/v1/bot/managers/${fixture.manager.id}/players`, { external_user_id: randomUUID(), name: "Local Flow" }, { apikey: "wrong", apisecret: "wrong" });
      assert.equal(unauthorized.status, 401); assert.equal(fixture.providerCreations, 0);
    });
    await test("expired-preparation-creates-no-account", async () => {
      const old = await handleTemplate7Prepare(new Request(origins.builder + "/api/template7/prepare", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }), process.env, Date.now() - 6 * 60_000);
      assert.equal(old.status, 200);
      const result = await old.json() as { handoff_url: string };
      assert.equal((await account(new URL(result.handoff_url).searchParams.get("t")!)).status, 503);
      assert.equal(fixture.providerCreations, 0); assert.equal(fixture.players.size, 0);
    });
    // These invariants deliberately fail if production can lose credentials or
    // create another provider account after a partial local database write.
    for (const fault of ["player-write", "credential-write"] as const) await test("retry-after-" + fault, async () => {
      const token = await prepare(); fixture.faults.set(fault, 1);
      assert.equal((await account(token)).status, 503);
      const ready = await complete(token); await finalize(ready.continuation_token); assertSingleAccount();
    });
    await test("concurrent-account-requests", async () => {
      const token = await prepare();
      fixture.synchronizePlayerReads(2);
      const results = await Promise.all([account(token), account(token)]);
      const success = results.find(result => result.ok);
      assert.ok(success, "At least one concurrent request must complete");
      const ready = await success.json() as { continuation_token: string };
      await finalize(ready.continuation_token); assertSingleAccount();
    });

    console.log(JSON.stringify({ transport: "loopback HTTP only", productionTouched: false,
      storage: "in-memory adapters; PostgreSQL RPCs and real provider clients excluded", passed,
      failed: failures, httpRequests: http.requests }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await fixture.drainBackground();
    await http.close();
    delete (globalThis as unknown as Record<string, unknown>).__TEMPLATE7_LOCAL_FLOW__;
    for (const key of Object.keys(process.env)) if (!(key in envBefore)) delete process.env[key];
    Object.assign(process.env, envBefore);
    console.info = infoBefore;
  }
}

main().catch(error => { console.error(error instanceof Error ? error.stack : "Local flow failed"); process.exitCode = 1; });
