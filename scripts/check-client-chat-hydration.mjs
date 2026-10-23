import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
const require2 = createRequire(new URL("../frontend/package.json", import.meta.url)), { build } = require2("esbuild");
let browsers;
try {
  browsers = require2(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
} catch {
  const entry = process.env.PLAYWRIGHT_MODULE_PATH || process.env.APPDATA && path.join(process.env.APPDATA, "npm/node_modules/playwright");
  if (!entry) throw Error("Install Playwright or set PLAYWRIGHT_MODULE_PATH");
  browsers = require2(entry);
}
const { chromium, webkit } = browsers;
const root = fileURLToPath(new URL("../../internal-chat", import.meta.url));
const artifacts = new URL("../.vercel/validation-deferred-app/", import.meta.url);
await mkdir(artifacts, { recursive: true });
process.env.TZ = "UTC";
process.env.NODE_ENV = "production";
const requireApp = createRequire(root + "/package.json");
const msg = { id: "00000000-0000-4000-8000-000000000003", sender: "asesor", type: "texto", content: "Fixture hydration message", metadata: {}, created_at: "2026-10-17T12:03:00.000Z", delivered_at: null, read_at: null };
const props = { advisorSlug: "fixture", deviceId: "00000000-0000-4000-8000-000000000001", embedded: true, embeddedParentOrigin: "https://fixture.test", embeddedHasActiveWallet: false, conversationSessionToken: "synthetic-token", widgetTemplate: "atrio", initialMessages: [msg], quickStarters: [], session: { advisor_id: "00000000-0000-4000-8000-000000000002", advisor_name: "Fixture", advisor_avatar_url: null, advisor_status: "disponible", player_id: "00000000-0000-4000-8000-000000000001", conversation_id: "00000000-0000-4000-8000-000000000004", player_display_name: "Fixture", player_platform: "android", app_installed_status: "unknown", whatsapp_url: null, telegram_url: null } };
const define = { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://db.fixture.test"', "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '"synthetic-test-key"', "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '"synthetic-test-key"', "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": "undefined" };
const checks = [];
for (const phase of ["fixed"]) {
  const component = root + "/src/components/client-chat-shell.tsx";
  const imports = 'import React from "react";import{ClientChatShell}from' + JSON.stringify(component) + ";const props=" + JSON.stringify(props) + ";";
  const server = await build({ absWorkingDir: root, nodePaths: [root + "/node_modules"], tsconfig: root + "/tsconfig.json", stdin: { contents: imports + 'import{renderToString}from"react-dom/server";export const html=renderToString(React.createElement(ClientChatShell,props));', resolveDir: root, loader: "tsx" }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", define });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", server.outputFiles[0].text)(loaded, loaded.exports, requireApp);
  const html = loaded.exports.html;
  assert.ok(html.includes("12:03"));
  const client = await build({ absWorkingDir: root, nodePaths: [root + "/node_modules"], tsconfig: root + "/tsconfig.json", stdin: { contents: imports + 'import{hydrateRoot}from"react-dom/client";hydrateRoot(document.getElementById("root"),React.createElement(ClientChatShell,props),{onRecoverableError(error){window.hydrationErrors.push(error.message)}});', resolveDir: root, loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define });
  for (const [engine, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
    const browser = await type.launch({ headless: true });
    try {
      for (const zone of ["America/Argentina/Buenos_Aires", "UTC"]) {
        const page = await browser.newPage({ timezoneId: zone });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript(() => {
          window.hydrationErrors = [];
        });
        await page.route("**/*", (route) => {
          const path2 = new URL(route.request().url()).pathname;
          if (path2 === "/") return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root">' + html + '</div><script src="/client.js"><\/script></body></html>' });
          if (path2 === "/client.js") return route.fulfill({ contentType: "application/javascript", body: client.outputFiles[0].text });
          return route.fulfill({ json: { ok: true, messages: [msg], profile: {} } });
        });
        await page.goto("https://fixture.test/");
        await page.getByPlaceholder("Escribi un mensaje...").waitFor();
        await page.waitForTimeout(500);
        const recoverable = await page.evaluate(() => window.hydrationErrors), local = await page.locator("body").innerText();
        const expected = zone === "UTC" ? "12:03" : "09:03";
        assert.ok(local.includes(expected));
        const mismatch = recoverable.some((e) => e.includes("#418") || e.includes("Hydration"));
        assert.equal(mismatch, false);
        assert.equal(errors.length, 0, errors.join("\n"));
        checks.push({ phase, engine, zone, hydrationMismatch: mismatch, browserLocalTime: expected });
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
}
await writeFile(new URL("hydration-validation.json", artifacts), JSON.stringify({ at: (/* @__PURE__ */ new Date()).toISOString(), checks, externalNetwork: 0, accountsCreated: 0 }, null, 2));
console.log(JSON.stringify({ passed: checks.length, hydrationErrors: 0, browserLocalHoursPreserved: true }));
