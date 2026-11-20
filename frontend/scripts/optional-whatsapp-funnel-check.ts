import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { renderClassicTemplate7Html, renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import type { PublicLandingConfig } from "../components/public-landing/types";
import { validateEntryFunnelBatch } from "../lib/landing/entryFunnel";

const landingId = "d0000000-0000-4000-8000-000000000001";
const privateInput = "1123459056";
const stageNames = ["whatsapp_field_visible", "whatsapp_field_focus", "whatsapp_field_started", "whatsapp_form_submitted"];
type Stage = { name: string; id: string; navigation_id: string };

async function main() {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const template of [7, 9] as const) for (const classic of [false, true]) {
        const config: PublicLandingConfig = {
          id: landingId, schemaVersion: 1, updatedAt: "", name: "fixture", comment: "",
          layout: { template, ctaPosition: "bottom" }, template7Capture: { whatsapp: true },
          tracking: { pixelId: "", postUrl: "", landingTag: "fixture", target_provider: "ganamos_net" },
        };
        const render = () => classic
          ? renderClassicTemplate7Html({ slug: "fixture", config }, 'function getOrCreateDeviceId(){return "d0000000-0000-4000-8000-000000000002"}')
          : renderPublicLandingHtml({ slug: "fixture", config });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        try {
          const page = await context.newPage();
          const origin = classic ? "https://landing.example" : "https://mkt.example";
          const batchBodies: string[] = [], destinations: string[] = [], errors: string[] = [];
          page.on("pageerror", error => errors.push(error.message));
          let releaseAsset!: () => void;
          const gate = new Promise<void>(resolve => { releaseAsset = resolve; });
          await page.route("**/*", async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.pathname === "/fixture") return route.fulfill({ contentType: "text/html", body: render() });
            if (url.pathname.startsWith("/public-assets/template-entry/") && url.pathname.endsWith(".js")) {
              await gate;
              const source = await readFile(path.join("public", url.pathname), "utf8");
              return route.fulfill({ contentType: "text/javascript", body: source });
            }
            if (url.pathname === "/api/entry-funnel") {
              const body = request.postData();
              if (body) batchBodies.push(body);
              const ids = body ? JSON.parse(body).events.map((event: Stage) => event.id) : [];
              return route.fulfill({ json: { accepted: true, event_ids: ids } });
            }
            if (request.postData()?.includes("whatsapp_field_") || request.postData()?.includes("whatsapp_form_submitted"))
              destinations.push(url.pathname);
            if (url.pathname === "/api/template7/destination") return route.fulfill({ json: {
              atrioClientId: landingId, atrioId: landingId, atrioSlug: "fixture", preparationReady: true,
            } });
            if (url.pathname === "/api/template7/start" || url.pathname === "/api/template7/prepare") {
              return route.fulfill({ status: 400, json: { error: "test retry" } });
            }
            if (url.pathname.endsWith(".js")) return route.fulfill({ contentType: "text/javascript", body: "" });
            return route.fulfill({ json: { ok: true } });
          });
          await page.goto(origin + "/fixture", { waitUntil: "commit" });
          const phone = page.locator("[data-template7-whatsapp]");
          await phone.focus();
          await phone.fill(privateInput);
          await phone.blur();
          await phone.focus();
          const early = () => page.evaluate(() => (window as any).__ENTRY_FUNNEL_EARLY__.events as Stage[]);
          const phoneEvents = (events: Stage[]) => events.filter(event => stageNames.includes(event.name));
          const prior = phoneEvents(await early());
          assert.deepEqual(prior.map(event => event.name).sort(), stageNames.slice(0, 3).sort());
          await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
          if (template === 7) {
            await phone.fill("");
            await page.locator("[data-template7-name]").fill("Prueba");
            await page.locator("[data-public-landing-cta]").click();
            assert.equal(phoneEvents(await early()).filter(event => event.name === "whatsapp_form_submitted").length, 1);
          }
          releaseAsset();
          await page.waitForFunction(() => !!(window as any).__T7_RUNTIME_READY__ && !!(window as any).__entryFunnel);
          const cta = page.locator("[data-public-landing-cta]");
          if (template === 9) {
            await page.locator("[data-template7-name]").fill("Prueba");
            await cta.click();
          }
          await page.locator("[data-template7-error]:visible").waitFor();
          await cta.click();
          await page.locator("[data-template7-error]:visible").waitFor();
          await page.evaluate(() => (window as any).__entryFunnel.flush());
          await page.waitForFunction(() => {
            const data = sessionStorage.getItem("entry-funnel:v1:" + "d0000000-0000-4000-8000-000000000001" + ":pending");
            return !data || !JSON.parse(data).events.length;
          });
          const unique = new Map<string, Stage>();
          for (const body of batchBodies) {
            assert.ok(validateEntryFunnelBatch(JSON.parse(body)));
            assert.ok(!body.includes(privateInput));
            for (const event of phoneEvents(JSON.parse(body).events)) unique.set(event.id, event);
          }
          assert.deepEqual([...unique.values()].map(event => event.name).sort(), stageNames.slice().sort());
          assert.ok(prior.every(event => unique.has(event.id)), "stable IDs from before the runtime arrived");
          assert.equal(new Set([...unique.values()].map(event => event.navigation_id)).size, 1);
          assert.deepEqual(destinations, []);
          assert.deepEqual(errors, []);
          config.template7Capture = { whatsapp: false };
          await page.reload();
          assert.equal(await page.locator("[data-template7-whatsapp]").count(), 0);
          assert.equal(await page.evaluate(() => typeof (window as any).__T7_WHATSAPP_FORM_SUBMITTED__), "undefined");
          console.log(engine.name(), classic ? "classic" : "constructor", "T" + template, "OK");
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
