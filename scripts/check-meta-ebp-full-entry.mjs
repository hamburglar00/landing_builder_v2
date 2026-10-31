// Independent check of the whole rendered entry runtime, not extracted collectors.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = path.join(root, "frontend");
const require = createRequire(path.join(frontend, "package.json"));
const { build } = require("esbuild");
const { chromium, webkit } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
process.env.MULTI_SKIN_GATEWAY_ORIGIN = "https://gateway.fixture.test";
process.env.GANAMOS_PLUS_GATEWAY_ORIGIN = "https://gateway.fixture.test";
const bundled = await build({ absWorkingDir: frontend, stdin: { resolveDir: frontend, loader: "ts", contents: `
 export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';
 export {template7RuntimeAsset} from './components/public-landing/template7RuntimeAsset';
 export {buildLandingConfig} from './lib/landing/buildLandingConfig';
 export {DEFAULT_CONFIG} from './lib/landing/mocks';
` }, bundle: true, write: false, platform: "node", format: "cjs", external: ["react", "react/jsx-runtime", "react-dom/server", "next/*"] });
const loaded = { exports: {} };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(require, loaded, loaded.exports);
const api = loaded.exports;
const classic = createRequire(path.join(root, "../landing-prueba-1/package.json"))("./lib/template7/shared.cjs");
const helperUrl = (await readFile(path.join(frontend, "lib/meta/ebpAssetManifest.ts"), "utf8")).match(/META_EBP_COLLECTOR_URL = "([^"]+)"/)[1];
const helper = await readFile(path.join(frontend, "public", helperUrl), "utf8");
const rows = [];
for (const [browserName, launcher] of [["Chromium", chromium], ["WebKit", webkit]]) {
  const browser = await launcher.launch({ headless: true });
  try { for (const template of [7, 8]) {
    const engine = template === 7 ? "builder" : "classic";
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), requests = [], errors = [];
    const id = "f0000000-0000-4000-8000-000000000001", pixel = "123456", slug = "audit-ebp";
    const legacy = "fb.1." + (Date.now() - 86400000) + ".ForeignSyntheticClick";
    const freshClick = "NativeCurrentSyntheticClick";
    const cfg = api.buildLandingConfig({ id, name: slug, comment: "", pixelId: pixel, postUrl: "https://tracking.fixture.test/events", landingTag: "TEST", workspaceCurrency: "ARS", config: {
      ...api.DEFAULT_CONFIG, template: "template" + template, ctaDestination: "atrio", targetProvider: "multi_skin", multiSkinCode: "bet30", titleLine1: "Fixture", titleLine2: "", logoUrl: "", backgroundImageUrls: [],
      template8Cover: { cardCount: 2, headerText: "Fixture", footerText: "", backgroundImageUrl: "", cards: ["bet30", "ganamos_plus"].map(code => ({ imageUrl: "", text: code, ctaText: "", targetProvider: "multi_skin", multiSkinCode: code })) },
    } });
    const html = engine === "builder" ? api.renderPublicLandingHtml({ slug, config: cfg }) : classic.renderClassicTemplate7InlineHtml({ slug, config: cfg }, 'function getOrCreateDeviceId(){return "44444444-4444-4444-8444-444444444444";}');
    await context.addCookies([{ name: "_fbc", value: legacy, domain: "entry.fixture.test", path: "/" }]);
    await context.addInitScript(({ freshClick, legacy }) => {
      window.nativeCalls = 0; window.nativeReturned = false; window.unhandled = [];
      window.addEventListener("unhandledrejection", event => window.unhandled.push(String(event.reason)));
      Object.defineProperty(window, "webkit", { configurable: true, value: { messageHandlers: { browserProperties: {
        postMessage(path) { if (path !== "clickID") throw Error("Unexpected property"); window.nativeCalls++; window.nativeReturned = true; return Promise.resolve(freshClick); },
      } } } });
      // A never-settling SDK cannot block the CTA, and its FBC must not be used.
      window.clientParamBuilder = { processAndCollectAllParams: () => new Promise(() => {}), getFbc: () => legacy, getFbp: () => "fb.1.1600000000000.12345" };
      Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: () => false });
    }, { freshClick, legacy });
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      let body = null; try { body = request.postDataJSON(); } catch { /* Non-JSON fixtures. */ }
      requests.push({ path: url.pathname, origin: url.origin, method: request.method(), body, at: Date.now() });
      if (url.pathname === helperUrl) return route.fulfill({ contentType: "text/javascript", body: helper });
      if (url.pathname.startsWith("/public-assets/template-entry/")) return route.fulfill({ contentType: "text/javascript", body: api.template7RuntimeAsset(template, engine === "classic").source });
      if (url.pathname === "/api/client-identity/bootstrap") return route.fulfill({ json: { ok: true }, headers: { "Set-Cookie": "lb_cid=44444444-4444-4444-8444-444444444444; Path=/; HttpOnly; SameSite=Lax" } });
      if (url.pathname === "/api/template7/destination") return route.fulfill({ json: { atrioClientId: "22222222-2222-4222-8222-222222222222", atrioId: "33333333-3333-4333-8333-333333333333", atrioSlug: "fixture", preparationReady: false } });
      if (["/api/template7/prepare", "/api/template7/start"].includes(url.pathname)) return route.fulfill({ status: 503, json: { error: "Fixture stops before account creation" } });
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { ok: true, active: false } });
      if (url.pathname.endsWith(".js")) return route.fulfill({ contentType: "text/javascript", body: "/* isolated vendor */" });
      if (request.isNavigationRequest()) return route.fulfill({ contentType: "text/html;charset=utf-8", body: html });
      return route.fulfill({ status: 204, body: "" });
    });
    try {
      await page.goto("https://entry.fixture.test/" + slug);
      await page.waitForFunction(() => window.__T7_RUNTIME_READY__ === true);
      if (template === 8) await page.locator('[data-template8-card-index="1"]').click();
      await page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith("landing-fbc:v2:") && JSON.parse(localStorage.getItem(key) || "null")?.source === "sdk_fresh"));
      await page.locator("[data-template7-name]").fill("Fixture");
      const entryRequest = page.waitForRequest(request => ["/api/template7/prepare", "/api/template7/start"].includes(new URL(request.url()).pathname), { timeout: 5000 });
      const clickedAt = Date.now();
      await page.locator("[data-public-landing-cta]").first().click();
      await entryRequest;
      const contact = requests.find(item => item.path === "/api/track" && item.body?.payload?.event_name === "Contact")?.body.payload;
      assert.ok(contact, "whole runtime sends the intercepted Contact");
      assert.match(contact.fbc, new RegExp("\\." + freshClick + "$"));
      assert.notEqual(contact.fbc, legacy);
      assert.deepEqual({ ...contact.landing_attribution, captured_at: null }, { version: 2, landing_id: id, workspace_currency: "ARS", pixel_id: pixel, entry_source: "sdk_fresh", fbc_source: "sdk_fresh", captured_at: null, legacy_fbc_quarantined: true });
      const journeys = requests.filter(item => item.path === "/api/journey-start").map(item => item.body);
      assert.ok(journeys.length > 0, "whole runtime sends the intercepted journey");
      for (const journey of journeys) { assert.notEqual(journey.fbc, legacy); assert.equal(journey.landing_attribution.version, 2); }
      const entry = requests.find(item => ["/api/template7/prepare", "/api/template7/start"].includes(item.path));
      assert.match(entry.body.attribution.fbc, new RegExp("\\." + freshClick + "$"));
      assert.equal((await context.cookies()).find(cookie => cookie.name === "_fbc")?.value, legacy);
      assert.equal(await page.evaluate(() => window.nativeCalls), 1);
      assert.deepEqual(await page.evaluate(() => window.unhandled), []); assert.deepEqual(errors, []);
      rows.push({ browser: browserName, engine, template, contactFbcSource: contact.landing_attribution.fbc_source, contactScoped: true, entryScoped: true, journey: journeys.map(value => ({ fbcPresent: !!value.fbc, entrySource: value.landing_attribution.entry_source, fbcSource: value.landing_attribution.fbc_source })), initialJourneyCapturedFreshClick: journeys.every(value => value.fbc === contact.fbc), ctaToEntryMs: entry.at - clickedAt, globalCookieUntouched: true, allRequestsIntercepted: true });
    } finally { await context.close(); }
  } } finally { await browser.close(); }
}
await writeFile(path.join(root, "docs/validation/meta-ebp-full-entry-20261031.json"), JSON.stringify({ scope: "Whole T7 Builder / T8 classic runtime and real EBP asset; SDK/main services mocked, no real conversion or account", results: rows }, null, 2) + "\n");
console.log(JSON.stringify(rows, null, 2));
