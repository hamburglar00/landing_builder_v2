import assert from "node:assert/strict";
import test from "node:test";
import { mapMetaAudienceBuyerPayload, buildMetaAudienceCsv, getMetaAudiencePreviewStats, getMetaAudienceExportStats } from "../lib/metaAudienceExport";
import { applyMetaAudienceRules } from "../lib/metaAudienceRules";

// Positional transport fixture, entirely synthetic. Expected results below are fixed oracles.
const row = (key: string, value: number, currency = "ARS", active = true, email = `${key}@example.invalid`) => [
  key, "", email, "", "", "", "", "", "", currency,
  3, 1, 2, value, value / 3, value, 10, "2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z", 14,
  active ? 2 : 0, 0, active ? 2 : 0, active ? value : 0, 0, active ? value : 0, active ? value / 2 : null, active ? value : null,
];

test("Phase 0: compact RPC -> ties/currency/scope -> independent summary and exact CSV", () => {
  const people = mapMetaAudienceBuyerPayload({ version: 2, rows: [
    row("a", 100), row("b", 100), row("c", 50), row("d", 25),
    row("inactive", 1000, "ARS", false), row("unidentified", 100, "ARS", true, ""),
    row("pyg", 1, "PYG"),
  ] });
  const { people: segment } = applyMetaAudienceRules({ people, scope: "all", rules: [
    { id: "top", metric: "period_total_value", operator: "top_percent", value: 25 },
    { id: "count", metric: "period_purchase_count", operator: "gte", value: 2 },
  ] });
  assert.deepEqual(segment.map(x => x.key), ["a", "b", "unidentified", "pyg"]);
  // Select one currency, as the UI does. Never sum ARS with PYG.
  const ars = segment.filter(x => x.currency === "ARS");
  assert.deepEqual(getMetaAudiencePreviewStats(ars, "period_total_value"), {
    representedPurchases: 6, totalValue: 300, averageValue: 100, medianValue: 100, peopleWithValue: 3,
  });
  const options = { people: ars, selectedFields: ["email"] as const, audienceType: "value_based" as const, exportValueMetric: "historical_first_purchase_value" as const };
  assert.equal(getMetaAudienceExportStats(options).missingIdentifierCount, 1);
  assert.equal(buildMetaAudienceCsv(options), '"email","value"\r\n"a@example.invalid","10"\r\n"b@example.invalid","10"');
  assert.equal(buildMetaAudienceCsv({ ...options, audienceType: "segmented" }), '"email"\r\n"a@example.invalid"\r\n"b@example.invalid"');
});

test("Phase 0: database transport is all-or-error, one request, no silent duplicate removal", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "synthetic-key";
  const { fetchMetaAudienceBuyersWithClient } = await import("../lib/metaAudienceDb");
  const request = { currency: "ARS" as const, range: { start: new Date("2026-01-01Z"), end: new Date("2026-09-15Z") }, asOf: new Date("2026-09-15Z") };
  let calls = 0;
  const client = { rpc: async () => { calls++; return { data: { version: 2, rows: Array.from({ length: 2815 }, (_, n) => row(`synthetic-${n}`, n)) }, error: null }; } };
  assert.equal((await fetchMetaAudienceBuyersWithClient(client as never, request)).length, 2815);
  assert.equal(calls, 1);
  await assert.rejects(fetchMetaAudienceBuyersWithClient({ rpc: async () => ({ data: { version: 2, rows: [row("dup", 10), row("dup", 20)] }, error: null }) } as never, request), /duplicados/);
  const error = { code: "57014", message: "synthetic timeout" };
  await assert.rejects(fetchMetaAudienceBuyersWithClient({ rpc: async () => ({ data: null, error }) } as never, request), e => e === error);
  await assert.rejects(fetchMetaAudienceBuyersWithClient({ rpc: async () => ({ data: { version: 99, rows: [] }, error: null }) } as never, request), /compatible/);
});
