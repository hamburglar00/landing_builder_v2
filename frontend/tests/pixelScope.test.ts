import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { buildPixelInitScript } from "../components/public-landing/metaPixelHtml";
import { buildPublicLandingRuntimeSource, buildRuntimeConfig } from "../components/public-landing/PublicLandingRuntimeScript";
import { buildTemplate7FastRuntime } from "../components/public-landing/template7FastRuntime";
import type { PublicLandingConfig } from "../components/public-landing/types";

function pixelHarness() {
  const initialized = new Set(["999999"]);
  const deliveries: Array<{ pixel: string; event: string; eventId?: string }> = [];
  // Model Meta's documented routing contract: track broadcasts, trackSingle is scoped.
  const eventId = (options: unknown) => (options as { eventID?: string } | undefined)?.eventID;
  const fbq = (command: string, ...args: unknown[]) => {
    if (command === "init") initialized.add(String(args[0]));
    if (command === "track") for (const pixel of initialized) deliveries.push({ pixel, event: String(args[0]), eventId: eventId(args[2]) });
    if (command === "trackSingle") {
      assert.ok(initialized.has(String(args[0])), "only dispatch to an initialized pixel");
      deliveries.push({ pixel: String(args[0]), event: String(args[1]), eventId: eventId(args[3]) });
    }
  };
  const storage = new Map<string, string>();
  const context = {
    fbq, URL, URLSearchParams,
    document: { cookie: "" },
    localStorage: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) },
    window: { fbq, location: new URL("https://landing.invalid/fixture"), crypto: { randomUUID: () => "synthetic-browser-id" }, __META: { PIXEL_ID: "999999" } },
  };
  return { context, deliveries };
}

for (const engine of ["constructor", "classic"] as const) {
  test(`${engine}: PageView and every CTA stay on the configured pixel when another pixel exists`, () => {
    for (const template of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      for (const selectedEvent of ["Lead", "CompleteRegistration"] as const) {
        const { context, deliveries } = pixelHarness();
        const config = {
          id: "a0000000-0000-4000-8000-000000000001", name: "fixture", schemaVersion: 1,
          layout: { template }, tracking: { pixelId: "123456", sendContactPixel: true, ctaMetaEvent: selectedEvent },
        } as PublicLandingConfig;
        const init = buildPixelInitScript(config.tracking.pixelId, "fixture", "54", engine === "classic");
        runInNewContext(init.replace(/^<script>/, "").replace(/<\/script>$/, ""), context);
        const source = template >= 7
          ? buildTemplate7FastRuntime("fixture", config, engine === "classic" ? "function getOrCreateDeviceId(){return 'device';}" : "", false)
          : buildPublicLandingRuntimeSource();
        const dispatch = source.match(/function firePixelContact\(eventId\) \{[\s\S]*?\n      \}/)![0];
        const cfg = buildRuntimeConfig({ slug: "fixture", config, engine });
        runInNewContext(dispatch + ';firePixelContact("original-capi-id");', { ...context, cfg });
        assert.deepEqual(deliveries, [
          { pixel: "123456", event: "PageView", eventId: undefined },
          { pixel: "123456", event: template >= 7 ? selectedEvent : "Contact", eventId: "original-capi-id" },
        ], `${engine} T${template} ${selectedEvent}`);
      }
    }
  });
}

test("CTA without its own configured pixel never falls back to another initialized pixel", () => {
  const { context, deliveries } = pixelHarness();
  const dispatch = buildPublicLandingRuntimeSource().match(/function firePixelContact\(eventId\) \{[\s\S]*?\n      \}/)![0];
  for (const cfg of [{ sendContactPixel: true, pixelId: "" }, { sendContactPixel: true, pixelId: "invalid" }, { sendContactPixel: false, pixelId: "999999" }]) {
    runInNewContext(dispatch + ';firePixelContact("original-capi-id");', { ...context, cfg });
  }
  assert.deepEqual(deliveries, []);
});
