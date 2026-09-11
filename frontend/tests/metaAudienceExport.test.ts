import assert from "node:assert/strict";
import test from "node:test";
import type { ConversionRow } from "../lib/conversionsDb";
import {
  buildMetaAudience,
  buildMetaAudienceCsv,
  fieldCoverage,
} from "../lib/metaAudienceExport";

function purchaseRow(
  id: string,
  extra: Partial<ConversionRow> = {},
): ConversionRow {
  return {
    id,
    user_id: "client-1",
    phone: "",
    email: "",
    fn: "",
    ln: "",
    ct: "",
    st: "",
    zip: "",
    country: "",
    purchase_event_id: `purchase-${id}`,
    purchase_type: "first",
    purchase_transaction_id: `transaction-${id}`,
    observaciones: "",
    valor: 100,
    created_at: "2026-09-01T12:00:00.000Z",
    ...extra,
  } as ConversionRow;
}

test("unifica una persona por identificadores y deduplica compras repetidas", () => {
  const result = buildMetaAudience([
    purchaseRow("first", {
      phone: "+54 9 11 2222-3333",
      email: "Cliente@Ejemplo.com ",
      fn: "José",
      country: "Argentina",
      valor: 100,
    }),
    purchaseRow("repeat", {
      phone: "",
      email: "cliente@ejemplo.com",
      purchase_type: "repeat",
      valor: 250,
      created_at: "2026-09-03T12:00:00.000Z",
    }),
    purchaseRow("duplicate", {
      phone: "5491122223333",
      purchase_event_id: "purchase-first",
      purchase_transaction_id: "transaction-first",
      valor: 100,
    }),
  ], {
    valueMetric: "period_total",
    purchaseScope: "all",
    countryCallingCode: "54",
  });

  assert.equal(result.purchaseEvents, 2);
  assert.equal(result.buyersBeforeValueFilter, 1);
  assert.equal(result.people[0].value, 350);
  assert.equal(result.people[0].purchaseCount, 2);
  assert.equal(result.people[0].fields.phone, "5491122223333");
  assert.equal(result.people[0].fields.email, "cliente@ejemplo.com");
  assert.equal(result.people[0].fields.fn, "jose");
  assert.equal(result.people[0].fields.country, "ar");
});

test("calcula primera carga, total por tipo y aplica el rango monetario", () => {
  const rows = [
    purchaseRow("a-first", { phone: "111", valor: 50 }),
    purchaseRow("a-repeat", {
      phone: "111",
      purchase_type: "repeat",
      valor: 200,
      created_at: "2026-09-02T12:00:00.000Z",
    }),
    purchaseRow("b-first", { phone: "222", valor: 300 }),
    purchaseRow("test", { phone: "333", valor: 900, test_event_code: "TEST123" }),
  ];

  const firstPurchase = buildMetaAudience(rows, {
    valueMetric: "first_purchase",
    purchaseScope: "all",
    minimumValue: 100,
  });
  assert.deepEqual(firstPurchase.people.map((person) => person.fields.phone), ["222"]);
  assert.equal(firstPurchase.excludedByValue, 1);

  const repeats = buildMetaAudience(rows, {
    valueMetric: "period_total",
    purchaseScope: "repeat",
  });
  assert.equal(repeats.people.length, 1);
  assert.equal(repeats.people[0].fields.phone, "111");
  assert.equal(repeats.people[0].value, 200);
});

test("genera CSV con los campos elegidos y agrega value sólo cuando corresponde", () => {
  const result = buildMetaAudience([
    purchaseRow("one", {
      email: "PERSONA@EXAMPLE.COM",
      phone: "+595 981 123 456",
      fn: "María",
      ln: "Pérez",
      valor: 1234.5,
    }),
  ], {
    valueMetric: "period_total",
    purchaseScope: "all",
  });

  assert.deepEqual(fieldCoverage(result.people), {
    email: 1,
    phone: 1,
    fn: 1,
    ln: 1,
    ct: 0,
    st: 0,
    zip: 0,
    country: 0,
  });

  const segmented = buildMetaAudienceCsv({
    people: result.people,
    selectedFields: ["email", "phone"],
    audienceType: "segmented",
  });
  assert.equal(
    segmented,
    '"email","phone"\r\n"persona@example.com","595981123456"',
  );

  const valueBased = buildMetaAudienceCsv({
    people: result.people,
    selectedFields: ["email", "fn", "ln"],
    audienceType: "value_based",
  });
  assert.equal(
    valueBased,
    '"email","fn","ln","value"\r\n"persona@example.com","maria","perez","1234.5"',
  );
});

test("completa el código de país de teléfonos locales según el workspace", () => {
  const argentina = buildMetaAudience([
    purchaseRow("ar", { phone: "011 2222-3333" }),
  ], {
    valueMetric: "period_total",
    purchaseScope: "all",
    countryCallingCode: "54",
  });
  const paraguay = buildMetaAudience([
    purchaseRow("py", { phone: "0981 123 456" }),
  ], {
    valueMetric: "period_total",
    purchaseScope: "all",
    countryCallingCode: "595",
  });

  assert.equal(argentina.people[0].fields.phone, "541122223333");
  assert.equal(paraguay.people[0].fields.phone, "595981123456");
});
