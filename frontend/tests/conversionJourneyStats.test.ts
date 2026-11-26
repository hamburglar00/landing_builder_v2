import assert from "node:assert/strict";
import test from "node:test";
import type { ConversionJourneyStartRow, ConversionRow } from "../lib/conversionsDb";
import { STATISTICS_ORIGINS, computeChannelFunnel, createStatisticsChannelResolver, dedupeStatisticsEvents,
  scopeStatisticsChannel, scopeStatisticsStages, stageDate, statisticsEventRangeFilter, statisticsOrigin,
  statisticsRate, statisticsTemporalRows, countStatisticsVisitConversions, computeStatisticsPurchasePlayers } from "../lib/conversionJourneyStats";
import { gatewayEntryCohort, statisticsMessageCoverage, filterConversionsByActivityRange } from "../lib/conversionJourneyStats";
import { projectInternalConversion } from "../lib/internalConversionEvents";
import { validWhatsappMetaMapping } from "../lib/whatsappMetaMilestones";

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

test("WhatsApp internal conversation keeps historical dates, registration and purchase ratios", () => {
  const base = [
    contact("lead", "whatsapp", {
      lead_event_id: "message", lead_event_time: time + 1,
      registration_event_id: "account", registration_event_time: time + 2,
      purchase_event_id: "first", purchase_event_time: time + 3, purchase_type: "first", valor: 4000,
    }),
    row("repeat", { purchase_event_id: "repeat", purchase_event_time: time + 4, purchase_type: "repeat", valor: 2000 }),
  ];
  const migrated = [
    { ...base[0], internal_events_version: 1, lead_event_id: "", lead_event_time: null,
      cta_clicked_event_id: base[0].contact_event_id, cta_clicked_event_time: time,
      conversation_started_event_id: "message", conversation_started_event_time: time + 1,
      purchase_confirmed_event_id: "first", purchase_confirmed_event_time: time + 3 },
    base[1],
  ];
  for (const window of [range, { start: new Date((time + 2) * 1000), end: range.end }]) {
    const stats = (items: ConversionRow[]) => computeChannelFunnel(
      dedupeStatisticsEvents(scopeStatisticsStages(items, window)), "whatsapp",
    );
    assert.deepEqual(stats(migrated), stats(base));
  }
  assert.deepEqual(computeStatisticsPurchasePlayers(base), computeStatisticsPurchasePlayers(migrated));
});

test("WhatsApp mappings allow off multiple times and each Meta event once", () => {
  assert.equal(validWhatsappMetaMapping({ first_message: "off", username_requested: "off", username_sent: "Lead" }), true);
  assert.equal(validWhatsappMetaMapping({ first_message: "Lead", username_requested: "CompleteRegistration", username_sent: "InitiateCheckout" }), true);
  assert.equal(validWhatsappMetaMapping({ first_message: "Lead", username_requested: "off", username_sent: "Lead" }), false);
});

test("gateway counts distinct scoped CTA arrivals including later visits and distinguishes missing measurements", () => {
  const entered = contact("arrived", "atrio", { gateway_entry_event_id: "greeting", gateway_entry_event_time: time + 86400 });
  const stayed = contact("form-only", "atrio", { gateway_entry_measured: true });
  const unknown = contact("lookup-failed", "atrio");
  const whatsapp = contact("wa", "whatsapp", { gateway_entry_event_id: "external", gateway_entry_event_time: time + 1 });
  const otherDay = contact("earlier", "atrio", { contact_event_time: time - 86400, gateway_entry_event_id: "greeting-b", gateway_entry_event_time: time });
  const rows = scopeStatisticsStages([entered, { ...entered }, stayed, unknown, whatsapp, otherDay], range);
  assert.deepEqual(gatewayEntryCohort(rows), { total: 3, measured: 2, entered: 1 });
  assert.equal(computeChannelFunnel(rows, "atrio").messages, 0);
});

test("table and funnel date filtering retains late operational activity without rewriting public Meta identity", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  const { buildFunnelContactsFromConversions } = await import("../lib/conversionsDb");
  const old = time - 86400;
  const cta = contact("old-cta", "atrio", { internal_events_version: 1, cta_clicked_event_id: "cta", cta_clicked_event_time: old,
    contact_event_id: "cta", contact_event_time: old, lead_event_id: "cta", lead_event_time: old,
    phone: "5491111111111", estado: "lead" });
  const message = { ...cta, id: "message-today", conversation_started_event_id: "human", conversation_started_event_time: time };
  const purchase = { ...cta, id: "purchase-today", phone: "5492222222222", purchase_confirmed_event_id: "purchase", purchase_confirmed_event_time: time,
    purchase_event_id: "purchase", purchase_event_time: time, purchase_type: "first" as const, valor: 100 };
  const account = { ...cta, id: "account-today", confirmed_registration_event_id: "account", confirmed_registration_event_time: time };
  const input = [cta, message, purchase, account];
  const filtered = filterConversionsByActivityRange(input, range);
  assert.deepEqual(filtered.map(item => item.id), [message.id, purchase.id, account.id]);
  assert.equal(filtered[0], message);
  assert.equal(message.lead_event_id, "cta");
  assert.equal(message.lead_event_time, old);
  assert.equal(message.created_at, cta.created_at);
  const funnel = buildFunnelContactsFromConversions(filtered.filter(item => item !== account));
  assert.equal(funnel.length, 2);
  assert.equal(funnel.reduce((sum, item) => sum + item.total_valor, 0), 100);
});

test("promoting legacy IDs without timestamps preserves their original created-at fallback", () => {
  const legacy = row("upgraded-legacy", { internal_events_version: 1, cta_clicked_event_id: "old-cta", cta_clicked_event_time: null,
    contact_event_id: "old-cta", contact_event_time: null, conversation_started_event_id: "human-now", conversation_started_event_time: time,
    purchase_confirmed_event_id: "old-purchase", purchase_confirmed_event_time: null,
    purchase_event_id: "old-purchase", purchase_event_time: null, purchase_type: "first", valor: 200 });
  assert.equal(stageDate(legacy, "contact")?.getTime(), Date.parse(legacy.created_at));
  assert.equal(stageDate(legacy, "purchase")?.getTime(), Date.parse(legacy.created_at));
  assert.equal(computeStatisticsPurchasePlayers([legacy]).firstPlayers, 1);
  const today = scopeStatisticsStages([legacy], range)[0];
  assert.equal(today.lead_event_id, "human-now");
  assert.equal(today.purchase_event_id, "");
  const originalPeriod = { start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-11-01T23:59:59Z") };
  const history = scopeStatisticsStages([legacy], originalPeriod)[0];
  assert.equal(history.purchase_event_id, "old-purchase");
  assert.equal(history.valor, 200);
  assert.equal(history.lead_event_id, "");
  assert.equal(legacy.purchase_event_time, null);
  assert.equal(legacy.purchase_event_id, "old-purchase");
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

test("canonical Atrio CTA columns never invent human messages or confirmed accounts", () => {
  for (const event of ["Lead", "CompleteRegistration"] as const) {
    const stage=event==="Lead"?"lead":"registration", id="cta-canonical";
    const captured=contact("canonical","atrio",{
      contact_event_id:id,estado:stage,
      contact_payload_raw:JSON.stringify({source_platform:"landing",cta_destination:"atrio",landing_cta_event_version:1,
        event_id:id,landing_cta_meta_event:event}),
      [`${stage}_event_id`]:id,[`${stage}_event_time`]:time,
    });
    const result=computeChannelFunnel([captured],"atrio");
    assert.equal(result.contacts,1);assert.equal(result.messages,0);assert.equal(result.registrations,null);
    const confirmed=scopeStatisticsChannel([{...captured,confirmed_registration_event_id:"internal-account:real",
      confirmed_registration_event_time:time+1}],[],"atrio",range);
    assert.equal(confirmed.funnel.registrations,1);assert.equal(confirmed.funnel.registered,1);
  }
});
test("no synthetic lead or registration is inferred from a purchase", () => {
  const rows = [contact("a", "whatsapp"), row("p", { purchase_event_id: "p", purchase_event_time: time + 30, purchase_type: "first" })];
  const result = computeChannelFunnel(rows, "whatsapp");
  assert.equal(result.messages, 0); assert.equal(result.registrations, null); assert.equal(result.firstPurchases, 0);
});
test("Atrio keeps purchases visible but a funnel progression requires a real message", () => {
  const result = computeChannelFunnel([contact("a", "atrio"), row("p", { purchase_event_id: "p", purchase_event_time: time + 30, purchase_type: "first" })], "atrio");
  assert.equal(result.firstPurchases, 0);
  assert.deepEqual(statisticsMessageCoverage([contact("a", "atrio")], "atrio"), { measured: false, unknownJourneys: 1 });
});
test("WhatsApp follows real CTA, message, confirmed registration, first purchase and repeat", () => {
  const rows = [contact("a", "whatsapp"), row("l", { lead_event_id: "l", lead_event_time: time + 1 }),
    row("r", { registration_event_id: "r", registration_event_time: time + 2 }),
    row("p", { purchase_event_id: "p", purchase_event_time: time + 3, purchase_type: "first" }),
    row("repeat", { purchase_event_id: "repeat", purchase_event_time: time + 4, purchase_type: "repeat" }),
    row("repeat2", { purchase_event_id: "repeat2", purchase_event_time: time + 5, purchase_type: "repeat" })];
  assert.deepEqual(computeChannelFunnel(rows, "whatsapp"), { contacts: 1, messages: 1, registrations: 1, registered: 1, firstPurchases: 1, repeats: 1 });
});
test("a Full Carga registration cannot exclude purchases of other WhatsApp bot types", () => {
  const rows = ["full", "manual"].flatMap((kind, index) => [contact(kind, "whatsapp", { promo_code: `P-${kind}` }),
    row(`l-${kind}`, { promo_code: `P-${kind}`, lead_event_id: `l-${kind}`, lead_event_time: time + 1 }),
    ...(index === 0 ? [row("r-full", { promo_code: "P-full", registration_event_id: "r", registration_event_time: time + 2 })] : []),
    row(`p-${kind}`, { promo_code: `P-${kind}`, purchase_event_id: `p-${kind}`, purchase_event_time: time + 3, purchase_type: "first" })]);
  assert.equal(computeChannelFunnel(rows, "whatsapp").firstPurchases, 2);
});
test("the reference period has 51 first-load players and 16 repeated players, not 38 repeat events", () => {
  const firsts = Array.from({ length: 51 }, (_, index) => row(`first-${index}`, { purchase_event_id: `first-${index}`,
    purchase_type: "first", purchase_player_username: `player-${index}`, purchase_agency_id: "184", purchase_event_time: time }));
  const repeats = Array.from({ length: 38 }, (_, index) => row(`repeat-${index}`, { purchase_event_id: `repeat-${index}`,
    purchase_type: "repeat", purchase_player_username: `player-${index % 16}`, purchase_agency_id: "184", purchase_event_time: time + index + 1 }));
  const result = computeStatisticsPurchasePlayers([...firsts, ...repeats]);
  assert.deepEqual(result, { firstPlayers: 51, repeatPlayers: 16, repeatPlayersFromFirst: 16, repeatEventsFromFirst: 38 });
  assert.equal(statisticsRate(result.repeatPlayersFromFirst, result.firstPlayers), "31.4%");
});
test("player progression excludes unrelated agencies, prior repeats and first loads outside the period", () => {
  const rows = [row("first", { purchase_event_id: "first", purchase_type: "first", purchase_event_time: time, purchase_player_username: "one", purchase_agency_id: "10" }),
    row("earlier", { purchase_event_id: "earlier", purchase_type: "repeat", purchase_event_time: time - 1, purchase_player_username: "one", purchase_agency_id: "10" }),
    row("other", { purchase_event_id: "other", purchase_type: "repeat", purchase_event_time: time + 1, purchase_player_username: "one", purchase_agency_id: "20" }),
    row("old-first", { purchase_event_id: "old-first", purchase_type: "first", purchase_event_time: time - 4 * 86400, purchase_player_username: "two", purchase_agency_id: "10" }),
    row("new-repeat", { purchase_event_id: "new-repeat", purchase_type: "repeat", purchase_event_time: time + 1, purchase_player_username: "two", purchase_agency_id: "10" })];
  const result = computeStatisticsPurchasePlayers(scopeStatisticsStages(rows, range));
  assert.equal(result.firstPlayers, 1); assert.equal(result.repeatPlayersFromFirst, 0);
});
test("Atrio excludes Chatrace and Cloud API origins even if they claim an Atrio destination", () => {
  const rows = [contact("landing", "atrio", { purchase_event_id: "lp", purchase_event_time: time + 1, valor: 1000 }),
    contact("chatrace", "atrio", { source_platform: "chatrace", promo_code: "P-chat", purchase_event_id: "cp", purchase_event_time: time + 1, valor: 2000 }),
    contact("cloud", "atrio", { source_platform: "whatsapp_cloud_api", promo_code: "P-cloud", purchase_event_id: "wp", purchase_event_time: time + 1, valor: 3000 })];
  const result = scopeStatisticsChannel(rows, [], "atrio", range);
  assert.equal(result.conversions.length, 1); assert.equal(result.conversions[0].valor, 1000);
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
  const starts = ["whatsapp", "atrio", null].map((channel, index) => ({ id: String(index), source_platform: "landing", first_seen_at: "2026-11-04T12:00:00Z", journey_destination: channel } as ConversionJourneyStartRow));
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
  const rows = statisticsTemporalRows([contact("a", "atrio", { lead_event_id: "message", lead_event_time: time, purchase_event_id: "p", purchase_event_time: time + 86400 })], "atrio");
  assert.equal(rows.length, 2); assert.equal(rows[0].created_at, "2026-11-04T15:00:00.000Z");
  assert.equal(rows[1].created_at, "2026-11-05T15:00:00.000Z"); assert.equal(rows[1].contact_event_id, "");
});
test("database filter includes all four milestone timestamps and sanitizes invalid dates", () => {
  const query = statisticsEventRangeFilter(range.start.toISOString(), range.end.toISOString());
  for (const name of ["created_at", "contact_event_time", "lead_event_time", "registration_event_time", "purchase_event_time", "cta_clicked_event_time", "conversation_started_event_time", "purchase_confirmed_event_time"]) assert.ok(query.includes(name));
  assert.equal(statisticsEventRangeFilter("invalid", "invalid"), "");
});

test("versioned Atrio milestones preserve public Meta Lead while counting the later human message", () => {
  const source = contact("at-v1", "atrio", {
    internal_events_version: 1,
    cta_clicked_event_id: "cta", cta_clicked_event_time: time,
    contact_event_id: "cta", lead_event_id: "cta", lead_event_time: time,
    conversation_started_event_id: "message", conversation_started_event_time: time + 20,
    purchase_confirmed_event_id: "purchase", purchase_confirmed_event_time: time + 60,
    purchase_event_id: "purchase", purchase_event_time: time + 60, purchase_type: "first",
    contact_payload_raw: JSON.stringify({ source_platform: "landing", cta_destination: "atrio", landing_cta_event_version: 1,
      event_id: "cta", landing_cta_meta_event: "Lead" }),
    lead_status_capi: "enviado", contact_status_capi: "", valor: 1000,
  });
  const stats = scopeStatisticsChannel([source, { ...source, id: "duplicate" }], [], "atrio", range);
  assert.equal(stats.funnel.contacts, 1);
  assert.equal(stats.funnel.messages, 1);
  assert.equal(stats.funnel.firstPurchases, 1);
  assert.equal(stats.conversions.filter(item => item.purchase_event_id).length, 1);
  assert.equal(stageDate(stats.conversions[0], "lead")?.getTime(), (time + 20) * 1000);
  assert.equal(source.lead_event_id, "cta", "public Meta identity is immutable");
  assert.equal(source.lead_status_capi, "enviado", "delivery result remains intact");
  assert.equal(stats.conversions[0].lead_event_id, "message", "only derived analytics uses internal identity");
});

test("versioned CTA alone never becomes a message even when Meta accepted Lead", () => {
  const source = contact("at-v1", "atrio", { internal_events_version: 1,
    cta_clicked_event_id: "cta", cta_clicked_event_time: time,
    lead_event_id: "meta-lead", lead_event_time: time, lead_status_capi: "enviado", estado: "lead" });
  const projected = projectInternalConversion(source);
  assert.equal(projected.lead_event_id, "");
  assert.equal(projected.estado, "contact");
  assert.equal(source.lead_event_id, "meta-lead");
  assert.deepEqual(statisticsMessageCoverage([source], "atrio"), { measured: true, unknownJourneys: 0 });
});

test("internal message dates survive range scoping without resurrecting the excluded CTA", () => {
  const source = contact("at-v1", "atrio", { internal_events_version: 1,
    cta_clicked_event_id: "cta", cta_clicked_event_time: time - 86400,
    conversation_started_event_id: "human-message", conversation_started_event_time: time,
    lead_event_id: "cta", lead_event_time: time - 86400 });
  const rows = dedupeStatisticsEvents(scopeStatisticsStages([source], range));
  assert.equal(rows[0].contact_event_id, "");
  assert.equal(rows[0].lead_event_id, "human-message");
  assert.equal(computeChannelFunnel(rows, "atrio").contacts, 0);
  assert.equal(projectInternalConversion(rows[0]).contact_event_id, "", "repeated projection preserves scoped exclusions");
});
test("several CTA attempts during one visit cannot produce a conversion rate over 100 percent", () => {
  const start = { id: "visit", user_id: "owner", landing_id: "landing", source_platform: "landing", external_id: "visitor", first_seen_at: new Date(time * 1000).toISOString() } as ConversionJourneyStartRow;
  const rows = [contact("one", "whatsapp", { external_id: "visitor", promo_code: "one" }),
    contact("two", "whatsapp", { external_id: "visitor", promo_code: "two", contact_event_time: time + 10 })];
  assert.equal(countStatisticsVisitConversions([start], rows), 1);
  assert.equal(countStatisticsVisitConversions([{ ...start, source_platform: "whatsapp_cloud_api" }], rows), 0);
});
