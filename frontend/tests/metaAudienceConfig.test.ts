import assert from "node:assert/strict";
import test from "node:test";
import {
  META_AUDIENCE_PRESETS,
  META_AUDIENCE_TIMEZONE,
  applyMetaAudiencePreset,
  canReplaceMetaAudienceDraft,
  createDefaultMetaAudienceConfig,
  deserializeMetaAudienceConfig,
  resolveMetaAudiencePeriod,
  serializeMetaAudienceConfig,
  metaAudienceConfigFingerprint,
} from "../lib/metaAudienceConfig";
import { applyMetaAudienceRules } from "../lib/metaAudienceRules";
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
    lastHistoricalPurchaseAt: "2026-01-01T00:00:00.000Z",
    daysSinceLastPurchase: 250,
    periodPurchaseCount: 0,
    periodFirstPurchaseCount: 0,
    periodReloadCount: 0,
    periodTotalValue: 0,
    periodFirstPurchaseTotalValue: 0,
    periodReloadTotalValue: 0,
    periodAveragePurchaseValue: null,
    periodMaxPurchaseValue: null,
    ...overrides,
  };
}

test("los seis presets producen configuraciones completas e independientes", () => {
  assert.equal(META_AUDIENCE_PRESETS.length, 6);
  assert.equal(Object.isFrozen(META_AUDIENCE_PRESETS), true);
  assert.equal(META_AUDIENCE_PRESETS.every(Object.isFrozen), true);
  assert.deepEqual(META_AUDIENCE_PRESETS.map((preset) => preset.id), [
    "high_value_30d",
    "vip_90d",
    "historical_top_10",
    "repeat_buyers",
    "active_large_customers",
    "inactive_high_value",
  ]);
  const first = applyMetaAudiencePreset("vip_90d", "ARS");
  const second = applyMetaAudiencePreset("vip_90d", "ARS");
  first.rules[0]!.value = 50;
  first.selectedFields.pop();
  assert.equal(second.rules[0]!.value, 10);
  assert.equal(second.selectedFields.length, 5);
  assert.equal(second.audienceType, "segmented");
  assert.equal(second.rules[1]?.value, 3);
  assert.equal(second.sourcePresetId, "vip_90d");
  assert.equal(second.sourcePresetVersion, 1);
  assert.equal(second.currency, "ARS");
  assert.deepEqual(applyMetaAudiencePreset("high_value_30d", "ARS").rules[0], { id: "preset-high-value-30d", metric: "period_total_value", operator: "top_percent", value: 25 });
  assert.equal(applyMetaAudiencePreset("historical_top_10", "ARS").purchaseScope, "none");
  assert.deepEqual(applyMetaAudiencePreset("repeat_buyers", "ARS").rules[0], { id: "preset-repeat-buyers", metric: "historical_reload_count", operator: "gte", value: 1 });
  assert.equal(applyMetaAudiencePreset("active_large_customers", "ARS").rules[1]?.value, 30);
  assert.equal(applyMetaAudiencePreset("inactive_high_value", "ARS").rules[1]?.value, 90);
});

test("aplicar un preset reemplaza las reglas del borrador anterior", () => {
  const manual = createDefaultMetaAudienceConfig("ARS");
  manual.rules.push({ id: "manual", metric: "historical_purchase_count", operator: "gte", value: 99 });
  const preset = applyMetaAudiencePreset("repeat_buyers", "ARS");
  assert.deepEqual(preset.rules.map((rule) => rule.id), ["preset-repeat-buyers"]);
});

test("Alto valor inactivo incluye compradores históricos sin actividad del período", () => {
  const config = applyMetaAudiencePreset("inactive_high_value", "ARS");
  const people = [
    buyer("inactive-high", { historicalTotalValue: 1000, daysSinceLastPurchase: 120 }),
    buyer("active-high", { historicalTotalValue: 900, daysSinceLastPurchase: 10, periodPurchaseCount: 1 }),
    buyer("inactive-low", { historicalTotalValue: 10, daysSinceLastPurchase: 120 }),
  ];
  const result = applyMetaAudienceRules({ people, scope: config.purchaseScope, rules: config.rules });
  assert.deepEqual(result.people.map((person) => person.key), ["inactive-high"]);
});

test("un período relativo se recalcula con el mismo asOf de cada ejecución", () => {
  const period = { kind: "relative", days: 30, timezone: META_AUDIENCE_TIMEZONE } as const;
  const firstAsOf = new Date("2026-09-11T18:30:00.000Z");
  const nextAsOf = new Date("2026-09-12T18:30:00.000Z");
  const first = resolveMetaAudiencePeriod(period, firstAsOf);
  const next = resolveMetaAudiencePeriod(period, nextAsOf);
  assert.equal(first.end.toISOString(), firstAsOf.toISOString());
  assert.equal(next.end.toISOString(), nextAsOf.toISOString());
  assert.notEqual(first.start.toISOString(), next.start.toISOString());
});

test("un período custom conserva sus fechas y limita el final al mismo asOf", () => {
  const period = { kind: "custom", startDate: "2026-08-01", endDate: "2026-09-30", timezone: META_AUDIENCE_TIMEZONE } as const;
  const asOf = new Date("2026-09-11T18:30:00.000Z");
  const range = resolveMetaAudiencePeriod(period, asOf);
  assert.equal(range.start.toISOString(), "2026-08-01T03:00:00.000Z");
  assert.equal(range.end.toISOString(), asOf.toISOString());
  assert.deepEqual(period, { kind: "custom", startDate: "2026-08-01", endDate: "2026-09-30", timezone: META_AUDIENCE_TIMEZONE });
});

test("serializa y deserializa MetaAudienceConfig sin congelar el período ni depender del preset vivo", () => {
  const config = applyMetaAudiencePreset("historical_top_10", "PYG");
  config.sourcePresetId = "preset_retirado_en_el_futuro";
  config.sourcePresetVersion = 7;
  const restored = deserializeMetaAudienceConfig(serializeMetaAudienceConfig(config));
  assert.deepEqual(restored, config);
  assert.deepEqual(restored.period, { kind: "relative", days: 30, timezone: META_AUDIENCE_TIMEZONE });
  assert.equal(restored.configVersion, 1);
});

test("el fingerprint detecta cambios sin guardar y vuelve a coincidir tras restaurar", () => {
  const original = createDefaultMetaAudienceConfig("ARS");
  const baseline = metaAudienceConfigFingerprint(original);
  const changed = { ...original, purchaseScope: "none" as const };
  assert.notEqual(metaAudienceConfigFingerprint(changed), baseline);
  assert.equal(metaAudienceConfigFingerprint(deserializeMetaAudienceConfig(baseline)), baseline);
});

test("solo pide confirmación al reemplazar un borrador con cambios sin guardar", () => {
  let confirmations = 0;
  assert.equal(canReplaceMetaAudienceDraft(false, () => { confirmations += 1; return false; }), true);
  assert.equal(confirmations, 0);
  assert.equal(canReplaceMetaAudienceDraft(true, () => { confirmations += 1; return false; }), false);
  assert.equal(canReplaceMetaAudienceDraft(true, () => { confirmations += 1; return true; }), true);
  assert.equal(confirmations, 2);
});
