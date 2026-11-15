import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { buildLandingFbcFactoryScript } from "../lib/tracking/landingFbc";

test("native EBP loads from legacy and scoped Gateway assets, rejecting external or malformed paths", async () => {
  const browser = await chromium.launch({ headless: true });
  const asset = "/vendor/atrio-meta-click/v1/collect-click-id.313adead513e2b9aab4f3efb.js";
  try {
    for (const [source, accepted] of [
      [asset, true], ["/l/demo/_assets" + asset, true], ["/l/nexobet/demo/_assets" + asset, true],
      ["https://external.example" + asset, false], ["//external.example" + asset, false],
      ["/l/../demo/_assets" + asset, false], ["/l/%2e%2e/_assets" + asset, false],
      ["/l/demo/_assets" + asset + "?redirect=1", false], ["/l/demo/_assets/vendor/untrusted.js", false],
    ] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const scripts: string[] = [];
      await context.route("**/*", route => {
        if (route.request().resourceType() === "document") return route.fulfill({ contentType: "text/html", body: "<!doctype html><html><head></head><body>Fixture</body></html>" });
        scripts.push(route.request().url());
        return route.fulfill({ contentType: "application/javascript", body: "window.__ATRIO_META_COLLECT_CLICK_ID__ = () => Promise.resolve(null);" });
      });
      await page.goto("https://gateway.example/l/demo");
      await page.evaluate(`window.fixtureCollector = (${buildLandingFbcFactoryScript()})({landingId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slug:'demo',workspaceCurrency:'ARS',pixelId:'123456'});`);
      await page.evaluate(source => (window as Window & { fixtureCollector: { collectNative(value: string): Promise<void> } }).fixtureCollector.collectNative(source), source);
      assert.deepEqual(scripts, accepted ? ["https://gateway.example" + source] : [], source);
      await context.close();
    }
  } finally { await browser.close(); }
});
