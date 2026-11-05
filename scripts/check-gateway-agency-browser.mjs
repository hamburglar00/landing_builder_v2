import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
let playwright;
try { playwright = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
catch { playwright = require("playwright"); }
const source = fileURLToPath(new URL("../../landing-autologuin", import.meta.url));
const compiled = await build({ absWorkingDir: source, entryPoints: ["src/lib/gateway-agency-page.ts"], bundle: true,
  write: false, platform: "node", format: "esm", target: "es2022", plugins: [{ name: "response-only", setup(build) {
    build.onResolve({ filter: /^next\/server$/ }, () => ({ path: "response-only", namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const NextResponse = Response", loader: "js" }));
  } }] });
const { gatewayAgencyPage } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const output = fileURLToPath(new URL("../docs/validation/gateway-agency-20261104", import.meta.url));
await mkdir(output, { recursive: true });
const providers = { rey_de_ases: "landing-autologuin", ases_del_norte: "ases-gateway", ganamos_net: "ganamos-gateway", multi_skin: "multi-skin-gateway" };
let checks = 0;
for (const [engineName, engine] of [["Chromium", playwright.chromium], ["WebKit", playwright.webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const [provider, repo] of Object.entries(providers)) for (const viewport of [{ width: 390, height: 844 }, { width: 1365, height: 768 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage(), calls = [], errors = [];
      let reject = true;
      const html = await gatewayAgencyPage(provider, 17).text();
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        assert.equal(url.origin, "https://gateway.example");
        if (url.pathname === "/17") return route.fulfill({ contentType: "text/html", body: html });
        if (/\.(webp|png|svg)$/.test(url.pathname)) {
          const asset = fileURLToPath(new URL(`../../${repo}/public${url.pathname}`, import.meta.url));
          return route.fulfill({ contentType: url.pathname.endsWith("webp") ? "image/webp" : "image/png", body: await readFile(asset) });
        }
        if (url.pathname === "/api/agency-entry") {
          calls.push(route.request().postDataJSON());
          return route.fulfill({ status: reject ? 401 : 200, contentType: "application/json", body: JSON.stringify(reject ? { error: "Revisá tus datos." } : { recovery_token: "encrypted-fixture", redirect_url: "/home?gateway_chat=open" }) });
        }
        if (url.pathname === "/api/session/recover") return route.fulfill({ contentType: "application/json", body: '{"active":true}' });
        assert.equal(url.pathname, "/home");
        return route.fulfill({ contentType: "text/html", body: "<main>Casino y chat</main>" });
      });
      await page.goto("https://gateway.example/17");
      assert.equal(await page.locator("img").evaluate(img => img.complete && img.naturalWidth > 0), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.ok((await page.locator("img").boundingBox()).width >= 200);
      if (engineName === "Chromium" && (viewport.width === 390 || provider === "ganamos_net")) await page.screenshot({ path: path.join(output, `${provider}-${viewport.width}.png`), fullPage: true });
      await page.locator("#username").fill("cliente"); await page.locator("#password").fill("fixture-password");
      await page.locator("#show-password").click(); assert.equal(await page.locator("#password").getAttribute("type"), "text");
      await page.locator("#submit").click(); await page.locator("#error").filter({ hasText: "Revisá tus datos." }).waitFor();
      assert.equal(await page.locator("#submit").isEnabled(), true); checks++;
      reject = false; await page.locator("#submit").click(); await page.waitForURL("**/home?gateway_chat=open");
      assert.deepEqual(calls.at(-1), { agency_id: 17, action: "login", username: "cliente", password: "fixture-password" });
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes("fixture-password")), false); checks++;
      await page.goto("https://gateway.example/17"); await page.locator("#toggle").click();
      await page.locator("#name").fill("Nombre Cliente"); await page.locator("#submit").click(); await page.waitForURL("**/home?gateway_chat=open");
      assert.deepEqual(calls.at(-1), { agency_id: 17, action: "register", name: "Nombre Cliente" });
      assert.deepEqual(errors, []); checks++;
      await context.close();
    }
  } finally { await browser.close(); }
}
console.log(`${checks} browser scenarios passed: 4 providers, Chromium/WebKit, mobile/desktop; isolated HTTP only.`);
