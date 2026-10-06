import assert from "node:assert/strict";
import test from "node:test";
import { renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import type { PublicLandingConfig } from "../components/public-landing/types";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import { switchLandingTemplate } from "../lib/landing/templateVariants";
import type { LandingTemplate6Grid } from "../lib/landing/types";

for (const [grid, count] of [["2x1", 2], ["2x2", 4], ["2x3", 6]] as const) {
  test(`plantilla 6 publica ${count} tarjetas y CTAs en grilla ${grid}`, () => {
    const config = buildLandingConfig({
      id: "test-cover",
      name: "Portada",
      comment: "",
      pixelId: "",
      postUrl: "",
      landingTag: "COVER",
      config: {
        ...DEFAULT_CONFIG,
        template: "template6",
        ctaDestination: "atrio",
        leadCapture: { ...DEFAULT_CONFIG.leadCapture, enabled: true },
        template6Cover: {
          grid: grid as LandingTemplate6Grid,
          backgroundImageUrl: "https://cdn.example.com/cover.avif",
          headerText: "Primera línea\nSegunda línea\nIgnorada",
          footerText: "Pie uno\nPie dos",
          cards: Array.from({ length: 6 }, (_, index) => ({
            imageUrl: `https://cdn.example.com/card-${index + 1}.avif`,
            text: `Opción ${index + 1}`,
            ctaText: index === 0 ? "Elegir esta" : "",
          })),
        },
      },
    });

    assert.equal(config.layout.template, 6);
    assert.equal(config.tracking.ctaDestination, "whatsapp");
    assert.equal(config.leadCapture?.enabled, false);
    assert.equal(config.content?.template6?.cards.length, count);
    assert.equal(config.content?.template6?.backgroundImageUrl, "https://cdn.example.com/cover.avif");
    assert.equal(config.content?.template6?.headerText, "Primera línea\nSegunda línea");
    const html = renderPublicLandingHtml({ slug: "portada", config: config as PublicLandingConfig });
    assert.equal(html.split('class="template6__card"').length - 1, count);
    assert.equal(html.split('class="template6__cta"').length - 1, count);
    assert.match(html, /class="template6__background"/);
    assert.match(html, /class="public-landing template6 has-background"/);
    assert.match(html, /Elegir esta/);
    assert.doesNotMatch(html, /Ignorada/);
    if (count < 6) assert.doesNotMatch(html, /card-6\.avif/);
  });
}

test("la portada conserva sus tarjetas al cambiar de plantilla", () => {
  const config = switchLandingTemplate(DEFAULT_CONFIG, "template6");
  const customized = {
    ...config,
    template6Cover: {
      ...config.template6Cover!,
      grid: "2x3" as const,
      cards: config.template6Cover!.cards.map((card, index) =>
        index === 5 ? { ...card, text: "Sexta opción" } : card,
      ),
    },
  };
  const restored = switchLandingTemplate(switchLandingTemplate(customized, "template2"), "template6");
  assert.equal(restored.template6Cover?.grid, "2x3");
  assert.equal(restored.template6Cover?.cards[5]?.text, "Sexta opción");
  assert.equal(restored.ctaDestination, "whatsapp");
});

test("la portada conserva el fondo opcional al cambiar de plantilla", () => {
  const config = switchLandingTemplate(DEFAULT_CONFIG, "template6");
  const customized = {
    ...config,
    template6Cover: { ...config.template6Cover!, backgroundImageUrl: "https://cdn.example.com/fondo.avif" },
  };
  const restored = switchLandingTemplate(switchLandingTemplate(customized, "template1"), "template6");
  assert.equal(restored.template6Cover?.backgroundImageUrl, "https://cdn.example.com/fondo.avif");
  const noBackground = buildLandingConfig({
    id: "without-background", name: "Portada", comment: "", pixelId: "", postUrl: "", landingTag: "COVER",
    config: { ...DEFAULT_CONFIG, template: "template6" },
  });
  const html = renderPublicLandingHtml({ slug: "portada", config: noBackground as PublicLandingConfig });
  assert.doesNotMatch(html, /class="template6__background"/);
});
