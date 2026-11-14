import assert from "node:assert/strict";
import test from "node:test";
import { gatewayEntryWait, normalizeGatewayEntry } from "../lib/landing/gatewayEntry";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { switchLandingTemplate } from "../lib/landing/templateVariants";
import { resolveEffectiveLandingConfig } from "../lib/landing/effectiveLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";

test("saved entry modes are bounded and legacy absence stays absent", () => {
  for (const invalid of [undefined, null, {}, [], { mode: "manual", seconds: 4 }, { mode: "credentials", seconds: 0 },
    { mode: "credentials", seconds: 61 }, { mode: "direct", seconds: "4" }, { mode: "direct", seconds: 4, token: "extra" }]) {
    assert.equal(normalizeGatewayEntry(invalid), undefined);
    assert.equal(gatewayEntryWait(invalid), undefined);
  }
  assert.deepEqual(gatewayEntryWait({ mode: "direct", seconds: 4 }), { enabled: false, seconds: 4, continueButtonEnabled: false });
  assert.deepEqual(gatewayEntryWait({ mode: "credentials", seconds: 60 }), { enabled: true, seconds: 60, continueButtonEnabled: true });
  assert.equal(DEFAULT_CONFIG.gatewayEntry, undefined, "loading an old row must never silently change its entry behavior");
});

test("per-landing policy survives template changes and publication without affecting tracking", () => {
  for (const gatewayEntry of [undefined, { mode: "credentials" as const, seconds: 9 }]) {
    const config = { ...DEFAULT_CONFIG, template: "template7" as const, gatewayEntry };
    const next = switchLandingTemplate(switchLandingTemplate(config, "template8"), "template9");
    assert.deepEqual(next.gatewayEntry, gatewayEntry);
    const published = buildLandingConfig({ id: "fixture", name: "fixture", comment: "", pixelId: "1234567890", postUrl: "https://collector.test", landingTag: "campaign", config: next });
    assert.deepEqual(published.gatewayEntry, gatewayEntry);
    assert.equal(published.tracking?.pixelId, "1234567890");
    assert.deepEqual(resolveEffectiveLandingConfig({ ...next, templateConfigs: { template9: { gatewayEntry: { mode: "direct", seconds: 4 } } } }).gatewayEntry, gatewayEntry);
  }
});
