// Real gateway assets and transitions in real browsers; Atrio and all HTTP are fixtures.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
const requireBuilder = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = requireBuilder("esbuild");
const { chromium, webkit } = requireBuilder(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const providers = { "landing-autologuin": "rey_de_ases", "ases-gateway": "ases_del_norte", "ganamos-gateway": "ganamos_net", "multi-skin-gateway": "multi_skin" };
const compiled = await build({ absWorkingDir: path.join(workspace, "landing-autologuin"), entryPoints: ["src/lib/gateway-entry-transition.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { renderGatewayEntryTransition } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const results = [];

for (const [engine, browserType] of [["Chromium", chromium], ["WebKit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const [repo, provider] of Object.entries(providers)) {
      const [css, js] = await Promise.all(["gateway-client.css", "gateway-client.js"].map(file => readFile(path.join(workspace, repo, "public", file), "utf8")));
      for (const mode of ["visible-entry", "preload", "legacy"]) {
        const initialOpen = mode !== "preload";
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [];
        let sdkRequests = 0;
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", route => {
          const url = new URL(route.request().url());
          if (url.origin === "https://chat.test") return route.fulfill({ contentType: "text/html", body: `<!doctype html><main>Usable chat fixture</main><script>
            window.fixtureEvents=[];
            window.signalAtrio=data=>parent.postMessage({source:'atrio-widget',...data},'https://fixture.test');
            addEventListener('message',event=>{if(event.source===parent&&event.origin==='https://fixture.test')fixtureEvents.push(event.data)});
          </script>` });
          if (url.origin !== "https://fixture.test") return route.abort();
          if (url.pathname === "/gateway-client.js") return route.fulfill({ contentType: "application/javascript", body: js });
          if (url.pathname === "/gateway-app-sdk.js") { sdkRequests++; return route.fulfill({ contentType: "application/javascript", body: "" }); }
          if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { ok: true } });
          if (url.pathname !== "/") return route.fulfill({ status: 204 });
          return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
            ${renderGatewayEntryTransition(provider, { active: initialOpen })}
            <script src="/gateway-client.js" data-chat-url="https://chat.test/embed?token=fixture" ${initialOpen ? 'data-initial-chat-open="true" data-initial-chat-action="wallet"' : ""}></script>
          </body></html>` });
        });
        await page.goto("https://fixture.test/");
        const frame = page.frameLocator("#gateway-chat-shell iframe");
        await frame.locator("main").waitFor({ state: "attached" });
        const signal = data => frame.locator("body").evaluate((_, value) => window.signalAtrio(value), data);
        const events = () => frame.locator("body").evaluate(() => window.fixtureEvents);
        const waitVisibility = open => frame.locator("body").evaluate((_, value) => new Promise((resolve, reject) => {
          const started = Date.now();
          const check = () => {
            const latest = window.fixtureEvents.filter(event => event.type === "gateway.chat.visibility").at(-1);
            if (latest?.open === value) resolve();
            else if (Date.now() - started > 5000) reject(new Error("Visibility did not become " + value));
            else setTimeout(check, 20);
          }; check();
        }), open);
        await waitVisibility(false);
        assert.ok(!(await events()).some(event => event.type === "gateway.chat.action"), "Preload never requests wallet before the capability handshake");

        // Neither another origin nor another WindowProxy can release the overlay.
        if (initialOpen) {
          await page.evaluate(() => {
            const iframe = document.querySelector("#gateway-chat-shell iframe");
            const data = { source: "atrio-widget", type: "atrio.widget.ready", visibleEntry: true };
            dispatchEvent(new MessageEvent("message", { origin: "https://evil.test", source: iframe.contentWindow, data }));
            dispatchEvent(new MessageEvent("message", { origin: "https://chat.test", source: window, data }));
          });
          assert.equal(await page.locator("#gateway-entry-transition").evaluate(node => node.hidden), false);
        }
        if (mode === "visible-entry") await page.evaluate(() => {
          // Deterministic tab-visibility API fixture, shared by both engines.
          Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await signal({ type: "atrio.widget.ready", presentation: { template: "atrio", primary: "#ffffff", primaryHover: "#eeeeee", accent: "#dddddd", background: "#111111", surface: "#222222", text: "#ffffff", buttonText: "#000000", border: "#555555" }, ...(mode !== "legacy" ? { visibleEntry: true } : {}) });
        if (mode === "visible-entry") await page.locator("#gateway-entry-transition[hidden]").waitFor({ state: "attached" });
        await page.waitForTimeout(650);
        assert.equal(sdkRequests, 0, "Usable UI alone does not start optional app services");
        if (mode !== "legacy") assert.ok(!(await events()).some(event => event.type === "gateway.chat.action"), "Visible-entry capability owns intro, welcome and wallet ordering");
        else {
          assert.ok((await events()).some(event => event.type === "gateway.chat.action" && event.action === "wallet"), "Legacy chat keeps its wallet action");
          assert.equal(await page.locator("#gateway-entry-transition").evaluate(node => node.hidden), false, "Legacy chat keeps its original wallet transition");
          await signal({ type: "atrio.widget.entry-ready", walletReady: true, walletRequestCompleted: true, walletAvailable: true });
          await page.locator("#gateway-entry-transition[hidden]").waitFor({ state: "attached" });
        }
        if (mode === "visible-entry") {
          assert.ok(!(await events()).some(event => event.type === "gateway.chat.visibility" && event.open), "Hidden document cannot open the visible-entry gate");
          await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event("visibilitychange")); });
        }
        if (mode === "preload") {
          assert.ok(!(await events()).some(event => event.type === "gateway.chat.visibility" && event.open), "Closed preloaded chat stays hidden after ready");
          await page.evaluate(() => document.querySelector("#gateway-chat-button").click());
        }
        await waitVisibility(true);
        if (mode !== "legacy") assert.equal(sdkRequests, 0, "Chat becomes visible before deferred wallet readiness");

        await page.evaluate(() => document.querySelector("#gateway-chat-backdrop").click());
        await waitVisibility(false);
        await page.evaluate(() => {
          document.querySelector("#gateway-chat-button").click();
          document.querySelector("#gateway-chat-backdrop").click();
        });
        await page.waitForTimeout(650);
        await waitVisibility(false);
        await page.evaluate(() => document.querySelector("#gateway-chat-button").click());
        await waitVisibility(true);
        await page.evaluate(() => dispatchEvent(new Event("pagehide")));
        await waitVisibility(false);
        await page.evaluate(() => dispatchEvent(new Event("pageshow")));
        await waitVisibility(true);
        await page.evaluate(() => { document.querySelector("#gateway-entry-transition").hidden = false; });
        await waitVisibility(false);
        await page.evaluate(() => { document.querySelector("#gateway-entry-transition").hidden = true; });
        await waitVisibility(true);
        assert.deepEqual(errors, []);
        results.push({ engine, repo, mode, trustedReady: true, visibleBeforeWallet: true, lifecycleHidden: true, noBusinessRequests: true });
        await page.close();
      }
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ engine, passed: results.filter(result => result.engine === engine).length }));
}
console.log(JSON.stringify({ passed: results.length, gateways: 4, engines: 2, tabVisibilitySimulated: true, realMessagesOrConversions: 0 }));
