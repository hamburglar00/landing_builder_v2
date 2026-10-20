import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { renderPublicLandingHtml, renderClassicTemplate7InlineHtml } from "../components/public-landing/renderPublicLandingHtml";
import type { PublicLandingConfig } from "../components/public-landing/types";
import { constructorLandingOverride } from "../lib/landing/urlRouting";

// All HTTP requests are intercepted. Sessions, providers, accounts and tracking
// are synthetic; the gateway's actual resume handler and crypto are executed.
const providers = [
  { provider: "rey_de_ases", repo: "landing-autologuin", origin: "https://rey-gateway.test", variable: "REY_GATEWAY_ORIGIN" },
  { provider: "multi_skin", repo: "multi-skin-gateway", origin: "https://multi-gateway.test", variable: "GANAMOS_PLUS_GATEWAY_ORIGIN" },
  { provider: "ases_del_norte", repo: "ases-gateway", origin: "https://ases-gateway.test", variable: "ASES_DEL_NORTE_GATEWAY_ORIGIN" },
  { provider: "ganamos_net", repo: "ganamos-gateway", origin: "https://ganamos-gateway.test", variable: "GANAMOS_NET_GATEWAY_ORIGIN" },
] as const;
const key = "ab".repeat(32);
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type GatewayRequest = { cookies: { get(name: string): { value: string } | undefined } };
type GatewayRuntime = {
  GET(request: GatewayRequest): Response | Promise<Response>;
  POST(request: GatewayRequest): Response | Promise<Response>;
  NextRequest: new (url: URL, init: { headers: Record<string, string>;method?:string;body?:string }) => GatewayRequest;
  GATEWAY_SESSION_COOKIE: string;
  cookie(issuedAt?: number): string;
};
type RequestBody = { landing_slug?: string; attribution?: Record<string, string>; promo_code?: string; payload?: { event_name?: string; event_id?: string; promo_code?: string } & Record<string, unknown> };
type PausedRequest = { resourceType: string; requestId: string; request: { url: string; method: string; postData?: string; headers: Record<string, string> } };
type BrowserException = { exceptionDetails: { exception?: { description?: string }; text: string } };

async function loadGateway(root: string, entry: typeof providers[number]) {
  const gatewayRoot = path.resolve(root, "..", entry.repo);
  const create = entry.provider === "rey_de_ases"
    ? 'createGatewaySession("session=fixture", issuedAt)'
    : `createGatewaySession({
        ${entry.provider === "multi_skin" ? 'skinCode: "ganamos_plus", accessToken: "fixture", user: { id: 1 },' : 'upstreamCookies: "session=fixture",'}
        username: "fixture", password: "fixture-password",
        identity: { advisorSlug: "synthetic", playerId: "a0000000-0000-4000-8000-000000000004",
          playerProviderAccountId: "a0000000-0000-4000-8000-000000000005", targetProvider: "${entry.provider}" }
      }, issuedAt)`;
  const bundle = await build({
    absWorkingDir: gatewayRoot, tsconfig: path.join(gatewayRoot, "tsconfig.json"),
    stdin: { contents: `export { GET } from "./src/app/resume/route";
      export { POST } from "./src/app/api/session/recover/route";
      export { NextRequest } from "next/server";
      export { GATEWAY_SESSION_COOKIE } from "./src/lib/gateway-session";
      import { createGatewaySession, encryptGatewaySession } from "./src/lib/gateway-session";
      export const cookie = (issuedAt = Date.now()) => encryptGatewaySession(${create}, "${key}");`, resolveDir: gatewayRoot, loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "no-database", setup(plugin) {
      plugin.onLoad({ filter: /[\\/]lib[\\/]database\.ts$/ }, () => ({
        contents: 'export function getDatabase() { throw new Error("Live database access is forbidden in this test"); }', loader: "ts",
      }));
    } }],
  });
  const loaded = { exports: {} as GatewayRuntime };
  new Function("module", "exports", "require", bundle.outputFiles[0].text)(loaded, loaded.exports, createRequire(path.join(gatewayRoot, "package.json")));
  return loaded.exports;
}

async function main() {
  const root = path.resolve(process.cwd(), "..");
  Object.assign(process.env, {
    VERCEL_ENV: "development", SESSION_ENCRYPTION_KEY: key, LANDING_BUILDER_ORIGIN: "https://constructor-landing.test",
    TEMPLATE7_LANDING_ORIGINS: "https://constructor-landing.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-only",
  });
  for (const entry of providers) process.env[entry.variable] = entry.origin;
  const gateways = new Map<string, GatewayRuntime>();
  for (const entry of providers) gateways.set(entry.origin, await loadGateway(root, entry));
  const { landingOverride } = await import(pathToFileURL(path.resolve(root, "../landing-prueba-1/lib/landing/urlRouting.ts")).href);
  const { chromium } = await import(pathToFileURL(path.join(root, "scripts/phase0/browser-runtime.mjs")).href);
  const browser = await chromium();
  let current: { html: string; engine: string; landingPath: string; gatewayOrigin: string; calls: { url: string; method: string; body: RequestBody }[]; errors: string[]; cookieSeen: boolean; pixel: unknown[][] };
  const pending = new Set<Promise<unknown>>();
  browser.on("Runtime.exceptionThrown", (event: BrowserException) => current?.errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  browser.on("Fetch.requestPaused", (event: PausedRequest) => {
    const run = (async () => {
      const snapshot = current;
      const url = new URL(event.request.url);
      let body: RequestBody = {};
      try { body = JSON.parse(event.request.postData || "{}"); } catch { /* Documents/assets */ }
      snapshot.calls.push({ url: url.href, method: event.request.method, body });
      let content = "", status = 200, type = "text/plain";
      const headers: { name: string; value: string }[] = [];
      if (["/resume","/api/session/recover"].includes(url.pathname) && gateways.has(url.origin)) {
        const gateway = gateways.get(url.origin)!;
        const request = new gateway.NextRequest(url, { headers: event.request.headers,method:event.request.method,...(event.request.method==="POST"?{body:event.request.postData}: {}) });
        snapshot.cookieSeen = !!request.cookies.get(gateway.GATEWAY_SESSION_COOKIE)?.value;
        const response: Response = await (url.pathname==="/resume"?gateway.GET(request):gateway.POST(request));
        status = response.status;
        type=response.headers.get("content-type") || "text/plain";
        response.headers.forEach((value, name) => {if(name!=="content-type")headers.push({ name, value })});
        content = await response.text();
      } else if (event.resourceType === "Document") {
        type = "text/html";
        if (url.hostname === "constructor-landing.test" || url.hostname === "landing.panelbotadmin.com") {
          const selection = snapshot.engine === "constructor" ? constructorLandingOverride(url) : landingOverride(url);
          const pathname = selection && selection !== "invalid" ? selection.pathname : url.pathname;
          // Serving the same HTML for every path would hide a return to the
          // login page or a different landing after the gateway session check.
          if (selection === "invalid" || pathname !== snapshot.landingPath) {
            status = 404; content = '<!doctype html><p data-other-landing>Wrong landing</p>';
          } else content = snapshot.html;
        } else content = '<!doctype html><p data-gateway-arrival>Gateway ready</p>';
      } else if (url.pathname === "/api/client-identity/bootstrap") {
        content = JSON.stringify({ok:true});type="application/json";
      } else if (url.pathname.includes("landing-atrio")) {
        content = JSON.stringify({ atrioClientId: "a0000000-0000-4000-8000-000000000002", atrioId: "a0000000-0000-4000-8000-000000000003", atrioSlug: "synthetic" }); type = "application/json";
      } else if (url.pathname === "/api/template7/prepare" || url.pathname === "/api/template7/start") {
        snapshot.pixel = await browser.evaluate("(window.fbq && window.fbq.queue || []).map(args => Array.from(args))");
        content = JSON.stringify({ handoff_url: snapshot.gatewayOrigin + "/prepare?t=synthetic-only" }); type = "application/json";
      } else if (event.resourceType === "Script") {
        type = "text/javascript";
      } else { content = "{}"; type = "application/json"; }
      headers.push({ name: "Content-Type", value: type }, { name: "Access-Control-Allow-Origin", value: "*" },
        { name: "Access-Control-Allow-Headers", value: "authorization,apikey,content-type" });
      await browser.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: status, responseHeaders: headers, body: Buffer.from(content).toString("base64") });
    })().catch((error: Error) => current?.errors.push(error.message));
    pending.add(run); void run.finally(() => pending.delete(run));
  });
  const waitFor = async (expression: string) => {
    for (let i = 0; i < 150; i++) { if (await browser.evaluate(expression)) return; await pause(40); }
    throw new Error("Browser scenario timed out: " + expression);
  };
  const results = [];
  try {
    await browser.send("Page.enable"); await browser.send("Runtime.enable"); await browser.send("Network.enable");
    await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    for (const engine of ["constructor", "classic"]) {
      const landingOrigin = engine === "constructor" ? "https://constructor-landing.test" : "https://landing.panelbotadmin.com";
      const landingPath = engine === "constructor" ? "/l/reentry" : "/reentry";
      const routes = engine === "constructor" ? [landingPath, "/", "/l", "/l/unrelated"] : [landingPath, "/", "/unrelated"];
      const attribution = { utm_campaign: "synthetic", facebook: "Page A", portofolio: "Portfolio B", cp: "001234567890123456789", campana: "Campaign C", conjunto: "Ad set D", anuncio: "Ad E" };
      for (const entry of providers) for (const session of ["valid", "missing", "tampered", "expired"]) for (const route of routes) {
        await Promise.all([...pending]);
        await browser.send("Network.clearBrowserCookies");
        await browser.send("Storage.clearDataForOrigin", { origin: landingOrigin, storageTypes: "all" });
        await browser.send("Storage.clearDataForOrigin", { origin: entry.origin, storageTypes: "all" });
        const gateway = gateways.get(entry.origin)!;
        if (session !== "missing") await browser.send("Network.setCookie", {
          name: gateway.GATEWAY_SESSION_COOKIE, value: session === "tampered" ? "invalid" : gateway.cookie(session === "expired" ? Date.now() - 400 * 86400000 : Date.now()),
          url: entry.origin, path: "/", httpOnly: true, secure: true, sameSite: "Lax",
        });
        const config: PublicLandingConfig = { schemaVersion: 1, id: "a0000000-0000-4000-8000-000000000001", name: "Synthetic", updatedAt: "", comment: "",
          layout: { template: 7, ctaPosition: "bottom" }, tracking: { pixelId: "123456", postUrl: landingOrigin + "/conversions", landingTag: "TEST", target_provider: entry.provider, skin_code: "ganamos_plus" } };
        const html = engine === "constructor" ? renderPublicLandingHtml({ slug: "reentry", config })
          : '<!doctype html><html><head></head><body>' + renderClassicTemplate7InlineHtml({ slug: "reentry", config }, 'function getOrCreateDeviceId(){return "a0000000-0000-4000-8000-000000000009";}') + '</body></html>';
        current = { html, engine, landingPath, gatewayOrigin: entry.origin, calls: [], errors: [], cookieSeen: false, pixel: [] };
        const params = new URLSearchParams({ ...(route === landingPath ? {} : { landing: "reentry" }), ...attribution, fbclid: "fixture" });
        const landingUrl = landingOrigin + route + "?" + params;
        await browser.send("Page.navigate", { url: landingUrl });
        if (session === "valid") {
          await waitFor('!!document.querySelector("[data-gateway-arrival]")');
          assert.equal(await browser.evaluate("location.origin"), entry.origin);
          assert.equal(current.cookieSeen, true, "SameSite=Lax cookie must reach the top-level gateway request");
          assert.equal(current.calls.filter(call => call.method === "POST").length, 0, "Reentry must not create a new account, identity or Contact");
        } else {
          await waitFor('!!document.querySelector("[data-template7-name]") && !window.__TEMPLATE7_REENTRY_PENDING__');
          assert.equal(await browser.evaluate('location.href'), landingUrl, "The original URL and advertising data must be restored");
          assert.equal(current.calls.filter(call => new URL(call.url).pathname === "/resume").length, 1, "A missing session must not loop");
          await browser.evaluate(`var input=document.querySelector('[data-template7-name]');input.value='Prueba';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.template7__cta').click();document.querySelector('.template7__cta').click();`);
          await waitFor('!!document.querySelector("[data-gateway-arrival]")');
          const starts = current.calls.filter(call => ["/api/template7/prepare", "/api/template7/start"].includes(new URL(call.url).pathname));
          const contacts = current.calls.filter(call => new URL(call.url).pathname === "/api/track" && call.body.payload?.event_name === "Contact");
          assert.equal(starts.length, 1, "Double-click must keep one account request");
          assert.equal(starts[0].body.landing_slug, "reentry");
          assert.equal(starts[0].body.attribution?.target_provider, entry.provider);
          assert.equal(await browser.evaluate("location.origin"), entry.origin);
          assert.equal(contacts.length, 1, "Fallback must keep one Contact");
          assert.equal(contacts[0].body.payload?.promo_code, starts[0].body.promo_code);
          for (const [name, value] of Object.entries(attribution)) {
            assert.equal(starts[0].body.attribution?.[name], value, `Start attribution: ${name}`);
            assert.equal(contacts[0].body.payload?.[name], value, `Contact attribution: ${name}`);
          }
          const pixel = current.pixel.filter(args => args[0] === "track" && args[1] === "Contact");
          assert.equal(pixel.length, 1, "Fallback must keep one browser Contact");
          assert.equal((pixel[0][3] as { eventID: string }).eventID, contacts[0].body.payload?.event_id);
        }
        assert.deepEqual(current.errors, []);
        results.push({ engine, provider: entry.provider, session, route, passed: true });
      }
    }
    console.log(JSON.stringify({ result: "passed", scenarios: results.length, realAccountsCreated: 0, productionChanges: false, results }, null, 2));
  } finally { await Promise.allSettled([...pending]); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
