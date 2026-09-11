import assert from "node:assert/strict";
import test from "node:test";
import {
  META_AUDIENCE_RULE_METRICS,
  applyMetaAudienceRules,
  createInitialMetaAudienceRules,
  personMatchesMetaAudienceScope,
  validateMetaAudienceRule,
  type MetaAudienceRule,
} from "../lib/metaAudienceRules";
import type { MetaAudiencePerson } from "../lib/metaAudienceExport";

function buyer(key: string, overrides: Partial<MetaAudiencePerson> = {}): MetaAudiencePerson {
  return {
    key,
    fields: { email: `${key}@example.com`, phone: "", fn: "", ln: "", ct: "", st: "", zip: "", country: "ar" },
    currency: "ARS",
    historicalPurchaseCount: 1,
    historicalFirstPurchaseCount: 1,
    historicalReloadCount: 0,
    historicalTotalValue: 100,
    historicalAveragePurchaseValue: 100,
    historicalMaxPurchaseValue: 100,
    historicalFirstPurchaseValue: 100,
    historicalFirstPurchaseAt: "2026-01-01T00:00:00.000Z",
    lastHistoricalPurchaseAt: "2026-09-01T00:00:00.000Z",
    daysSinceLastPurchase: 30,
    periodPurchaseCount: 1,
    periodFirstPurchaseCount: 1,
    periodReloadCount: 0,
    periodTotalValue: 100,
    periodFirstPurchaseTotalValue: 100,
    periodReloadTotalValue: 0,
    periodAveragePurchaseValue: 100,
    periodMaxPurchaseValue: 100,
    ...overrides,
  };
}

function apply(people: MetaAudiencePerson[], rules: MetaAudienceRule[]) {
  return applyMetaAudienceRules({ people, rules, scope: "all" });
}

test("catálogo cerrado asigna operadores correctos por tipo", () => {
  const historicalCount = META_AUDIENCE_RULE_METRICS.find((item) => item.value === "historical_purchase_count");
  const reloadCount = META_AUDIENCE_RULE_METRICS.find((item) => item.value === "historical_reload_count");
  const recency = META_AUDIENCE_RULE_METRICS.find((item) => item.value === "days_since_last_purchase");
  assert.equal(historicalCount?.operators.includes("top_percent"), true);
  assert.equal(reloadCount?.operators.includes("top_percent"), false);
  assert.equal(recency?.operators.includes("top_percent"), false);
  assert.match(validateMetaAudienceRule({ id: "x", metric: "days_since_last_purchase", operator: "top_percent", value: 10 }) ?? "", /no está disponible/);
  assert.match(validateMetaAudienceRule({ id: "x", metric: "invalid" as never, operator: "gte", value: 1 }) ?? "", /no es válida/);
});

test("aplica todos los operadores escalares y between inclusivo", () => {
  const people = [buyer("a", { periodTotalValue: 100 })];
  for (const [operator, value, value2] of [
    ["gt", 99], ["gte", 100], ["lt", 101], ["lte", 100], ["eq", 100], ["between", 100, 100],
  ] as const) {
    assert.equal(apply(people, [{ id: operator, metric: "period_total_value", operator, value, value2 }]).people.length, 1);
  }
});

test("AND exige todas las reglas y null nunca cumple", () => {
  const people = [
    buyer("a", { periodTotalValue: 300, periodPurchaseCount: 3, periodAveragePurchaseValue: null }),
    buyer("b", { periodTotalValue: 300, periodPurchaseCount: 1 }),
  ];
  const result = apply(people, [
    { id: "value", metric: "period_total_value", operator: "gte", value: 300 },
    { id: "frequency", metric: "period_purchase_count", operator: "gte", value: 3 },
  ]);
  assert.deepEqual(result.people.map((item) => item.key), ["a"]);
  assert.equal(apply([people[0]], [{ id: "null", metric: "period_average_purchase_value", operator: "gte", value: 0 }]).people.length, 0);
});

test("valida porcentajes, rangos y valores vacíos", () => {
  assert.match(validateMetaAudienceRule({ id: "x", metric: "period_total_value", operator: "top_percent", value: 20 }) ?? "", /50, 25, 10, 5 o 1/);
  assert.match(validateMetaAudienceRule({ id: "x", metric: "period_total_value", operator: "between", value: 10, value2: 5 }) ?? "", /segundo valor/);
  assert.match(validateMetaAudienceRule({ id: "x", metric: "period_total_value", operator: "gte", value: "" }) ?? "", /valor válido/);
});

test("scope reemplaza solo la condición base de actividad", () => {
  const all = buyer("all", { periodPurchaseCount: 1, periodFirstPurchaseCount: 0, periodReloadCount: 0 });
  const first = buyer("first", { periodPurchaseCount: 1, periodFirstPurchaseCount: 1, periodReloadCount: 0 });
  const repeat = buyer("repeat", { periodPurchaseCount: 1, periodFirstPurchaseCount: 0, periodReloadCount: 1 });
  assert.equal(personMatchesMetaAudienceScope(all, "all"), true);
  assert.equal(personMatchesMetaAudienceScope(all, "first"), false);
  assert.equal(personMatchesMetaAudienceScope(all, "repeat"), false);
  assert.deepEqual([all, first, repeat].filter((item) => personMatchesMetaAudienceScope(item, "first")).map((item) => item.key), ["first"]);
  assert.deepEqual([all, first, repeat].filter((item) => personMatchesMetaAudienceScope(item, "repeat")).map((item) => item.key), ["repeat"]);
  assert.equal(createInitialMetaAudienceRules()[0].metric, "historical_first_purchase_value");
});

test("percentiles incluyen empates y se calculan antes de las otras reglas", () => {
  const people = [
    buyer("a", { historicalTotalValue: 100, periodPurchaseCount: 1 }),
    buyer("b", { historicalTotalValue: 100, periodPurchaseCount: 1 }),
    buyer("c", { historicalTotalValue: 80, periodPurchaseCount: 4 }),
    buyer("d", { historicalTotalValue: 70, periodPurchaseCount: 1 }),
  ];
  const result = apply(people, [
    { id: "top", metric: "historical_total_value", operator: "top_percent", value: 25 },
    { id: "frequency", metric: "period_purchase_count", operator: "gte", value: 2 },
  ]);
  assert.deepEqual(result.people, []);
  assert.deepEqual(apply(people, [{ id: "top", metric: "historical_total_value", operator: "top_percent", value: 25 }]).people.map((item) => item.key), ["a", "b"]);
});

test("percentil de período excluye inactivos, null y mantiene cero", () => {
  const people = [
    buyer("active-high", { periodPurchaseCount: 1, periodAveragePurchaseValue: 100 }),
    buyer("active-zero", { periodPurchaseCount: 1, periodAveragePurchaseValue: 0 }),
    buyer("active-null", { periodPurchaseCount: 1, periodAveragePurchaseValue: null }),
    buyer("inactive", { periodPurchaseCount: 0, periodAveragePurchaseValue: 1000 }),
  ];
  const result = apply(people, [{ id: "top", metric: "period_average_purchase_value", operator: "top_percent", value: 50 }]);
  assert.deepEqual(result.people.map((item) => item.key), ["active-high"]);
});

test("cero participa del ranking cuando la métrica no es null", () => {
  const people = [
    buyer("active-zero", { periodPurchaseCount: 1, periodAveragePurchaseValue: 0 }),
    buyer("active-null", { periodPurchaseCount: 1, periodAveragePurchaseValue: null }),
  ];
  const result = apply(people, [
    { id: "top", metric: "period_average_purchase_value", operator: "top_percent", value: 50 },
  ]);

  assert.deepEqual(result.people.map((item) => item.key), ["active-zero"]);
});

test("múltiples top_percent se resuelven de forma independiente y sin mezclar monedas", () => {
  const people = [
    buyer("shared", { historicalTotalValue: 100, historicalPurchaseCount: 2 }),
    buyer("ars-b", { historicalTotalValue: 50, historicalPurchaseCount: 5 }),
    buyer("shared", { currency: "PYG", historicalTotalValue: 1000, historicalPurchaseCount: 2 }),
    buyer("pyg-b", { currency: "PYG", historicalTotalValue: 500, historicalPurchaseCount: 1 }),
  ];
  const result = apply(people, [
    { id: "value", metric: "historical_total_value", operator: "top_percent", value: 50 },
    { id: "count", metric: "historical_purchase_count", operator: "top_percent", value: 50 },
  ]);
  assert.deepEqual(result.people.map((item) => `${item.currency}:${item.key}`), ["PYG:shared"]);
});
