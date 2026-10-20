import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { switchLandingTemplate, withCurrentTemplateSnapshot } from "../lib/landing/templateVariants";
import type { TemplateOption } from "../lib/landing/types";

for (let number = 1; number <= 7; number++) {
  const template = `template${number}` as TemplateOption, expected = number === 7 ? "atrio" : "whatsapp";
  test(`${template}: old channel overrides cannot alter the template's destination`, () => {
    const stale = { ...DEFAULT_CONFIG, template, ctaDestination: number === 7 ? "whatsapp" as const : "atrio" as const };
    const published = buildLandingConfig({ id:"channel-test", name:"test", comment:"", pixelId:"", postUrl:"", landingTag:"TEST", config:stale });
    assert.equal(published.tracking.ctaDestination, expected);
    assert.equal(withCurrentTemplateSnapshot(stale).ctaDestination, expected);
    assert.equal(switchLandingTemplate(stale, template).ctaDestination, expected);
    assert.equal(switchLandingTemplate({ ...stale, template: number === 7 ? "template2" : "template7" }, template).ctaDestination, expected);
  });
}
