import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetaAudienceCsv,
  getMetaAudienceExportStats,
  getMetaAudiencePreviewStats,
  mapMetaAudienceBuyerPayload,
  mapMetaAudienceBuyerRows,
  metaAudienceRepresentedPurchases,
  metaAudienceSummaryValue,
  type MetaAudienceBuyerRpcRow,
  type MetaAudiencePerson,
} from "../lib/metaAudienceExport";

function rpcRow(overrides: Partial<MetaAudienceBuyerRpcRow> = {}): MetaAudienceBuyerRpcRow {
  return {
    customer_key: " phone:5491111111111 ",
    phone: "+54 (9) 11 1111-1111",
    email: " PERSONA@EXAMPLE.COM ",
    fn: "María",
    ln: "Pérez",
    ct: "Córdoba",
    st: "Córdoba",
    zip: " X5000 ",
    country: "Argentina",
    currency: "ARS",
    historical_purchase_count: "4",
    historical_first_purchase_count: "1",
    historical_reload_count: "3",
    historical_total_value: "1000.50",
    historical_average_purchase_value: "250.125",
    historical_max_purchase_value: "500",
    historical_first_purchase_value: "100",
    historical_first_purchase_at: "2026-01-10T12:00:00Z",
    last_historical_purchase_at: "2026-09-10T12:00:00Z",
    days_since_last_purchase: "30",
    period_purchase_count: "3",
    period_first_purchase_count: "0",
    period_reload_count: "3",
    period_total_value: "900.50",
    period_first_purchase_total_value: "0",
    period_reload_total_value: "900.50",
    period_average_purchase_value: "300.166",
    period_max_purchase_value: "500",
    ...overrides,
  };
}

function compactPayloadRow(row = rpcRow()): unknown[] {
  return [
    row.customer_key,
    row.phone,
    row.email,
    row.fn,
    row.ln,
    row.ct,
    row.st,
    row.zip,
    row.country,
    row.currency,
    row.historical_purchase_count,
    row.historical_first_purchase_count,
    row.historical_reload_count,
    row.historical_total_value,
    row.historical_average_purchase_value,
    row.historical_max_purchase_value,
    row.historical_first_purchase_value,
    row.historical_first_purchase_at,
    row.last_historical_purchase_at,
    row.days_since_last_purchase,
    row.period_purchase_count,
    row.period_first_purchase_count,
    row.period_reload_count,
    row.period_total_value,
    row.period_first_purchase_total_value,
    row.period_reload_total_value,
    row.period_average_purchase_value,
    row.period_max_purchase_value,
  ];
}

function person(overrides: Partial<MetaAudiencePerson> = {}): MetaAudiencePerson {
  return { ...mapMetaAudienceBuyerRows([rpcRow()])[0], ...overrides };
}

test("mapea todas las métricas v2 y preserva null", () => {
  const [buyer] = mapMetaAudienceBuyerRows([rpcRow({
    historical_first_purchase_value: null,
    historical_first_purchase_at: null,
    period_average_purchase_value: null,
    period_max_purchase_value: null,
  })]);

  assert.equal(buyer.key, "phone:5491111111111");
  assert.equal(buyer.fields.phone, "5491111111111");
  assert.equal(buyer.fields.email, "persona@example.com");
  assert.equal(buyer.fields.fn, "maria");
  assert.equal(buyer.historicalPurchaseCount, 4);
  assert.equal(buyer.periodReloadTotalValue, 900.5);
  assert.equal(buyer.historicalFirstPurchaseValue, null);
  assert.equal(buyer.historicalFirstPurchaseAt, null);
  assert.equal(buyer.periodAveragePurchaseValue, null);
  assert.equal(buyer.periodMaxPurchaseValue, null);
});

test("calcula valores y compras representadas según el resumen elegido", () => {
  const buyer = person();
  assert.equal(metaAudienceSummaryValue(buyer, "historical_first_purchase_value"), 100);
  assert.equal(metaAudienceSummaryValue(buyer, "historical_total_value"), 1000.5);
  assert.equal(metaAudienceSummaryValue(buyer, "period_total_value"), 900.5);
  assert.equal(metaAudienceRepresentedPurchases(buyer, "historical_first_purchase_value"), 1);
  assert.equal(metaAudienceRepresentedPurchases(buyer, "historical_total_value"), 4);
  assert.equal(metaAudienceRepresentedPurchases(buyer, "period_total_value"), 3);
  assert.equal(metaAudienceRepresentedPurchases(buyer, "period_first_purchase_total_value"), 0);
  assert.equal(metaAudienceRepresentedPurchases(buyer, "period_reload_total_value"), 3);

  const [withoutFirst] = mapMetaAudienceBuyerRows([rpcRow({ historical_first_purchase_value: null })]);
  assert.equal(metaAudienceRepresentedPurchases(withoutFirst, "historical_first_purchase_value"), 0);
});

test("separa personas del segmento de exportables por identificador y valor", () => {
  const valid = person();
  const noIdentifier = person({
    key: "row:no-id",
    fields: { email: "", phone: "", fn: "", ln: "", ct: "", st: "", zip: "", country: "" },
  });
  const zeroValue = person({ key: "email:zero@example.com", historicalFirstPurchaseValue: 0 });
  zeroValue.fields.email = "zero@example.com";
  const nullValue = person({ key: "email:null@example.com", historicalFirstPurchaseValue: null });
  nullValue.fields.email = "null@example.com";
  const negativeValue = person({ key: "email:negative@example.com", historicalFirstPurchaseValue: -5 });
  negativeValue.fields.email = "negative@example.com";
  const people = [valid, noIdentifier, zeroValue, nullValue, negativeValue];

  const segmented = getMetaAudienceExportStats({
    people,
    selectedFields: ["email", "phone"],
    audienceType: "segmented",
    exportValueMetric: "historical_first_purchase_value",
  });
  assert.equal(segmented.exportablePeople.length, 4);
  assert.equal(segmented.missingIdentifierCount, 1);
  assert.equal(segmented.missingValueCount, 0);

  const valueBased = getMetaAudienceExportStats({
    people,
    selectedFields: ["email", "phone"],
    audienceType: "value_based",
    exportValueMetric: "historical_first_purchase_value",
  });
  assert.deepEqual(valueBased.exportablePeople.map((item) => item.key), [valid.key]);
  assert.equal(valueBased.missingIdentifierCount, 1);
  assert.equal(valueBased.missingValueCount, 3);
});

test("mapea el payload compacto versionado sin perder columnas", () => {
  const [buyer] = mapMetaAudienceBuyerPayload({ version: 2, rows: [compactPayloadRow()] });

  assert.equal(buyer.key, "phone:5491111111111");
  assert.equal(buyer.historicalTotalValue, 1000.5);
  assert.equal(buyer.historicalFirstPurchaseValue, 100);
  assert.equal(buyer.periodReloadTotalValue, 900.5);
  assert.equal(buyer.periodMaxPurchaseValue, 500);
});

test("rechaza versiones o filas incompatibles del payload compacto", () => {
  assert.throws(
    () => mapMetaAudienceBuyerPayload({ version: 1, rows: [] }),
    /versi.n de datos/i,
  );
  assert.throws(
    () => mapMetaAudienceBuyerPayload({ version: 2, rows: [["incompleta"]] }),
    /fila de compradores/i,
  );
});

test("el preview económico usa todo el segmento aunque falte identificador", () => {
  const withIdentifier = person({
    historicalTotalValue: 100,
    historicalPurchaseCount: 2,
  });
  const withoutIdentifier = person({
    key: "row:no-id",
    fields: { email: "", phone: "", fn: "", ln: "", ct: "", st: "", zip: "", country: "" },
    historicalTotalValue: 300,
    historicalPurchaseCount: 3,
  });
  const stats = getMetaAudiencePreviewStats(
    [withIdentifier, withoutIdentifier],
    "historical_total_value",
  );

  assert.equal(stats.representedPurchases, 5);
  assert.equal(stats.totalValue, 400);
  assert.equal(stats.averageValue, 200);
  assert.equal(stats.medianValue, 200);
  assert.equal(stats.peopleWithValue, 2);
});

test("CSV segmentado no incluye value y el basado en valor incluye una sola columna", () => {
  const valid = person();
  valid.fields.fn = 'ana, "a"\nsegunda línea';
  const zero = person({ key: "email:zero@example.com", periodTotalValue: 0 });
  zero.fields.email = "zero@example.com";

  const segmented = buildMetaAudienceCsv({
    people: [valid, zero],
    selectedFields: ["email", "fn"],
    audienceType: "segmented",
    exportValueMetric: "period_total_value",
  });
  assert.match(segmented.split("\r\n")[0], /^"email","fn"$/);
  assert.equal(segmented.split("\r\n").length, 3);

  const valueBased = buildMetaAudienceCsv({
    people: [valid, zero],
    selectedFields: ["email", "fn"],
    audienceType: "value_based",
    exportValueMetric: "period_total_value",
  });
  assert.equal(
    valueBased,
    '"email","fn","value"\r\n"persona@example.com","ana, ""a""\nsegunda línea","900.5"',
  );
});
