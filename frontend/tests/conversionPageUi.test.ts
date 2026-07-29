import assert from "node:assert/strict";
import test from "node:test";
import { isSuccessfulMetaResponse } from "../components/conversiones/ConversionPageUi";

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
