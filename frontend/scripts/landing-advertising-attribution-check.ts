import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import { GET as publicRuntimeResponse } from "../app/public-assets/landing-runtime-v6.js/route";
import { PUBLIC_LANDING_CSS } from "../components/public-landing/publicLandingCss";
import type { PublicLandingConfig } from "../components/public-landing/types";
import { parseTemplate7StartPayload } from "../lib/reyDeAses/start.server";

// Actual classic React components (1-6), generated classic bundle (7), and
// constructor HTML/runtime. Every request is fulfilled locally by CDP.
const expected = {
  facebook: "Facebook Norte + Sur", portofolio: "Portofolio Córdoba / A",
  cp: "001234567890123456789", campana: "Campaña Octubre", conjunto: "Conjunto A", anuncio: "Anuncio 1",
};
const landingId = "a0000000-0000-4000-8000-000000000001";
const fixture = (template: number, provider: PublicLandingConfig["tracking"]["target_provider"]): PublicLandingConfig => ({
  schemaVersion: 1, updatedAt: "2026-10-19", id: landingId, name: "Synthetic attribution", comment: "",
  layout: { template, ctaPosition: "bottom" },
  tracking: { pixelId: "", postUrl: "https://audit.invalid/conversions", landingTag: "TEST",
    target_provider: provider, ...(provider === "multi_skin" ? { skin_code: "ganamos_plus" } : {}) },
  content: { logoUrl: "", title: ["Prueba"], subtitle: [], ctaText: "Continuar",
    template6: { grid: "2x1", headerText: "Prueba", footerText: "", cards: [{ imageUrl: "", text: "Prueba", ctaText: "Continuar" }] } },
  socialProof: { enabled: false }, interactions: { enabled: false }, template7Capture: { whatsapp: false },
});
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Call = { path: string; body: Record<string, any> };

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://audit.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-only";
  process.env.NEXT_PUBLIC_META_IP_COLLECTOR_URL = "";
  const root = path.resolve(process.cwd(), "..");
  const classic = path.resolve(root, "../landing-prueba-1");
  const require = createRequire(path.join(classic, "package.json"));
  const { renderClassicTemplate7InlineHtml } = require("./lib/template7/shared.cjs");
  const { parsePayload: parseClassicPayload } = await import(pathToFileURL(path.join(classic, "lib/reyDeAses/start.server.ts")).href);
  const classicBundle = await build({
    absWorkingDir: classic, tsconfig: path.join(classic, "tsconfig.json"), bundle: true, write: false,
    platform: "browser", format: "iife", jsx: "automatic",
    stdin: { contents: `import {createRoot} from 'react-dom/client'; import Landing from './components/Landing';
      createRoot(document.getElementById('root')).render(<Landing slug={window.__slug} config={window.__config}/>);`,
      loader: "tsx", resolveDir: classic },
    define: { "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://audit.supabase.co"',
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '"synthetic-only"',
      "process.env.NEXT_PUBLIC_META_IP_COLLECTOR_URL": '""' },
  });
  const { chromium } = await import(pathToFileURL(path.join(root, "scripts/phase0/browser-runtime.mjs")).href);
  const browser = await chromium();
  let current: { html: string; calls: Call[]; errors: string[]; leftLanding: boolean };
  const pending = new Set<Promise<unknown>>();
  browser.on("Runtime.exceptionThrown", (event: any) => current?.errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  browser.on("Page.frameNavigated", (event: any) => {
    if (current && !event.frame.parentId && /^https:\/\//.test(event.frame.url)
      && new URL(event.frame.url).hostname !== "audit.invalid") current.leftLanding = true;
  });
  browser.on("Fetch.requestPaused", (event: any) => {
    const run = (async () => {
      const snapshot = current;
      const url = new URL(event.request.url);
      let body = {};
      try { body = JSON.parse(event.request.postData || "{}"); } catch { /* non-JSON resources */ }
      snapshot.calls.push({ path: url.pathname, body });
      let content = "{}", type = "application/json";
      if (event.resourceType === "Document") {
        content = url.hostname === "audit.invalid" ? snapshot.html : "<!doctype html><p>Synthetic destination</p>";
        type = "text/html";
      } else if (url.pathname === "/classic.js") {
        content = classicBundle.outputFiles[0].text; type = "text/javascript";
      } else if (url.pathname.endsWith("landing-runtime-v6.js")) {
        content = await publicRuntimeResponse().text(); type = "text/javascript";
      } else if (url.pathname.endsWith("landing-styles-v3.css")) {
        content = PUBLIC_LANDING_CSS; type = "text/css";
      } else if (url.pathname.includes("landing-phone")) {
        content = JSON.stringify({ phone: "5491100000001", landingId, landingName: "Synthetic attribution", phoneMode: "random", phoneKind: "carga" });
      } else if (url.pathname.includes("landing-atrio")) {
        content = JSON.stringify({ atrioClientId: "a0000000-0000-4000-8000-000000000002", atrioId: "a0000000-0000-4000-8000-000000000003", atrioSlug: "synthetic" });
      } else if (url.pathname === "/api/client-identity/bootstrap") {
        content = JSON.stringify({ ok: true });
      } else if (url.pathname === "/api/template7/prepare" || url.pathname === "/api/template7/start") {
        content = JSON.stringify({ handoff_url: "https://gateway.invalid/prepare?t=synthetic" });
      } else if (event.resourceType === "Script") {
        content = "/* synthetic */"; type = "text/javascript";
      }
      await browser.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: type }, { name: "Access-Control-Allow-Origin", value: "*" },
          { name: "Access-Control-Allow-Headers", value: "authorization,apikey,content-type" }],
        body: Buffer.from(content).toString("base64") });
    })().catch((error: Error) => current?.errors.push(error.message));
    pending.add(run); void run.finally(() => pending.delete(run));
  });
  const contacts = () => current.calls.filter(call => call.path === "/api/track" && call.body.payload?.event_name === "Contact");
  let cases = 0;
  try {
    await browser.send("Page.enable"); await browser.send("Runtime.enable");
    await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    for (const engine of ["constructor", "classic"]) {
      for (const resolution of engine === "classic" ? ["url_parameter", "path", "automatic"] : ["url_parameter", "path"]) {
      for (let template = 1; template <= 7; template++) {
        for (const provider of template === 7 ? ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"] as const : ["rey_de_ases"] as const) {
          await Promise.all([...pending]);
          await browser.send("Network.clearBrowserCookies");
          await browser.send("Storage.clearDataForOrigin", { origin: "https://audit.invalid", storageTypes: "all" });
          await browser.send("Emulation.setDeviceMetricsOverride", { width: engine === "classic" ? 1280 : 390, height: 844, deviceScaleFactor: 1, mobile: engine !== "classic" });
          const slug = `attribution-${engine}-${template}-${provider}-${resolution}`;
          const config = fixture(template, provider);
          const startPath = engine === "constructor" ? "/api/template7/prepare" : "/api/template7/start";
          const html = engine === "constructor" ? renderPublicLandingHtml({ slug, config })
            : template === 7 ? `<!doctype html><html><head></head><body>${renderClassicTemplate7InlineHtml({ slug, config }, 'function getOrCreateDeviceId(){return "a0000000-0000-4000-8000-000000000009";}')}</body></html>`
            : `<!doctype html><html><head></head><body><div id="root"></div><script>window.__slug=${JSON.stringify(slug)};window.__config=${JSON.stringify(config)}</script><script src="/classic.js"></script></body></html>`;
          current = { html, calls: [], errors: [], leftLanding: false };
          const entryPath = resolution === "url_parameter" ? "/" : `${engine === "constructor" ? "/l" : ""}/${slug}`;
          const query = new URLSearchParams(expected);
          if (resolution === "url_parameter") query.set("landing", slug);
          if (resolution === "automatic") query.set("__landing_auto", slug);
          await browser.send("Page.navigate", { url: `https://audit.invalid${entryPath}?${query}` });
          if (template !== 3) {
            await browser.evaluate(`new Promise((resolve,reject)=>{var end=Date.now()+12000;
              function check(){if(location.pathname!==${JSON.stringify(entryPath)}||document.readyState!=='complete'){
                  if(Date.now()>end)return reject(new Error('Document not ready'));setTimeout(check,30);return;}
                var input=document.querySelector('[data-template7-name]');
                if(input){input.value='Prueba';input.dispatchEvent(new Event('input',{bubbles:true}));}
                var button=document.querySelector('[data-public-landing-cta],.whatsapp-button,.cta,.template4__cta,.template5__cta,.template6__cta');
                if(button&&!button.disabled){button.click();return resolve(true);}
                if(Date.now()>end)return reject(new Error('CTA unavailable: '+document.body.innerText.slice(0,500)));
                setTimeout(check,30);}check();})`);
          }
          for (let i = 0; i < 240 && (contacts().length === 0 || template === 7 && !current.calls.some(call => call.path === startPath)); i++) await pause(50);
          assert.deepEqual(current.errors, [], `${engine} ${template}: browser errors`);
          assert.equal(contacts().length, 1, `${engine} ${template}: Contact missing/duplicated; paths=${current.calls.map(c => c.path)}`);
          const payload = contacts()[0].body.payload;
          for (const [key, value] of Object.entries({ landing: slug, landing_resolution: resolution, ...expected })) assert.equal(payload[key], value, `${engine} ${template}: ${key}`);
          if (template === 7) {
            const starts = current.calls.filter(call => call.path === startPath);
            assert.equal(starts.length, 1);
            assert.equal(starts[0].body.promo_code, payload.promo_code);
            assert.equal(starts[0].body.attribution.target_provider, provider);
            const parsed = engine === "constructor" ? parseTemplate7StartPayload(starts[0].body) : parseClassicPayload(starts[0].body);
            assert.ok(parsed, "Server must accept the actual browser payload");
            for (const [key, value] of Object.entries({ ...expected, landing_resolution: resolution })) assert.equal(parsed.attribution[key], value);
          }
          cases++;
          // Contact can arrive before the old document's scheduled redirect.
          // Let that navigation finish before starting another fixture.
          for (let i = 0; i < 100 && !current.leftLanding; i++) await pause(50);
          assert.equal(current.leftLanding, true, `${engine} ${template}: destination navigation missing`);
          console.log(`PASS: ${engine} template ${template}${template === 7 ? ` ${provider}` : ""} ${resolution}`);
        }
      }
    }
    }
    console.log(`PASS: ${cases} browser cases; all outbound traffic intercepted, no real accounts/events.`);
  } finally { await Promise.all([...pending]); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
