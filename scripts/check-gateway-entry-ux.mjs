// Actual gateway renderers/assets with local fixtures; no accounts or financial requests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
let playwright;
try { playwright = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
catch { playwright = require("playwright"); }
const artifact = fileURLToPath(new URL("../.vercel/validation-entry-ux/", import.meta.url));
await mkdir(artifact, { recursive: true });
const repos = ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"];
const assets = await Promise.all(repos.map(async repo => {
  const gateway = path.join(root, repo);
  const compiled = await build({ absWorkingDir: gateway, stdin: { resolveDir: gateway, loader: "ts", contents: 'export{renderPreparationPage}from"./src/lib/preparation-page";export{applyGatewayBrowserAppearance}from"./src/lib/gateway-browser-appearance";' }, bundle: true, write: false, platform: "node", format: "cjs" });
  const module = { exports: {} }; new Function("module", "exports", compiled.outputFiles[0].text)(module, module.exports);
  return { repo, ...module.exports, css: await readFile(path.join(gateway, "public/gateway-client.css"), "utf8"), js: await readFile(path.join(gateway, "public/gateway-client.js"), "utf8") };
}));
const theme = { title: "Fixture", canvasColor: "#0b0b0f", logo: "/logo.webp", logoAlt: "Fixture", background: "#0b0b0f", accent: "#f6c84b", accentText: "#171105", text: "#ffffff", muted: "#dddddd", panel: "#17140d", panelBorder: "#725b20", spinnerTrack: "#5b481b", shadow: "none" };
const checks = [];
for (const [engine, browserType] of [["Chromium", playwright.chromium], ["WebKit", playwright.webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const asset of assets) {
      for (const classic of [false, true]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        let release, cookieRequested = false, starts = 0, accounts = 0, confirmations = 0;
        const cookieGate = new Promise(resolve => { release = resolve; });
        await page.route("https://fixture.test/**", async route => {
          const url = new URL(route.request().url());
          if (url.pathname === "/api/preparations/complete") { accounts++; return route.fulfill({ json: { username: "fixtureplayer", continuation_token: "c1.fixture", handoff_url: "https://fixture.test/start?t=fixture" } }); }
          if (url.pathname === "/start") { starts++; assert.equal(route.request().headers().accept, "application/json"); return route.fulfill({ json: { username: "fixtureplayer", password: "fixture-password", redirect_url: "https://fixture.test/home", entry_wait: { enabled: true, seconds: 60 } } }); }
          if (url.pathname === "/api/session/recover") { confirmations++; cookieRequested = true; await cookieGate; return route.fulfill({ json: { active: true } }); }
          if (url.pathname === "/api/session/credentials") throw Error("Entry must reuse /start credentials");
          if (url.pathname === "/home") return route.fulfill({ contentType: "text/html", body: "<p>Ingreso confirmado</p>" });
          if (url.pathname === "/logo.webp") return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><circle cx="120" cy="90" r="64" fill="none" stroke="#f6c84b" stroke-width="3"/><text x="120" y="100" fill="#f6c84b" font-size="24" text-anchor="middle">Fixture</text></svg>' });
          return route.fulfill({ contentType: "text/html", body: asset.renderPreparationPage(classic ? "classic-fixture" : "p1.fixture", theme) });
        });
        await page.goto("https://fixture.test/prepare");
        await page.getByRole("button", { name: "Continuar a la plataforma", exact: true }).waitFor();
        await page.locator("#password").filter({hasText:"fixture-password"}).waitFor();
        assert.equal(await page.getByRole("button", {name:"Copiar clave",exact:true}).isEnabled(), true);
        const next = page.locator("#continue");
        try { await next.click({ timeout: 5000 }); }
        catch (error) { await page.screenshot({ path: path.join(artifact, engine + "-" + asset.repo + "-continue-error.png") }); console.log(JSON.stringify({ engine, repo: asset.repo, classic, html: await page.locator("main").innerHTML() })); throw error; }
        assert.equal(await next.isDisabled(), true);
        assert.equal(await next.getAttribute("aria-busy"), "true");
        assert.equal(await next.textContent(), "Preparando tu ingreso…");
        assert.notEqual(await next.evaluate(el => getComputedStyle(el, "::before").animationName), "none");
        assert.equal(new URL(page.url()).pathname, "/prepare");
        await next.evaluate(el => el.click());
        for (let n = 0; n < 50 && !cookieRequested; n++) await page.waitForTimeout(10);
        assert.equal(cookieRequested, true);
        if (asset.repo === repos[0] && !classic) await page.screenshot({ path: path.join(artifact, engine + "-continue-pending.png") });
        release(); await page.waitForURL("https://fixture.test/home");
        assert.equal(starts, 1); assert.equal(confirmations, 1); assert.equal(accounts, classic ? 0 : 1);
        checks.push({ repo: asset.repo, engine, landingEngine: classic ? "classic" : "constructor", busyFeedbackBeforeConfirmation: true, duplicateClickIgnored: true, starts, confirmations, fixtureAccountCalls: accounts });
        await page.close();
      }
      for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 768 }]) {
        const page = await browser.newPage({ viewport });
        const errors = []; page.on("pageerror", error => errors.push(String(error)));
        let frameNavigations = 0, sdkRequests = 0;
        const palette = { "landing-autologuin": "#141414", "ases-gateway": "#071b2c", "ganamos-gateway": "#11001f", "multi-skin-gateway": "#121212" }[asset.repo];
        const paletteRgb = "rgb(" + [1,3,5].map(index => parseInt(palette.slice(index,index+2),16)).join(", ") + ")";
        const html = asset.applyGatewayBrowserAppearance(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${asset.css}</style></head><body><button id="provider" style="position:fixed;inset:0;background:${palette};color:white" onclick="window.providerClicks=(window.providerClicks||0)+1">Casino de prueba</button><script src="/gateway-client.js" data-chat-url="https://chat.test/embed"></script></body></html>`, palette);
        await page.route("https://fixture.test/**", route => {
          const url = new URL(route.request().url());
          if (url.pathname === "/gateway-client.js") return route.fulfill({ contentType: "application/javascript", body: asset.js });
          if (url.pathname === "/gateway-app-sdk.js") sdkRequests++;
          if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { ok: true } });
          return route.fulfill({ contentType: "text/html", body: html });
        });
        await page.route("https://chat.test/**", route => {
          frameNavigations++;
          return route.fulfill({ contentType: "text/html", body: `<html><body style="margin:0;background:#efe7e1;color:#161616;font-family:system-ui"><header style="padding:20px;background:#08786b;color:white">Tu asesor <button id="close" onclick="parent.postMessage({source:'atrio-widget',type:'atrio.widget.close'},'https://fixture.test')">Cerrar chat</button></header><p>Chat listo</p><script>parent.postMessage({source:'atrio-widget',type:'atrio.widget.bootstrap',presentation:{template:'whatsapp',primary:'#00cc66',primaryHover:'#00dd77',accent:'#08786b',background:'#efe7e1',surface:'#ffffff',text:'#161616',buttonText:'#ffffff',border:'#00cc66'}},'https://fixture.test');parent.postMessage({source:'atrio-widget',type:'atrio.widget.ready'},'https://fixture.test');</script></body></html>` });
        });
        await page.goto("https://fixture.test/");
        const launcher = page.locator("#gateway-chat-button"), shell = page.locator("#gateway-chat-shell");
        await launcher.waitFor();
        const canvas = async () => page.locator("#gateway-browser-edge").evaluate(el => ({ background: getComputedStyle(el).backgroundColor, opacity: getComputedStyle(el).opacity, bottom: el.getBoundingClientRect().bottom, height: el.getBoundingClientRect().height, viewport: innerHeight, hitTarget: document.elementFromPoint(innerWidth / 2, innerHeight - 2)?.id }));
        for (let cycle = 0; cycle < 2; cycle++) {
          const before = await canvas(); assert.equal(before.background, paletteRgb); assert.equal(before.opacity, "1"); assert.equal(before.bottom, before.viewport); assert.ok(before.height >= 8); assert.notEqual(before.hitTarget, "gateway-browser-edge");
          assert.equal(await page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor), paletteRgb);
          await launcher.click();
          const opening = await shell.evaluate(el => ({ width: el.getBoundingClientRect().width, layoutWidth: el.offsetWidth, opacity: Number(getComputedStyle(el).opacity), inert: el.inert }));
          assert.ok(opening.width > 0); assert.ok(opening.width < opening.layoutWidth); assert.equal(opening.inert, false);
          await page.waitForFunction(() => document.querySelector("#gateway-chat-shell").dataset.motion === "open");
          const normalBox = await shell.boundingBox();
          // Reject requests from the provider window, even if it claims to be Atrio.
          await page.evaluate(() => window.postMessage({source:"atrio-widget",type:"atrio.widget.maximize",maximized:true},location.origin));
          assert.notEqual(await shell.getAttribute("data-maximized"), "true");
          await page.frameLocator("#gateway-chat-shell iframe").locator("body").evaluate(() => parent.postMessage({source:"atrio-widget",type:"atrio.widget.maximize",maximized:true},"https://fixture.test"));
          await page.waitForFunction(() => document.querySelector("#gateway-chat-shell").dataset.maximized === "true");
          await page.waitForTimeout(360);
          const expandedBox = await shell.boundingBox();
          assert.ok(Math.abs(normalBox.width-expandedBox.width)<1,"Maximize preserves width");
          assert.ok(expandedBox.height>=normalBox.height,"Maximize cannot reduce the chat");
          assert.ok(expandedBox.y>=0&&expandedBox.y<80,"Maximize leaves room near the header");
          assert.ok(expandedBox.y+expandedBox.height<=viewport.height,"Maximize stays inside the viewport");
          await page.frameLocator("#gateway-chat-shell iframe").locator("body").evaluate(() => parent.postMessage({source:"atrio-widget",type:"atrio.widget.maximize",maximized:false},"https://fixture.test"));
          await page.waitForFunction(() => document.querySelector("#gateway-chat-shell").dataset.maximized === "false");
          await page.waitForTimeout(360);
          assert.ok(Math.abs((await shell.boundingBox()).height-normalBox.height)<1,"Restore returns to original height");
          const openCanvas = await canvas(); assert.equal(openCanvas.background, before.background);
          await page.frameLocator("#gateway-chat-shell iframe").getByRole("button", { name: "Cerrar chat" }).click();
          await page.waitForFunction(() => document.querySelector("#gateway-chat-shell").dataset.open === "false");
          const closing = await shell.evaluate(el => ({ width: el.offsetWidth, inert: el.inert })); assert.ok(closing.width > 0); assert.equal(closing.inert, true);
          await page.waitForTimeout(350);
          assert.ok(await shell.evaluate(el => Number(getComputedStyle(el).opacity)>.95),"Closing remains visible while compressing");
          assert.equal(await shell.getAttribute("data-motion"),"animating");
          // Even during contraction, the closed frame/backdrop must pass touches through.
          await page.mouse.click(20, viewport.height - 40);
          await page.waitForFunction(() => document.querySelector("#gateway-chat-shell").dataset.motion === "closed");
          assert.equal(await shell.evaluate(el => el.offsetWidth), 0);
        }
        assert.equal(frameNavigations, 1); assert.equal(sdkRequests, 0); assert.equal(await page.evaluate(() => window.providerClicks), 2); assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        // Reverse a closing animation before it finishes; stale timers must not collapse an open chat.
        await launcher.click(); await page.waitForFunction(() => document.querySelector("#gateway-chat-shell").dataset.motion === "open");
        await page.keyboard.press("Escape"); await launcher.evaluate(el => el.click());
        await page.waitForFunction(() => document.querySelector("#gateway-chat-shell").dataset.motion === "open");
        assert.equal(await shell.getAttribute("data-open"), "true"); assert.ok(await shell.evaluate(el => el.offsetWidth) > 0);
        if (asset.repo === repos[0] && viewport.width === 390) await page.screenshot({ path: path.join(artifact, engine + "-chat-open.png") });
        await page.emulateMedia({ reducedMotion: "reduce" }); await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.querySelector("#gateway-chat-shell").dataset.motion === "closed");
        assert.equal(await shell.getAttribute("data-motion"), "closed");
        // The invitation uses the same centered brand header in every gateway.
        await page.frameLocator("#gateway-chat-shell iframe").locator("body").evaluate(() => parent.postMessage({source:"atrio-widget",type:"atrio.widget.invitation",invitation:{id:"fixture-profile-20261027",action:"complete_profile",title:"COMPLETAR PERFIL",body:"Completá los datos que faltan en tu perfil."}},"https://fixture.test"));
        await page.getByRole("dialog").waitFor();
        const brand = await page.locator(".gateway-app-notice-brand").evaluate(el => {
          const box=el.getBoundingClientRect(), mark=el.querySelector(".gateway-app-notice-mark").getBoundingClientRect();
          return {center:box.x+box.width/2,logoCenter:mark.x+mark.width/2};
        });
        assert.ok(Math.abs(brand.center-brand.logoCenter)<1,"Invitation logo is centered");
        checks.push({ repo: asset.repo, engine, viewport, opensFromLauncher: true, contractsBeforeCollapsing: true, noProviderTouchBlock: true, rapidReversal: true, reducedMotion: true, darkEdgeInAllStates: true, frameNavigations, sdkRequests });
        await page.close();
      }
      console.log(JSON.stringify({ engine, repo: asset.repo, passed: checks.filter(check => check.engine === engine && check.repo === asset.repo).length }));
    }
  } finally { await browser.close(); }
}
await writeFile(path.join(artifact, "report.json"), JSON.stringify({ fixtureOnly: true, physicalSafariToolbarVerified: false, productionWrites: 0, checks }, null, 2));
console.log(JSON.stringify({ passed: checks.length, gateways: 4, engines: ["Chromium", "WebKit"], productionWrites: 0, physicalSafariToolbarVerified: false }));
