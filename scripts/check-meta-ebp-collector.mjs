import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium, webkit } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const manifest = await readFile(path.join(root, "frontend/lib/meta/ebpAssetManifest.ts"), "utf8");
const assetUrl = manifest.match(/META_EBP_COLLECTOR_URL = "([^"]+)"/)[1];
const asset = await readFile(path.join(root, "frontend/public", assetUrl), "utf8");
assert.equal(asset, await readFile(path.join(root, "../landing-prueba-1/public", assetUrl), "utf8"));
const cases = [
  ["ios-success", "currentIosClick_123", 1], ["ios-reject", null, 1], ["ios-throw", null, 1],
  ["ios-timeout", null, 1], ["ios-late", null, 1], ["ios-invalid", null, 1], ["ios-number", null, 1],
  ["android-success", "currentAndroidClick_123", 1], ["android-facebook", "currentAndroidClick_123", 1],
  ["android-error", null, 1], ["android-timeout", null, 1], ["android-http-error", null, 1],
  ["android-empty", null, 1], ["android-open-throw", null, 1], ["android-send-throw", null, 1],
  ["android-constructor-throw", null, 1], ["android-old-instagram", null, 0], ["android-old-facebook", null, 0],
  ["unsupported", null, 0],
];
const results = [];
for (const [engine, launcher] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await launcher.launch({ headless: true });
  try { for (const [mode, expected, expectedCalls] of cases) {
    const context = await browser.newContext();
    const page = await context.newPage(), errors = [], requests = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", route => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Isolated EBP fixture</title>" });
    });
    try {
      await page.goto("https://ebp.fixture.test/");
      await page.clock.install();
      await page.evaluate(mode => {
        const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
        document.cookie = "_fbc=fb.1.1600000000000.foreignClick; path=/";
        document.cookie = "_fbp=fb.1.1600000000000.foreignBrowser; path=/";
        window.cookieBefore = descriptor.get.call(document);
        window.cookieReads = 0; window.cookieWrites = 0;
        Object.defineProperty(document, "cookie", { configurable: true,
          get() { window.cookieReads++; return descriptor.get.call(document); },
          set(value) { window.cookieWrites++; descriptor.set.call(document, value); },
        });
        window.readCookieDirectly = () => descriptor.get.call(document);
        window.bridgeCalls = []; window.aborts = 0; window.unhandled = [];
        window.addEventListener("unhandledrejection", event => window.unhandled.push(String(event.reason)));
        window.clientParamBuilder = { unchanged: true };
        if (mode.startsWith("ios-")) {
          Object.defineProperty(window, "webkit", { configurable: true, value: { messageHandlers: { browserProperties: {
            postMessage(path) {
              window.bridgeCalls.push({ path });
              if (mode === "ios-throw") throw Error("Fixture native failure");
              if (mode === "ios-reject") return Promise.reject(Error("Fixture rejected"));
              if (mode === "ios-timeout") return new Promise(() => {});
              if (mode === "ios-late") return new Promise(resolve => setTimeout(() => resolve("tooLateClick"), 1200));
              if (mode === "ios-invalid") return Promise.resolve("invalid.click id");
              if (mode === "ios-number") return Promise.resolve(123);
              return Promise.resolve("currentIosClick_123");
            },
          } } } });
        } else {
          Object.defineProperty(window, "webkit", { configurable: true, value: undefined });
          Object.defineProperty(navigator, "userAgent", { configurable: true, value:
            mode === "unsupported" ? "Mozilla Chrome" :
            mode === "android-old-instagram" ? "Android Instagram 263" :
            mode === "android-old-facebook" ? "Android FB_IAB FBAV/396" :
            mode === "android-facebook" ? "Android FB_IAB FBAV/397" : "Android Instagram 264",
          });
          window.XMLHttpRequest = class {
            readyState = 0; status = 0; responseText = "";
            constructor() {
              if (mode === "android-constructor-throw") { window.bridgeCalls.push({ constructor: true }); throw Error("Fixture constructor failure"); }
            }
            open(method, url) {
              window.bridgeCalls.push({ method, url });
              if (mode === "android-open-throw") throw Error("Fixture open failure");
            }
            send() {
              if (mode === "android-send-throw") throw Error("Fixture send failure");
              if (mode === "android-timeout") return;
              queueMicrotask(() => {
                if (mode === "android-error") { this.onerror?.(); return; }
                this.readyState = 4;
                this.status = mode === "android-http-error" ? 400 : 200;
                this.responseText = mode === "android-empty" ? "" : "currentAndroidClick_123";
                this.onload?.();
              });
            }
            abort() { window.aborts++; }
          };
        }
        window.originalWebkit = window.webkit;
        window.originalXhr = window.XMLHttpRequest;
        window.originalSdk = window.clientParamBuilder;
      }, mode);
      await page.addScriptTag({ content: asset });
      assert.deepEqual(await page.evaluate(() => window.bridgeCalls), [], "loading never invokes EBP");
      await page.evaluate(() => {
        window.result = "pending";
        window.started = performance.now();
        const first = window.__ATRIO_META_COLLECT_CLICK_ID__();
        window.samePromise = first === window.__ATRIO_META_COLLECT_CLICK_ID__();
        first.then(value => { window.result = value; window.elapsed = performance.now() - window.started; });
      });
      await page.clock.runFor(810);
      const state = await page.evaluate(() => ({ result: window.result, elapsed: window.elapsed,
        calls: window.bridgeCalls, samePromise: window.samePromise,
        cookieReads: window.cookieReads, cookieWrites: window.cookieWrites,
        cookiesUnchanged: window.readCookieDirectly() === window.cookieBefore,
        globalsUnchanged: window.webkit === window.originalWebkit && window.XMLHttpRequest === window.originalXhr && window.clientParamBuilder === window.originalSdk,
      }));
      assert.equal(state.result, expected, `${engine}/${mode}`);
      assert.ok(state.elapsed <= 800, `${engine}/${mode} deadline ${state.elapsed}`);
      assert.equal(state.calls.length, expectedCalls);
      assert.equal(state.samePromise, true);
      assert.equal(state.cookieReads, 0); assert.equal(state.cookieWrites, 0);
      assert.equal(state.cookiesUnchanged, true); assert.equal(state.globalsUnchanged, true);
      for (const call of state.calls) {
        if (call.path) assert.equal(call.path, "clickID");
        if (call.url) assert.deepEqual(call, { method: "GET", url: "properties://browser/clickID" });
      }
      await page.clock.runFor(500);
      assert.equal(await page.evaluate(() => window.result), expected, "late reply cannot replace settled result");
      assert.deepEqual(await page.evaluate(() => window.unhandled), []);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, ["https://ebp.fixture.test/"]);
      results.push({ engine, mode, passed: true, elapsedMs: state.elapsed, calls: state.calls.length, cookiesUntouched: true, globalsUntouched: true, noBusinessRequests: true });
    } finally { await context.close(); }
  } } finally { await browser.close(); }
}
const report = { assetUrl, cases: results.length, passed: true, results };
const destination = path.join(root, "docs/validation/meta-ebp-collector-20261031.json");
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ cases: results.length, passed: true, assetUrl }));
