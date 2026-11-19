import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {loadSource} from "./gateway-browser-fixtures.mjs";
import {loadProductPaths} from "./product-worktrees.mjs";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
let playwright;
try { playwright = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
catch { playwright = require("playwright"); }
const productPath = loadProductPaths();
const output = fileURLToPath(new URL("../.local/gateway-agency-resume-20261112", import.meta.url));
await mkdir(output, { recursive: true });
const providers = { rey_de_ases: "landing-autologuin", ases_del_norte: "ases-gateway", ganamos_net: "ganamos-gateway", multi_skin: "multi-skin-gateway" };
const pages = new Map();
for (const [provider,repo] of Object.entries(providers)) {
  const {gatewayAgencyPage} = await loadSource(productPath(repo),"export {gatewayAgencyPage} from './src/lib/gateway-agency-page';");
  pages.set(provider,await gatewayAgencyPage(provider,17).text());
}
let checks = 0;
for (const [engineName, engine] of [["Chromium", playwright.chromium], ["WebKit", playwright.webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const [provider, repo] of Object.entries(providers)) for (const viewport of [{ width: 390, height: 844 }, { width: 1365, height: 768 }]) {
      const context = await browser.newContext({ viewport });
      let page = await context.newPage();const calls = [], errors = [];
      let reject = true, recovery = "missing", confirmed = true, repair = "none";
      let heldRequest;
      function holdNext(action) {
        const started = Promise.withResolvers(), release = Promise.withResolvers();
        heldRequest = { action, started, release };
        return { started: started.promise, release: release.resolve };
      }
      async function waitIfHeld(action) {
        if (heldRequest?.action !== action) return;
        const gate = heldRequest;
        heldRequest = undefined;
        gate.started.resolve();
        await gate.release.promise;
      }
      async function assertEntering(selector) {
        const button = page.locator(selector);
        assert.equal(await button.textContent(), "Ingresando a tu cuenta…");
        assert.equal(await button.innerText(), "Ingresando a tu cuenta…");
        assert.equal(await button.getAttribute("aria-busy"), "true");
        assert.equal(await button.isDisabled(), true);
        assert.equal(await page.getByRole("button", { name: /^ingresando a tu cuenta…$/i }).count(), 1);
        assert.equal(await page.getByRole("progressbar").count(), 0);
        assert.equal(await page.locator("#agency-feedback").textContent(), "");
        assert.equal(await button.evaluate(el => getComputedStyle(el, "::before").animationName), "spin");
        await page.emulateMedia({ reducedMotion: "reduce" });
        assert.equal(await button.evaluate(el => getComputedStyle(el, "::before").animationName), "none");
        await page.emulateMedia({ reducedMotion: "no-preference" });
      }
      const returningName = "cliente<prueba>";
      const session = { entry_confirmation: "ge1.fixture", recovery_token: "encrypted-fixture", redirect_url: "/home?gateway_chat=open" };
      const html = pages.get(provider);
      page.on("pageerror", e => errors.push(e.message));
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        assert.equal(url.origin, "https://gateway.example");
        if (url.pathname === "/17") return route.fulfill({ contentType: "text/html", body: html });
        if (/\.(webp|png|svg)$/.test(url.pathname)) {
          const asset = path.join(productPath(repo), "public", url.pathname);
          return route.fulfill({ contentType: url.pathname.endsWith("webp") ? "image/webp" : "image/png", body: await readFile(asset) });
        }
        if (url.pathname === "/api/agency-entry/17") {
          const input=route.request().postDataJSON();calls.push(input);
          await waitIfHeld(input.action);
          if(input.action==='resume') {
            if(recovery==='network')return route.abort();
            return route.fulfill({contentType:'application/json',body:JSON.stringify(recovery==='active'?
              {active:true,username:returningName,...session}:
              {active:false,...(recovery==='different'?{different_account:true}:{})})});
          }
          if (input.action === "register" && !reject) return route.fulfill({ json: { account_created: true, username: "cliente", password: "fixture-password", continuation: "fixture-continuation" } });
          if (input.action === "prepare_created") return route.fulfill({ json: { username: "cliente", ...session } });
          return route.fulfill({ status: reject ? 401 : 200, contentType: "application/json", body: JSON.stringify(reject ? { error: "Revisá tus datos." } : { username:"cliente",entry_confirmation: "ge1.fixture", recovery_token: "encrypted-fixture", redirect_url: "/home?gateway_chat=open" }) });
        }
        if (url.pathname === "/api/session/recover") {
          await waitIfHeld("confirm");
          const proof = route.request().postDataJSON();
          if (repair !== "none" && proof.recovery_token) return route.fulfill({ json: { active: true, entry_repaired: true } });
          const exact = confirmed && repair !== "blocked" && proof.entry_confirmation === "ge1.fixture";
          return route.fulfill({ json: { active: exact, entry_confirmed: exact } });
        }
        if(url.pathname === "/manifest.webmanifest") return route.fulfill({json:{name:"Fixture",icons:[]}});
        assert.equal(url.pathname, "/home");
        return route.fulfill({ contentType: "text/html", body: "<main>Casino y chat</main>" });
      });
      await page.goto("https://gateway.example/17");
      await page.locator('#username').waitFor({state:'visible'});
      assert.equal(calls.length,1);assert.equal(calls[0].action,'resume');
      assert.equal(await page.locator('#name').isVisible(),false);
      assert.equal(await page.locator("#submit").evaluate(el=>getComputedStyle(el).color), "rgb(255, 255, 255)");
      assert.equal(await page.locator("#toggle").evaluate(el=>getComputedStyle(el).color), "rgb(255, 255, 255)");
      assert.notEqual(await page.locator("html").evaluate(el=>getComputedStyle(el).backgroundColor), "rgb(7, 7, 10)");
      if(engineName==='Chromium')await page.screenshot({path:path.join(output,`${provider}-${viewport.width}-register.png`),fullPage:true});
      assert.equal(await page.locator("img").evaluate(img => img.complete && img.naturalWidth > 0), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.ok((await page.locator("img").boundingBox()).width >= 200);
      if (engineName === "Chromium" && (viewport.width === 390 || provider === "ganamos_net")) await page.screenshot({ path: path.join(output, `${provider}-${viewport.width}.png`), fullPage: true });
      await page.locator("#username").fill("cliente"); await page.locator("#password").fill("fixture-password");
      await page.locator("#show-password").click(); assert.equal(await page.locator("#password").getAttribute("type"), "text");
      const manualLogin = holdNext("login");
      await page.locator("#submit").click(); await manualLogin.started;
      await assertEntering("#submit"); manualLogin.release();
      await page.locator("#error").filter({ hasText: "Revisá tus datos." }).waitFor();
      assert.equal(await page.locator("#submit").textContent(), "Ingresar");
      assert.equal(await page.locator("#submit").getAttribute("aria-busy"), "false");
      assert.equal(await page.locator("#submit").isEnabled(), true); checks++;
      reject = false;
      const manualConfirmation = holdNext("confirm");
      await page.locator("#submit").click(); await manualConfirmation.started;
      await assertEntering("#submit"); manualConfirmation.release();
      await page.waitForURL("**/home?gateway_chat=open");
      assert.deepEqual(calls.at(-1), { agency_id: 17, action: "login", username: "cliente", password: "fixture-password" });
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes("fixture-password")), false); checks++;
      recovery="active";await page.close();page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
      const returningConfirmation = holdNext("confirm");
      await page.goto("https://gateway.example/17"); await returningConfirmation.started;
      assert.equal(await page.locator("#agency-continue").textContent(), "Acceder a mi cuenta");
      await page.locator("#agency-continue").click(); await assertEntering("#agency-continue");
      returningConfirmation.release(); await page.waitForURL("**/home?gateway_chat=open");
      assert.equal(calls.at(-1).action,"resume");checks++;recovery="missing";
      await page.goto("https://gateway.example/17"); await page.locator('#username').waitFor({state:'visible'});await page.locator("#toggle").click();await page.locator("#name").waitFor({state:"visible"});
      const creating = holdNext("register");
      await page.locator("#name").fill("Nombre Cliente"); await page.locator("#submit").click(); await creating.started;
      assert.equal(await page.getByRole("progressbar", { name: "Creando tu cuenta" }).count(), 1);
      assert.equal(await page.locator("#agency-creating").innerText(), "Creando tu cuenta…");
      assert.equal(await page.locator(".entry-progress-stops").isVisible(), false);
      assert.equal(await page.locator("#submit").isVisible(), false);
      assert.equal(await page.locator("#name").isEditable(), false);
      assert.deepEqual(calls.at(-1), { agency_id: 17, action: "register", name: "Nombre Cliente", present_account:true });
      const preparingCreated = holdNext("prepare_created");
      creating.release(); await preparingCreated.started;
      await page.locator("#agency-created-title").waitFor(); assert.equal(await page.locator("#agency-account-password").innerText(), "fixture-password");
      assert.equal(await page.locator("#agency-continue").textContent(), "Continuar a mi cuenta");
      await page.locator("#agency-continue").click(); await assertEntering("#agency-continue");
      confirmed=false; preparingCreated.release();
      await page.locator("#agency-feedback").filter({hasText:"No pudimos confirmar"}).waitFor();
      assert.equal(await page.locator("#agency-continue").textContent(), "Continuar a mi cuenta");
      assert.equal(await page.locator("#agency-continue").getAttribute("aria-busy"), "false");
      confirmed=true; await page.locator("#agency-continue").click(); await page.waitForURL("**/home?gateway_chat=open");
      assert.equal(calls.at(-1).action, "prepare_created"); checks++;
      for(const state of ['active','different','network']) {
        recovery=state;const before=calls.length;await page.goto('https://gateway.example/17');
        if(state==='active'){await page.locator('#agency-continue').click();await page.waitForURL('**/home?gateway_chat=open');}
        else {await page.locator('#username').waitFor({state:'visible'});assert.equal(Boolean(await page.locator('#error').textContent()),state==='network');}
        if(state==='network') {
          assert.equal(await page.locator('#retry-recovery').count(),0);
          assert.equal(await page.locator('#username').isVisible(),true);
        }
        assert.equal(calls.length,before+1);assert.equal(calls.at(-1).action,'resume');checks++;
      }
      recovery='active';confirmed=false;const before=calls.length;await page.goto('https://gateway.example/17');
      await page.locator('#agency-feedback').filter({hasText:'No pudimos confirmar'}).waitFor();
      assert.equal(new URL(page.url()).pathname,'/17');assert.equal(calls.length,before+1);checks++;
      confirmed=true;
      for (const state of ["accepted","blocked"]) {
        repair=state;
        await page.goto("https://gateway.example/17");
        if (state==="accepted"){await page.locator("#agency-continue").click();await page.waitForURL("**/home?gateway_chat=open");}
        else {
          await page.locator("#agency-feedback").filter({hasText:"No pudimos confirmar"}).waitFor();
          assert.equal(new URL(page.url()).pathname, "/17");
        }
        checks++;
      }
      repair="none";recovery="active";
      const start = new Date("2026-11-19T12:00:00Z");
      await page.clock.install({ time: start });
      await page.clock.pauseAt(new Date(start.getTime() + 1000));
      await page.goto("https://gateway.example/17");
      await page.locator("#agency-returning-title").waitFor();
      assert.equal(await page.locator("#agency-recovering").textContent(), "");
      assert.equal(await page.locator("#agency-account-title").innerText(), "¡Hola de nuevo, " + returningName + "!");
      assert.equal(await page.locator("#agency-returning-name > *").count(), 0);
      const colors = await page.evaluate(() => ({
        greeting: getComputedStyle(document.getElementById("agency-returning-title")).color,
        username: getComputedStyle(document.getElementById("agency-returning-name")).color,
        accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
      }));
      assert.equal(colors.greeting, "rgb(255, 255, 255)");
      const accentRgb = colors.accent.slice(1).match(/../g).map(pair => parseInt(pair, 16)).join(", ");
      assert.equal(colors.username, "rgb(" + accentRgb + ")");
      assert.equal(await page.getByRole("progressbar").count(), 0);
      const slowReturn = holdNext("resume");
      await page.goto("https://gateway.example/17"); await slowReturn.started;
      const logo = page.locator(".brand img"), initialLogo = await logo.boundingBox();
      await page.clock.runFor(299);
      assert.equal(await page.locator("#agency-recovering").innerText(), "");
      await page.clock.runFor(1);
      assert.equal(await page.locator("#agency-recovering").innerText(), "Verificando tu cuenta…");
      assert.deepEqual(await logo.boundingBox(), initialLogo);
      assert.equal(await page.getByRole("progressbar").count(), 0);
      slowReturn.release(); await page.locator("#agency-returning-title").waitFor(); await page.clock.resume();
      checks+=2;
      assert.deepEqual(errors, []); checks++;
      await context.close();
    }
  } finally { await browser.close(); }
}
console.log(`${checks} browser scenarios passed: 4 providers, Chromium/WebKit, mobile/desktop; isolated HTTP only.`);
