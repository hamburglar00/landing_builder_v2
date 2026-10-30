// Fixture-only UI checks: no real accounts, messages, settings changes or financial operations.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url)), atrio = path.join(root, "internal-chat"), gateway = path.join(root, "landing-autologuin");
const require = createRequire(path.join(root, "landing-builder/frontend/package.json")), { build } = require("esbuild");
let browsers; try { browsers = require("playwright"); } catch { browsers = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
const artifact = new URL("../.vercel/validation-entry-wait/", import.meta.url); await mkdir(artifact, { recursive: true });
const ui = await build({ absWorkingDir: atrio, stdin: { resolveDir: atrio, loader: "tsx", contents:
  'import React from "react";import{createRoot}from"react-dom/client";import{GatewayEntrySettingsCard}from"./src/components/gateway-entry-settings-card";const root=createRoot(document.getElementById("root"));window.saved={enabled:false,seconds:4};window.remount=()=>root.render(<GatewayEntrySettingsCard key={window.version=(window.version||0)+1} initialSettings={window.saved}/>);window.remount();' },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "fixture-actions", setup(b) {
    b.onResolve({ filter: /^@\/app\/dashboard\/gateway-entry-actions$/ }, () => ({ path: "actions", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export async function saveGatewayEntrySettingsAction(settings){window.calls=(window.calls||0)+1;if(window.failSave)return{ok:false,message:"No pudimos guardar."};window.saved=settings;return{ok:true,settings}}' }));
  } }] });
const server = await build({ absWorkingDir: gateway, stdin: { resolveDir: gateway, loader: "ts", contents: 'export{renderPreparationPage}from"./src/lib/preparation-page";' }, bundle: true, write: false, platform: "node", format: "cjs" });
const module = { exports: {} }; new Function("module", "exports", server.outputFiles[0].text)(module, module.exports);
const css = (await Promise.all((await readdir(path.join(atrio, ".next/static"), { recursive: true })).filter(file => file.endsWith(".css")).map(file => readFile(path.join(atrio, ".next/static", file), "utf8")))).join("\n");
const checks = [];
for (const [engine, browserType] of [["Chromium", browsers.chromium], ["WebKit", browsers.webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1366, height: 768 }]) {
      const page = await browser.newPage({ viewport });
      await page.route("https://fixture.test/**", route => route.fulfill({ contentType: "text/html", body: `<html><head><style>${css}</style></head><body style="background:#0b0b0f;color:white;padding:12px"><div id="root"></div><script>${ui.outputFiles[0].text}</script></body></html>` }));
      await page.goto("https://fixture.test/settings");
      const toggle = page.getByRole("switch"), seconds = page.getByLabel("Duración (segundos)"), save = page.getByRole("button", { name: "Guardar espera" });
      await seconds.waitFor(); assert.equal(await seconds.isDisabled(), true); assert.equal(await toggle.getAttribute("aria-checked"), "false");
      await toggle.click(); assert.equal(await seconds.inputValue(), "4");
      for (const invalid of ["61", "0", "1.5", ""]) { await seconds.fill(invalid); assert.equal(await save.isDisabled(), true); }
      await seconds.fill("60"); await save.click(); await page.getByText("Configuración guardada.").waitFor();
      assert.deepEqual(await page.evaluate(() => window.saved), { enabled: true, seconds: 60 });
      await page.evaluate(() => window.remount()); assert.equal(await seconds.inputValue(), "60"); assert.equal(await toggle.getAttribute("aria-checked"), "true");
      await toggle.click(); await save.click(); await page.getByText("Configuración guardada.").waitFor(); assert.equal(await seconds.isDisabled(), true);
      assert.deepEqual(await page.evaluate(() => window.saved), { enabled: false, seconds: 60 });
      await toggle.click(); await page.evaluate(() => { window.failSave = true; }); await save.click(); await page.getByRole("alert").waitFor();
      assert.deepEqual(await page.evaluate(() => window.saved), { enabled: false, seconds: 60 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (engine === "Chromium" && viewport.width === 390) await page.screenshot({ path: fileURLToPath(new URL("settings-mobile.png", artifact)) });
      checks.push({ engine, feature: "superadmin settings", viewport, bounds: true, savedAndReopened: true, disabledRetainsSeconds: true, failedSavePreservesStoredValue: true }); await page.close();
    }
    for (const classic of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); let logins = 0, accounts = 0;
      const html = module.exports.renderPreparationPage(classic ? "classic-fixture" : "p1.fixture", { title: "Fixture", logo: "/logo.webp", logoAlt: "Fixture", background: "#080808", accent: "#f6c84b", accentText: "#171105", text: "#fff", muted: "#ddd", panel: "#17140d", panelBorder: "#725b20", spinnerTrack: "#5b481b", shadow: "none" });
      await page.route("https://fixture.test/**", route => {
        const url = new URL(route.request().url());
        if (url.pathname === "/api/preparations/complete") { accounts++; return route.fulfill({ json: { username: "fixtureplayer", continuation_token: "c1.fixture", entry_token: "ge1.fixture", handoff_url: "https://fixture.test/start?t=opaque" } }); }
        if (url.pathname === "/start") { logins++; return route.fulfill({ json: { username: "fixtureplayer", entry_confirmation: "ge1.confirmed", entry_id: "fixture-entry", redirect_url: "https://fixture.test/home", entry_wait: { enabled: true, seconds: 1 } } }); }
        if (url.pathname === "/api/session/recover") return route.fulfill({ json: { active: true, entry_confirmed: true, entry_id: "fixture-entry" } });
        if (url.pathname === "/home") return route.fulfill({ contentType: "text/html", body: "<p>Session ready</p>" });
        if (url.pathname === "/logo.webp") return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"/>' });
        return route.fulfill({ contentType: "text/html", body: html });
      });
      await page.goto("https://fixture.test/prepare"); await page.locator('[data-view="account"]').waitFor();
      assert.equal(await page.locator("#username").textContent(), "fixtureplayer"); assert.equal(new URL(page.url()).pathname, "/prepare");
      await page.waitForURL("https://fixture.test/home"); assert.equal(logins, 1); assert.equal(accounts, classic ? 0 : 1);
      checks.push({ engine, feature: "account-card automatic entry", landingEngine: classic ? "classic" : "constructor", delaySeconds: 1, logins, accountCalls: accounts }); await page.close();
    }
  } finally { await browser.close(); }
}
await writeFile(new URL("report.json", artifact), JSON.stringify({ at: new Date().toISOString(), fixtureOnly: true, createdAccounts: 0, productionSettingsWrites: 0, checks }, null, 2) + "\n");
console.log(JSON.stringify({ passed: checks.length, browsers: ["Chromium", "WebKit"], fixtureOnly: true }));
