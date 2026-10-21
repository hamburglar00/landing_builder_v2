// Browser regressions with fixture APIs only. No real accounts, messages, resets or financial operations.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url)), builder = path.join(root, "landing-builder/frontend"), atrio = path.join(root, "internal-chat");
const require = createRequire(path.join(builder, "package.json")), { build } = require("esbuild");
let browsers; try { browsers = require("playwright"); } catch { browsers = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
const artifacts = new URL("../.vercel/validation-entry-and-replies/", import.meta.url); await mkdir(artifacts, { recursive: true });
const checks = [];
async function serverModule(repo, imports) {
  const cwd = path.join(root, repo);
  const compiled = await build({ absWorkingDir: cwd, stdin: { contents: imports, resolveDir: cwd, loader: "ts" }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external" });
  const module = { exports: {} }; new Function("module", "exports", "require", compiled.outputFiles[0].text)(module, module.exports, createRequire(path.join(cwd, "package.json"))); return module.exports;
}
const { gatewayLoginPage } = await serverModule("landing-autologuin", 'export {gatewayLoginPage} from "./src/lib/gateway-login-page";');
const renderer = await serverModule("landing-builder/frontend", 'export {renderPublicLandingHtml,renderClassicTemplate7InlineHtml} from "./components/public-landing/renderPublicLandingHtml";');
const css = (await Promise.all((await readdir(path.join(atrio, ".next/static"), { recursive: true })).filter(file => file.endsWith(".css")).map(file => readFile(path.join(atrio, ".next/static", file), "utf8")))).join("\n");
const connections = [
  { id: "00000000-0000-4000-8000-000000000041", manager_id: 1041, agency_name: "Gerencia MKT", manager_type: "mkt", target_provider: "ganamos_net", active: true },
  { id: "00000000-0000-4000-8000-000000000042", manager_id: 1042, agency_name: "Gerencia Full Carga", manager_type: "full_carga", target_provider: "ganamos_net", active: true },
];
const ui = await build({ absWorkingDir: atrio, stdin: { contents: 'import React from "react";import{createRoot}from"react-dom/client";import{AdvisorManagerConnections}from"./src/components/advisor-manager-sync";createRoot(document.getElementById("root")).render(<AdvisorManagerConnections/>);', resolveDir: atrio, loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "fixture-actions", setup(b) {
  b.onResolve({ filter: /^@\/app\/dashboard\/manager-connection-actions$/ }, () => ({ path: "fixture", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `const rows=${JSON.stringify(connections)};export async function listManagerConnectionsAction(){return{connections:rows.map(r=>({...r,full_carga_reply_preferences:r.manager_type==='full_carga'?window.savedPreferences:undefined})),routes:[]}}export async function synchronizeManagerConnectionsAction(){return{status:'synced',pending:[],message:null}}export async function connectManagerAction(){throw Error('Not part of this fixture')}export async function saveFullCargaReplyPreferencesAction(id,preferences){window.saveCalls=(window.saveCalls||0)+1;if(window.failSave)return{ok:false,message:'No pudimos guardar. Intentá nuevamente.'};window.savedPreferences=preferences;return{ok:true,preferences}}`, loader: "js" }));
} }] });
const providers = ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"];
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 768 }];
for (const [engine, browserType] of [["Chromium", browsers.chromium], ["WebKit", browsers.webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.route("https://fixture.test/**", route => route.fulfill({ contentType: "text/html", body: `<html><head><style>${css}</style></head><body style="background:#0b0b0f;color:white;padding:12px"><div id="root"></div><script>${ui.outputFiles[0].text}</script></body></html>` }));
      await page.goto("https://fixture.test/settings");
      if (viewport.width < 1024) await page.getByRole("button", { name: /Bots de PBAdmin/ }).click();
      const gear = page.getByRole("button", { name: "Configurar respuestas del bot 1042" }); await gear.click();
      assert.equal(await page.getByRole("button", { name: "Configurar respuestas del bot 1041" }).count(), 0);
      assert.equal(await page.getByRole("switch").count(), 8);
      assert.equal(await page.getByRole("switch", { name: "Avisos de carga" }).getAttribute("aria-checked"), "true");
      await page.getByRole("switch", { name: "Promociones" }).click(); await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(await page.evaluate(() => window.saveCalls || 0), 0);
      await gear.click(); assert.equal(await page.getByRole("switch", { name: "Promociones" }).getAttribute("aria-checked"), "true");
      await page.getByRole("switch", { name: "Promociones" }).click(); await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" }); await gear.click();
      assert.equal(await page.getByRole("switch", { name: "Promociones" }).getAttribute("aria-checked"), "false");
      const box = await page.getByRole("dialog").boundingBox(); assert.ok(box.x >= 0 && box.width <= viewport.width && box.height <= viewport.height);
      assert.equal(await page.getByRole("dialog").evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await page.evaluate(() => { window.failSave = true; }); await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await page.getByRole("alert").waitFor(); assert.equal(await page.getByRole("dialog").isVisible(), true);
      if (engine === "Chromium" && [390, 1366].includes(viewport.width)) await page.screenshot({ path: fileURLToPath(new URL(`full-carga-${viewport.width}.png`, artifacts)) });
      await page.keyboard.press("Escape"); await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(await gear.evaluate(el => document.activeElement === el), true);
      checks.push({ engine, feature: "Full Carga settings", viewport, switches: 8, realWrites: 0 }); await page.close();
    }
    for (const provider of providers) {
      const html = await gatewayLoginPage(provider).text();
      for (const viewport of [viewports[0], viewports[1], viewports[3]]) {
        const page = await browser.newPage({ viewport });
        await page.route("https://fixture.test/**", route => {
          const pathname = new URL(route.request().url()).pathname;
          if (pathname === "/api/session/recover") return route.fulfill({ json: { active: false } });
          if (/\.(png|webp|avif)$/.test(pathname)) return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84"/>' });
          return route.fulfill({ contentType: "text/html", body: html });
        });
        await page.goto("https://fixture.test/"); await page.getByRole("heading", { name: "Ingresá a tu cuenta" }).waitFor();
        await page.getByLabel("Contraseña", { exact: true }).fill("fixture");
        await page.getByRole("button", { name: "Mostrar contraseña", exact: true }).click(); assert.equal(await page.locator("#password").getAttribute("type"), "text");
        await page.getByRole("button", { name: "Ocultar contraseña", exact: true }).click(); assert.equal(await page.locator("#password").getAttribute("type"), "password");
        const footer = await page.locator("small").evaluate(el => ({ height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight), align: getComputedStyle(el).textAlign }));
        assert.ok(footer.height <= footer.lineHeight * 2 + 1); assert.equal(footer.align, "center");
        assert.equal(await page.getByText("Usá tu usuario y contraseña para volver al casino y a tu chat.", { exact: true }).count(), 0);
        checks.push({ engine, feature: "gateway login", provider, viewport }); await page.close();
      }
      for (const classic of [false, true]) {
        const page = await browser.newPage({ viewport: viewports[1] });
        const config = { schemaVersion: 1, updatedAt: "2026-10-20", id: "00000000-0000-4000-8000-000000000001", name: "Fixture", layout: { template: 7, ctaPosition: "bottom" }, tracking: { pixelId: "123456789", postUrl: "/api/track", landingTag: "TEST", target_provider: provider, ...(provider === "multi_skin" ? { skin_code: "ganamos_plus" } : {}) }, content: { logoUrl: "https://images.test/logo.webp", title: ["Crear cuenta"], subtitle: [], ctaText: "Continuar" }, background: { mode: "single", images: ["https://images.test/background.webp"] } };
        const html = classic ? `<html><head></head><body>${renderer.renderClassicTemplate7InlineHtml({ slug: "fixture", config }, 'function getOrCreateDeviceId(){return "00000000-0000-4000-8000-000000000099";}')}</body></html>` : renderer.renderPublicLandingHtml({ slug: "fixture", config });
        let destinationCalls = 0, startCalls = 0, releaseDestination, releaseStart;
        const destinationGate = new Promise(resolve => { releaseDestination = resolve; }), startGate = new Promise(resolve => { releaseStart = resolve; });
        await page.route("**/*", async route => {
          const url = new URL(route.request().url());
          if (url.hostname === "fixture.test" && ["/fixture", "/l/fixture"].includes(url.pathname)) return route.fulfill({ contentType: "text/html", body: html });
          if (url.pathname === "/api/client-identity/bootstrap") return route.fulfill({ json: { ok: true, recovery_token: "fixture" } });
          if (url.pathname === "/api/template7/destination") { destinationCalls++; await destinationGate; return route.fulfill({ json: { atrioClientId: "00000000-0000-4000-8000-000000000002", atrioId: "00000000-0000-4000-8000-000000000003", atrioSlug: "fixture", preparationReady: true } }); }
          if (["/api/template7/start", "/api/template7/prepare"].includes(url.pathname)) { startCalls++; await startGate; return route.fulfill({ status: 503, json: { error: "fixture_failure" } }); }
          if (url.hostname === "images.test") return route.abort(); // Form and progress must survive unavailable images.
          return route.fulfill({ json: {} });
        });
        await page.goto(`https://fixture.test/${classic ? "" : "l/"}fixture`, { waitUntil: "domcontentloaded" });
        const input = page.locator("[data-template7-name]"); await input.fill("Demo");
        const button = page.locator("[data-public-landing-cta]"); await button.click();
        await page.locator("#gateway-entry-transition").waitFor({ state: "visible" });
        assert.doesNotMatch(await button.textContent(), /Abriendo/);
        await page.waitForTimeout(1650); assert.equal(destinationCalls, 1); assert.equal(startCalls, 0);
        releaseDestination(); await page.waitForFunction(() => document.querySelector("#gateway-entry-transition")?.dataset.stage === "creating");
        await page.waitForTimeout(600); assert.equal(destinationCalls, 1); assert.equal(startCalls, 1);
        releaseStart(); await page.locator("[data-template7-error]").waitFor({ state: "visible" }); await page.locator("#gateway-entry-transition").waitFor({ state: "hidden" });
        checks.push({ engine, feature: "early form and shared destination", provider, motor: classic ? "classic" : "constructor", destinationCalls, startCalls, actualAccountsCreated: 0 }); await page.close();
      }
    }
  } finally { await browser.close(); }
}
await writeFile(new URL("report.json", artifacts), JSON.stringify({ at: new Date().toISOString(), passed: checks.length, simulatedApi: true, productionWrites: 0, cacheNote: "Playwright routes disable HTTP cache. These are functional regressions, not production timing samples.", checks }, null, 2) + "\n");
console.log(JSON.stringify({ passed: checks.length, engines: ["Chromium", "WebKit"], realAccountsCreated: 0, productionWrites: 0 }));
