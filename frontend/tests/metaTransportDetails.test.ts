import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MetaTransportDetails } from "../components/conversiones/MetaTransportDetails";
const render = (log: Parameters<typeof MetaTransportDetails>[0]["log"]) => renderToStaticMarkup(createElement(MetaTransportDetails, { log }));
test("historical logs stay without invented transport details", () => {
  assert.equal(render({}), "");
  assert.equal(render({ meta_api_version: null, meta_http_status: null, meta_attempt: null }), "");
});
test("shows actual status, Graph version and execution attempt", () => {
  const html = render({ meta_api_version: "v26.0", meta_http_status: 201, meta_attempt: 2 });
  assert.match(html, /Graph v26.0 · HTTP 201 · Intento HTTP 2/);
  assert.match(html, /cada ejecución posterior/);
});
test("network failures have no fabricated HTTP code", () => {
  const html = render({ meta_api_version: "v25.0", meta_http_status: null, meta_attempt: 3 });
  assert.match(html, /Sin respuesta HTTP/); assert.doesNotMatch(html, /HTTP 200/);
});
