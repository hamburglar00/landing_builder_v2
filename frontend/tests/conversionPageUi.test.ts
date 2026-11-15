import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { isSuccessfulMetaResponse, statusText } from "../components/conversiones/ConversionPageUi";

test("reconoce una respuesta exitosa de Meta CAPI", () => {
  assert.equal(
    isSuccessfulMetaResponse({
      function_name: "sendToMetaCAPI",
      message: "Meta CAPI respuesta",
      response_meta: JSON.stringify({ events_received: 1 }),
    }),
    true,
  );
});

test("no marca como exitosa una respuesta con error o sin eventos", () => {
  assert.equal(
    isSuccessfulMetaResponse({
      function_name: "sendToMetaCAPI",
      message: "Meta CAPI respuesta",
      response_meta: JSON.stringify({
        error: { message: "Invalid parameter" },
        events_received: 0,
      }),
    }),
    false,
  );
});

test("tolera respuestas de Meta malformadas", () => {
  assert.equal(
    isSuccessfulMetaResponse({
      function_name: "sendToMetaCAPI",
      message: "Meta CAPI respuesta",
      response_meta: "{invalid-json",
    }),
    false,
  );
});

test("el indicador de entrega exige el recibo numérico exacto de un evento sin error", () => {
  for (const response of [
    null, [], [{ events_received: 1 }], "accepted", true, 1, {},
    { events_received: 0 }, { events_received: -1 }, { events_received: 2 },
    { events_received: 1.5 }, { events_received: "1" }, { events_received: true },
    { events_received: null }, { events_received: 1, error: null },
    { events_received: 1, error: false }, { events_received: 1, error: {} },
  ]) {
    const response_meta = JSON.stringify(response);
    assert.equal(isSuccessfulMetaResponse({
      function_name: "sendToMetaCAPI", message: "Meta CAPI respuesta", response_meta,
    }), false, response_meta);
  }
});

test("una entrega incierta muestra revisión pendiente en ámbar y no figura enviada", () => {
  const html = renderToStaticMarkup(statusText("unconfirmed_meta_receipt"));
  assert.equal(html, '<span class="text-amber-300">sin confirmación: requiere revisión</span>');
});
