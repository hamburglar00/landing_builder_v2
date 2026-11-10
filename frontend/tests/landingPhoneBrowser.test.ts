import assert from "node:assert/strict";
import test from "node:test";
import { renderClassicPublicLandingHtml, renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import { buildPublicLandingRuntimeSource } from "../components/public-landing/PublicLandingRuntimeScript";
import { PUBLIC_LANDING_CSS } from "../components/public-landing/publicLandingCss";
import type { PublicLandingConfig } from "../components/public-landing/types";

test("browser: all six templates in both engines reuse late assignments and keep Pixel tied to the successful click", {
  skip: process.env.RUN_PHONE_BROWSER !== "1", timeout: 120000,
}, async () => {
  const { chromium } = await import("playwright");
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.supabase.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-public-key";
  const source = buildPublicLandingRuntimeSource(true);
  assert.equal(source.split("window.location.assign(redirectUrl);").length, 2);
  // Stop at the navigation boundary so no external destination opens and browser assertions survive.
  const runtime = source.replace("window.location.assign(redirectUrl);", "window.__outbound.push(redirectUrl);");
  const browser = await chromium.launch({ headless: true });
  try {
    const scenarios = [false, true].flatMap(classic => [1, 2, 3, 4, 5, 6].map(template => ({ classic, template, outcome: "late" })))
      .concat([false, true].flatMap(classic => ["empty", "http_error", "network_error"].map(outcome => ({ classic, template: 2, outcome }))));
    for (const { classic, template, outcome } of scenarios) {
      const label = `${classic ? "classic" : "constructor"} T${template} ${outcome}`;
      const config: PublicLandingConfig = {
        schemaVersion: 1, updatedAt: "2026-11-10", id: "b453a8c5-a91a-4511-ac22-28bcfa4ea97c", name: "fixture", comment: "",
        tracking: { pixelId: "123456789", postUrl: "https://synthetic.events.invalid/conversions", landingTag: "FIXTURE", sendContactPixel: true },
        content: { logoUrl: "", title: ["Fixture"], subtitle: ["Fixture"], footerBadge: ["Fixture"], ctaText: "Contactar" },
        layout: { template: template as 1 | 2 | 3 | 4 | 5 | 6, ctaPosition: "between_title_and_info" }, socialProof: { enabled: false },
        interactions: { enabled: false, whatsappPrefillText: "Consulta ficticia" },
      };
      const html = classic ? renderClassicPublicLandingHtml({ slug: "fixture", config }, "") : renderPublicLandingHtml({ slug: "fixture", config });
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const errors: string[] = [], telemetry: any[] = [], tracks: any[] = [];
      let requests = 0, release: (() => Promise<void>) | undefined;
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(() => {
        const host = window as any;
        host.__pixelCalls = [];
        host.__outbound = [];
        host.fbq = (...args: unknown[]) => host.__pixelCalls.push(args);
        host.fbq.loaded = true;
      });
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "apikey,authorization,content-type" };
        if (url.pathname === "/fixture") { await route.fulfill({ contentType: "text/html", body: html }); return; }
        if (url.pathname === "/functions/v1/landing-phone") {
          if (route.request().method() === "OPTIONS") { await route.fulfill({ status: 200, headers }); return; }
          requests++;
          await new Promise<void>(done => { release = async () => {
            if (outcome === "network_error") await route.abort("failed");
            else await route.fulfill({ status: outcome === "http_error" ? 503 : 200, contentType: "application/json", headers,
              body: JSON.stringify(outcome === "empty" ? { phone: null } : { phone: "5491100000000", gerenciaId: 17 }) });
            done();
          }; });
          return;
        }
        if (/\/public-assets\/template-entry\/landing-.*\.js$/.test(url.pathname)) { await route.fulfill({ contentType: "text/javascript", body: runtime }); return; }
        if (url.pathname.endsWith(".css")) { await route.fulfill({ contentType: "text/css", body: PUBLIC_LANDING_CSS }); return; }
        if (url.hostname === "wa.me") { await route.abort(); return; }
        if (url.pathname === "/api/entry-funnel") {
          try { telemetry.push(...JSON.parse(route.request().postData() || "{}").events); } catch { /* empty diagnostics */ }
        }
        if (url.pathname === "/api/track") {
          try { tracks.push(JSON.parse(route.request().postData() || "{}")); } catch { /* empty tracking */ }
        }
        await route.fulfill({ status: 200, contentType: url.pathname.endsWith(".js") ? "text/javascript" : "application/json", headers, body: url.pathname.endsWith(".js") ? "" : "{}" });
      });
      try {
        await page.clock.install();
        await page.goto("https://fixture.invalid/fixture", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean((window as any).__PUBLIC_LANDING_PHONE_CLIENT__) && Boolean((window as any).__entryFunnel));
        const cta = page.locator("[data-public-landing-cta]").first();
        // Dispatch exercises the actual handlers without depending on an optional template curtain.
        await cta.dispatchEvent("click"); await page.clock.runFor(32);
        await cta.dispatchEvent("click");
        if (outcome !== "late") {
          assert.ok(release); await release(); await page.clock.runFor(1500);
          assert.equal(requests, 1, label + " no automatic retry");
          assert.equal(await cta.isDisabled(), false);
          assert.equal((await cta.textContent())?.trim(), "Reintentar");
          const notice = await page.locator(".public-phone-notice").textContent();
          assert.equal(notice?.includes("No hay un número"), outcome === "empty", label + " do not misreport network failures as empty inventory");
          const event = telemetry.find(event => event.name === "entry_error");
          assert.equal(event?.error_code, outcome === "network_error" ? "network_error" : "destination_unavailable");
          assert.equal(event?.status, outcome === "network_error" ? undefined : outcome === "empty" ? 200 : 503);
          assert.equal(await page.evaluate(() => (window as any).__pixelCalls.filter((call: any[]) => call.includes("Contact")).length), 0);
          assert.equal(await page.evaluate(() => (window as any).__outbound.length), 0);
          assert.deepEqual(errors, []);
          continue;
        }
        await page.clock.runFor(15020);
        assert.equal(requests, 1, label + " must not reassign after timeout");
        assert.equal(await cta.isDisabled(), false, label + " CTA recovers");
        assert.equal((await cta.textContent())?.trim(), "Continuar");
        for (const [name, element] of [["CTA", cta], ["notice", page.locator(".public-phone-notice")]] as const) {
          const bounds = await element.evaluate(node => {
            const rect = node.getBoundingClientRect();
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            const texts: Array<{ left: number; right: number }> = [];
            let text: Node | null;
            while ((text = walker.nextNode())) {
              if (!text.textContent?.trim()) continue;
              const range = document.createRange(); range.selectNodeContents(text);
              for (const value of range.getClientRects()) if (value.width > 0) texts.push({ left: value.left, right: value.right });
            }
            return { left: rect.left, right: rect.right, width: rect.width, viewport: innerWidth, texts };
          });
          assert.equal(bounds.viewport, 390);
          assert.ok(bounds.width > 0 && bounds.left >= -1 && bounds.right <= bounds.viewport + 1, label + " " + name + " fits the mobile viewport: " + JSON.stringify(bounds));
          assert.ok(bounds.texts.length > 0 && bounds.texts.every(text => text.left >= bounds.left - 1 && text.right <= bounds.right + 1), label + " " + name + " text fits its box: " + JSON.stringify(bounds));
        }
        assert.equal(await page.evaluate(() => (window as any).__pixelCalls.filter((call: any[]) => call.includes("Contact")).length), 0);
        assert.equal(await page.evaluate(() => (window as any).__outbound.length), 0);
        // Odd templates receive the late result while idle; even ones resume while it is pending.
        if (template % 2 === 0) { await cta.dispatchEvent("click"); await page.clock.runFor(32); assert.equal(await cta.isDisabled(), true); }
        assert.ok(release, label + " captured one selection request"); await release();
        await page.clock.runFor(40);
        if (template % 2 !== 0) {
          assert.equal(await page.evaluate(() => (window as any).__outbound.length), 0, label + " late resolution cannot navigate");
          assert.equal(await page.evaluate(() => (window as any).__pixelCalls.filter((call: any[]) => call.includes("Contact")).length), 0);
          assert.equal(await cta.isDisabled(), false);
          await cta.dispatchEvent("click"); await page.clock.runFor(32);
        } else assert.equal(await cta.isDisabled(), true, label + " old timeout continuation cannot unlock the new click");
        await page.clock.runFor(1500);
        const pixel = await page.evaluate(() => (window as any).__pixelCalls.filter((call: any[]) => call.includes("Contact")));
        assert.equal(pixel.length, 1, label + " one successful Contact");
        const contact = tracks.find(item => item.payload?.event_name === "Contact");
        assert.ok(contact, label + " matching server tracking");
        assert.equal(pixel[0].at(-1).eventID, contact.payload.event_id, label + " shared Pixel/CAPI event ID");
        assert.equal(await page.evaluate(() => (window as any).__outbound.length), 1, label + " exactly one outbound request");
        assert.equal(requests, 1, label + " exactly one assignment");
        assert.ok(telemetry.some(event => event.name === "entry_error" && event.error_code === "request_timeout"));
        assert.ok(telemetry.some(event => event.name === "stage_timing" && event.phase === "destination_request"));
        assert.ok(!JSON.stringify(telemetry).includes("5491100000000"), "diagnostics omit phone numbers");
        assert.deepEqual(errors, [], label + " no browser errors");
        if (template === 6) {
          await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
          await page.clock.runFor(32);
          assert.equal(requests, 2, label + " returning from WhatsApp refreshes the completed assignment");
          assert.equal(await cta.isDisabled(), false);
          assert.ok(release); await release(); await page.clock.runFor(32);
          assert.equal(await page.evaluate(() => (window as any).__outbound.length), 1, "return prewarm cannot navigate");
          assert.equal(await page.evaluate(() => (window as any).__pixelCalls.filter((call: any[]) => call.includes("Contact")).length), 1, "return prewarm cannot duplicate Contact");
        }
      } finally { await context.close(); }
    }
  } finally {
    await browser.close();
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key;
  }
});
