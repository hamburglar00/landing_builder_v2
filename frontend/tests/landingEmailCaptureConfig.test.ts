import assert from "node:assert/strict";
import test from "node:test";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import type { LandingThemeConfig } from "../lib/landing/types";

function published(config: LandingThemeConfig) {
  return buildLandingConfig({
    id: "landing-test",
    name: "landing-test",
    comment: "",
    pixelId: "",
    postUrl: "",
    landingTag: "TEST",
    config,
  });
}

test("captura de email permanece apagada en configuraciones nuevas y anteriores", () => {
  assert.equal(DEFAULT_CONFIG.emailCaptureEnabled, false);
  assert.equal(published(DEFAULT_CONFIG).emailCapture?.enabled, false);
  const previousConfig = { ...DEFAULT_CONFIG };
  delete previousConfig.emailCaptureEnabled;
  assert.equal(published(previousConfig).emailCapture?.enabled, false);
});

test("solo templates 1 y 2 pueden publicar captura de email activada", () => {
  for (const template of ["template1", "template2"] as const) {
    assert.equal(published({ ...DEFAULT_CONFIG, template, emailCaptureEnabled: true }).emailCapture?.enabled, true);
  }
  for (const template of ["template3", "template4", "template5", "template6", "template7"] as const) {
    assert.equal(published({ ...DEFAULT_CONFIG, template, emailCaptureEnabled: true }).emailCapture?.enabled, false);
  }
});
