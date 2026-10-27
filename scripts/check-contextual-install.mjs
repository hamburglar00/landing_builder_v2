// Actual chat + gateway scripts, fixture HTTP only. No accounts or financial actions.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const workspace = fileURLToPath(new URL("../../", import.meta.url));
const atrio = path.join(workspace, "internal-chat");
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
const appRequire = createRequire(path.join(atrio, "package.json"));
const { chromium, webkit } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const output = fileURLToPath(new URL("../.vercel/validation-contextual-install/", import.meta.url));
await mkdir(output, { recursive: true });
const cssFile = path.join(atrio, "src/app/globals.css");
const chatCss = (await appRequire("postcss")([appRequire("@tailwindcss/postcss")({ base: atrio })]).process(await readFile(cssFile, "utf8"), { from: cssFile })).css;
const bundle = await build({ absWorkingDir: atrio, stdin: { resolveDir: atrio, loader: "tsx", contents: 'import React from "react";import{createRoot}from"react-dom/client";import{ClientChatShell}from"./src/components/client-chat-shell";createRoot(document.getElementById("root")).render(<ClientChatShell {...window.fixtureProps}/>);' }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "no-database", setup(b) {
  b.onResolve({ filter: /^@\/lib\/supabase\/anon$/ }, () => ({ path: "anon", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export function createAnonSupabaseClient(){return {}}' }));
} }] });
const configs = [["landing-autologuin", "reydeases-gateway"], ["ases-gateway", "ases-del-norte-gateway"], ["ganamos-gateway", "ganamos-gateway"], ["multi-skin-gateway", "multi-skin-gateway"]];
const checks = [];
for (const [engine, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
  const browser = await type.launch({ headless: true });
  try {
    for (const [repo, fallbackSource] of configs) {
      const root = path.join(workspace, repo);
      const js = await readFile(path.join(root, "public/gateway-client.js"), "utf8");
      const source = js.match(/messageSource:.*?\|\| "([^"]+)"/)?.[1] || fallbackSource;
      const css = await readFile(path.join(root, "public/gateway-client.css"), "utf8");
      const sdk = await readFile(path.join(root, "public/gateway-app-sdk.js"), "utf8");
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      let serial = 0;
      const msg = (sender, content, metadata = {}) => ({ id: `fixture-message-${++serial}`, sender, type: "texto", content, metadata, created_at: new Date(1793100000000 + serial * 1000).toISOString(), read_at: null });
      const wallet = msg("asesor", "Cuenta de prueba", { wallet: { accountNumber: "0000000000000000000000", alias: "fixture", holderName: "Fixture" } });
      let messages = [msg("asesor", "Bienvenida", { source: "auto_welcome" }), wallet];
      const props = { advisorSlug: "fixture", deviceId: "fixture-device-1234", embedded: true, embeddedParentOrigin: "https://gateway.test", embeddedGatewaySource: source, embeddedHasActiveWallet: false, conversationSessionToken: "fixture-token", widgetTemplate: "whatsapp", quickStarters: [], session: { advisor_id: "fixture-advisor", advisor_name: "Asesor de prueba", advisor_avatar_url: null, advisor_status: "disponible", player_id: "fixture-player", conversation_id: "fixture-conversation", player_display_name: "Prueba", player_platform: "ios", app_installed_status: "unknown", whatsapp_url: null, telegram_url: null } };
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.hostname === "gateway.test") {
          if (url.pathname === "/gateway-client.js") return route.fulfill({ contentType: "text/javascript", body: js });
          if (url.pathname === "/gateway-app-sdk.js") return route.fulfill({ contentType: "text/javascript", body: sdk });
          if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#11001f}${css}</style></head><body><script src="/gateway-client.js" data-chat-url="https://chat.test/embed" data-initial-chat-open="true"></script></body></html>` });
          return route.fulfill({ json: { ok: true, active: false } });
        }
        if (url.hostname === "chat.test") {
          if (url.pathname === "/embed") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${chatCss}</style></head><body><div id="root"></div><script>window.fixtureProps=${JSON.stringify({ ...props, initialMessages: messages })}</script><script src="/chat.js"></script></body></html>` });
          if (url.pathname === "/chat.js") return route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
          if (url.pathname === "/api/gateway/chat" && route.request().method() === "POST") {
            const body = route.request().postDataJSON();
            if (body.action === "message") { const message = msg("cliente", body.content); messages.push(message); return route.fulfill({ json: { message } }); }
          }
          return route.fulfill({ json: { ok: true, messages, profile: {} } });
        }
        return route.fulfill({ status: 204 });
      });
      await page.goto("https://gateway.test/");
      const chat = page.frameLocator("#gateway-chat-shell iframe");
      const offer = chat.getByRole("complementary", { name: "Guardar acceso en este teléfono" });
      await chat.getByPlaceholder("Escribi un mensaje...").waitFor();
      await page.waitForFunction(() => !!window.GatewayApp);
      await page.waitForTimeout(1800);
      assert.equal(await offer.count(), 0);
      assert.equal(await page.getByRole("dialog").count(), 0, "No automatic install modal at entry");
      await chat.getByRole("button", { name: "Cerrar chat", exact: true }).click();
      await page.waitForTimeout(700);
      assert.equal(await page.getByRole("dialog").count(), 0, "Closing chat must not open install modal");
      await page.getByRole("button", { name: "Abrir chat de Atrio" }).click();
      await chat.getByPlaceholder("Escribi un mensaje...").fill("Hola, quiero consultar");
      await chat.getByPlaceholder("Escribi un mensaje...").press("Enter");
      await page.waitForTimeout(300);
      assert.equal(await offer.count(), 0);
      messages.push(msg("asesor", "Bienvenida tardía", { source: "auto_welcome" }), { ...wallet, id: "another-wallet" });
      await page.waitForTimeout(1200); assert.equal(await offer.count(), 0);
      messages.push(msg("asesor", "Hola, te ayudo"));
      await offer.waitFor();
      const status = state => msg("asesor", `Estado: ${state}`, { api2_reply: { version: 1, category: "load_status", event: "fixture", status: state } });
      messages.push(status("processing"));
      await offer.waitFor({ state: "detached" });
      messages.push(status("success"));
      await offer.waitFor();
      await page.screenshot({ path: path.join(output, `${engine}-${repo}-offer.png`) });
      await chat.getByRole("button", { name: "Instalar app", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      assert.equal(await page.locator(".gateway-app-notice-copy").innerText(), await page.evaluate(() => window.GatewayApp.installationInstructions("ios")));
      await page.getByRole("button", { name: "Ahora no", exact: true }).click();
      await page.reload();
      await chat.getByPlaceholder("Escribi un mensaje...").waitFor();
      await page.waitForFunction(() => !!window.GatewayApp);
      await page.waitForTimeout(300); assert.equal(await offer.count(), 0, "Dismissal survives reload");
      // A later explicit advisor invitation remains available despite dismissing the offer.
      messages.push({ ...msg("asesor", "Instructivo enviado por el asesor", { source: "install_instructions_rpc" }), type: "instrucciones_instalacion" });
      await page.getByRole("dialog").waitFor();
      assert.equal(await page.locator(".gateway-app-notice-copy").innerText(), "Instructivo enviado por el asesor");
      await page.evaluate(() => localStorage.clear());
      messages = [msg("cliente", "Hola"), msg("asesor", "Te ayudo")];
      await page.addInitScript(() => {
        const original = window.matchMedia.bind(window);
        window.matchMedia = query => query.includes("display-mode") ? { matches: true, addEventListener() {}, removeEventListener() {} } : original(query);
      });
      await page.reload();
      await chat.getByPlaceholder("Escribi un mensaje...").waitFor();
      await page.waitForFunction(() => !!window.GatewayApp);
      await page.waitForTimeout(300);
      assert.equal(await offer.count(), 0, "No install offer inside the installed app");
      assert.deepEqual(errors, []);
      checks.push({ engine, repo, firstExchange: true, pendingLoadDeferred: true, noEntryOrCloseModal: true, dismissalPersisted: true, advisorInvitationPreserved: true, noStandaloneOffer: true });
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ engine, passed: checks.filter(check => check.engine === engine).length }));
}
await writeFile(path.join(output, "report.json"), JSON.stringify({ checks, fixtureOnly: true, productionWrites: 0 }, null, 2));
console.log(JSON.stringify({ passed: checks.length, productionWrites: 0 }));
