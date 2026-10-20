import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { renderPublicLandingHtml, renderClassicTemplate7InlineHtml } from "../components/public-landing/renderPublicLandingHtml";
import { buildPublicLandingRuntimeSource } from "../components/public-landing/PublicLandingRuntimeScript";
import { PUBLIC_LANDING_CSS } from "../components/public-landing/publicLandingCss";
import type { PublicLandingConfig } from "../components/public-landing/types";

// Synthetic browser checks: every HTTP request is intercepted, including Meta.
// No credentials, real accounts, database writes, or conversion events.
const fixture = (provider: PublicLandingConfig["tracking"]["target_provider"]): PublicLandingConfig => ({
  schemaVersion: 1, updatedAt: "2026-10-15", id: "a0000000-0000-4000-8000-000000000001", name: "Synthetic audit", comment: "",
  layout: { template: 7, ctaPosition: "bottom" },
  tracking: { pixelId: "123456", postUrl: "https://audit.invalid/conversions", landingTag: "TEST", target_provider: provider },
  content: { logoUrl: "https://audit.supabase.co/storage/v1/object/public/landing-images/owner/logo.avif", title: ["Crear cuenta"], subtitle: [], ctaText: "Continuar" },
  template7Capture: { whatsapp: true },
});
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Fixed pre-optimization revision: committing this work must not move the baseline.
const baselineRef = "20c4cf7246eb6b3be9f049747e9616c6ffa03ee3";

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://audit.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-only";
  process.env.NEXT_PUBLIC_META_IP_COLLECTOR_URL = "";
  const root = path.resolve(process.cwd(), "..");
  const require = createRequire(path.join(process.cwd(), "package.json"));
  // Compile the pre-change renderer from Git, not a hand-written approximation.
  const baselineBundle = await build({
    absWorkingDir: process.cwd(), entryPoints: ["components/public-landing/renderPublicLandingHtml.tsx"],
    bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"],
    plugins: [{ name: "baseline", setup(plugin) {
      plugin.onLoad({ filter: /renderPublicLandingHtml\.tsx$/ }, () => ({
        contents: execFileSync("git", ["show", `${baselineRef}:frontend/components/public-landing/renderPublicLandingHtml.tsx`], { cwd: root, encoding: "utf8" }),
        loader: "tsx", resolveDir: path.resolve("components/public-landing"),
      }));
    } }],
  });
  const baselineModule = { exports: {} as { renderPublicLandingHtml: typeof renderPublicLandingHtml } };
  new Function("module", "exports", "require", baselineBundle.outputFiles[0].text)(baselineModule, baselineModule.exports, require);
  for (let template = 1; template <= 6; template++) {
    const config = { ...fixture("rey_de_ases"), layout: { template, ctaPosition: "bottom" } };
    assert.equal(renderPublicLandingHtml({ slug: "test", config }), baselineModule.exports.renderPublicLandingHtml({ slug: "test", config }), `Template ${template} HTML changed`);
  }
  console.log("Templates 1-6: HTML identical to Git baseline.");
  const { chromium } = await import(pathToFileURL(path.join(root, "scripts/phase0/browser-runtime.mjs")).href);
  const browser = await chromium();
  let current: { html: string; engine: string; calls: { path: string; method: string; body: Record<string, any>; at: number }[]; errors: string[]; pixel: any[]; startedAt: number; baseline?: boolean };
  const pending = new Set<Promise<unknown>>();
  browser.on("Runtime.exceptionThrown", (event: any) => current?.errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  browser.on("Fetch.requestPaused", (event: any) => {
    const run = (async () => {
      const snapshot = current;
      const url = new URL(event.request.url);
      let body: Record<string, any> = {};
      try { body = JSON.parse(event.request.postData || "{}"); } catch { /* images etc. */ }
      snapshot.calls.push({ path: url.pathname, method: event.request.method, body, at: Date.now() - snapshot.startedAt });
      let content = "", type = "text/plain", status = 200;
      if (event.resourceType === "Document") {
        content = url.hostname === "audit.invalid" ? snapshot.html : "<!doctype html><p>Gateway synthetic</p>";
        type = "text/html";
      } else if (url.pathname === "/audit/hydration.js") {
        await pause(3000); content = "window.__hydrated=true"; type = "text/javascript";
      } else if (url.pathname.endsWith("landing-runtime-v3.js")) {
        await pause(1500); content = buildPublicLandingRuntimeSource(); type = "text/javascript";
      } else if (url.pathname.endsWith("landing-styles-v3.css")) {
        await pause(600); content = PUBLIC_LANDING_CSS; type = "text/css";
      } else if (url.pathname.includes("landing-atrio")) {
        content = JSON.stringify({ atrioClientId: "a0000000-0000-4000-8000-000000000002", atrioId: "a0000000-0000-4000-8000-000000000003", atrioSlug: "synthetic" }); type = "application/json";
      } else if (url.pathname === "/api/client-identity/bootstrap") {
        await pause(700); content = JSON.stringify({ok:true}); type = "application/json";
      } else if (url.pathname === "/api/template7/prepare" || url.pathname === "/api/template7/start") {
        snapshot.pixel = await browser.evaluate("(window.fbq && window.fbq.queue || []).map(args => Array.from(args))");
        content = JSON.stringify({ handoff_url: "https://gateway.invalid/prepare?t=synthetic" }); type = "application/json";
      } else if (event.resourceType === "Image") {
        // Make the optimized logo fail to exercise its original-image fallback.
        status = url.pathname.includes("/render/image/") ? 503 : 200;
        type = "image/png";
        content = "";
      } else if (event.resourceType === "Script") {
        type = "text/javascript"; content = "/* synthetic: no external JS */";
      } else { content = "{}"; type = "application/json"; }
      await browser.send("Fetch.fulfillRequest", {
        requestId: event.requestId, responseCode: status,
        responseHeaders: [{ name: "Content-Type", value: type }, { name: "Access-Control-Allow-Origin", value: "*" }, { name: "Access-Control-Allow-Headers", value: "authorization,apikey,content-type" }],
        body: Buffer.from(content).toString("base64"),
      });
    })().catch((error: Error) => current?.errors.push(error.message));
    pending.add(run); void run.finally(() => pending.delete(run));
  });
  try {
    await browser.send("Page.enable"); await browser.send("Runtime.enable");
    await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    const results = [];
    for (const engine of ["baseline", "constructor", "classic"]) {
      for (const provider of engine === "baseline" ? ["rey_de_ases"] as const : ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"] as const) {
        await Promise.all([...pending]);
        await browser.send("Network.clearBrowserCookies");
        await browser.send("Storage.clearDataForOrigin", { origin: "https://audit.invalid", storageTypes: "all" });
        const config = fixture(provider);
        let html = engine === "baseline" ? baselineModule.exports.renderPublicLandingHtml({ slug: `test-${provider}`, config })
          : engine === "classic" ? `<!doctype html><html><head></head><body>${renderClassicTemplate7InlineHtml({ slug: `test-${provider}`, config }, 'function getOrCreateDeviceId(){return "a0000000-0000-4000-8000-000000000009";}')}</body></html>`
          : renderPublicLandingHtml({ slug: `test-${provider}`, config });
        // Unrelated deferred work must not delay the new form. This is a fault
        // injection check, NOT a claim about real-world production latency.
        html = html.replace("</head>", '<script src="/audit/hydration.js" defer></script></head>');
        if (engine === "classic") {
          // React can stop a discrete event at its hydration root before the
          // native button listener sees it. Reproduce that capture boundary.
          html = html.replace("</head>", `<script>document.addEventListener("click",function(event){
            if(!window.__hydrated&&event.target.closest("[data-public-landing-cta]")){
              window.__blockedHydrationClicks=(window.__blockedHydrationClicks||0)+1;
              event.stopPropagation();
            }
          },true);</script></head>`);
        }
        current = { html, engine, calls: [], errors: [], pixel: [], startedAt: Date.now() };
        await browser.send("Page.navigate", { url: `https://audit.invalid/${engine}-${provider}?fbclid=synthetic&utm_campaign=audit` });
        const form = await browser.evaluate(`new Promise((resolve, reject) => {
          var until = Date.now()+10000;
          function check(){
            var input=document.querySelector('[data-template7-name]');
            var button=document.querySelector('.template7__cta');
            if(input && button){input.value='Prueba';input.dispatchEvent(new Event('input',{bubbles:true}));}
            if(button && !button.disabled) return resolve({ms:Math.round(performance.now()),hydrated:!!window.__hydrated});
            if(Date.now()>until) return reject(new Error('Form not interactive'));
            setTimeout(check,20);
          } check();
        })`);
        if (engine !== "baseline") assert.equal(form.hydrated, false, "Form waited for unrelated hydration");
        for (let i = 0; i < 40 && !current.calls.some(call => call.path.includes("/object/public/landing-images/")); i++) await pause(25);
        assert.ok(current.calls.some(call => call.path.includes("/object/public/landing-images/")), "Original-image fallback was not requested");
        await browser.evaluate(`var phone=document.querySelector('[data-template7-whatsapp]');phone.value='11 2345-6789';phone.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.template7__cta').click();document.querySelector('.template7__cta').click();`);
        for (let i = 0; i < 100 && !current.calls.some(call => call.path === "/api/template7/prepare" || call.path === "/api/template7/start"); i++) await pause(50);
        await pause(150);
        assert.deepEqual(current.errors, []);
        const starts = current.calls.filter(call => call.path === "/api/template7/prepare" || call.path === "/api/template7/start");
        assert.equal(starts.length, 1, "Double click must issue exactly one start, including during hydration");
        const contacts = current.calls.filter(call => call.path === "/api/track" && call.body.payload?.event_name === "Contact");
        assert.equal(contacts.length, 1, "Contact lost or duplicated");
        assert.equal(starts[0].body.phone, "5491123456789");
        assert.equal(contacts[0].body.payload.form_phone, "5491123456789");
        assert.equal(contacts[0].body.payload.promo_code, starts[0].body.promo_code);
        const contactPixel = current.pixel.filter(call => call[0] === "track" && call[1] === "Contact");
        assert.equal(contactPixel.length, 1);
        assert.equal(contactPixel[0][3].eventID, contacts[0].body.payload.event_id);
        assert.equal(current.pixel.filter(call => call[0] === "track" && call[1] === "PageView").length, 1);
        assert.equal(starts[0].body.attribution.target_provider, provider);
        if (engine === "constructor") assert.ok(starts[0].at >= 650, "Identity bootstrap race");
        results.push({ engine, provider, formReadyMs: form.ms, beforeUnrelatedHydration: !form.hydrated, contact: contacts.length });
        console.log(JSON.stringify(results.at(-1)));
      }
    }
    console.log("PASS: 9 synthetic browser cases; all outbound traffic intercepted.");
  } finally { await Promise.all([...pending]); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
