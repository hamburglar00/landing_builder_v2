import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CtaDestinationSection } from "../components/landing/CtaDestinationSection";
import { renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import { buildPublicLandingRuntimeSource } from "../components/public-landing/PublicLandingRuntimeScript";
import type { PublicLandingConfig } from "../components/public-landing/types";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import { switchLandingTemplate } from "../lib/landing/templateVariants";

const publicRuntime = buildPublicLandingRuntimeSource();

test("el editor de Template 7 oculta el aviso de Atrio y usa un selector propio", () => {
  const props = { setConfig: () => undefined, atrioClients: [] };
  const template7 = renderToStaticMarkup(createElement(CtaDestinationSection, {
    ...props,
    config: { ...DEFAULT_CONFIG, template: "template7", ctaDestination: "atrio" },
  }));
  const template2 = renderToStaticMarkup(createElement(CtaDestinationSection, {
    ...props,
    config: { ...DEFAULT_CONFIG, template: "template2", ctaDestination: "atrio" },
  }));

  assert.doesNotMatch(template7, /cliente\(s\) Atrio disponibles/);
  assert.match(template7, /Proveedor de destino/);
  assert.match(template7, /aria-haspopup="listbox"/);
  assert.doesNotMatch(template7, /<select\b/);
  assert.match(template2, /cliente\(s\) Atrio disponibles/);
});

test("la plantilla 7 conserva su configuración separada de la 2", () => {
  const original = { ...DEFAULT_CONFIG, template: "template2" as const, titleLine1: "Título 2" };
  const seven = { ...switchLandingTemplate(original, "template7"), titleLine1: "Título 7" };
  const twoAgain = switchLandingTemplate(seven, "template2");

  assert.equal(twoAgain.titleLine1, "Título 2");
  assert.equal(seven.ctaDestination, "atrio");
  assert.equal(seven.targetProvider, "rey_de_ases");
  assert.equal(twoAgain.ctaDestination, original.ctaDestination);
  assert.equal(switchLandingTemplate(twoAgain, "template7").titleLine1, "Título 7");
});

test("la plantilla 7 publica un formulario de nombre con asesor de Atrio", () => {
  const config = buildLandingConfig({
    id: "landing-7",
    name: "Prueba 7",
    comment: "",
    pixelId: "",
    postUrl: "",
    landingTag: "TEST",
    config: {
      ...DEFAULT_CONFIG,
      template: "template7",
      backgroundImages: ["https://cdn.example.com/fondo.jpg"],
      logoUrl: "https://cdn.example.com/logo.png",
      titleLine1: "Título siete",
      footerBadgeLine1: "Badge siete",
      subtitleLine1: "Detalle siete",
      emailCaptureEnabled: true,
      ctaText: "Crear mi cuenta",
    },
  });

  assert.equal(config.layout.template, 7);
  assert.equal(config.emailCapture?.enabled, false);
  assert.equal(config.tracking.ctaDestination, "atrio");
  assert.equal(config.tracking.target_provider, "rey_de_ases");
  const html = renderPublicLandingHtml({ slug: "prueba-7", config: config as PublicLandingConfig });
  const source = html + publicRuntime;
  const main = html.match(/<main class="public-landing template7"[\s\S]*?<\/main>/)?.[0] ?? "";
  assert.match(main, /class="public-landing template7"/);
  assert.match(main, /Título siete/);
  assert.match(main, /Detalle siete/);
  assert.match(main, /data-template7-name/);
  assert.match(main, /class="template7__cta"[^>]*disabled/);
  assert.match(main, /Crear mi cuenta/);
  assert.doesNotMatch(main, /Badge siete/);
  assert.doesNotMatch(main, /data-inline-email-input/);
  assert.doesNotMatch(main, /data-public-landing-social-proof/);
  assert.match(html, /imagesizes="100vw"/);
  assert.match(source, /processCtaClick\(button, \{ firstName: firstName, phone: normalizedWhatsapp \}\)/);
  assert.match(source, /formFn = hasLeadCaptureForm && \(cfg.template === 7 \|\| captureFields.firstName\)/);
  assert.match(source, /var redirectUrl = gatewayMode \? "" : atrioMode/);
  assert.match(source, /startTemplate7Gateway\(formFn, formPhone, promoCode, atrioData, tracking, params\)/);
  assert.match(source, /navigateTemplate7Handoff\(handoffUrl\)/);
  assert.match(html, /fetch\("\/api\/client-identity\/bootstrap"/);
  assert.match(html, /credentials: "same-origin", cache: "no-store"/);
  assert.match(html, /cookie propia necesaria <code>lb_cid<\/code>/);
  assert.match(source, /template7AttemptContext = context/);
  assert.doesNotMatch(source, /device_id: deviceId|localStorage\.setItem\("lb_cid"/);
  assert.match(source, /notifyAtrioClick\(atrioData\)/);
  assert.doesNotMatch(html, /landing-phone\?name=prueba-7/);
  assert.match(source, /template7ContactSent = true/);
  assert.match(source, /target_provider: gatewayMode \? cfg.targetProvider/);
  assert.match(source, /cfg\.targetProvider === "multi_skin"/);
  assert.match(source, /"ases_del_norte_gateway"/);
  assert.match(source, /"ganamos_net_gateway"/);
  assert.match(source, /"rey_de_ases_gateway"/);
  assert.match(source, /atrio_client_id: atrioMode/);
  assert.match(source, /atrio_id: atrioMode/);
  assert.match(source, /atrio_slug: atrioMode/);
  assert.doesNotMatch(source, /INTERNAL_CHAT_PLAYER_RESOLVE_KEY|API2_GATEWAY_API_KEY|REY_GATEWAY_HANDOFF_API_KEY/);
});

test("Template 7 publica WhatsApp opcional, lo normaliza y no bloquea un valor invalido", () => {
  const built = buildLandingConfig({
    id: "landing-7", name: "Prueba 7", comment: "", pixelId: "", postUrl: "",
    landingTag: "TEST", config: {
      ...DEFAULT_CONFIG,
      template: "template7",
      template7WhatsappEnabled: true,
    },
  });
  const html = renderPublicLandingHtml({ slug: "prueba-7", config: built as PublicLandingConfig });

  assert.equal(built.template7Capture?.whatsapp, true);
  assert.match(html, /data-template7-whatsapp/);
  assert.match(html, /WhatsApp <span>\(opcional\)<\/span>/);
  assert.match(html, /data-template7-phone-warning/);
  assert.match(publicRuntime, /normalizeArgentinaWhatsapp/);
  assert.match(publicRuntime, /Continuaremos sin guardarlo/);
  assert.match(publicRuntime, /Promise\.all\(\[/);
  assert.match(publicRuntime, /phone: phone \|\| undefined/);
});

test("Template 7 varía el nombre de ejemplo por visita en ambos modos del constructor", () => {
  const config = buildLandingConfig({
    id: "landing-7", name: "Prueba 7", comment: "", pixelId: "", postUrl: "",
    landingTag: "TEST", config: { ...DEFAULT_CONFIG, template: "template7" },
  }) as PublicLandingConfig;

  for (const demoMode of [false, true]) {
    const html = renderPublicLandingHtml({ slug: "prueba-7", config, demoMode });
    const script = html.match(/<script>(\(\(\)=>\{const input=document\.querySelector\('\[data-template7-name\]'\);[\s\S]*?\}\)\(\);)<\/script>/)?.[1];
    assert.ok(script);

    const placeholders: string[] = [];
    for (const random of [0, 0.35]) {
      const input = { placeholder: "" };
      new Script(script).runInNewContext({
        document: { querySelector: () => input },
        Math: { floor: Math.floor, random: () => random },
      });
      placeholders.push(input.placeholder);
    }
    assert.deepEqual(placeholders, ["Ej.: Martín", "Ej.: Valentina"]);
  }
});

test("Template 7 publica Multi Skin como target_provider sin afectar otras plantillas", () => {
  const config = {
    ...DEFAULT_CONFIG,
    template: "template7" as const,
    targetProvider: "multi_skin" as const,
    multiSkinCode: "ganamos_plus" as const,
  };
  const built = buildLandingConfig({ id: "landing-7", name: "Prueba 7", comment: "", pixelId: "", postUrl: "", landingTag: "TEST", config });
  assert.equal(built.tracking.target_provider, "multi_skin");
  assert.equal(built.tracking.skin_code, "ganamos_plus");
  const html = renderPublicLandingHtml({ slug: "prueba-7", config: built as PublicLandingConfig });
  assert.match(html, /"targetProvider":"multi_skin"/);
  assert.match(html, /"skinCode":"ganamos_plus"/);
  const other = buildLandingConfig({ id: "landing-2", name: "Prueba 2", comment: "", pixelId: "", postUrl: "", landingTag: "TEST", config: { ...config, template: "template2" } });
  assert.equal(other.tracking.target_provider, undefined);
  assert.equal(other.tracking.skin_code, undefined);
});

test("Template 7 inicia bootstrap antes del Pixel y conserva Contact sin duplicarlo al reintentar", () => {
  const built = buildLandingConfig({
    id: "landing-7", name: "Prueba 7", comment: "", pixelId: "123456", postUrl: "https://example.com/post",
    landingTag: "TEST", config: { ...DEFAULT_CONFIG, template: "template7" },
  });
  const html = renderPublicLandingHtml({ slug: "prueba-7", config: built as PublicLandingConfig });
  const bootstrapAt = html.indexOf('fetch("/api/client-identity/bootstrap"');
  const pixelAt = html.indexOf("fbq('track', 'PageView')");
  const runtimeAt = html.indexOf('/public-assets/landing-runtime-v3.js');
  assert.ok(bootstrapAt > 0 && bootstrapAt < pixelAt && pixelAt < runtimeAt);
  assert.match(publicRuntime, /recordLandingJourneyStart\(\);/);
  assert.equal(html.match(/fbq\('track', 'PageView'\)/g)?.length, 1);
  assert.match(html, /ready\.then\(init,init\)/);
  assert.match(publicRuntime, /shouldSkipContact = context\.shouldSkipContact \|\| \(cfg\.template === 7 && template7ContactSent\)/);
  assert.match(publicRuntime, /if \(!shouldSkipContact\) markContactSent/);
  assert.match(publicRuntime, /if \(gatewayMode && !shouldSkipContact\) template7ContactSent = true/);
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Script(match[1]);
  new Script(publicRuntime);
});
