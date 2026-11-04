import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import { switchLandingTemplate, withCurrentTemplateSnapshot } from "../lib/landing/templateVariants";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { getTemplate9Brand } from "../lib/landing/template9";
import { MULTI_SKIN_CODES } from "../lib/multi-skin-catalog";
import { renderPublicLandingHtml, renderClassicTemplate7InlineHtml } from "../components/public-landing/renderPublicLandingHtml";
import { buildTemplate7RuntimeConfig } from "../components/public-landing/template7FastRuntime";
import { LandingTemplateSection } from "../components/landing/LandingEditorForm";
import { LandingPreview } from "../components/landing/LandingPreview";
import { validateEntryFunnelBatch, validateEntryFunnelContext } from "../lib/landing/entryFunnel";

const id = "a0000000-0000-4000-8000-000000000001";
const config = switchLandingTemplate({ ...DEFAULT_CONFIG, template: "template7", titleLine1: "Mi T7", template7WhatsappEnabled: true }, "template9");
const published = (provider = "ganamos_net", skin = "ganamos_plus") => buildLandingConfig({
  id, name: "fixture", comment: "", pixelId: "123456", postUrl: "https://events.invalid/conversions", landingTag: "T9",
  config: { ...config, targetProvider: provider as typeof config.targetProvider, multiSkinCode: skin as typeof config.multiSkinCode },
});
const publicConfig = (provider?: string, skin?: string) => {
  const payload = published(provider, skin);
  return { ...payload, layout: { ...payload.layout, ctaPosition: "bottom" } };
};

test("Template 9 has independent defaults/drafts and keeps the Atrio channel", () => {
  assert.equal(config.titleLine1, "Creá tu cuenta gratis");
  assert.equal(config.subtitleLine1, "Estamos Online 24hs!");
  assert.equal(config.ctaText, "CREAR MI CUENTA · +18");
  assert.equal(config.template7WhatsappEnabled, false);
  assert.equal(config.ctaDestination, "atrio");
  const edited = withCurrentTemplateSnapshot({ ...config, targetProvider: "ganamos_net", titleLine1: "Mi T9" });
  const seven = switchLandingTemplate(edited, "template7");
  assert.equal(seven.titleLine1, "Mi T7");
  assert.equal(switchLandingTemplate(seven, "template9").titleLine1, "Mi T9");
  assert.equal(switchLandingTemplate(edited, "template2").ctaDestination, "whatsapp");
});

test("Template 9 permission uses the existing single-platform entry capability", () => {
  const hidden = renderToStaticMarkup(createElement(LandingTemplateSection, { config, setConfig() {}, allowTemplate7: false }));
  assert.doesNotMatch(hidden, /value="template9"/);
  const visible = renderToStaticMarkup(createElement(LandingTemplateSection, { config, setConfig() {}, allowTemplate7: true }));
  assert.match(visible, /value="template9"/);
  const preview = renderToStaticMarkup(createElement(LandingPreview, { config }));
  assert.match(preview, /iframe/);
  assert.match(preview, /template9__card/);
  assert.doesNotMatch(preview, /connect\.facebook|functions\/v1|data-template7-runtime/);
});

for (const provider of ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"]) {
  test(`Template 9 ${provider}: both engines share the T7 entry and scoped tracking`, () => {
    const payload = publicConfig(provider);
    assert.equal(payload.layout.template, 9);
    assert.equal(payload.tracking.ctaDestination, "atrio");
    assert.equal(payload.tracking.target_provider, provider);
    assert.equal(payload.leadCapture?.enabled, false);
    assert.equal(payload.emailCapture?.enabled, false);
    const runtime = buildTemplate7RuntimeConfig("fixture", payload);
    assert.equal(runtime.template, 7, "same tested functional runtime");
    assert.equal(runtime.entryTemplate, 9, "diagnostics distinguish the visual template");
    assert.equal(runtime.ctaDestination, "atrio");
    assert.equal(runtime.targetProvider, provider);
    assert.equal(runtime.postUrl, "https://events.invalid/conversions");
    for (const html of [renderPublicLandingHtml({ slug: "fixture", config: payload }), renderClassicTemplate7InlineHtml({ slug: "fixture", config: payload }, "function getOrCreateDeviceId(){return 'fixture'}")]) {
      assert.match(html, /class="public-landing template9"/);
      assert.match(html, /Creá tu <b>cuenta gratis<\/b>/);
      assert.match(html, /data-template7-form/);
      assert.match(html, /data-template7-name/);
      assert.match(html, /data-template7-runtime/);
      assert.match(html, /"entryTemplate":9/);
      assert.match(html, /data-template9-cookie-dismiss/);
      assert.doesNotMatch(html, /data-public-landing-phone-prewarm|src="https:\/\/ganamosmayor|landing-styles-v3\.css/);
      assert.ok(html.includes(getTemplate9Brand(provider).logo));
    }
  });
}

test("NET and Plus match the reference palette; every Multi Skin uses its saved branding", () => {
  const net = getTemplate9Brand("ganamos_net"), plus = getTemplate9Brand("multi_skin", "ganamos_plus");
  assert.equal(net.primary, plus.primary);
  assert.equal(net.secondary, plus.secondary);
  for (const skin of MULTI_SKIN_CODES) {
    const html = renderPublicLandingHtml({ slug: "fixture", config: publicConfig("multi_skin", skin) });
    assert.ok(html.includes(getTemplate9Brand("multi_skin", skin).logo));
    assert.ok(html.includes(`"skinCode":"${skin}"`));
  }
});

test("Template 9 diagnostic context is accepted end to end without accepting unknown templates", () => {
  const context = { landing_id: id, flow_id: id, template: 9, telemetry_origin: "https://landing.panelbotadmin.com", started_at: Date.now() };
  assert.equal(validateEntryFunnelContext(context)?.template, 9);
  assert.equal(validateEntryFunnelBatch({ landing_id: id, flow_id: id, template: 9, events: [{ id, name: "cta_clicked", elapsed_ms: 10 }] })?.template, 9);
  assert.equal(validateEntryFunnelContext({ ...context, template: 10 }), null);
});
