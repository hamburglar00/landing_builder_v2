import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingTemplateSection } from "../components/landing/LandingEditorForm";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";

test("Plantilla 7 solo figura en el selector cuando la cuenta tiene permiso", () => {
  const config = { ...DEFAULT_CONFIG, template: "template2" as const };
  const props = { config, setConfig: () => undefined };
  const hidden = renderToStaticMarkup(createElement(LandingTemplateSection, { ...props, allowTemplate7: false }));
  const enabled = renderToStaticMarkup(createElement(LandingTemplateSection, { ...props, allowTemplate7: true }));

  assert.doesNotMatch(hidden, /Plantilla 7/);
  assert.match(hidden, /Plantilla 6/);
  assert.match(enabled, /Plantilla 7/);
});

test("una landing existente de Template 7 avisa que debe cambiar de plantilla si se revocó el permiso", () => {
  const html = renderToStaticMarkup(createElement(LandingTemplateSection, {
    config: { ...DEFAULT_CONFIG, template: "template7" },
    setConfig: () => undefined,
    allowTemplate7: false,
  }));

  assert.doesNotMatch(html, /value="template7"/);
  assert.match(html, /ya no está habilitada/);
});
