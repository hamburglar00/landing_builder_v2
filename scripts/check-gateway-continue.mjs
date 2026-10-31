// Compiled gateway pages, synthetic responses only; no account/settings mutations.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
const { chromium, webkit } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const artifact = new URL("../.vercel/validation-gateway-continue/", import.meta.url);
await mkdir(artifact, { recursive: true });
const assets = [];
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const dir = path.join(root, repo);
  const result = await build({ absWorkingDir: dir, stdin: { resolveDir: dir, loader: "ts", contents: 'export {renderPreparationPage} from "./src/lib/preparation-page";' }, bundle: true, write: false, platform: "node", format: "cjs" });
  const module = { exports: {} }; new Function("module", "exports", result.outputFiles[0].text)(module, module.exports);
  assets.push({ repo, render: module.exports.renderPreparationPage });
}
const theme = { title: "Fixture", logo: "/logo.svg", logoAlt: "Fixture", background: "#121212", accent: "#f5c518", accentText: "#111", text: "#fff", muted: "#ddd", panel: "#222", panelBorder: "#666", spinnerTrack: "#333", shadow: "none" };
const checks = [];
for (const [engine, browserType] of [["Chromium", chromium], ["WebKit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const { repo, render } of assets) for (const classic of [false, true]) for (const manual of [false, true]) for (const legacyWait of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const requests = [], errors = []; let release, loginStarted = false;
      const loginGate = new Promise(resolve => { release = resolve; });
      page.on("pageerror", error => errors.push(error.message));
      await page.clock.install();
      await page.route("**/*", async route => {
        const request = route.request(), url = new URL(request.url());
        assert.equal(url.origin, 'https://fixture.test'); requests.push(url.pathname);
        if (url.pathname === "/prepare") return route.fulfill({ contentType: "text/html", body: render(classic ? "classic-fixture" : "p1.fixture", theme) });
        if (url.pathname === "/logo.svg") return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"/>' });
        if (url.pathname === "/api/entry-funnel") return route.fulfill({ status: 204, body: "" });
        if (url.pathname === "/api/preparations/complete") return route.fulfill({ json: { username: "fixture-player", continuation_token: "c1.fixture", entry_token: "ge1.fixture", handoff_url: "https://fixture.test/start?t=fixture" } });
        if (url.pathname === "/start") { loginStarted = true; await loginGate; return route.fulfill({ json: { username: "fixture-player", password: "fixture-password", redirect_url: "https://fixture.test/home", entry_confirmation: "ge1.confirmed", entry_id: "exact-fixture-entry", entry_wait: { enabled: legacyWait, seconds: 60, continueButtonEnabled: manual } } }); }
        if (url.pathname === "/api/session/recover") { assert.equal(request.postDataJSON().entry_confirmation, "ge1.confirmed"); return route.fulfill({ json: { active: true, entry_confirmed: true, entry_id: "exact-fixture-entry" } }); }
        if (url.pathname === "/home") return route.fulfill({ contentType: "text/html", body: "<p>Session confirmed</p>" });
        throw Error("Unexpected request " + url.pathname);
      });
      try {
        await page.goto("https://fixture.test/prepare");
        while (!loginStarted) await new Promise(resolve => setTimeout(resolve, 10));
        const button = page.locator("#continue");
        assert.equal(await button.isHidden(), true);
        assert.equal(await button.isDisabled(), true);
        await button.evaluate(element => element.click());
        release();
        if (manual || legacyWait) await page.locator("#password").filter({ hasText: "fixture-password" }).waitFor();
        if (manual) {
          assert.equal(await button.isVisible(), true); assert.equal(await button.isEnabled(), true);
          await page.clock.fastForward(180000);
          assert.equal(new URL(page.url()).pathname, "/prepare");
          assert.equal(requests.includes("/api/session/recover"), false);
          assert.equal(page.frames().length, 1, "human wait never mounts an invisible chat");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          if (!classic && !legacyWait && repo === "landing-autologuin") await page.screenshot({ path: fileURLToPath(new URL(`${engine}-manual-390.png`, artifact)) });
          await button.click();
        } else if (legacyWait) {
          assert.equal(await button.isHidden(), true);
          assert.equal(await button.evaluate(element => getComputedStyle(element).display), "none");
          await page.clock.fastForward(60001);
        }
        await page.waitForURL("https://fixture.test/home");
        assert.equal(requests.filter(url => url === "/start").length, 1);
        assert.equal(requests.filter(url => url === "/api/session/recover").length, 1);
        assert.equal(requests.filter(url => url === "/api/preparations/complete").length, classic ? 0 : 1);
        assert.deepEqual(errors, []);
        checks.push({ repo, engine, classic, manual, legacyWait, earlyClickIgnored: true, exactSessionConfirmed: true });
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
}
await writeFile(new URL("results.json", artifact), JSON.stringify(checks, null, 2));
console.log(`${checks.length} real-browser Continue policy scenarios passed; external business operations: 0`);
