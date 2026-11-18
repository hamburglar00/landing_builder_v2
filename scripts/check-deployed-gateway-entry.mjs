import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = require("playwright");
const origins = process.argv.slice(2);
assert.ok(origins.length, "Pass a gateway origin to check its published preparation page.");
const browser = await chromium.launch();
try {
  for (const base of origins) {
    const origin = new URL(base).origin;
    for (const account of [true, false]) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      try {
        const page = await context.newPage();
        const token = account ? "p1.browser-fixture" : "browser-fixture";
        const url = origin + "/prepare?t=" + token;
        const first = account ? "/api/preparations/complete" : "/start";
        const calls = [];
        let failedOnce = false;
        // Only the inert HTML document is fetched. All account, login and session
        // calls are served locally, including the failure that exercises the button.
        await context.route("**/*", async route => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          if (request.url() === url && request.isNavigationRequest() && request.method() === "GET") {
            const document = await route.fetch({ maxRedirects: 0 });
            assert.equal(document.status(), 200);
            return route.fulfill({ response: document });
          }
          if (new URL(request.url()).origin !== origin) return route.abort();
          if (path === "/fixture-home") return route.fulfill({ contentType: "text/html", body: "<p>Sesión confirmada</p>" });
          if (path === first && !failedOnce) {
            failedOnce = true;
            calls.push(path);
            return route.fulfill({ status: 400, json: { error: "fixture_unavailable" } });
          }
          const replies = {
            "/api/preparations/complete": { username: "fixture", continuation_token: "c1.fixture", entry_token: "ge1.fixture", handoff_url: origin + "/start?t=fixture" },
            "/start": { username: "fixture", entry_confirmation: "ge1.fixture", entry_id: "fixture", redirect_url: origin + "/fixture-home", entry_wait: { enabled: false, seconds: 4, continueButtonEnabled: false } },
            "/api/session/recover": { active: true, entry_confirmed: true, entry_id: "fixture" },
          };
          if (Object.hasOwn(replies, path)) {
            calls.push(path);
            return route.fulfill({ json: replies[path] });
          }
          return route.fulfill({ status: 204 });
        });
        await page.goto(url);
        await page.locator("#retry").waitFor({ state: "visible", timeout: 10000 });
        assert.deepEqual(calls, [first], "The first request must reach the fixture before the retry screen appears");
        await page.locator("#retry").click();
        await page.waitForURL(origin + "/fixture-home", { timeout: 15000 });
        assert.deepEqual(calls, [first, ...(account ? [first] : []), "/start", "/api/session/recover"]);
        console.log(origin, account ? "preparation" : "handoff", "retry and confirmed session OK");
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }
