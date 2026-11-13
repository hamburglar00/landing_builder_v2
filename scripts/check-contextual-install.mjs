// Actual chat + gateway scripts, fixture HTTP only. No accounts or financial actions.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const workspace = fileURLToPath(new URL("../../", import.meta.url));
const product = process.argv.includes("--nexobet") ? "NexoBet" : "internal-chat";
const atrio = path.join(workspace, product);
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
const appRequire = createRequire(path.join(atrio, "package.json"));
const { chromium, webkit } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const output = fileURLToPath(new URL(`../.vercel/validation-contextual-install-${product}/`, import.meta.url));
await mkdir(output, { recursive: true });
const cssFile = path.join(atrio, "src/app/globals.css");
let chatCss = (await appRequire("postcss")([appRequire("@tailwindcss/postcss")({ base: atrio })]).process(await readFile(cssFile, "utf8"), { from: cssFile })).css;
const bundle = await build({ absWorkingDir: atrio, stdin: { resolveDir: atrio, loader: "tsx", contents: 'import React from "react";import{createRoot}from"react-dom/client";import{ClientChatShell}from"./src/components/client-chat-shell";createRoot(document.getElementById("root")).render(<ClientChatShell {...window.fixtureProps}/>);' }, bundle: true, write: false, outfile: "chat.js", platform: "browser", format: "iife", jsx: "automatic", define: { "process.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "no-database", setup(b) {
  b.onResolve({ filter: /^@\/lib\/supabase\/anon$/ }, () => ({ path: "anon", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export function createAnonSupabaseClient(){return {}}' }));
} }] });
chatCss += bundle.outputFiles.find(file => file.path.endsWith(".css"))?.text || "";
const configs = [["landing-autologuin", "reydeases-gateway"], ["ases-gateway", "ases-del-norte-gateway"], ["ganamos-gateway", "ganamos-gateway"], ["multi-skin-gateway", "multi-skin-gateway"]];
const checks = [];
const TWO_HOURS = 2 * 60 * 60 * 1000;
for (const [engine, type] of (process.argv.includes("--quick") ? [["Chromium", chromium]] : (process.argv.includes("--webkit") ? [["WebKit", webkit]] : [["Chromium", chromium], ["WebKit", webkit]]))) {
  const browser = await type.launch({ headless: true });
  try {
    for (const [repo, fallbackSource] of (process.argv.includes("--quick") ? configs.slice(0, 1) : configs.filter(([repo])=>!process.env.GATEWAY_TEST_PROVIDER || repo===process.env.GATEWAY_TEST_PROVIDER))) {
      const root = path.join(workspace, repo);
      const js = await readFile(path.join(root, "public/gateway-client.js"), "utf8");
      const source = js.match(/messageSource:.*?\|\| "([^"]+)"/)?.[1] || fallbackSource;
      const css = await readFile(path.join(root, "public/gateway-client.css"), "utf8");
      const sdk = await readFile(path.join(root, "public/gateway-app-sdk.js"), "utf8");
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile" });
      // Keep installation/reminder HTTP fixtures independent of OS service workers.
      // The separate deferred-app checker verifies worker registration and push.
      await context.addInitScript(() => {
        const worker = { pushManager: { getSubscription: async () => null } };
        Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {
          register: async () => worker, ready: Promise.resolve(worker), controller: null,
          getRegistration: async () => worker, addEventListener() {}, removeEventListener() {}
        } });
      });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(15000);
      page.on("pageerror", error => errors.push(error.message));
      let serial = 0;
      let now = Date.now();
      let profile = { displayName:"Prueba",whatsapp:"",email:"" };
      await page.clock.setFixedTime(now);
      const msg = (sender, content, metadata = {}) => ({ id: `fixture-message-${++serial}`, sender, type: "texto", content, metadata, created_at: new Date(now + serial).toISOString(), read_at: null });
      const wallet = msg("asesor", "Cuenta de prueba", { wallet: { accountNumber: "0000000000000000000000", alias: "fixture", holderName: "Fixture" } });
      let messages = [msg("asesor", "Bienvenida", { source: "auto_welcome" }), wallet];
      const props = { advisorSlug: "fixture", deviceId: "fixture-device-1234", embedded: true, embeddedParentOrigin: "https://gateway.test", embeddedGatewaySource: source, embeddedHasActiveWallet: false, conversationSessionToken: "fixture-token", widgetTemplate: "whatsapp", quickStarters: [], session: { advisor_id: "fixture-advisor", advisor_name: "Asesor de prueba", advisor_avatar_url: null, advisor_status: "disponible", player_id: "fixture-player", conversation_id: "fixture-conversation", player_display_name: "Prueba", player_platform: "ios", app_installed_status: "unknown", whatsapp_url: null, telegram_url: null } };
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.hostname === "gateway.test") {
          if (url.pathname === "/gateway-client.js") return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: js });
          if (url.pathname === "/gateway-app-sdk.js") return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: sdk });
          if (url.pathname === "/") return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--gateway-primary:#a726d9;--gateway-surface:#1c082e;--gateway-page-background:#11001f}body{background:#11001f}${css}</style></head><body><script src="/gateway-client.js" data-chat-url="https://chat.test/embed" data-initial-chat-open="true"></script></body></html>` });
          return route.fulfill({ json: { ok: true, active: false } });
        }
        if (url.hostname === "chat.test") {
          if (url.pathname === "/embed") return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${chatCss}</style></head><body><div id="root"></div><script>window.fixtureProps=${JSON.stringify({ ...props, initialMessages: messages })}</script><script src="/chat.js"></script></body></html>` });
          if (url.pathname === "/chat.js") return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: bundle.outputFiles[0].text });
          if (url.pathname === "/api/gateway/chat" && route.request().method() === "POST") {
            const body = route.request().postDataJSON();
            if (body.action === "visible_entry") return route.fulfill({ json: { messages, walletReady: true, walletRequestCompleted: true, entryDiagnostics: [] } });
            if (body.action === "app_invitation" || body.action === "installation_help") {
              const source = body.action === "app_invitation" ? "automatic_install_invite" : "client_install_help";
              let message = messages.find(row=>row.metadata?.source===source);
              if (!message) { message = {...msg("asesor","Guardamos tu acceso para volver cuando quieras",{source}),type:body.action === "app_invitation" ? "instrucciones_instalacion" : "texto"}; messages.push(message); }
              return route.fulfill({json:{message}});
            }
            if (body.action === "message") { const message = msg("cliente", body.content); messages.push(message); return route.fulfill({ json: { message } }); }
          }
          return route.fulfill({ json: { ok: true, messages, profile } });
        }
        return route.fulfill({ status: 204 });
      });
      await page.goto("https://gateway.test/");
      const chat = page.frameLocator("#gateway-chat-shell iframe");
      const closeChat = async () => {
        await page.locator('#gateway-chat-shell[data-motion="open"]').waitFor();
        await chat.getByRole("button",{name:"Cerrar chat",exact:true}).click();
        await page.locator('#gateway-chat-shell[data-open="false"]').waitFor();
      };
      const offer = chat.locator('[data-chat-invitation-action="install_app"]');
      await chat.getByPlaceholder("Escribi un mensaje...").waitFor();
      await page.waitForFunction(() => !!window.GatewayApp);
      for (const name of ["Mi perfil","Cerrar chat"]) {
        const button=chat.getByRole("button",{name,exact:true});
        assert.equal(await button.evaluate(el=>getComputedStyle(el).borderTopWidth),"1px");
        assert.ok(Math.abs((await button.boundingBox()).width-40)<1);
      }
      assert.equal(await chat.getByRole("button",{name:/Maximizar/}).count(),0);
      assert.equal(await page.getByRole("dialog").count(),0);
      await chat.getByPlaceholder("Escribi un mensaje...").fill("Hola, quiero consultar");
      await chat.getByPlaceholder("Escribi un mensaje...").press("Enter");
      await page.waitForTimeout(300);assert.equal(await offer.count(),0);
      messages.push(msg("asesor","Hola, *te ayudo*"));
      await offer.waitFor();
      for(const text of ['Hola, quiero consultar','Hola, te ayudo']) {
        const bubble=chat.locator('[data-chat-message-row]').filter({hasText:text}).last().locator('.chat-message-copyable').first();
        assert.deepEqual(await bubble.evaluate(e=>({size:getComputedStyle(e).fontSize,weight:getComputedStyle(e).fontWeight})),{size:'15px',weight:'600'});
      }
      assert.equal(await chat.locator('strong').filter({hasText:'te ayudo'}).evaluate(e=>getComputedStyle(e).fontWeight),'700');
      assert.equal(await chat.getByText('0000000000000000000000',{exact:true}).evaluate(e=>getComputedStyle(e).fontWeight),'700');
      assert.equal(await chat.getByText('CBU',{exact:true}).evaluate(e=>getComputedStyle(e).fontWeight),'700');
      assert.equal(await page.getByRole("dialog").count(),0,"Receiving an invitation never opens a modal");
      await offer.getByRole("button",{name:"Instalar app",exact:true}).click();
      await page.getByRole("dialog").waitFor();
      const rect=await page.locator('.gateway-app-notice').boundingBox();
      assert.ok(rect.x>=14 && rect.y>=16 && rect.x+rect.width<=376 && rect.y+rect.height<=828);
      assert.equal(await page.locator('.gateway-app-notice-copy').first().evaluate(e=>getComputedStyle(e).fontWeight),"700");
      assert.equal(await page.locator('.gateway-app-notice').evaluate(e=>getComputedStyle(e).getPropertyValue('--gateway-page-primary').trim()),"#a726d9");
      await page.getByRole("button",{name:"Entendido",exact:true}).click();
      assert.equal(await offer.count(),1,"Acknowledgement retains the history and CTA");
      await chat.locator('.chat-install-help').waitFor();
      await offer.getByRole("button",{name:"Instalar app",exact:true}).click();
      await page.getByRole("button",{name:"Ahora no",exact:true}).click();
      await page.waitForTimeout(400);assert.equal(await chat.locator('.chat-install-help').count(),1,"Repeated taps reuse help");
      messages.push({...msg("asesor","Instala desde este mensaje",{source:"install_instructions_rpc"}),type:"instrucciones_instalacion"});
      messages.push({...msg("asesor","Recibi mis avisos",{source:"push_activation_invite"}),type:"instrucciones_instalacion"});
      messages.push(msg("asesor","Completa tus datos",{source:"profile_completion_invite"}));
      await chat.locator('[data-chat-invitation-action="complete_profile"]').waitFor();
      assert.equal(await page.getByRole("dialog").count(),0);
      await chat.getByRole("button",{name:"Mi perfil",exact:true}).click();
      await page.locator('#gateway-chat-shell[data-profile-overlay="true"]').waitFor();
      const profileRect=await chat.getByRole("dialog",{name:"Mi perfil",exact:true}).boundingBox();
      assert.ok(profileRect.x>=16 && profileRect.y>=16 && profileRect.x+profileRect.width<=374 && profileRect.y+profileRect.height<=828);
      assert.equal(await chat.getByRole("dialog",{name:"Mi perfil",exact:true}).evaluate(e=>e.scrollHeight>e.clientHeight+1),false);
      await page.screenshot({path:path.join(output,`${engine}-${repo}-profile.png`)});
      await chat.getByRole("button",{name:"Cerrar",exact:true}).click();
      await page.locator('#gateway-chat-shell[data-profile-overlay="false"]').waitFor();
      await closeChat();
      await page.waitForTimeout(1000);await page.getByRole("button",{name:"Abrir chat de Atrio"}).click();
      await page.waitForTimeout(4300);assert.equal(await page.getByRole("dialog").count(),0,"Reopening cancels the pending automatic prompt");
      await closeChat();
      await page.getByRole("dialog").waitFor();
      const firstShown=await page.evaluate(()=>Number(localStorage.getItem('gateway:automatic-install:last-shown:v1')));
      assert.ok(firstShown>0);
      await page.getByRole("button",{name:"Ahora no",exact:true}).click();
      await page.getByRole("button",{name:"Abrir chat de Atrio"}).click();
      await closeChat();
      await page.waitForTimeout(5200);assert.equal(await page.getByRole("dialog").count(),0,"Automatic cooldown is separate from manual invitations");
      now+=30*60*1000+1000;await page.clock.setFixedTime(now);
      assert.equal(await page.locator("#gateway-chat-shell").getAttribute("data-open"),"false");
      await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
      await page.getByRole("dialog").waitFor().catch(async error => {
        console.log(JSON.stringify({engine,repo,diagnostic:await page.evaluate(()=>({now:Date.now(),last:localStorage.getItem('gateway:automatic-install:last-shown:v1'),visibility:document.visibilityState,open:document.querySelector('#gateway-chat-shell')?.dataset.open,dialogs:[...document.querySelectorAll('[aria-modal="true"]')].map(e=>({text:e.textContent?.slice(0,60),visible:!!e.getClientRects().length})),installed:localStorage.getItem('gateway:installed')})),errors}));
        throw error;
      });
      assert.ok(await page.evaluate(()=>Number(localStorage.getItem('gateway:automatic-install:last-shown:v1')))>firstShown);
      await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
      await page.getByRole("dialog").waitFor({state:"detached"});
      await page.getByRole("button",{name:"Abrir chat de Atrio"}).click();
      await chat.getByRole("button",{name:"App instalada",exact:true}).first().waitFor();
      assert.equal(await chat.getByRole("button",{name:"Instalar app",exact:true}).count(),0);
      assert.deepEqual(errors,[]);
      checks.push({engine,repo,persistentInvitations:true,manualOnly:true,profileOverlay:true,modalMargins:true,thirtyMinuteCooldown:true,reopenCancels:true,confirmedInstallation:true});
      console.log(JSON.stringify({engine,repo,passed:true}));
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ engine, passed: checks.filter(check => check.engine === engine).length }));
}
await writeFile(path.join(output, "report.json"), JSON.stringify({ checks, fixtureOnly: true, productionWrites: 0 }, null, 2));
console.log(JSON.stringify({ passed: checks.length, productionWrites: 0 }));
