import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_COLUMNS,
  columnLabel,
  columnsForTableView,
  FRIENDLY_HIDDEN_COLUMNS,
  type ConversionColumnKey,
} from "../components/conversiones/conversionPageShared";

const EXPECTED_HIDDEN_COLUMNS: ConversionColumnKey[] = [
  "zip",
  "fbc",
  "fbp",
  "meta_pixel_id",
  "ctwa_clid",
  "contact_event_time",
  "contact_payload_raw",
  "lead_event_time",
  "lead_payload_raw",
  "purchase_event_time",
  "purchase_payload_raw",
  "clientIP",
  "agentuser",
  "purchase_capi_route",
  "purchase_capi_route_reason",
  "device_type",
  "geo_city",
  "geo_region",
  "geo_country",
  "geo_source",
  "cuit_cuil",
  "inferred_sex",
  "sex_source",
  "lead_bot_phone",
  "lead_player_username",
  "lead_agency_id",
  "lead_gerencia_label",
  "lead_incoming_promo_code",
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
  "registration_attribution_status",
  "registration_attribution_conversion_id",
  "purchase_bot_phone",
  "purchase_player_username",
  "purchase_agency_id",
  "purchase_gerencia_label",
  "purchase_incoming_promo_code",
  "purchase_attribution_status",
  "purchase_attribution_conversion_id",
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
    "pixel_id",
    "contact_event_id",
    "lead_event_id",
    "purchase_event_id",
    "contact_status_capi",
    "lead_status_capi",
    "purchase_status_capi",
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
  assert.equal(columnLabel("purchase_status_capi", "friendly"), "Envío CAPI de Purchase");
});
