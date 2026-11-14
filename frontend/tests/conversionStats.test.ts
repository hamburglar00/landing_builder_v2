import assert from "node:assert/strict";
import test from "node:test";
import type { ConversionJourneyStartRow, ConversionRow } from "../lib/conversionsDb";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

test("Atrio historical rendering marks unmeasured messages without treating a public Lead as a conversation", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: StatsPanel } = await import("../components/conversiones/StatsPanel");
  const record = conversionRow("legacy-cta", {
    source_platform: "landing", contact_event_id: "cta", lead_event_id: "cta", estado: "lead",
    contact_payload_raw: JSON.stringify({ source_platform: "landing", cta_destination: "atrio", landing_cta_event_version: 1,
      event_id: "cta", landing_cta_meta_event: "Lead" }),
  });
  const html = renderToStaticMarkup(React.createElement(StatsPanel, {
    canViewAtrio: true, channel: "atrio", channelLabels: { atrio: "Chat propio" }, availableChannels: ["atrio"],
    conversions: [record], allConversions: [record], journeyStarts: [], funnelContacts: [], premiumThreshold: 200, dateRange: null, currency: "ARS",
  }));
  assert.match(html, /Mensajes recibidos/);
  assert.match(html, /Sin medición del primer mensaje/);
  assert.match(html, /recorridos históricos no tienen medición confirmada/);
  assert.match(html, /Chat propio/);
  assert.equal(record.lead_event_id, "cta");
});

test("a historical purchase remains visible by campaign without inventing a message or conversion rate", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: StatsPanel } = await import("../components/conversiones/StatsPanel");
  const row = conversionRow("unmeasured-purchase", { source_platform: "landing",
    contact_payload_raw: JSON.stringify({ source_platform: "landing", cta_destination: "atrio" }),
    contact_event_id: "cta", purchase_event_id: "purchase", purchase_type: "first", valor: 25000, utm_campaign: "historia" });
  const html = renderToStaticMarkup(React.createElement(StatsPanel, {
    canViewAtrio: true, channel: "atrio", conversions: [row], allConversions: [row], journeyStarts: [],
    funnelContacts: [], premiumThreshold: 200, dateRange: null, currency: "ARS",
  }));
  const campaignRow = html.match(/<tr[^>]*><td[^>]*>historia<\/td>(.*?)<\/tr>/)?.[1] ?? "";
  assert.match(campaignRow, /<td[^>]*>—<\/td><td[^>]*>1<\/td><td[^>]*>—<\/td>/);
  assert.match(campaignRow, /25[.,]000/);
});

test("the province map separates Atrio CTA, human messages and purchases, including missing historical measurement", async () => {
  const { buildProvinceData, getMetricValue } = await import("../components/conversiones/ArgentinaMap");
  const cta = conversionRow("cta-only", { geo_region: "Buenos Aires", internal_events_version: 1,
    cta_clicked_event_id: "cta-only", cta_clicked_event_time: 100, contact_event_id: "cta-only", lead_event_id: "meta-cta-only" });
  const journey = conversionRow("human", { geo_region: "Buenos Aires", internal_events_version: 1,
    promo_code: "PROMO-b", external_id: "player-b", cta_clicked_event_id: "cta-human", cta_clicked_event_time: 100,
    conversation_started_event_id: "human", conversation_started_event_time: 200,
    purchase_confirmed_event_id: "purchase", purchase_confirmed_event_time: 300, purchase_type: "first", valor: 120 });
  const data = [...buildProvinceData([], [cta, journey], [cta, journey], 200, "atrio").values()][0];
  assert.equal(getMetricValue(data, "contactos", 0, 2), 2);
  assert.equal(getMetricValue(data, "leads", 0, 2), 1);
  assert.equal(getMetricValue(data, "pct_inicio", 0, 2), 50);
  assert.equal(getMetricValue(data, "primeras_cargas", 0, 2), 1);
  assert.equal(getMetricValue(data, "total_cargado", 0, 2), 120);
  const legacy = conversionRow("legacy", { geo_region: "Buenos Aires", contact_event_id: "old", purchase_event_id: "old-buy",
    purchase_type: "first", valor: 25000 });
  const oldData = [...buildProvinceData([], [legacy], [legacy], 200, "atrio").values()][0];
  assert.equal(getMetricValue(oldData, "leads", 0, 1), null);
  assert.equal(getMetricValue(oldData, "pct_carga", 0, 1), null);
  assert.equal(getMetricValue(oldData, "primeras_cargas", 0, 1), 1);
  assert.equal(getMetricValue(oldData, "total_cargado", 0, 1), 25000);
});

function purchaseRow(
  id: string,
  phone: string,
  purchaseType: "first" | "repeat",
  externalId: string,
  extra: Partial<ConversionRow> = {},
): ConversionRow {
  return {
    id,
    user_id: "client-1",
    phone,
    external_id: externalId,
    purchase_event_id: `purchase-${id}`,
    purchase_type: purchaseType,
    created_at: "2026-07-31T12:00:00.000Z",
    valor: 100,
    ...extra,
  } as ConversionRow;
}

function conversionRow(
  id: string,
  extra: Partial<ConversionRow>,
): ConversionRow {
  return {
    id,
    user_id: "client-1",
    phone: "5491111111111",
    external_id: "player-a",
    promo_code: "PROMO-a",
    created_at: "2026-07-31T12:00:00.000Z",
    valor: 0,
    ...extra,
  } as ConversionRow;
}

function journeyStartRow(
  id: string,
  extra: Partial<ConversionJourneyStartRow>,
): ConversionJourneyStartRow {
  return {
    id,
    user_id: "client-1",
    source_platform: "landing",
    start_identity_key: `start-${id}`,
    landing_id: null,
    landing_name: "",
    workspace_currency: "ARS",
    external_id: "",
    phone: "",
    wa_id: "",
    email: "",
    utm_campaign: "",
    fbp: "",
    fbc: "",
    from_meta_ads: false,
    meta_pixel_id: "",
    dataset_id: "",
    ctwa_clid: "",
    telefono_asignado: "",
    device_type: "",
    event_source_url: "",
    client_ip: "",
    agent_user: "",
    first_seen_at: "2026-07-31T12:00:00.000Z",
    last_seen_at: "2026-07-31T12:00:00.000Z",
    created_at: "2026-07-31T12:00:00.000Z",
    updated_at: "2026-07-31T12:00:00.000Z",
    ...extra,
  } as ConversionJourneyStartRow;
}

test("separa jugadores que recargaron, recargas totales y cohorte del período", async () => {
  const { computeCoreStats } = await import("../lib/conversionStats");
  const conversions = [
    purchaseRow("first-a", "5491111111111", "first", "player-a", {
      contact_event_id: "contact-a",
      lead_event_id: "lead-a",
    }),
    purchaseRow("repeat-a-1", "5491111111111", "repeat", "player-a"),
    purchaseRow("repeat-a-2", "5491111111111", "repeat", "player-a"),
    purchaseRow("repeat-b-1", "5492222222222", "repeat", "player-b"),
    purchaseRow("repeat-b-2", "5492222222222", "repeat", "player-b"),
    purchaseRow("repeat-c-1", "5493333333333", "repeat", "player-c"),
  ];

  const stats = computeCoreStats(conversions, [], conversions, 200_000);

  assert.equal(stats.firstLoadPurchasersAttributed, 1);
  assert.equal(stats.purchaseRepeat, 3);
  assert.equal(stats.totalPurchases, 6);
  assert.equal(stats.repeatFromAttributedFirstInRange, 1);
  assert.equal(stats.repeatEventsFromAttributedFirstInRange, 2);
});

test("mide recorridos publicitarios por promo y gerencia aunque sea el mismo jugador", async () => {
  const { computeCoreStats } = await import("../lib/conversionStats");
  const conversions = [
    conversionRow("contact-a", {
      contact_event_id: "contact-a",
      promo_code: "PROMO-a",
      assigned_gerencia_id: 10,
    }),
    conversionRow("lead-a", {
      lead_event_id: "lead-a",
      promo_code: "PROMO-a",
      assigned_gerencia_id: 10,
      lead_gerencia_id: 10,
    }),
    conversionRow("purchase-a", {
      purchase_event_id: "purchase-a",
      purchase_type: "first",
      promo_code: "PROMO-a",
      assigned_gerencia_id: 10,
      lead_gerencia_id: 10,
      purchase_gerencia_id: 10,
      valor: 100,
    }),
    conversionRow("contact-b", {
      contact_event_id: "contact-b",
      promo_code: "PROMO-b",
      assigned_gerencia_id: 20,
    }),
    conversionRow("lead-b", {
      lead_event_id: "lead-b",
      promo_code: "PROMO-b",
      assigned_gerencia_id: 20,
      lead_gerencia_id: 20,
    }),
    conversionRow("purchase-b", {
      purchase_event_id: "purchase-b",
      purchase_type: "first",
      promo_code: "PROMO-b",
      assigned_gerencia_id: 20,
      lead_gerencia_id: 20,
      purchase_gerencia_id: 20,
      valor: 200,
    }),
  ];

  const stats = computeCoreStats(conversions, [], conversions, 200_000);

  assert.equal(stats.firstLoadPurchasersAttributed, 1);
  assert.equal(stats.adContactJourneys, 2);
  assert.equal(stats.adLeadJourneysLinkedToContact, 2);
  assert.equal(stats.adFirstPurchaseJourneysAttributed, 2);
  assert.equal(stats.adFirstPurchaseEventsAttributed, 2);
  assert.equal(stats.firstPurchaseEventRevenue, 300);
});

test("no adjudica al recorrido una compra con promo arrastrado y gerencia receptora distinta", async () => {
  const { computeCoreStats } = await import("../lib/conversionStats");
  const conversions = [
    conversionRow("contact-b", {
      contact_event_id: "contact-b",
      promo_code: "PROMO-b",
      assigned_gerencia_id: 20,
    }),
    conversionRow("lead-b", {
      lead_event_id: "lead-b",
      promo_code: "PROMO-b",
      assigned_gerencia_id: 20,
      lead_gerencia_id: 20,
    }),
    conversionRow("purchase-conflict", {
      purchase_event_id: "purchase-conflict",
      purchase_type: "first",
      promo_code: "PROMO-b",
      purchase_incoming_promo_code: "PROMO-b",
      assigned_gerencia_id: 20,
      lead_gerencia_id: 20,
      purchase_gerencia_id: 10,
      valor: 100,
    }),
  ];

  const stats = computeCoreStats(conversions, [], conversions, 200_000);

  assert.equal(stats.adContactJourneys, 1);
  assert.equal(stats.adLeadJourneysLinkedToContact, 1);
  assert.equal(stats.adFirstPurchaseEvents, 1);
  assert.equal(stats.adFirstPurchaseJourneysAttributed, 0);
  assert.equal(stats.adFirstPurchaseEventsAttributed, 0);
});

test("los recorridos publicitarios usan phone + agency como identidad", async () => {
  const { computeCoreStats } = await import("../lib/conversionStats");
  const conversions = [
    conversionRow("contact-a", {
      contact_event_id: "contact-a",
      promo_code: "PROMO-a",
      assigned_gerencia_external_id: 10,
      external_id: "shared-external",
    }),
    conversionRow("lead-a", {
      lead_event_id: "lead-a",
      promo_code: "PROMO-a",
      lead_agency_id: "10",
      external_id: "shared-external",
    }),
    conversionRow("purchase-a", {
      purchase_event_id: "purchase-a",
      purchase_type: "first",
      promo_code: "PROMO-a",
      purchase_agency_id: "10",
      external_id: "shared-external",
      valor: 100,
    }),
    conversionRow("purchase-b-same-promo-other-agency", {
      purchase_event_id: "purchase-b",
      purchase_type: "first",
      promo_code: "PROMO-a",
      purchase_agency_id: "20",
      external_id: "shared-external",
      valor: 200,
    }),
  ];

  const stats = computeCoreStats(conversions, [], conversions, 200_000);

  assert.equal(stats.adContactJourneys, 1);
  assert.equal(stats.adLeadJourneysLinkedToContact, 1);
  assert.equal(stats.adFirstPurchaseEvents, 2);
  assert.equal(stats.adFirstPurchaseJourneysAttributed, 1);
  assert.equal(stats.adFirstPurchaseEventsAttributed, 1);
});

test("el funnel separa tarjetas por jugador/gerencia y acota montos", async () => {
  const { buildFunnelContactsFromConversions } = await import("../lib/conversionsDb");
  const rows = [
    conversionRow("purchase-a", {
      purchase_event_id: "purchase-a",
      purchase_type: "first",
      phone: "5491111111111",
      purchase_agency_id: "10",
      purchase_gerencia_label: "Gerencia A",
      estado: "purchase",
      valor: 100,
    }),
    conversionRow("purchase-b", {
      purchase_event_id: "purchase-b",
      purchase_type: "first",
      phone: "5491111111111",
      purchase_agency_id: "20",
      purchase_gerencia_label: "Gerencia B",
      estado: "purchase",
      valor: 250,
    }),
  ];

  const contacts = buildFunnelContactsFromConversions(rows);

  assert.equal(contacts.length, 2);
  assert.deepEqual(
    contacts.map((c) => ({ gerencia: c.assigned_gerencia_label, total: c.total_valor, player: c.player_username })).sort((a, b) => a.total - b.total),
    [
      { gerencia: "Gerencia A", total: 100, player: null },
      { gerencia: "Gerencia B", total: 250, player: null },
    ],
  );
});

test("el funnel agrupa por phone + agency aunque cambie player_username", async () => {
  const { buildFunnelContactsFromConversions } = await import("../lib/conversionsDb");
  const rows = [
    conversionRow("purchase-a-1", {
      purchase_event_id: "purchase-a-1",
      purchase_type: "first",
      phone: "5491111111111",
      purchase_agency_id: "10",
      purchase_player_username: "temporal-phone",
      purchase_gerencia_label: "Gerencia A",
      estado: "purchase",
      valor: 100,
    }),
    conversionRow("purchase-a-2", {
      purchase_event_id: "purchase-a-2",
      purchase_type: "repeat",
      phone: "5491111111111",
      purchase_agency_id: "10",
      purchase_player_username: "guille2737",
      purchase_gerencia_label: "Gerencia A",
      estado: "purchase",
      valor: 250,
    }),
  ];

  const contacts = buildFunnelContactsFromConversions(rows);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].total_valor, 350);
  assert.equal(contacts[0].purchase_count, 2);
  assert.equal(contacts[0].player_username, "guille2737");
});

test("cuenta PageViews de landing por recorrido antes del Contact", async () => {
  const { computeJourneyStartStats } = await import("../lib/conversionStats");
  const starts = [
    journeyStartRow("view-a-1", {
      source_platform: "landing",
      start_identity_key: "landing:landing-1:external-a:view-1",
      landing_id: "landing-1",
      external_id: "external-a",
    }),
    journeyStartRow("view-a-2", {
      source_platform: "landing",
      start_identity_key: "landing:landing-1:external-a:view-2",
      landing_id: "landing-1",
      external_id: "external-a",
    }),
    journeyStartRow("view-b", {
      source_platform: "landing",
      start_identity_key: "landing:landing-1:external-b:view-1",
      landing_id: "landing-1",
      external_id: "external-b",
    }),
  ];
  const conversions = [
    conversionRow("contact-a", {
      source_platform: "landing",
      landing_id: "landing-1",
      external_id: "external-a",
      contact_event_id: "contact-a",
    }),
  ];

  const stats = computeJourneyStartStats(starts, conversions);

  assert.equal(stats.starts, 3);
  assert.equal(stats.contacts, 1);
});

test("mide chats iniciados de WhatsApp Cloud API antes del click al CTA", async () => {
  const { computeJourneyStartStats } = await import("../lib/conversionStats");
  const starts = [
    journeyStartRow("chat-a", {
      source_platform: "whatsapp_cloud_api",
      start_identity_key: "whatsapp_cloud_api:config-1:5491111111111",
      external_id: "wca-external-a",
      phone: "5491111111111",
      wa_id: "5491111111111",
    }),
    journeyStartRow("chat-b", {
      source_platform: "whatsapp_cloud_api",
      start_identity_key: "whatsapp_cloud_api:config-1:5492222222222",
      external_id: "wca-external-b",
      phone: "5492222222222",
      wa_id: "5492222222222",
    }),
  ];
  const conversions = [
    conversionRow("contact-a", {
      source_platform: "whatsapp_cloud_api",
      external_id: "wca-external-a",
      phone: "5491111111111",
      contact_event_id: "contact-a",
    }),
  ];

  const stats = computeJourneyStartStats(starts, conversions);

  assert.equal(stats.starts, 2);
  assert.equal(stats.contacts, 1);
});

test("expone la misma familia de metricas que usa Estadisticas", async () => {
  const { computeStatsTruthMetrics } = await import("../lib/conversionStats");
  const conversions = [
    conversionRow("contact-a", {
      contact_event_id: "contact-a",
      external_id: "player-a",
    }),
    conversionRow("lead-a", {
      lead_event_id: "lead-a",
      external_id: "player-a",
    }),
    conversionRow("purchase-a-first", {
      purchase_event_id: "purchase-a-first",
      purchase_type: "first",
      external_id: "player-a",
      valor: 100,
    }),
    conversionRow("purchase-a-repeat", {
      purchase_event_id: "purchase-a-repeat",
      purchase_type: "repeat",
      external_id: "player-a",
      valor: 50,
    }),
    conversionRow("purchase-b-inferred", {
      contact_event_id: "contact-b",
      purchase_event_id: "purchase-b-inferred",
      purchase_type: "first",
      external_id: "player-b",
      promo_code: "PROMO-b",
      valor: 300,
    }),
  ];

  const stats = computeStatsTruthMetrics({
    conversions,
    funnelContacts: [],
    allConversions: conversions,
    premiumThreshold: 200,
  });

  assert.equal(stats.uniqueContacts, 2);
  assert.equal(stats.uniqueLeadsLinkedToContact, 1);
  assert.equal(stats.inferredLeadsFromContactPurchase, 0, "a purchase does not prove a human message");
  assert.equal(stats.firstLoadPurchasersLinkedToLead, 1);
  assert.equal(stats.totalPurchases, 3);
  assert.equal(stats.totalRevenue, 450);
});

test("calcula frecuencia de leads por cliente y resumen por landing tag", async () => {
  const { computeLeadRepeatStats } = await import("../components/conversiones/StatsPanel");
  const leads = [
    conversionRow("reb-a-1", {
      phone: "+54 9 11 1111-1111",
      promo_code: "ReB-a",
      contact_event_id: "contact-reb-a-1",
      lead_event_id: "lead-reb-a-1",
      lead_event_time: 100,
    }),
    conversionRow("reb-a-2", {
      phone: "5491111111111",
      promo_code: "ReB-b",
      contact_event_id: "contact-reb-a-2",
      lead_event_id: "lead-reb-a-2",
      lead_event_time: 200,
    }),
    conversionRow("reb-b-1", {
      phone: "5492222222222",
      promo_code: "ReB-c",
      contact_event_id: "contact-reb-b-1",
      lead_event_id: "lead-reb-b-1",
      lead_event_time: 300,
    }),
    conversionRow("abc-a-1", {
      phone: "5491111111111",
      promo_code: "ABC-a",
      contact_event_id: "contact-abc-a-1",
      lead_event_id: "lead-abc-a-1",
      lead_event_time: 400,
    }),
    conversionRow("abc-a-2", {
      phone: "5491111111111",
      promo_code: "ABC-b",
      contact_event_id: "contact-abc-a-2",
      lead_event_id: "lead-abc-a-2",
      lead_event_time: 500,
    }),
    conversionRow("abc-a-3", {
      phone: "5491111111111",
      promo_code: "ABC-c",
      contact_event_id: "contact-abc-a-3",
      lead_event_id: "lead-abc-a-3",
      lead_event_time: 600,
    }),
    conversionRow("orphan-lead", {
      phone: "5494444444444",
      promo_code: "ABC-orphan",
      lead_event_id: "lead-orphan",
      lead_event_time: 700,
    }),
    conversionRow("not-a-lead", {
      phone: "5493333333333",
      promo_code: "ABC-d",
      lead_event_id: "",
    }),
  ];

  const stats = computeLeadRepeatStats(leads);

  assert.equal(stats.totalLeads, 6);
  assert.equal(stats.uniquePhones, 2);
  assert.equal(stats.firstLeads, 2);
  assert.equal(stats.repeatLeads, 4);
  assert.equal(stats.golondrinaPhones, 1);
  assert.deepEqual(
    stats.buckets.map((bucket) => ({
      label: bucket.label,
      phones: bucket.phones,
      leads: bucket.leads,
    })),
    [
      { label: "1 vez", phones: 1, leads: 1 },
      { label: "5 veces", phones: 1, leads: 5 },
    ],
  );

  const reb = stats.byLandingTag.find((row) => row.landingTag === "ReB");
  const abc = stats.byLandingTag.find((row) => row.landingTag === "ABC");
  assert.equal(reb?.totalLeads, 3);
  assert.equal(reb?.uniquePhones, 2);
  assert.equal(reb?.repeatLeads, 1);
  assert.equal(abc?.totalLeads, 3);
  assert.equal(abc?.uniquePhones, 1);
  assert.equal(abc?.repeatLeads, 2);
});

test("expone ID de gerencia en chats iniciados aunque el label historico sea generico", async () => {
  const { getJourneyStartGerenciaLabels } = await import("../lib/conversionsDb");

  const labels = getJourneyStartGerenciaLabels(
    journeyStartRow("chat-gerencia", {
      source_platform: "whatsapp_cloud_api",
      assigned_gerencia_id: 17,
      assigned_gerencia_external_id: 17,
      assigned_gerencia_label: "Gerencia 17",
    }),
    {},
  );

  assert(labels.includes("Gerencia 17"));
  assert(labels.some((label) => /\(ID\s*17\)/i.test(label)));
});

test("desempeno matchea gerencias por ID aunque cambie el texto historico", async () => {
  const { labelsMatchGerenciaLabel } = await import("../components/conversiones/GerenciasPerformancePanel");

  assert.equal(labelsMatchGerenciaLabel("chiva77bot (ID 17)", ["Gerencia 17"]), true);
  assert.equal(labelsMatchGerenciaLabel("chiva77bot (ID 17)", ["chiva77bot (ID 17)"]), true);
  assert.equal(labelsMatchGerenciaLabel("chiva77bot (ID 17)", ["pikman_mkt (ID 125)"]), false);
});
