import assert from "node:assert/strict";
import test from "node:test";
import { buildConversionLogQueryFilter } from "../lib/conversionLogFilters";

test("sin filtros conserva todos los Logs", () => {
  const filter = buildConversionLogQueryFilter("all", "all");

  assert.equal(filter.requireReceivedPayload, false);
  assert.equal(filter.requireMetaPayload, false);
  assert.equal(filter.orExpression, "");
});

test("CompleteRegistration recibido contempla variantes del bot", () => {
  const filter = buildConversionLogQueryFilter("received", "COMPLETEREGISTRATION");

  assert.match(filter.orExpression, /"event_name":"CompleteRegistration"/);
  assert.match(filter.orExpression, /"action":"COMPLETEREGISTRATION"/);
  assert.match(filter.orExpression, /"action":"COMPLETATIONREGISTRATION"/);
  assert.match(filter.orExpression, /"action":"COMPLETE_REGISTRATION"/);
});

test("Purchase recibido se identifica por event_name o action", () => {
  const filter = buildConversionLogQueryFilter("received", "PURCHASE");

  assert.equal(filter.requireReceivedPayload, true);
  assert.equal(filter.requireMetaPayload, false);
  assert.match(
    filter.orExpression,
    /payload_received\.ilike\.%"event_name":"Purchase"%/,
  );
  assert.match(
    filter.orExpression,
    /payload_received\.ilike\.%"action":"PURCHASE"%/,
  );
  assert.doesNotMatch(filter.orExpression, /payload_meta/);
});

test("Purchase enviado a Meta conserva únicamente filas con payload CAPI", () => {
  const filter = buildConversionLogQueryFilter("meta", "PURCHASE");

  assert.equal(filter.requireReceivedPayload, false);
  assert.equal(filter.requireMetaPayload, true);
  assert.equal(
    filter.orExpression,
    'payload_meta.ilike.%"event_name":"Purchase"%',
  );
});

test("un tipo sin recorrido busca tanto recepción como envío a Meta", () => {
  const filter = buildConversionLogQueryFilter("all", "LEAD");

  assert.match(filter.orExpression, /payload_received/);
  assert.match(filter.orExpression, /payload_meta/);
});
