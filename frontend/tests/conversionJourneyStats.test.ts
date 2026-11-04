import assert from "node:assert/strict";
import test from "node:test";
import type { ConversionJourneyStartRow, ConversionRow } from "../lib/conversionsDb";
import { STATISTICS_ORIGINS, computeChannelFunnel, createStatisticsChannelResolver, dedupeStatisticsEvents,
  scopeStatisticsChannel, scopeStatisticsStages, stageDate, statisticsEventRangeFilter, statisticsOrigin,
  statisticsRate, statisticsTemporalRows, countStatisticsVisitConversions } from "../lib/conversionJourneyStats";

const time = Math.floor(Date.parse("2026-11-04T15:00:00Z") / 1000);
const range = { start: new Date("2026-11-04T00:00:00Z"), end: new Date("2026-11-04T23:59:59.999Z") };
const row = (id: string, extra: Partial<ConversionRow> = {}): ConversionRow => ({
  id, user_id: "owner", landing_id: "landing", source_platform: "landing", promo_code: "P-one",
  created_at: "2026-11-01T10:00:00Z", valor: 0, ...extra,
} as ConversionRow);
const contact = (id: string, channel: "whatsapp" | "atrio", extra: Partial<ConversionRow> = {}) => row(id, {
  contact_event_id: `c-${id}`, contact_event_time: time,
  contact_payload_raw: JSON.stringify({ cta_destination: channel, landing_cta_meta_event: "CompleteRegistration", source_platform: "landing" }), ...extra,
});

test("source is independent from channel and only the three approved origins are options", () => {
  assert.deepEqual(STATISTICS_ORIGINS, ["landing", "chatrace", "whatsapp_cloud_api"]);
  assert.equal(statisticsOrigin(contact("a", "atrio")), "landing");
  assert.equal(statisticsOrigin(row("x", { source_platform: "atrio", contact_payload_raw: '{"source_platform":"landing"}' })), "landing");
  assert.equal(statisticsOrigin(row("x", { source_platform: "atrio" })), "");
});
test("a CTA CompleteRegistration is a request, never a confirmed account or message", () => {
  const result = computeChannelFunnel([contact("a", "atrio")], "atrio");
  assert.equal(result.contacts, 1); assert.equal(result.messages, 0); assert.equal(result.registrations, null);
});
test("no synthetic lead or registration is inferred from a purchase", () => {
  const rows = [contact("a", "whatsapp"), row("p", { purchase_event_id: "p", purchase_event_time: time + 30, purchase_type: "first" })];
  const result = computeChannelFunnel(rows, "whatsapp");
  assert.equal(result.messages, 0); assert.equal(result.registrations, null); assert.equal(result.firstPurchases, 0);
});
test("Atrio links CTA directly to first purchase without requiring a Lead", () => {
  const result = computeChannelFunnel([contact("a", "atrio"), row("p", { purchase_event_id: "p", purchase_event_time: time + 30, purchase_type: "first" })], "atrio");
  assert.equal(result.firstPurchases, 1); assert.equal(statisticsRate(result.firstPurchases, result.contacts), "100.0%");
});
test("WhatsApp follows real CTA, message, confirmed registration, first purchase and repeat", () => {
  const rows = [contact("a", "whatsapp"), row("l", { lead_event_id: "l", lead_event_time: time + 1 }),
    row("r", { registration_event_id: "r", registration_event_time: time + 2 }),
    row("p", { purchase_event_id: "p", purchase_event_time: time + 3, purchase_type: "first" }),
    row("repeat", { purchase_event_id: "repeat", purchase_event_time: time + 4, purchase_type: "repeat" }),
    row("repeat2", { purchase_event_id: "repeat2", purchase_event_time: time + 5, purchase_type: "repeat" })];
  assert.deepEqual(computeChannelFunnel(rows, "whatsapp"), { contacts: 1, messages: 1, registrations: 1, registered: 1, firstPurchases: 1, repeats: 1 });
});
test("out-of-order milestones and separate owners or landings never form a chain", () => {
  const rows = [contact("a", "whatsapp"), row("before", { lead_event_id: "before", lead_event_time: time - 1 }),
    row("other", { user_id: "other-owner", lead_event_id: "other", lead_event_time: time + 1 }),
    row("other-landing", { landing_id: "other-landing", lead_event_id: "other2", lead_event_time: time + 1 })];
  assert.equal(computeChannelFunnel(rows, "whatsapp").messages, 0);
});
test("event dates, not row creation, determine period membership", () => {
  const source = contact("a", "whatsapp", { contact_event_time: time - 3 * 86400, lead_event_id: "l", lead_event_time: time,
    registration_event_id: "r", registration_event_time: time + 10 * 86400 });
  const [scoped] = scopeStatisticsStages([source], range);
  assert.equal(scoped.contact_event_id, ""); assert.equal(scoped.lead_event_id, "l"); assert.equal(scoped.registration_event_id, "");
  assert.equal(source.contact_event_id, "c-a", "source is immutable");
  assert.equal(stageDate(scoped, "lead")?.toISOString(), "2026-11-04T15:00:00.000Z");
});
test("a carried promo does not link a first purchase from a different agency", () => {
  const rows = [contact("wa", "whatsapp", { assigned_gerencia_external_id: 10, phone: "5491111111111" }),
    row("lead", { lead_event_id: "l", lead_event_time: time + 1, lead_agency_id: "10", phone: "5491111111111" }),
    row("wrong", { purchase_event_id: "p", purchase_event_time: time + 3, purchase_type: "first", purchase_agency_id: "20", phone: "5491111111111" })];
  const result = computeChannelFunnel(rows, "whatsapp");
  assert.equal(result.messages, 1); assert.equal(result.firstPurchases, 0);
});
test("duplicate delivery and duplicate transaction do not inflate financial totals or registrations", () => {
  const rows = [row("a", { purchase_event_id: "p1", purchase_transaction_id: "tx", valor: 1000, registration_event_id: "r" }),
    row("b", { purchase_event_id: "p2", purchase_transaction_id: "tx", valor: 1000, registration_event_id: "r" }),
    row("other", { user_id: "other", purchase_event_id: "p2", purchase_transaction_id: "tx", valor: 500 })];
  const result = dedupeStatisticsEvents(rows);
  assert.equal(result.filter(r => r.purchase_event_id).reduce((sum, r) => sum + r.valor, 0), 1500);
  assert.equal(result.filter(r => r.registration_event_id).length, 1);
});
test("channel resolution follows recorded destination and unambiguous same-owner lineage", () => {
  const root = contact("a", "whatsapp", { atrio_id: "later-advisor" });
  const purchase = row("p", { promo_code: "", purchase_attribution_conversion_id: "a", purchase_atrio_id: "later-advisor" });
  const resolve = createStatisticsChannelResolver([root, purchase]);
  assert.equal(resolve(root), "whatsapp"); assert.equal(resolve(purchase), "whatsapp");
  assert.equal(resolve(row("x", { user_id: "other", purchase_attribution_conversion_id: "a", promo_code: "" })), null);
});
test("ambiguous promotions and missing evidence stay unclassified", () => {
  const rows = [contact("wa", "whatsapp"), contact("at", "atrio"), row("unknown")];
  const resolve = createStatisticsChannelResolver(rows);
  assert.equal(resolve(rows[2]), null);
});
test("legacy contact assignments classify the original channel without current landing configuration", () => {
  const resolve = createStatisticsChannelResolver([]);
  assert.equal(resolve(row("wa", { contact_event_id: "wa", telefono_asignado: "5491111111111" })), "whatsapp");
  assert.equal(resolve(row("at", { contact_event_id: "at", atrio_id: "advisor" })), "atrio");
  assert.equal(resolve(row("none", { contact_event_id: "none" })), null);
});
test("all selected statistics are isolated by channel and only captured visit destinations count", () => {
  const rows = [contact("wa", "whatsapp", { purchase_event_id: "wp", purchase_event_time: time + 10, valor: 1000 }),
    contact("at", "atrio", { promo_code: "P-two", purchase_event_id: "ap", purchase_event_time: time + 10, valor: 2000 })];
  const starts = ["whatsapp", "atrio", null].map((channel, index) => ({ id: String(index), first_seen_at: "2026-11-04T12:00:00Z", journey_destination: channel } as ConversionJourneyStartRow));
  const result = scopeStatisticsChannel(rows, starts, "atrio", range);
  assert.equal(result.conversions.length, 1); assert.equal(result.conversions[0].valor, 2000);
  assert.equal(result.journeyStarts.length, 1); assert.equal(result.unknownStarts, 1);
});
test("confirmed internal Atrio outcomes count without changing captured Meta CTA fields", () => {
  const source = contact("at", "atrio", { confirmed_registration_event_id: "internal-account:one", confirmed_registration_event_time: time + 1 });
  const result = scopeStatisticsChannel([source], [], "atrio", range);
  assert.equal(result.funnel.registrations, 1); assert.equal(source.registration_event_id, undefined);
  assert.equal(JSON.parse(source.contact_payload_raw).landing_cta_meta_event, "CompleteRegistration");
});
test("rates without coverage or a valid denominator are not a fabricated zero", () => {
  assert.equal(statisticsRate(null, 10), "—"); assert.equal(statisticsRate(0, 0), "—"); assert.equal(statisticsRate(0, 10), "0.0%");
});
test("chart dates match the actual activity and purchase instead of the row date", () => {
  const rows = statisticsTemporalRows([contact("a", "atrio", { purchase_event_id: "p", purchase_event_time: time + 86400 })], "atrio");
  assert.equal(rows.length, 2); assert.equal(rows[0].created_at, "2026-11-04T15:00:00.000Z");
  assert.equal(rows[1].created_at, "2026-11-05T15:00:00.000Z"); assert.equal(rows[1].contact_event_id, "");
});
test("database filter includes all four milestone timestamps and sanitizes invalid dates", () => {
  const query = statisticsEventRangeFilter(range.start.toISOString(), range.end.toISOString());
  for (const name of ["created_at", "contact_event_time", "lead_event_time", "registration_event_time", "purchase_event_time"]) assert.ok(query.includes(name));
  assert.equal(statisticsEventRangeFilter("invalid", "invalid"), "");
});
test("several CTA attempts during one visit cannot produce a conversion rate over 100 percent", () => {
  const start = { id: "visit", user_id: "owner", landing_id: "landing", source_platform: "landing", external_id: "visitor", first_seen_at: new Date(time * 1000).toISOString() } as ConversionJourneyStartRow;
  const rows = [contact("one", "whatsapp", { external_id: "visitor", promo_code: "one" }),
    contact("two", "whatsapp", { external_id: "visitor", promo_code: "two", contact_event_time: time + 10 })];
  assert.equal(countStatisticsVisitConversions([start], rows), 1);
  assert.equal(countStatisticsVisitConversions([{ ...start, source_platform: "whatsapp_cloud_api" }], rows), 0);
});
