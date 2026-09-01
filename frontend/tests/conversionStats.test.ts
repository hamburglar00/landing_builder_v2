import assert from "node:assert/strict";
import test from "node:test";
import type { ConversionJourneyStartRow, ConversionRow } from "../lib/conversionsDb";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

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
  assert.equal(stats.inferredLeadsFromContactPurchase, 1);
  assert.equal(stats.firstLoadPurchasersLinkedToLead, 2);
  assert.equal(stats.totalPurchases, 3);
  assert.equal(stats.totalRevenue, 450);
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
