import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require2 = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require2("esbuild");
let browserModule;
try {
  browserModule = require2("playwright");
} catch {
  const configured = process.env.PLAYWRIGHT_MODULE_PATH || process.env.APPDATA && path.join(process.env.APPDATA, "npm/node_modules/playwright");
  if (!configured) throw new Error("Install Playwright or set PLAYWRIGHT_MODULE_PATH; browser binaries are required.");
  browserModule = require2(configured);
}
const { chromium, webkit } = browserModule;
const workspace = fileURLToPath(new URL("../../", import.meta.url));
const artifacts = new URL("../.vercel/validation-deferred-app/", import.meta.url);
await mkdir(artifacts, { recursive: true });
const checks = [];
const fixtureCode = {
  "landing-autologuin": { name: "rewriteReyHtml", options: '{gatewayClient:{appId:"synthetic",displayName:"Synthetic",chatEmbedUrl:"https://chat.test/widget",vapidPublicKey:"AQID",initialChatOpen:true,initialChatAction:"wallet"}}', suffix: ".html" },
  "ases-gateway": { name: "rewriteAsesHtml", extra: 'import{getProviderConfig}from"./src/lib/skin-registry";', options: '{appId:"synthetic",displayName:"Synthetic",chatEmbedUrl:"https://chat.test/widget",vapidPublicKey:"AQID",initialChatOpen:true,initialChatAction:"wallet",provider:getProviderConfig()}' },
  "ganamos-gateway": { name: "rewriteGanamosHtml", extra: 'import{getProviderConfig}from"./src/lib/skin-registry";', options: '{appId:"synthetic",displayName:"Synthetic",chatEmbedUrl:"https://chat.test/widget",vapidPublicKey:"AQID",initialChatOpen:true,initialChatAction:"wallet",provider:getProviderConfig()}' },
  "multi-skin-gateway": { name: "rewriteMultiSkinHtml", extra: 'import{getSkinConfig}from"./src/lib/skin-registry";', options: '{appId:"synthetic",displayName:"Synthetic",chatEmbedUrl:"https://chat.test/widget",vapidPublicKey:"AQID",initialChatOpen:true,initialChatAction:"wallet",skin:getSkinConfig("ganamos_plus"),accessToken:"synthetic",user:{id:1}}' }
};
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const gateway = path.join(workspace, repo);
  const script = await readFile(gateway + "/public/gateway-client.js", "utf8"), sdk = await readFile(gateway + "/public/gateway-app-sdk.js", "utf8");
  const f = fixtureCode[repo];
  const compiled = await build({ absWorkingDir: gateway, tsconfig: gateway + "/tsconfig.json", stdin: { contents: "import{" + f.name + '}from"./src/lib/html-rewriter";' + (f.extra || "") + ";export const html=" + f.name + "(" + JSON.stringify('<html><head><script src="/provider-delayed.js" defer><\/script></head><body><main>Casino</main></body></html>') + "," + f.options + ")" + (f.suffix || "") + ";", resolveDir: gateway, loader: "ts" }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external" });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", compiled.outputFiles[0].text)(loaded, loaded.exports, createRequire(gateway + "/package.json"));
  const html = loaded.exports.html;
  assert.ok(!html.includes("/gateway-app-sdk.js"));
  for (const [engine, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
    const browser = await type.launch({ headless: true });
    try {
      for (const ios of [false, true]) {
        for (const sdkLate of [false, true]) {
          const page = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: ios ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile" : "Mozilla/5.0 (Linux; Android 14) Chrome/130.0.0.0 Mobile" });
          await page.addInitScript(({ ios: ios2 }) => {
            window.calls = [];
            window.sdkRequests = 0;
            window.installPrompts = 0;
            const worker = { pushManager: { getSubscription: async () => null, subscribe: async () => {
              window.calls.push("subscribe");
              return { toJSON: () => ({ endpoint: "https://push.test/endpoint", keys: { p256dh: "fixture", auth: "fixture" } }) };
            } } };
            Object.defineProperty(window, "Notification", { value: { permission: "default", requestPermission() {
              window.calls.push("native-permission");
              window.gestureAtPrompt = navigator.userActivation?.isActive;
              return Promise.resolve("granted");
            } } });
            Object.defineProperty(window, "PushManager", { value: class {
            } });
            Object.defineProperty(navigator, "serviceWorker", { value: { register: async () => {
              window.calls.push("register");
              return worker;
            }, ready: Promise.resolve(worker) } });
            const match = window.matchMedia.bind(window);
            window.matchMedia = (q) => q.includes("display-mode") ? { matches: ios2, addEventListener() {
            }, removeEventListener() {
            } } : match(q);
          }, { ios });
          await page.route("https://fixture.test/**", async (route) => {
            const path2 = new URL(route.request().url()).pathname;
            if (path2 === "/gateway-app-sdk.js" || path2 === "/gateway-client.js") {
              if (path2.includes("sdk")) await page.evaluate(() => window.sdkRequests++);
              if (path2.includes("sdk") && sdkLate) await new Promise((resolve) => setTimeout(resolve, 1800));
              return route.fulfill({ contentType: "application/javascript", body: path2.includes("sdk") ? sdk : script });
            }
            if (path2 === "/provider-delayed.js") {
              await new Promise((resolve) => setTimeout(resolve, 1200));
              return route.fulfill({ contentType: "application/javascript", body: "window.providerLoaded=true;" });
            }
            if (path2 === "/api/push-subscriptions") {
              await page.evaluate(() => window.calls.push("saved"));
              return route.fulfill({ json: { ok: true } });
            }
            if (path2.startsWith("/api/")) return route.fulfill({ json: { ok: true } });
            if (path2 === "/") return route.fulfill({ contentType: "text/html", body: html });
            return route.fulfill({ status: 204 });
          });
          await page.route("https://chat.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><p>Chat fixture</p>" }));
          await page.goto("https://fixture.test/", { waitUntil: "commit" });
          await page.locator("#gateway-chat-shell").waitFor({ state: "attached" });
          if (!ios) await page.evaluate(() => {
            const e = new Event("beforeinstallprompt");
            e.prompt = () => {
              window.calls.push("native-install");
              return Promise.resolve();
            };
            e.userChoice = Promise.resolve({ outcome: "accepted" });
            window.dispatchEvent(e);
          });
          const signal = async (data, origin = "https://chat.test") => page.evaluate(({ data: data2, origin: origin2 }) => {
            const frame = document.querySelector("#gateway-chat-shell iframe");
            window.dispatchEvent(new MessageEvent("message", { origin: origin2, source: frame.contentWindow, data: { source: "atrio-widget", ...data2 } }));
          }, { data, origin });
          await page.waitForTimeout(100);
          assert.equal(await page.evaluate(() => window.sdkRequests), 0);
          assert.ok(!(await page.evaluate(() => window.calls)).includes("register"));
          assert.ok((await page.evaluate(() => performance.getEntriesByType("resource").map((r) => new URL(r.name).pathname))).includes("/api/app-events"));
          await signal({ type: "atrio.widget.ready" });
          await signal({ type: "atrio.widget.entry-ready", walletReady: true, walletRequestCompleted: true, walletAvailable: true }, "https://untrusted.test");
          await signal({ type: "atrio.widget.entry-ready", walletReady: false, walletAvailable: true });
          await signal({ type: "atrio.widget.entry-ready", walletReady: true, walletRequestCompleted: false, walletAvailable: true });
          await page.waitForTimeout(150);
          assert.equal(await page.evaluate(() => window.sdkRequests), 0);
          await signal({ type: "atrio.widget.entry-ready", walletReady: true, walletRequestCompleted: true, walletAvailable: true });
          await signal({ type: "atrio.widget.entry-ready", walletReady: true, walletRequestCompleted: true, walletAvailable: true });
          await page.waitForFunction(() => !!window.GatewayApp);
          await page.waitForFunction(() => window.calls.includes("register"));
          assert.equal(await page.evaluate(() => window.sdkRequests), 1);
          if (!ios) {
            const source = await page.evaluate(() => window.GatewayApp.canInstall());
            assert.equal(source, true);
            await signal({ type: "atrio.widget.request-install" });
            await page.getByRole("button", { name: "Instalar", exact: true }).click();
            assert.equal((await page.evaluate(() => window.calls)).filter((x) => x === "native-install").length, 1);
          }
          await page.evaluate(() => {
            const frame = document.querySelector("#gateway-chat-shell iframe");
            window.dispatchEvent(new MessageEvent("message", { origin: "https://chat.test", source: frame.contentWindow, data: { source: "atrio-widget", type: "atrio.widget.invitation", invitation: { id: "push-invitation-1234", action: "enable_notifications", title: "Activar notificaciones", body: "Recibí los mensajes de tu asesor." } } }));
          });
          await page.getByRole("button", { name: /Activar notificaciones/ }).click();
          await page.waitForFunction(() => window.calls.includes("saved"));
          const calls = await page.evaluate(() => window.calls);
          assert.equal(calls.filter((c) => c === "native-permission").length, 1);
          assert.ok(calls.indexOf("native-permission") < calls.indexOf("subscribe"));
          assert.ok(calls.indexOf("subscribe") < calls.indexOf("saved"));
          if (engine === "Chromium") assert.equal(await page.evaluate(() => window.gestureAtPrompt), true);
          checks.push({ repo, engine, sdkLate, platform: ios ? "installed iOS (simulated APIs)" : "Android (simulated APIs)", nativePermissionFromCTA: true, persisted: true, noSdkOrWorkerBeforeWallet: true, sdkLoadedOnce: true, earlyInstallEventPreserved: !ios, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
}
await writeFile(new URL("browser-validation.json", artifacts), JSON.stringify({ at: (/* @__PURE__ */ new Date()).toISOString(), checks, physicalDeviceValidated: false, realNotificationsSent: 0 }, null, 2));
console.log(JSON.stringify({ passed: checks.length, gateways: 4, engines: ["Chromium", "WebKit"], realNotificationsSent: 0 }));
