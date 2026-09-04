import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import {
  switchLandingTemplate,
  withCurrentTemplateSnapshot,
} from "../lib/landing/templateVariants";
import type { LandingThemeConfig } from "../lib/landing/types";

function baseConfig(patch: Partial<LandingThemeConfig> = {}): LandingThemeConfig {
  return {
    ...DEFAULT_CONFIG,
    ...patch,
    leadCapture: {
      ...DEFAULT_CONFIG.leadCapture,
      ...(patch.leadCapture ?? {}),
      fields: {
        ...DEFAULT_CONFIG.leadCapture.fields,
        ...(patch.leadCapture?.fields ?? {}),
      },
    },
  };
}

test("restaura la configuracion visual independiente de cada plantilla", () => {
  const template2 = baseConfig({
    template: "template2",
    titleLine1: "Titulo template 2",
    ctaText: "CTA template 2",
    ctaDestination: "whatsapp",
  });

  const template5 = {
    ...switchLandingTemplate(template2, "template5"),
    template5Live: {
      ...DEFAULT_CONFIG.template5Live!,
      titleText: "Titulo template 5",
      subtitleText: "Subtitulo template 5",
    },
    ctaDestination: "atrio" as const,
  };

  const restoredTemplate2 = switchLandingTemplate(template5, "template2");

  assert.equal(restoredTemplate2.template, "template2");
  assert.equal(restoredTemplate2.titleLine1, "Titulo template 2");
  assert.equal(restoredTemplate2.ctaText, "CTA template 2");
  assert.equal(restoredTemplate2.ctaDestination, "atrio");
  assert.equal(
    restoredTemplate2.templateConfigs?.template5?.template5Live?.titleText,
    "Titulo template 5",
  );
});

test("el snapshot de guardado incluye la plantilla activa actual", () => {
  const config = baseConfig({
    template: "template5",
    template5Live: {
      ...DEFAULT_CONFIG.template5Live!,
      titleText: "Live actualizado",
    },
  });

  const saved = withCurrentTemplateSnapshot(config);

  assert.equal(
    saved.templateConfigs?.template5?.template5Live?.titleText,
    "Live actualizado",
  );
});
