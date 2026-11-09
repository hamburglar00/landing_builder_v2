import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingTemplateSection } from "../components/landing/LandingEditorForm";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";

test("Atrio habilita todas sus plantillas y WhatsApp muestra solo las suyas", () => {
  const config = { ...DEFAULT_CONFIG, template: "template7" as const };
  const props = { config, setConfig: () => undefined };
  const hidden = renderToStaticMarkup(createElement(LandingTemplateSection, { ...props, allowAtrio: false }));
  const enabled = renderToStaticMarkup(createElement(LandingTemplateSection, { ...props, allowAtrio: true }));

  assert.doesNotMatch(hidden, /Plantilla 7/);
  assert.doesNotMatch(hidden, /value="template[789]"/);
  assert.match(enabled, /Plantilla 7/);
  assert.match(enabled, /Plantilla 8/);
  assert.match(enabled, /Plantilla 9/);
  assert.doesNotMatch(enabled, /value="template[1-6]"/);
  const whatsapp=renderToStaticMarkup(createElement(LandingTemplateSection,{...props,config:{...config,template:"template2"},allowAtrio:true}));
  assert.match(whatsapp,/Plantilla 6/);
  assert.doesNotMatch(whatsapp,/value="template[789]"/);
});

test("una landing existente de Template 7 avisa que debe cambiar de plantilla si se revocó el permiso", () => {
  const html = renderToStaticMarkup(createElement(LandingTemplateSection, {
    config: { ...DEFAULT_CONFIG, template: "template7" },
    setConfig: () => undefined,
    allowAtrio: false,
  }));

  assert.doesNotMatch(html, /value="template7"/);
  assert.match(html, /Atrio no está habilitado/);
});
