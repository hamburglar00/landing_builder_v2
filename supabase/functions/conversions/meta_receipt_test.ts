import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateMetaReceipt } from "./meta_receipt.ts";

Deno.test("Meta accepts only an explicit exact numeric receipt without an error", () => {
  assertEquals(evaluateMetaReceipt(200, '{"events_received":1}').accepted, true);
  assertEquals(evaluateMetaReceipt(201, '{"events_received":1,"fbtrace_id":"fixture"}').accepted, true);
  for (const body of ["", "<html>OK</html>", "null", "true", "1", "[]", "{}", '{"events_received":"1"}',
    '{"events_received":0}', '{"events_received":2}', '{"events_received":-1}', '{"events_received":1.5}']) {
    const receipt = evaluateMetaReceipt(200, body);
    assertEquals(receipt.accepted, false, body);
    assertEquals(receipt.retryable, true, body);
  }
  assertEquals(evaluateMetaReceipt(200, '{"events_received":1,"error":null}').accepted, false);
  assertEquals(evaluateMetaReceipt(400, '{"events_received":1}').accepted, false);
});

Deno.test("Meta errors preserve transient versus permanent retry behavior", () => {
  assertEquals(evaluateMetaReceipt(200, '{"error":{"is_transient":true}}').retryable, true);
  assertEquals(evaluateMetaReceipt(200, '{"error":{"code":190}}').retryable, false);
  assertEquals(evaluateMetaReceipt(400, '{"error":{"code":190}}').retryable, false);
  for (const status of [408, 429, 500, 503]) {
    assertEquals(evaluateMetaReceipt(status, "unavailable").retryable, true);
    assertEquals(evaluateMetaReceipt(status, '{"error":{}}').retryable, true);
  }
  assertEquals(evaluateMetaReceipt(400, "bad request").retryable, false);
});
