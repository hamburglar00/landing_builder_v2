import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_COLUMNS,
  columnLabel,
  columnTooltip,
  columnsForTableView,
  FRIENDLY_HIDDEN_COLUMNS,
  displayConversionStage,
  displayInternalConversionStage,
  conversionRowColor,
  displayMetaOriginEvidence,
  type ConversionColumnKey,
} from "../components/conversiones/conversionPageShared";

test("the canonical registration stage displays the actual CompleteRegistration event", () => {
  assert.equal(displayConversionStage({estado:"registration",source_platform:"landing"}),"CompleteRegistration");
  assert.equal(displayConversionStage({estado:"lead",source_platform:"landing"}),"lead");
  assert.equal(displayConversionStage({estado:"lead",source_platform:"whatsapp_cloud_api"}),"LeadSubmitted");
});

test("the table and PDF distinguish operational stages from accepted Meta events", () => {
  const row = { internal_events_version: 1, cta_clicked_event_id: "cta", cta_clicked_event_time: 100,
    contact_event_id: "cta", lead_event_id: "cta", lead_status_capi: "enviado", estado: "lead" };
  assert.equal(displayConversionStage(row), "lead");
  assert.equal(displayInternalConversionStage(row), "Contact · CTA");
  assert.equal(displayInternalConversionStage(row, true), "cta_clicked");
  assert.equal(displayInternalConversionStage({ ...row, conversation_started_event_id: "human-message" }), "Mensaje recibido");
  assert.equal(displayMetaOriginEvidence({ classification: "meta_ads", method: "meta_campaign", parameters: ["utm_source", "utm_medium"], values: {} }), "meta_campaign · utm_source, utm_medium");
  assert.deepEqual(columnsForTableView(["phone", "estado"], "friendly"), ["phone", "internal_event", "estado"]);
});

test("an internal conversation without a public event does not invent a Meta Lead", () => {
  const row = { internal_events_version: 1, conversation_started_event_id: "human-message", estado: "lead", lead_event_id: "" };
  assert.equal(displayConversionStage(row), "Sin evento Meta");
  assert.equal(displayInternalConversionStage(row), "Mensaje recibido");
  assert.equal(displayConversionStage({ ...row, internal_events_version: null }), "lead");
  assert.equal(displayConversionStage({ ...row, lead_event_id: "actual-meta-lead" }), "lead");
  const registered = { ...row, conversation_started_event_id: "", confirmed_registration_event_id: "created-account" };
  assert.equal(displayInternalConversionStage(registered), "Alta confirmada");
  assert.equal(displayConversionStage(registered), "Sin evento Meta");
});

test("visible gateway greeting uses Lead amber without inventing a message or overriding a purchase", () => {
  const cta = { internal_events_version: 1, cta_clicked_event_id: "cta-a", lead_event_id: "cta-a", estado: "lead" };
  const account = { ...cta, confirmed_registration_event_id: "account-a" };
  const entry = { ...account, gateway_entry_event_id: "greeting-a", gateway_entry_event_time: 100 };
  const message = { ...entry, conversation_started_event_id: "human-a" };
  assert.equal(conversionRowColor(cta), "bg-zinc-950/40");
  assert.equal(conversionRowColor(account), conversionRowColor(cta));
  assert.equal(displayInternalConversionStage(entry), "Ingresó al gateway");
  assert.equal(displayInternalConversionStage(entry, true), "gateway_visible_entry");
  assert.equal(conversionRowColor(entry), "bg-amber-950/18");
  assert.equal(displayInternalConversionStage(message), "Mensaje recibido");
  assert.equal(conversionRowColor(message), conversionRowColor(entry));
  assert.equal(displayConversionStage(entry), displayConversionStage(cta));
  const paid = { ...message, purchase_confirmed_event_id: "purchase-a" };
  assert.equal(displayInternalConversionStage(paid), "Compra confirmada");
  assert.equal(conversionRowColor(paid), "bg-rose-950/18");
  assert.equal(conversionRowColor({ ...paid, purchase_type: "repeat" }), "bg-violet-950/20");
});

const EXPECTED_HIDDEN_COLUMNS: ConversionColumnKey[] = [
  "zip",
  "form_fn",
  "form_ln",
  "form_email",
  "form_phone",
  "fbc",
  "fbp",
  "dataset_id",
  "source_platform",
  "ctwa_clid",
  "atrio_id",
  "atrio_client_id",
  "atrio_slug",
  "atrio_players_id",
  "contact_event_id",
  "contact_event_time",
  "sendContactPixel",
  "contact_payload_raw",
  "lead_event_id",
  "lead_event_time",
  "lead_payload_raw",
  "purchase_event_id",
  "purchase_event_time",
  "purchase_payload_raw",
  "clientIP",
  "agentuser",
  "purchase_capi_route",
  "purchase_capi_route_reason",
  "contact_status_capi",
  "lead_status_capi",
  "registration_status_capi",
  "purchase_status_capi",
  "observaciones",
  "device_type",
  "geo_city",
  "geo_region",
  "geo_country",
  "geo_source",
  "cuit_cuil",
  "inferred_sex",
  "sex_source",
  "external_id",
  "test_event_code",
  "lead_bot_phone",
  "lead_player_username",
  "lead_agency_id",
  "lead_gerencia_label",
  "lead_incoming_promo_code",
  "lead_atrio_id",
  "lead_atrio_players_id",
  "lead_attribution_status",
  "lead_attribution_conversion_id",
  "registration_event_id",
  "registration_event_time",
  "registration_player_username",
  "registration_payload_raw",
  "registration_bot_phone",
  "registration_agency_id",
  "registration_gerencia_label",
  "registration_incoming_promo_code",
  "registration_atrio_id",
  "registration_atrio_players_id",
  "registration_attribution_status",
  "registration_attribution_conversion_id",
  "purchase_bot_phone",
  "purchase_player_username",
  "purchase_agency_id",
  "purchase_gerencia_label",
  "purchase_incoming_promo_code",
  "purchase_atrio_id",
  "purchase_atrio_players_id",
  "purchase_attribution_status",
  "purchase_attribution_conversion_id",
  "cta_clicked_event_id", "cta_clicked_event_time",
  "conversation_started_event_id", "conversation_started_event_time",
  "purchase_confirmed_event_id", "purchase_confirmed_event_time",
];

test("la vista reducida oculta exactamente las columnas técnicas solicitadas", () => {
  assert.deepEqual(
    [...FRIENDLY_HIDDEN_COLUMNS],
    EXPECTED_HIDDEN_COLUMNS,
  );

  const friendlyColumns = columnsForTableView(ALL_COLUMNS, "friendly");
  for (const column of EXPECTED_HIDDEN_COLUMNS) {
    assert.equal(friendlyColumns.includes(column), false, column);
  }

  for (const column of [
    "phone",
    "email",
    "meta_pixel_id",
    "pixel_id",
  ] satisfies ConversionColumnKey[]) {
    assert.equal(friendlyColumns.includes(column), true, column);
  }
});

test("la vista técnica conserva todas las columnas y sus nombres originales", () => {
  assert.deepEqual(columnsForTableView(ALL_COLUMNS, "technical"), [
    ...ALL_COLUMNS,
  ]);
  assert.equal(columnLabel("phone", "technical"), "phone");
  assert.equal(columnLabel("assigned_gerencia_label", "technical"), "Nombre gerencia (ID)");
});

test("la vista reducida usa encabezados comprensibles", () => {
  assert.equal(columnLabel("phone", "friendly"), "Teléfono");
  assert.equal(columnLabel("timestamp", "friendly"), "Fecha y hora");
  assert.equal(columnLabel("test_event_code", "friendly"), "Test Event Code");
  assert.equal(columnLabel("meta_pixel_id", "friendly"), "Píxel recibido");
  assert.equal(columnLabel("pixel_id", "friendly"), "Píxel usado para CAPI");
});

test("los tooltips cambian segun la vista de tabla", () => {
  assert.match(
    columnTooltip("assigned_gerencia_label", "friendly"),
    /derivo el cliente/i,
  );
  assert.match(
    columnTooltip("assigned_gerencia_label", "technical"),
    /Gerencia historica/i,
  );
  assert.match(columnTooltip("phone", "friendly"), /cliente/i);
  assert.match(columnTooltip("phone", "technical"), /payload/i);
});
