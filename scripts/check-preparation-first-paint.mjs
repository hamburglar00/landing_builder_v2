// Signed fixture handoffs visit the real public /prepare route. All browser
// traffic is intercepted locally before any login, registration or tracking.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { loadSource, targets } from "./gateway-browser-fixtures.mjs";
import { loadProductPaths } from "./product-worktrees.mjs";

const product = loadProductPaths();
const builderRoot = product("landing-builder", "frontend");
const require = createRequire(path.join(builderRoot, "package.json"));
const { chromium } = require("playwright");
const checkedTargets = process.argv.includes("--multi-skin-only") ? targets.filter(target => target.code === "multi_skin") : targets;
const { buildTemplate7FastRuntime, buildTemplate7RuntimeConfig } = await loadSource(builderRoot,
  'export * from "./components/public-landing/template7FastRuntime";');
const key = "local-feedback-fixture-signing-key-20261119";
const origin = "https://casino.fixture";
Object.assign(process.env, { SESSION_ENCRYPTION_KEY: key, GATEWAY_PUBLIC_ORIGIN: origin });

function landingDestination(engine, provider, mode, submitted, href) {
  const page = { layout: { template: 9 }, gatewayEntry: { mode, seconds: 4 } };
  const identity = engine === "classic" ? "function getOrCreateDeviceId(){return 'fixture';}" : "";
  const cfg = { ...buildTemplate7RuntimeConfig("fixture", page, identity), targetProvider: provider, skinCode: "ganamos_plus" };
  const runtime = buildTemplate7FastRuntime("fixture", page, identity);
  function between(start, end) {
    const first = runtime.indexOf(start), last = runtime.indexOf(end, first);
    assert.ok(first >= 0 && last > first);
    return runtime.slice(first, last);
  }
  const program = between("function template7CheckedHandoff(raw)", "function showTemplate7HandoffFallback(")
    + between("function template7TransitionUrl(raw)", "function failTemplate7(")
    + "navigateTemplate7Handoff(template7TransitionUrl(href), submitted);";
  let destination;
  runInNewContext(program, { cfg, href, submitted, URL, window: {location: {assign(url) { destination = url; }}} });
  return new URL(destination);
}

const browser = await chromium.launch({ headless: true });
const firstPaint = await browser.newPage({ javaScriptEnabled: false });
const running = await browser.newPage();
const pages = [firstPaint, running];
let html, loaded = 0;
for (const page of pages) {
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === "/prepare") return route.fulfill({ contentType: "text/html", body: html });
    // Hold pending account/login responses so the runtime stage can be inspected.
    if (url.origin === origin && ["/start", "/api/preparations/complete", "/api/entry/presentation"].includes(url.pathname)) return;
    return route.abort();
  });
}
try {
  for (const { repo, code } of checkedTargets) {
    const root = product(repo);
    const { GET, addGatewayEntryWaitToHandoff, readGatewayEntryPresentation, NextRequest } = await loadSource(root,
      'export { GET } from "./src/app/prepare/route"; export * from "./src/lib/gateway-entry-settings"; export {NextRequest} from "next/server";');
    for (const engine of ["builder", "classic"]) for (const token of ["p1.fixture", "opaque-fixture"]) {
      for (const mode of ["credentials", "direct"]) for (const submitted of [true, false]) {
        const isCredentials = mode === "credentials", opaque = token === "opaque-fixture";
        const isNew = isCredentials && submitted, verifying = !submitted;
        const source = new URL((opaque ? "/start" : "/prepare") + "?t=" + token, origin);
        if (opaque) {
          const enabled = isCredentials && submitted;
          addGatewayEntryWaitToHandoff(source, { enabled, seconds: 4, continueButtonEnabled: enabled }, key, 120, undefined,
            isNew, submitted ? undefined : isCredentials ? true : "direct");
        }
        const destination = landingDestination(engine, code, mode, submitted, source.href);
        const label = [repo, engine, token, mode, submitted ? "new" : "return"].join("/");
        if (opaque) {
          assert.equal(destination.searchParams.get("ew"), source.searchParams.get("ew"), label + " proof preserved");
          const policy = readGatewayEntryPresentation(destination, key);
          assert.ok(policy, label + " valid proof");
          assert.equal(policy.newAccount, isNew, label);
        }
        const response = GET(new NextRequest(destination));
        assert.equal(response.status, 200, label);
        html = await response.text();
        for (const page of pages) {
          await page.goto(destination.href, { waitUntil: "domcontentloaded" });
          assert.equal(await page.locator("[data-stop]").count(), 0, label);
          assert.equal(await page.locator("[data-entry-progress]").isVisible(), isNew, label + " bar");
          assert.equal(await page.locator("#continue").isVisible(), false, label);
          const heading = page.locator("#entry-stage");
          if (verifying && page === firstPaint) assert.equal(await heading.isVisible(), false, label + " quiet first paint");
          else {
            if (verifying) await heading.waitFor({ state: "visible" });
            assert.equal(await heading.innerText(), isNew ? "Creando tu cuenta…" : verifying ? "Verificando tu cuenta…" : "Ingresando a tu cuenta…", label);
          }
          // Force another document even when only the cosmetic fragment differs.
          await page.goto("about:blank");
          loaded++;
        }
      }
    }
    console.log(repo + " passed");
  }
  console.log(JSON.stringify({ localOnly: true, renderedStates: loaded, networkRequestsSent: 0 }));
} finally {
  await browser.close();
}

