import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import type { PublicLandingConfig } from "../components/public-landing/types";

test("Gateway T7/T9: stable form, scoped identity/destination/tracking and one CTA handoff, without real accounts", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const template of [7, 9]) for (const width of [390, 1365]) for (const directAssets of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage(); const requests: Array<{ operation: string; body: Record<string, unknown> }> = [];
      const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
      const nativeCollectorLoaded = page.waitForRequest(request => request.url().includes("/l/demo/_assets/vendor/atrio-meta-click/v1/collect-click-id."));
      const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const config: PublicLandingConfig = { schemaVersion: 1, updatedAt: "2026-11-14", id, name: "demo", comment: "", layout: { template, ctaPosition: "bottom" },
        tracking: { pixelId: "123456789", postUrl: "https://example.supabase.co/functions/v1/conversions?name=fixture", landingTag: "TEST", target_provider: "ganamos_net", ctaDestination: "atrio" },
        content: { title: ["Crear cuenta"], subtitle: ["Tu acceso"], logoUrl: "", ctaText: "Crear cuenta" } };
      const html = renderPublicLandingHtml({ slug: "demo", config, engine: "gateway", canonicalUrl: "https://gateway.example.test/l/demo",
        apiBase: "/l/demo/_api", assetBase: "/l/demo/_assets", ...(directAssets ? { publicAssetBase: "https://constructor.panelbotadmin.com" } : {}), recoveryNamespace: "template7:gateway:builder:identity-recovery:v1" });
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin === "https://constructor.panelbotadmin.com" && directAssets && /^\/public-assets\/(?:template-entry|template9)\/[a-zA-Z0-9_.-]+$/.test(url.pathname)) {
          const body = await readFile(path.join(process.cwd(), "public", url.pathname.slice(1)));
          return route.fulfill({ contentType: url.pathname.endsWith(".js") ? "application/javascript" : "image/webp", body });
        }
        if (url.origin !== "https://gateway.example.test") return route.abort();
        if (url.pathname === "/l/demo") return route.fulfill({ contentType: "text/html", body: html });
        if (url.pathname.startsWith("/l/demo/_assets/")) {
          const name = url.pathname.slice("/l/demo/_assets/".length);
          assert.ok(!name.includes(".."));
          const body = await readFile(path.join(process.cwd(), "public", name));
          return route.fulfill({ contentType: name.endsWith(".js") ? "application/javascript" : name.endsWith(".svg") ? "image/svg+xml" : "image/webp", body });
        }
        if (url.pathname.startsWith("/l/demo/_api/")) {
          const operation = url.pathname.slice("/l/demo/_api/".length);
          const body = JSON.parse(route.request().postData() || "{}"); requests.push({ operation, body });
          if (operation === "client-identity/bootstrap") return route.fulfill({ json: { ok: true, recovery_token: "fixture-recovery" }, headers: { "Set-Cookie": `lb_gateway_builder_cid=${id}; Path=/l/demo/; Secure; HttpOnly; SameSite=Lax` } });
          if (operation === "template7/destination") return route.fulfill({ json: { atrioClientId: id, atrioId: id, atrioSlug: "fixture", atrioRedirectUrl: "https://chat.example.test/fixture" } });
          if (operation === "template7/prepare") return route.fulfill({ json: { handoff_url: "https://gateway.example.test/prepare?t=p1.synthetic.synthetic" } });
          return route.fulfill({ json: { ok: true, ready: true } });
        }
        if (url.pathname === "/prepare") return route.fulfill({ contentType: "text/html", body: "<h1>Gateway listo</h1>" });
        return route.fulfill({ status: 404, body: "not found" });
      });
      await page.goto("https://gateway.example.test/l/demo?utm_source=fixture&campana=retained");
      await page.waitForFunction(() => (window as Window & { __T7_RUNTIME_READY__?: boolean }).__T7_RUNTIME_READY__ === true);
      await nativeCollectorLoaded;
      assert.equal(new URL(await page.locator("script[data-template7-runtime]").getAttribute("src") as string, page.url()).origin, directAssets ? "https://constructor.panelbotadmin.com" : "https://gateway.example.test");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
      assert.ok(requests.some(r => r.operation === "client-identity/bootstrap"));
      assert.ok(requests.some(r => r.operation === "template7/destination"));
      await page.locator("[data-template7-name]").fill("Prueba local");
      await page.locator("[data-public-landing-cta]").click();
      await page.waitForURL("**/prepare?t=**");
      assert.equal(requests.filter(r => r.operation === "template7/prepare").length, 1);
      const prepare = requests.find(r => r.operation === "template7/prepare")!;
      assert.equal((prepare.body.attribution as Record<string, unknown>).campana, "retained");
      assert.equal((prepare.body.entry_funnel as Record<string, unknown>).engine, "gateway");
      assert.equal((prepare.body.entry_funnel as Record<string, unknown>).telemetry_path, "/l/demo/_api/entry-funnel");
      assert.ok(requests.some(r => r.operation === "track"));
      assert.ok(requests.some(r => r.operation === "journey-start"));
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});
