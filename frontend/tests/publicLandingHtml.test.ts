import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  buildPixelInitScript,
  buildPixelNoscript,
} from "../components/public-landing/metaPixelHtml";
import { renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import type { PublicLandingConfig } from "../components/public-landing/types";

const baseConfig: PublicLandingConfig = {
  schemaVersion: 1,
  updatedAt: "2026-07-29T00:00:00.000Z",
  id: "landing-test",
  name: "Landing de prueba",
  comment: "Comentario interno que no debe exponerse",
  tracking: {
    pixelId: "123456789",
    postUrl: "https://example.com/conversions",
    landingTag: "TEST",
    sendContactPixel: true,
  },
  background: {
    mode: "single",
    images: ["https://cdn.example.com/background.avif"],
    imagesResponsive: [
      {
        mobile: "https://cdn.example.com/background-mobile.avif",
        tablet: "https://cdn.example.com/background-tablet.avif",
        desktop: "https://cdn.example.com/background-desktop.avif",
      },
    ],
    rotateEveryHours: 24,
  },
  content: {
    logoUrl: "https://cdn.example.com/logo.avif",
    title: ["Oferta principal", "", ""],
    subtitle: ["Atención inmediata por WhatsApp", "", ""],
    footerBadge: ["Beneficio exclusivo", "", ""],
    ctaText: "Contactar",
  },
  typography: {
    fontFamily: "system",
    title: { sizePx: 26, weight: 700 },
    subtitle: { sizePx: 16, weight: 400 },
    cta: { sizePx: 18, weight: 700 },
    badge: { sizePx: 16, weight: 700 },
  },
  colors: {
    title: "#ffffff",
    subtitle: "#ffffff",
    badge: "#ffd700",
    ctaText: "#ffffff",
    ctaBackground: "#25d366",
    ctaGlow: "#ffd700",
  },
  socialProof: { enabled: true },
  interactions: { enabled: false, whatsappPrefillText: "" },
  layout: {
    ctaPosition: "between_title_and_info",
    template: 1,
  },
};

function occurrences(value: string, search: string) {
  return value.split(search).length - 1;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

test("genera un único bootstrap de Meta Pixel y un único PageView", () => {
  const html = renderPublicLandingHtml({
    slug: "oferta-test",
    config: baseConfig,
  });
  const pixelScript = buildPixelInitScript("123456789", "oferta-test");
  const pixelNoscript = buildPixelNoscript("123456789");

  assert.equal(
    occurrences(html, "https://connect.facebook.net/en_US/fbevents.js"),
    1,
  );
  assert.equal(occurrences(html, "fbq('track', 'PageView')"), 1);
  assert.equal(occurrences(html, "fbq('init', \"123456789\""), 1);
  assert.equal(occurrences(html, pixelScript), 1);
  assert.equal(occurrences(html, pixelNoscript), 1);
});

test("mantiene estable el bloque activo de Meta Pixel", () => {
  const pixelScript = buildPixelInitScript("abc123456", "slug-test");
  const pixelNoscript = buildPixelNoscript("abc123456");

  assert.equal(
    sha256(pixelScript),
    "d31d058a45e0e84ce2ce74ab8b71099470a17c9886a7d54ff4c9b8b7cbdb0076",
  );
  assert.equal(
    sha256(pixelNoscript),
    "2c57ae4dcb0eda01ead14e7ca178241ed91c0ca61bef0f370705d8b5145e142c",
  );
  assert.match(pixelScript, /landing-builder:123456:slug-test/);
  assert.match(pixelScript, /sanitizeAddressBar/);
  assert.match(pixelScript, /fbq\('track', 'PageView'\)/);
  assert.match(pixelScript, /external_id: externalId/);
  assert.match(pixelNoscript, /facebook\.com\/tr\?id=123456&amp;ev=PageView/);
});

test("mantiene identidad aislada por pixel y slug", () => {
  const html = renderPublicLandingHtml({
    slug: "oferta-test",
    config: baseConfig,
  });

  assert.match(html, /landing-builder:123456789:oferta-test/);
  assert.doesNotMatch(html, /Comentario interno que no debe exponerse/);
});

test("genera metadatos sociales públicos sin exponer comentarios internos", () => {
  const html = renderPublicLandingHtml({
    slug: "oferta-test",
    config: baseConfig,
    canonicalUrl:
      "https://constructor.panelbotadmin.com/l/oferta-test",
  });

  assert.match(html, /<title>Oferta principal<\/title>/);
  assert.match(
    html,
    /<meta name="description" content="Atención inmediata por WhatsApp">/,
  );
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/constructor\.panelbotadmin\.com\/l\/oferta-test">/,
  );
  assert.match(html, /<meta property="og:title" content="Oferta principal">/);
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/cdn\.example\.com\/background-desktop\.avif">/,
  );
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.doesNotMatch(html, /Comentario interno que no debe exponerse/);
});

test("conserva Contact con eventID y deduplicación local", () => {
  const html = renderPublicLandingHtml({
    slug: "oferta-test",
    config: baseConfig,
  });

  assert.equal(
    occurrences(
      html,
      'window.fbq("track", "Contact", { source: "main_button" }, { eventID: eventId })',
    ),
    1,
  );
  assert.match(html, /CONTACT_DEDUP_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(html, /contact_sent:/);
  assert.match(html, /scheduleMetaClientIpCollection/);
  assert.match(html, /scheduleOfficialMetaParamBuilder/);
  assert.match(
    html,
    /vendor\/meta-capi-param-builder\/1\.3\.1\/clientParamBuilder\.bundle\.js/,
  );
  assert.match(html, /sdk\.processAndCollectAllParams\(window\.location\.href/);
  assert.match(html, /window\.__PUBLIC_META_COLLECT_PARAMS/);
  assert.match(html, /return officialMetaTracking/);
  assert.match(html, /client_ip_issued_at: tracking\.clientIpIssuedAt/);
  assert.match(html, /client_ip_proof: tracking\.clientIpProof/);
  assert.match(html, /requestIdleCallback/);
});

test("genera scripts públicos con JavaScript válido", () => {
  const html = renderPublicLandingHtml({
    slug: "oferta-test",
    config: baseConfig,
  });
  const inlineScripts = Array.from(
    html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
    (match) => match[1],
  ).filter(Boolean);

  assert.ok(inlineScripts.length >= 2);
  inlineScripts.forEach((script) => {
    assert.doesNotThrow(() => new Function(script));
  });
});

test("omite completamente el pixel cuando no hay Pixel ID", () => {
  const html = renderPublicLandingHtml({
    slug: "sin-pixel",
    config: {
      ...baseConfig,
      tracking: {
        ...baseConfig.tracking,
        pixelId: "",
      },
    },
  });

  assert.doesNotMatch(html, /fbevents\.js/);
  assert.doesNotMatch(html, /fbq\('init'/);
  assert.doesNotMatch(html, /facebook\.com\/tr\?id=/);
});
