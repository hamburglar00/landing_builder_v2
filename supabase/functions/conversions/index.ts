import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildMetaBusinessMessagingPurchaseRequest,
  buildMetaRequest,
  type ConversionRow as SharedConversionRow,
  type ConversionsConfig as SharedConversionsConfig,
  generateEventId as sharedGenerateEventId,
  hasPreviousSuccessfulPurchases,
  normalizeCtwaClid,
  normalizeCurrencyCode,
  normalizePurchaseAmount,
  preparePurchaseCustomDataForMeta,
  resolvePurchaseCapiDecision,
  resolvePurchaseCapiRoute,
  shouldSkipCapiForNonMetaOrigin,
  toValidEventTime,
} from "./shared.ts";
import {
  type PurchasePixelAttribution,
  resolvePurchasePixelAttribution,
} from "./pixel_attribution.ts";
import {
  canonicalizeInboundTrackingPayload,
  inboundClientIpCandidates,
  inboundUserAgent,
} from "./inbound_tracking.ts";
import {
  actionEventIdempotencyKey,
  canUsePromoForJourney,
  choosePurchaseJourney,
  evaluatePromoGerenciaCoherence,
  type PromoGerenciaCoherence,
} from "./event_attribution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConversionsConfig {
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  send_lead_capi: boolean;
  send_complete_registration_capi: boolean;
  meta_ads_only_capi: boolean;
  include_purchase_type_capi?: boolean;
  send_first_purchase_capi?: boolean;
  send_repeat_purchase_capi?: boolean;
  send_purchase_capi: boolean;
  send_geo_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
}

interface PixelConfigRow {
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  send_lead_capi: boolean;
  send_complete_registration_capi: boolean;
  meta_ads_only_capi: boolean;
  include_purchase_type_capi?: boolean;
  send_first_purchase_capi?: boolean;
  send_repeat_purchase_capi?: boolean;
  send_purchase_capi: boolean;
  send_geo_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  is_default: boolean;
}

interface ChatraceCapiConfig {
  active: boolean;
  send_meta_capi_events: boolean;
  send_business_messaging_purchase_capi: boolean;
  whatsapp_business_account_id: string;
  meta_messaging_dataset_id: string;
  meta_messaging_access_token: string;
  meta_pixel_id: string;
}

interface LandingRow {
  id: string;
  name: string;
  user_id: string;
}

interface ConversionRow {
  id?: string;
  created_at?: string;
  landing_id: string | null;
  user_id: string;
  landing_name: string;
  phone: string;
  email: string;
  form_fn?: string | null;
  form_ln?: string | null;
  form_email?: string | null;
  form_phone?: string | null;
  cuit_cuil: string;
  inferred_sex?: string;
  sex_source?: string;
  fn: string;
  ln: string;
  ct: string;
  st: string;
  zip: string;
  country: string;
  fbp: string;
  fbc: string;
  from_meta_ads?: boolean;
  geo_source?: string;
  meta_pixel_id: string;
  pixel_attribution_source?: string;
  pixel_attribution_conversion_id?: string | null;
  source_platform?: string;
  ctwa_clid?: string;
  pixel_id: string;
  contact_event_id: string;
  contact_event_time: number | null;
  sendContactPixel?: boolean;
  contact_payload_raw: string;
  lead_event_id: string;
  lead_event_time: number | null;
  lead_payload_raw: string;
  purchase_event_id: string;
  purchase_event_time: number | null;
  purchase_payload_raw: string;
  purchase_coelsa_id?: string;
  purchase_transaction_id?: string;
  test_event_code?: string;
  purchase_type?: "first" | "repeat" | null;
  purchase_capi_route?: "" | "website" | "business_messaging";
  purchase_capi_route_reason?: string;
  client_ip: string;
  agent_user: string;
  device_type: string;
  event_source_url: string;
  estado: string;
  valor: number;
  currency: string;
  contact_status_capi: string;
  lead_status_capi: string;
  registration_status_capi?: string;
  purchase_status_capi: string;
  observaciones: string;
  external_id: string;
  utm_campaign: string;
  telefono_asignado: string;
  assigned_gerencia_id?: number | null;
  assigned_gerencia_external_id?: number | null;
  assigned_gerencia_name?: string | null;
  assigned_gerencia_label?: string | null;
  lead_bot_phone?: string;
  lead_player_username?: string;
  lead_agency_id?: string;
  lead_gerencia_id?: number | null;
  lead_gerencia_external_id?: number | null;
  lead_gerencia_name?: string | null;
  lead_gerencia_label?: string | null;
  lead_incoming_promo_code?: string;
  lead_attribution_status?: string;
  lead_attribution_conversion_id?: string | null;
  registration_event_id?: string;
  registration_event_time?: number | null;
  registration_payload_raw?: string;
  registration_player_username?: string;
  registration_bot_phone?: string;
  registration_agency_id?: string;
  registration_gerencia_id?: number | null;
  registration_gerencia_external_id?: number | null;
  registration_gerencia_name?: string;
  registration_gerencia_label?: string;
  registration_incoming_promo_code?: string;
  registration_attribution_status?: string;
  registration_attribution_conversion_id?: string | null;
  purchase_bot_phone?: string;
  purchase_player_username?: string;
  purchase_agency_id?: string;
  purchase_gerencia_id?: number | null;
  purchase_gerencia_external_id?: number | null;
  purchase_gerencia_name?: string | null;
  purchase_gerencia_label?: string | null;
  purchase_incoming_promo_code?: string;
  purchase_attribution_status?: string;
  purchase_attribution_conversion_id?: string | null;
  promo_code: string;
  geo_city: string;
  geo_region: string;
  geo_country: string;
}

type AssignedGerenciaSnapshot = {
  assigned_gerencia_id: number | null;
  assigned_gerencia_external_id: number | null;
  assigned_gerencia_name: string;
  assigned_gerencia_label: string;
};

interface GeoResult {
  geo_city: string;
  geo_region: string;
  geo_country: string;
  ct: string;
  st: string;
  country: string;
  zip: string;
}

type GeoSource = "payload" | "ip" | "phone_prefix" | "none";

type InboundStatus =
  | "received"
  | "deferred"
  | "processed"
  | "deduplicated"
  | "error";
type ProcessingContext = {
  conversionId?: string;
  inboxStatus?: InboundStatus;
  inboxPromoCode?: string;
  purchaseClaimId?: string;
};

type EventGerenciaSnapshot = {
  gerencia_id: number | null;
  gerencia_external_id: number | null;
  gerencia_name: string;
  gerencia_label: string;
  workspace_currency: string;
  bot_phone: string;
  agency_id: string;
  resolution_status: string;
};
type ContactDuplicateReason = "contact_event_id" | "promo_code";
type ContactDuplicateMatch = { id: string; reason: ContactDuplicateReason };
type PurchaseEventClaim = {
  claimed: boolean;
  claimId: string;
  eventId: string;
  conversionId: string;
  status: string;
  protectedBy: string[];
};

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;

const norm = (s: unknown): string => String(s ?? "").trim();
const normalizedSourcePlatform = (s: unknown): string => norm(s).toLowerCase();
const canonicalInboundAction = (value: unknown): string => {
  const raw = norm(value);
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "").toUpperCase();
  if (
    compact === "COMPLETEREGISTRATION" ||
    compact === "COMPLETATIONREGISTRATION" ||
    compact === "COMPLETEDREGISTRATION"
  ) {
    return "COMPLETEREGISTRATION";
  }
  if (compact === "CONTACT") return "CONTACT";
  if (compact === "LEAD") return "LEAD";
  if (compact === "PURCHASE") return "PURCHASE";
  return raw.toUpperCase();
};
const playerUsernameFromPayload = (p: Params): string =>
  norm(p.player_username ?? p.playerUsername ?? p.username);
const ctwaClidForSource = (value: unknown, sourcePlatform: unknown): string =>
  normalizedSourcePlatform(sourcePlatform) === "chatrace"
    ? normalizeCtwaClid(value)
    : "";
const META_CAPI_MAX_EVENT_AGE_SECONDS = 7 * 24 * 60 * 60;
const META_CAPI_FETCH_TIMEOUT_MS = 8000;
const PURCHASE_UNPROTECTED_OBSERVATION =
  "PURCHASE SIN IDENTIFICADOR ESTABLE (DEDUPE NO GARANTIZADO)";
const META_CRAWLER_CONTACT_STATUS = "skipped_meta_crawler";
const META_CRAWLER_CONTACT_OBSERVATION = "CONTACT CAPI OMITIDO META CRAWLER";
const META_CRAWLER_USER_AGENT_TOKENS = [
  "facebookexternalhit",
  "facebot",
  "facebookcatalog",
  "facebookbot",
  "meta-externalagent",
  "meta-externalfetcher",
  "meta-externalads",
  "meta-webindexer",
];
const META_INFRASTRUCTURE_IPV4_CIDRS = [
  "31.13.24.0/21",
  "31.13.64.0/18",
  "45.64.40.0/22",
  "57.141.0.0/16",
  "66.220.144.0/20",
  "69.63.176.0/20",
  "69.171.224.0/19",
  "74.119.76.0/22",
  "103.4.96.0/22",
  "129.134.0.0/16",
  "157.240.0.0/16",
  "163.70.128.0/17",
  "173.252.64.0/18",
  "179.60.192.0/22",
  "185.60.216.0/22",
  "204.15.20.0/22",
];

type MetaCrawlerMatch = {
  matched: boolean;
  reason: string;
  clientIp: string;
  matchedCidr: string;
  matchedUserAgentToken: string;
};

function isEventTimeTooOldForMetaCapi(eventTime: number): boolean {
  if (!Number.isFinite(eventTime) || eventTime <= 0) return false;
  const now = Math.floor(Date.now() / 1000);
  return now - eventTime > META_CAPI_MAX_EVENT_AGE_SECONDS;
}

function buildGerenciaLabel(
  row: { id?: unknown; nombre?: unknown; gerencia_id?: unknown },
): AssignedGerenciaSnapshot {
  const internalId = Number(row.id);
  const externalId = Number(row.gerencia_id);
  const labelId = Number.isFinite(externalId)
    ? externalId
    : (Number.isFinite(internalId) ? internalId : null);
  const name = norm(row.nombre) ||
    (labelId != null ? `Gerencia ${labelId}` : "Gerencia");
  return {
    assigned_gerencia_id: Number.isFinite(internalId) ? internalId : null,
    assigned_gerencia_external_id: labelId,
    assigned_gerencia_name: name,
    assigned_gerencia_label: labelId != null ? `${name} (ID ${labelId})` : name,
  };
}

async function resolveAssignedGerenciaSnapshot(
  db: SupabaseClient,
  userId: string,
  assignedPhone: unknown,
  landingId?: string | null,
): Promise<AssignedGerenciaSnapshot> {
  const phone = sanitizePhone(assignedPhone);
  const empty: AssignedGerenciaSnapshot = {
    assigned_gerencia_id: null,
    assigned_gerencia_external_id: null,
    assigned_gerencia_name: "",
    assigned_gerencia_label: "",
  };
  if (!phone) return empty;

  const { data: phoneRows } = await db
    .from("gerencia_phones")
    .select("gerencia_id,status,gerencias!inner(id,nombre,gerencia_id,user_id)")
    .eq("phone", phone)
    .eq("gerencias.user_id", userId);

  const candidates = (phoneRows ?? [])
    .map((row: Record<string, unknown>) => {
      const joined = Array.isArray(row.gerencias)
        ? row.gerencias[0]
        : row.gerencias;
      return {
        phoneGerenciaId: Number(row.gerencia_id),
        status: norm(row.status),
        gerencia: (joined ?? {}) as Record<string, unknown>,
      };
    })
    .filter((row) => Number.isFinite(row.phoneGerenciaId));

  if (candidates.length === 0) return empty;

  let assignedIds = new Set<number>();
  if (landingId) {
    const { data: assignments } = await db
      .from("landings_gerencias")
      .select("gerencia_id")
      .eq("landing_id", landingId);
    assignedIds = new Set(
      (assignments ?? [])
        .map((row: Record<string, unknown>) => Number(row.gerencia_id))
        .filter((id) => Number.isFinite(id)),
    );
  }

  const ranked = [...candidates].sort((a, b) => {
    const aLanding = assignedIds.has(a.phoneGerenciaId) ? 1 : 0;
    const bLanding = assignedIds.has(b.phoneGerenciaId) ? 1 : 0;
    if (aLanding !== bLanding) return bLanding - aLanding;
    const aActive = a.status === "active" ? 1 : 0;
    const bActive = b.status === "active" ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return a.phoneGerenciaId - b.phoneGerenciaId;
  });

  return buildGerenciaLabel(ranked[0].gerencia);
}

function snapshotPatch(
  snapshot: AssignedGerenciaSnapshot,
): Record<string, unknown> {
  if (!snapshot.assigned_gerencia_label) return {};
  return {
    assigned_gerencia_id: snapshot.assigned_gerencia_id,
    assigned_gerencia_external_id: snapshot.assigned_gerencia_external_id,
    assigned_gerencia_name: snapshot.assigned_gerencia_name,
    assigned_gerencia_label: snapshot.assigned_gerencia_label,
  };
}

function normalizeCoelsaId(v: unknown): string {
  return norm(v).replace(/\s+/g, "").toUpperCase().slice(0, 120);
}

function normalizeTransactionId(v: unknown): string {
  return norm(v).replace(/\s+/g, "").toUpperCase().slice(0, 120);
}

function purchaseDedupeIdsFromPayload(p: Params): string[] {
  return Array.from(
    new Set([
      normalizeCoelsaId(p.coelsa_id),
      normalizeTransactionId(p.transaction_id),
    ].filter(Boolean)),
  );
}

function emptyEventGerenciaSnapshot(
  agencyId: unknown,
  botPhone: unknown,
  status = "unresolved",
): EventGerenciaSnapshot {
  return {
    gerencia_id: null,
    gerencia_external_id: null,
    gerencia_name: "",
    gerencia_label: "",
    workspace_currency: "",
    bot_phone: sanitizePhone(botPhone),
    agency_id: norm(agencyId),
    resolution_status: status,
  };
}

function eventSnapshotFromGerencia(
  row: Record<string, unknown>,
  agencyId: unknown,
  botPhone: unknown,
  status: string,
): EventGerenciaSnapshot {
  const snapshot = buildGerenciaLabel(row);
  const workspaceCurrency = norm(row.workspace_currency).toUpperCase();
  return {
    gerencia_id: snapshot.assigned_gerencia_id,
    gerencia_external_id: snapshot.assigned_gerencia_external_id,
    gerencia_name: snapshot.assigned_gerencia_name,
    gerencia_label: snapshot.assigned_gerencia_label,
    workspace_currency:
      workspaceCurrency === "ARS" || workspaceCurrency === "PYG"
        ? workspaceCurrency
        : "",
    bot_phone: sanitizePhone(botPhone),
    agency_id: norm(agencyId),
    resolution_status: status,
  };
}

async function resolveEventGerenciaSnapshot(
  db: SupabaseClient,
  userId: string,
  agencyIdValue: unknown,
  botPhoneValue: unknown,
): Promise<EventGerenciaSnapshot> {
  const agencyId = norm(agencyIdValue);
  const botPhone = sanitizePhone(botPhoneValue);
  const numericAgencyId = Number(agencyId);

  let agencyGerencia: Record<string, unknown> | null = null;
  if (agencyId && Number.isInteger(numericAgencyId) && numericAgencyId > 0) {
    const { data: candidates } = await db
      .from("gerencias")
      .select("id,nombre,gerencia_id,workspace_currency")
      .eq("user_id", userId)
      .eq("gerencia_id", numericAgencyId);
    const rows = (candidates ?? []) as Record<string, unknown>[];
    agencyGerencia = rows.find((row) =>
      Number(row.gerencia_id) === numericAgencyId
    ) ?? null;
  }

  let phoneGerencias: Array<{
    status: string;
    gerencia: Record<string, unknown>;
  }> = [];
  if (botPhone) {
    const { data: phoneRows } = await db
      .from("gerencia_phones")
      .select(
        "status,gerencias!inner(id,nombre,gerencia_id,workspace_currency,user_id)",
      )
      .eq("phone", botPhone)
      .eq("gerencias.user_id", userId);
    phoneGerencias = (phoneRows ?? []).map((row: Record<string, unknown>) => {
      const joined = Array.isArray(row.gerencias)
        ? row.gerencias[0]
        : row.gerencias;
      return {
        status: norm(row.status),
        gerencia: (joined ?? {}) as Record<string, unknown>,
      };
    });
  }

  if (agencyGerencia) {
    const agencyInternalId = Number(agencyGerencia.id);
    const phoneMatchesAgency = phoneGerencias.some(
      (candidate) => Number(candidate.gerencia.id) === agencyInternalId,
    );
    const status = !botPhone
      ? "agency_id"
      : phoneGerencias.length === 0
      ? "agency_id_bot_unmapped"
      : phoneMatchesAgency
      ? "agency_id_bot_confirmed"
      : "agency_id_bot_conflict";
    return eventSnapshotFromGerencia(
      agencyGerencia,
      agencyId,
      botPhone,
      status,
    );
  }

  const uniqueByInternalId = new Map<number, typeof phoneGerencias[number]>();
  for (const candidate of phoneGerencias) {
    const id = Number(candidate.gerencia.id);
    if (Number.isInteger(id) && id > 0) uniqueByInternalId.set(id, candidate);
  }
  const uniqueCandidates = Array.from(uniqueByInternalId.values());
  if (uniqueCandidates.length === 1) {
    return eventSnapshotFromGerencia(
      uniqueCandidates[0].gerencia,
      agencyId,
      botPhone,
      agencyId ? "bot_phone_agency_unresolved" : "bot_phone_unique",
    );
  }
  const activeCandidates = uniqueCandidates.filter((candidate) =>
    candidate.status === "active"
  );
  if (activeCandidates.length === 1) {
    return eventSnapshotFromGerencia(
      activeCandidates[0].gerencia,
      agencyId,
      botPhone,
      agencyId
        ? "bot_phone_active_agency_unresolved"
        : "bot_phone_active_unique",
    );
  }

  return emptyEventGerenciaSnapshot(
    agencyId,
    botPhone,
    uniqueCandidates.length > 1 ? "bot_phone_ambiguous" : "unresolved",
  );
}

function eventGerenciaPatch(
  stage: "lead" | "registration" | "purchase",
  snapshot: EventGerenciaSnapshot,
  incomingPromoCode: string,
  attributionStatus: string,
  attributionConversionId?: string | null,
): Record<string, unknown> {
  return {
    [`${stage}_bot_phone`]: snapshot.bot_phone,
    [`${stage}_agency_id`]: snapshot.agency_id,
    [`${stage}_gerencia_id`]: snapshot.gerencia_id,
    [`${stage}_gerencia_external_id`]: snapshot.gerencia_external_id,
    [`${stage}_gerencia_name`]: snapshot.gerencia_name,
    [`${stage}_gerencia_label`]: snapshot.gerencia_label,
    [`${stage}_incoming_promo_code`]: incomingPromoCode,
    [`${stage}_attribution_status`]:
      `${attributionStatus}|gerencia:${snapshot.resolution_status}`,
    [`${stage}_attribution_conversion_id`]: attributionConversionId ?? null,
  };
}

function promoJourneyGerenciaId(
  row: ConversionRow | null | undefined,
): number | null {
  if (!row) return null;
  if (hasContactContext(row)) {
    const assigned = Number(row.assigned_gerencia_id);
    if (Number.isInteger(assigned) && assigned > 0) return assigned;
  }
  const lead = Number(row.lead_gerencia_id);
  if (Number.isInteger(lead) && lead > 0) return lead;
  const purchase = Number(row.purchase_gerencia_id);
  if (Number.isInteger(purchase) && purchase > 0) return purchase;
  const assigned = Number(row.assigned_gerencia_id);
  return Number.isInteger(assigned) && assigned > 0 ? assigned : null;
}

function rowBelongsToGerencia(row: ConversionRow, gerenciaId: number): boolean {
  return [
    row.purchase_gerencia_id,
    row.lead_gerencia_id,
    row.assigned_gerencia_id,
  ].some((value) => Number(value) === gerenciaId);
}

function rowIsTrustedLineageForGerencia(
  row: ConversionRow,
  gerenciaId: number,
): boolean {
  if (!rowBelongsToGerencia(row, gerenciaId)) return false;
  const assignedId = Number(row.assigned_gerencia_id);
  if (
    Number.isInteger(assignedId) &&
    assignedId > 0 &&
    assignedId !== gerenciaId
  ) {
    return false;
  }
  return hasContactContext(row) ||
    Boolean(norm(row.pixel_attribution_conversion_id)) ||
    Boolean(
      norm(row.pixel_attribution_source) &&
        norm(row.pixel_id || row.meta_pixel_id),
    );
}

async function findLatestRowForEventGerencia(
  db: SupabaseClient,
  userId: string,
  phone: string,
  gerenciaId: number | null,
  stage: "lead" | "purchase",
): Promise<ConversionRow | null> {
  let query = db
    .from("conversions")
    .select("*")
    .eq("user_id", userId)
    .eq("phone", phone)
    .eq("estado", stage)
    .order("created_at", { ascending: false })
    .limit(100);
  if (gerenciaId) {
    query = query.or(
      `${stage}_gerencia_id.eq.${gerenciaId},assigned_gerencia_id.eq.${gerenciaId}`,
    );
  }
  const { data } = await query;
  const rows = (data ?? []) as ConversionRow[];
  if (!gerenciaId) return rows[0] ?? null;
  return rows.find((row) => {
    const eventId = Number(
      stage === "lead" ? row.lead_gerencia_id : row.purchase_gerencia_id,
    );
    const assignedId = Number(row.assigned_gerencia_id);
    return eventId === gerenciaId ||
      (!(Number.isInteger(eventId) && eventId > 0) &&
        assignedId === gerenciaId);
  }) ?? null;
}

async function findLatestTrustedGerenciaLineage(
  db: SupabaseClient,
  userId: string,
  phone: string,
  gerenciaId: number | null,
): Promise<ConversionRow | null> {
  if (!gerenciaId) return null;
  const { data } = await db
    .from("conversions")
    .select("*")
    .eq("user_id", userId)
    .eq("phone", phone)
    .or(
      `purchase_gerencia_id.eq.${gerenciaId},lead_gerencia_id.eq.${gerenciaId},assigned_gerencia_id.eq.${gerenciaId}`,
    )
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as ConversionRow[]).find(
    (row) => rowIsTrustedLineageForGerencia(row, gerenciaId),
  ) ?? null;
}

function leadHasTrustedPromo(row: ConversionRow | null | undefined): boolean {
  if (!row || !isFullPromoCode(row.promo_code)) return false;
  const status = norm(row.lead_attribution_status);
  return hasContactContext(row) && !status.includes("conflict");
}

function purchaseIdempotencyKeysFromPayload(p: Params): string[] {
  const strongIds = purchaseDedupeIdsFromPayload(p);
  // The same opaque payment identifier is intentionally equivalent whether
  // an emitter labels it coelsa_id or transaction_id.
  const keys = strongIds.map((id) => `payment:${id}`);
  const actionEventId = norm(
    p.action_event_id || p.purchase_event_id || p.event_id,
  );
  if (actionEventId) {
    // action_event_id is a stable receipt/event identity supplied by the bot.
    // It remains an alias of the same payment even when Coelsa/transaction are
    // also present or the latest promo_code later changes.
    keys.push(actionEventIdempotencyKey(actionEventId));
  }
  return Array.from(new Set(keys.filter(Boolean)));
}

async function claimPurchaseEvent(
  db: SupabaseClient,
  userId: string,
  p: Params,
): Promise<PurchaseEventClaim> {
  const candidateEventId = generateEventId();
  const protectedBy = purchaseIdempotencyKeysFromPayload(p);
  if (protectedBy.length === 0) {
    return {
      claimed: true,
      claimId: "",
      eventId: candidateEventId,
      conversionId: "",
      status: "unprotected",
      protectedBy,
    };
  }

  const { data, error } = await db.rpc("claim_purchase_event", {
    p_user_id: userId,
    p_idempotency_keys: protectedBy,
    p_candidate_event_id: candidateEventId,
  });
  if (error) {
    throw new Error(
      `No se pudo reservar atomicamente el Purchase: ${error.message}`,
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | null;
  if (!row?.event_id) {
    throw new Error("La reserva atomica de Purchase no devolvio event_id");
  }

  return {
    claimed: row.claimed === true,
    claimId: norm(row.claim_id),
    eventId: norm(row.event_id),
    conversionId: norm(row.conversion_id),
    status: norm(row.claim_status),
    protectedBy,
  };
}

async function completePurchaseEventClaim(
  db: SupabaseClient,
  ctx: ProcessingContext,
  status: InboundStatus,
): Promise<void> {
  if (!ctx.purchaseClaimId) return;
  const { error } = await db.rpc("complete_purchase_event_claim", {
    p_claim_id: ctx.purchaseClaimId,
    p_conversion_id: ctx.conversionId || null,
    p_status: status,
  });
  if (error) {
    // Do not turn an already successful Meta response into an HTTP failure.
    // A stale claim can be reclaimed after five minutes with the same event_id.
    console.error("[completePurchaseEventClaim]", error.message, {
      claim_id: ctx.purchaseClaimId,
      conversion_id: ctx.conversionId,
      status,
    });
  }
}

async function traceUnprotectedPurchase(
  db: SupabaseClient,
  userId: string,
  rowId: string,
  p: Params,
  claim: PurchaseEventClaim,
): Promise<void> {
  if (claim.status !== "unprotected" || claim.protectedBy.length > 0) return;

  const { data: current } = await db
    .from("conversions")
    .select("observaciones")
    .eq("id", rowId)
    .single();
  const observaciones = appendObservation(
    norm(current?.observaciones),
    PURCHASE_UNPROTECTED_OBSERVATION,
  );
  const { error: updateError } = await db
    .from("conversions")
    .update({ observaciones })
    .eq("id", rowId);

  await writeLog(
    db,
    userId,
    "claimPurchaseEvent",
    "WARN",
    "Purchase procesado sin identificador estable",
    JSON.stringify({
      row_id: rowId,
      generated_event_id: claim.eventId,
      source_platform: norm(p.source_platform),
      accepted_identifiers: [
        "coelsa_id",
        "transaction_id",
        "action_event_id",
        "purchase_event_id",
        "event_id",
      ],
      observation_persisted: !updateError,
      observation_error: updateError?.message ?? "",
    }),
    rowId,
    undefined,
    undefined,
    safePayloadRaw(p),
    PURCHASE_UNPROTECTED_OBSERVATION,
  );
}

function normalizePromoCode(v: unknown): string {
  const s = norm(v);
  if (!s) return "";
  const lower = s.toLowerCase();
  if (
    lower === "null" ||
    lower === "undefined" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "na" ||
    s === "-"
  ) return "";
  return s;
}

function isFullPromoCode(v: unknown): boolean {
  const s = norm(v);
  // Flexible expected format: TAG-<alphanumeric suffix>
  // (no hard dependency on fixed suffix length like 12)
  return /^[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(s);
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

function deriveNameFromPayload(p: Params): { fn: string; ln: string } {
  const explicitFn = norm(p.fn);
  const explicitLn = norm(p.ln);
  if (explicitFn || explicitLn) {
    return { fn: explicitFn, ln: explicitLn };
  }

  const fullName = norm(p.full_name);
  if (!fullName) return { fn: "", ln: "" };

  // Preferred format: "Apellido, Nombre"
  if (fullName.includes(",")) {
    const [left, ...rest] = fullName.split(",");
    const ln = norm(left);
    const fn = norm(rest.join(","));
    return { fn, ln };
  }

  // Fallback format: "Nombre(s) Apellido(s)" -> last token as ln.
  const parts = fullName.split(/\s+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { fn: parts[0], ln: "" };
  }

  const ln = parts[parts.length - 1];
  const fn = parts.slice(0, -1).join(" ");
  return { fn, ln };
}

function safePayloadRaw(payload: Params): string {
  try {
    return JSON.stringify(payload).slice(0, 4000);
  } catch {
    return "";
  }
}

function payloadHasExplicitPixel(rawPayload: unknown): boolean {
  const raw = String(rawPayload ?? "").trim();
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw) as Params;
    return Boolean(norm(payload.meta_pixel_id || payload.pixel_id));
  } catch {
    return false;
  }
}

function hasContactContext(row: ConversionRow | null | undefined): boolean {
  if (!row) return false;
  return Boolean(norm(row.contact_event_id) || norm(row.contact_payload_raw));
}

function hasExplicitPixelPayloadContext(
  row: ConversionRow | null | undefined,
): boolean {
  if (!row) return false;
  return (
    payloadHasExplicitPixel(row.contact_payload_raw) ||
    payloadHasExplicitPixel(row.lead_payload_raw) ||
    payloadHasExplicitPixel(row.purchase_payload_raw)
  );
}

function hasTrustedStoredPixelContext(
  row: ConversionRow | null | undefined,
): boolean {
  if (!row) return false;
  return (
    hasContactContext(row) ||
    hasExplicitPixelPayloadContext(row) ||
    norm(row.source_platform).toLowerCase() === "chatrace"
  );
}

function clearUntrustedStoredPixel(row: ConversionRow): ConversionRow {
  const storedPixel = norm(row.pixel_id || row.meta_pixel_id);
  if (!storedPixel || hasTrustedStoredPixelContext(row)) return row;
  return { ...row, meta_pixel_id: "", pixel_id: "" };
}

function configuredPixelIds(
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
): string[] {
  return Array.from(
    new Set(
      [config.pixel_id, ...pixelConfigs.map((pixel) => pixel.pixel_id)]
        .map(norm)
        .filter(Boolean),
    ),
  );
}

async function resolveAndPersistPurchasePixel(
  db: SupabaseClient,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  row: ConversionRow,
  rowId: string,
  input: {
    inboundPixelId?: unknown;
    promoCode?: unknown;
    landingId?: unknown;
  },
): Promise<
  { row: ConversionRow; attribution: PurchasePixelAttribution | null }
> {
  const attribution = await resolvePurchasePixelAttribution(db, {
    userId: row.user_id,
    inboundPixelId: input.inboundPixelId,
    currentRow: row,
    promoCode: input.promoCode ?? row.promo_code,
    landingId: input.landingId ?? row.landing_id,
    configuredPixelIds: configuredPixelIds(config, pixelConfigs),
  });

  if (!attribution) {
    return {
      row: clearUntrustedStoredPixel(row),
      attribution: null,
    };
  }

  const attributedRow: ConversionRow = {
    ...row,
    pixel_id: attribution.pixelId,
    meta_pixel_id: attribution.pixelId,
    pixel_attribution_source: attribution.source,
    pixel_attribution_conversion_id: attribution.sourceConversionId,
  };

  await db
    .from("conversions")
    .update({
      pixel_id: attribution.pixelId,
      meta_pixel_id: attribution.pixelId,
      pixel_attribution_source: attribution.source,
      pixel_attribution_conversion_id: attribution.sourceConversionId,
    })
    .eq("id", rowId);

  await writeLog(
    db,
    row.user_id,
    "resolvePurchasePixelAttribution",
    "INFO",
    "Pixel Purchase resuelto",
    JSON.stringify({
      pixel_id: attribution.pixelId,
      source: attribution.source,
      source_conversion_id: attribution.sourceConversionId,
      promo_code: norm(input.promoCode ?? row.promo_code),
      landing_id: norm(input.landingId ?? row.landing_id),
    }),
    rowId,
  );

  return { row: attributedRow, attribution };
}

function ensurePayloadEventTime(
  payload: Params,
  receivedEventTime: number,
): Params {
  const next = { ...payload };
  const currentEventTime = Number(next.event_time);
  if (!Number.isFinite(currentEventTime) || currentEventTime <= 0) {
    next.event_time = receivedEventTime;
  }
  return next;
}

function sanitizePhone(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function sanitizeEmail(v: unknown): string {
  const email = norm(v).toLowerCase();
  if (!email || email.length > 254) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) return "";
  return email;
}

function isPlausibleInternationalPhone(digits: string): boolean {
  return /^\d{10,15}$/.test(digits);
}

function sanitizeContactPhone(
  v: unknown,
  rawCountryCallingCode: unknown,
): string {
  let digits = sanitizePhone(v);
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);

  const countryCallingCode = sanitizePhone(rawCountryCallingCode);
  if (
    countryCallingCode &&
    digits.startsWith(countryCallingCode) &&
    isPlausibleInternationalPhone(digits)
  ) {
    return digits;
  }

  let national = digits.replace(/^0+/, "");
  if (countryCallingCode === "54") {
    national = national.replace(/^15/, "");
    return national.length === 10 ? `54${national}` : "";
  }
  if (countryCallingCode === "595") {
    return national.length === 9 ? `595${national}` : "";
  }

  return isPlausibleInternationalPhone(digits) ? digits : "";
}

function sanitizeCuitCuil(v: unknown): string {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 11 ? digits.slice(0, 11) : digits;
}

function deriveCuitCuilFromPayload(p: Params): string {
  return sanitizeCuitCuil(
    p.cuit_cuil ??
      p.cuitCuil ??
      p.cuit ??
      p.cuil ??
      p["cuit/cuil"],
  );
}

function normalizeNameKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const first = raw.split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z'-]/g, "");
}

function inferSexFromCuitPrefix(
  cuitCuil: string,
): "male" | "female" | "unknown" {
  const digits = sanitizeCuitCuil(cuitCuil);
  const prefix = digits.slice(0, 2);
  if (prefix === "27") return "female";
  if (prefix === "20" || prefix === "23") return "male";
  return "unknown";
}

async function inferSexByNameCatalog(
  db: SupabaseClient,
  firstName: string,
): Promise<"male" | "female" | "unknown"> {
  const nameKey = normalizeNameKey(firstName);
  if (!nameKey) return "unknown";
  const { data, error } = await db
    .from("ar_name_inferred_sex")
    .select("inferred_sex")
    .eq("name_key", nameKey)
    .maybeSingle();
  if (error || !data?.inferred_sex) return "unknown";
  const sx = norm(data.inferred_sex).toLowerCase();
  if (sx === "m") return "male";
  if (sx === "f") return "female";
  return "unknown";
}

async function ensureSexOnRow(
  db: SupabaseClient,
  rowId: string,
  cuitCuil: string,
  firstName: string,
): Promise<void> {
  const fromCuit = inferSexFromCuitPrefix(cuitCuil);
  if (fromCuit !== "unknown") {
    await db
      .from("conversions")
      .update({ inferred_sex: fromCuit, sex_source: "cuit_cuil" })
      .eq("id", rowId);
    return;
  }

  const byName = await inferSexByNameCatalog(db, firstName);
  if (byName !== "unknown") {
    await db
      .from("conversions")
      .update({ inferred_sex: byName, sex_source: "name_catalog" })
      .eq("id", rowId);
    return;
  }

  await db
    .from("conversions")
    .update({ inferred_sex: "unknown", sex_source: "unknown" })
    .eq("id", rowId);
}

function sanitizeIp(v: unknown): string {
  let ip = String(v ?? "").trim();
  if (!ip) return "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  // Strip brackets and IPv6 zone-id if present.
  ip = ip.replace(/^\[|\]$/g, "");
  ip = ip.replace(/%.+$/, "");
  // IPv4 with port (e.g. 1.2.3.4:5678) -> keep only host.
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(":")[0];
  }
  ip = ip.replace(/[^\dA-Fa-f:.]/g, "");
  return ip;
}

function derivePromoCodeFromPayload(p: Params): string {
  return normalizePromoCode(p.promo_code ?? p.promoCode);
}

function isValidPublicIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) {
    return false;
  }
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isLikelyPublicIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (!lower.includes(":")) return false;
  if (!/^[0-9a-f:]+$/.test(lower)) return false;
  if (lower === "::" || lower === "::1") return false;
  if (
    lower.startsWith("fc") || lower.startsWith("fd") ||
    lower.startsWith("fe80:")
  ) return false;
  if (lower.startsWith("ff")) return false;
  if (lower.startsWith("2001:db8:")) return false;
  return lower.includes("::") || lower.split(":").filter(Boolean).length >= 3;
}

function normalizePublicClientIp(rawIp: unknown): string {
  let ip = sanitizeIp(rawIp);
  if (!ip) return "";
  if (!ip.includes(".") && !ip.includes(":") && ip.length === 12) {
    ip = ip.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, "$1.$2.$3.$4");
  }
  if (
    !ip.includes(".") && !ip.includes(":") && ip.length >= 8 && ip.length <= 11
  ) {
    const m = ip.match(/\d{1,3}/g);
    if (m) ip = m.join(".");
  }
  if (ip.includes(".") && isValidPublicIpv4(ip)) return ip;
  if (ip.includes(":") && isLikelyPublicIpv6(ip)) return ip;
  return "";
}

function isPrivateOrReservedIp(ip: string): boolean {
  return !normalizePublicClientIp(ip);
}

function payloadClientIp(p: Params): string {
  for (const candidate of inboundClientIpCandidates(p)) {
    const normalized = normalizePublicClientIp(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>>
    0;
}

function ipv4MatchesCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split("/");
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const ipNumber = ipv4ToUint32(ip);
  const networkNumber = ipv4ToUint32(network);
  if (ipNumber == null || networkNumber == null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((ipNumber & mask) >>> 0) === ((networkNumber & mask) >>> 0);
}

function detectMetaCrawlerContact(row: ConversionRow): MetaCrawlerMatch {
  const userAgent = norm(row.agent_user).toLowerCase();
  const matchedUserAgentToken =
    META_CRAWLER_USER_AGENT_TOKENS.find((token) => userAgent.includes(token)) ??
      "";
  if (matchedUserAgentToken) {
    return {
      matched: true,
      reason: "meta_crawler_user_agent",
      clientIp: normalizePublicClientIp(row.client_ip),
      matchedCidr: "",
      matchedUserAgentToken,
    };
  }

  const clientIp = normalizePublicClientIp(row.client_ip);
  const matchedCidr = clientIp.includes(".")
    ? (META_INFRASTRUCTURE_IPV4_CIDRS.find((cidr) =>
      ipv4MatchesCidr(clientIp, cidr)
    ) ?? "")
    : "";

  if (matchedCidr) {
    return {
      matched: true,
      reason: "meta_infrastructure_ip",
      clientIp,
      matchedCidr,
      matchedUserAgentToken: "",
    };
  }

  return {
    matched: false,
    reason: "",
    clientIp,
    matchedCidr: "",
    matchedUserAgentToken: "",
  };
}

function normalizeIpToMeta(rawIp: string): Record<string, string> {
  const ip = normalizePublicClientIp(rawIp);
  if (!ip) return {};
  return { client_ip_address: ip };
}

function generateEventId(): string {
  return sharedGenerateEventId();
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function appendObservation(current: string, token: string): string {
  const clean = token.trim();
  if (!clean) return current;
  const cur = current.trim();
  if (!cur) return clean;
  const parts = cur.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.includes(clean)) return cur;
  parts.push(clean);
  return parts.join(" | ");
}

function textResponse(msg: string, status = 200): Response {
  return new Response(msg, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/plain" },
  });
}

async function insertInboundEvent(
  db: SupabaseClient,
  userId: string,
  landingName: string,
  action: string,
  payload: Params,
): Promise<string | null> {
  const normalizedAction = canonicalInboundAction(action) || "CONTACT";
  const actionEventId = normalizedAction === "CONTACT"
    ? norm(
      payload.action_event_id || payload.contact_event_id || payload.event_id,
    )
    : norm(payload.action_event_id);
  const { data } = await db
    .from("conversion_inbox")
    .insert({
      user_id: userId,
      landing_name: landingName,
      action: normalizedAction,
      action_event_id: actionEventId,
      coelsa_id: normalizeCoelsaId(payload.coelsa_id),
      transaction_id: normalizeTransactionId(payload.transaction_id),
      promo_code: normalizePromoCode(payload.promo_code ?? payload.promoCode),
      phone: sanitizePhone(payload.phone),
      payload_raw: safePayloadRaw(payload),
      status: "received",
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

async function findPurchaseByDedupeIds(
  db: SupabaseClient,
  userId: string,
  dedupeIds: string[],
): Promise<{ id: string; purchase_event_id: string; estado: string } | null> {
  const ids = Array.from(
    new Set(dedupeIds.map((id) => norm(id)).filter(Boolean)),
  );
  if (ids.length === 0) return null;

  const [byCoelsa, byTransaction] = await Promise.all([
    db
      .from("conversions")
      .select("id, purchase_event_id, estado")
      .eq("user_id", userId)
      .in("purchase_coelsa_id", ids)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("conversions")
      .select("id, purchase_event_id, estado")
      .eq("user_id", userId)
      .in("purchase_transaction_id", ids)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const data = byCoelsa.data ?? byTransaction.data;
  return (data as
    | { id: string; purchase_event_id: string; estado: string }
    | null) ?? null;
}

async function findInboundByActionEventId(
  db: SupabaseClient,
  userId: string,
  action: string,
  actionEventId: string,
): Promise<
  | {
    id: string;
    status: InboundStatus;
    http_status: number | null;
    response_body: string;
    promo_code: string | null;
  }
  | null
> {
  if (!actionEventId) return null;
  const { data } = await db
    .from("conversion_inbox")
    .select("id, status, http_status, response_body, promo_code")
    .eq("user_id", userId)
    .eq("action", action)
    .eq("action_event_id", actionEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as
    | {
      id: string;
      status: InboundStatus;
      http_status: number | null;
      response_body: string;
      promo_code: string | null;
    }
    | null) ?? null;
}

async function findInboundByActionEventIdAndPromo(
  db: SupabaseClient,
  userId: string,
  action: string,
  actionEventId: string,
  promoCode: string,
): Promise<
  | {
    id: string;
    status: InboundStatus;
    http_status: number | null;
    response_body: string;
    promo_code: string | null;
  }
  | null
> {
  if (!actionEventId || !promoCode) return null;
  const { data } = await db
    .from("conversion_inbox")
    .select("id, status, http_status, response_body, promo_code")
    .eq("user_id", userId)
    .eq("action", action)
    .eq("action_event_id", actionEventId)
    .eq("promo_code", promoCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as
    | {
      id: string;
      status: InboundStatus;
      http_status: number | null;
      response_body: string;
      promo_code: string | null;
    }
    | null) ?? null;
}

async function finalizeInboundEvent(
  db: SupabaseClient,
  inboxId: string | null,
  status: InboundStatus,
  httpStatus: number,
  responseBody: string,
  conversionId?: string,
  promoCode?: string,
): Promise<void> {
  if (!inboxId) return;
  const updates: Record<string, unknown> = {
    status,
    http_status: httpStatus,
    response_body: (responseBody ?? "").slice(0, 4000),
    conversion_id: conversionId ?? null,
    processed_at: new Date().toISOString(),
  };
  if (isFullPromoCode(promoCode)) {
    updates.promo_code = promoCode;
  }
  await db.from("conversion_inbox").update(updates).eq("id", inboxId);
}

async function findDeferredLeadInboundByPhone(
  db: SupabaseClient,
  userId: string,
  phone: string,
  agencyId?: string,
  botPhone?: string,
): Promise<{ id: string; created_at: string } | null> {
  if (!phone) return null;
  const { data } = await db
    .from("conversion_inbox")
    .select("id, created_at, payload_raw")
    .eq("user_id", userId)
    .eq("action", "LEAD")
    .eq("status", "deferred")
    .eq("phone", phone)
    .order("created_at", { ascending: true })
    .limit(20);
  const candidates = (data ?? []) as Array<{
    id: string;
    created_at: string;
    payload_raw?: string | null;
  }>;
  const cleanAgencyId = norm(agencyId);
  const cleanBotPhone = sanitizePhone(botPhone);
  if (!cleanAgencyId && !cleanBotPhone) return candidates[0] ?? null;

  for (const candidate of candidates) {
    let payload: Params = {};
    try {
      payload = JSON.parse(norm(candidate.payload_raw) || "{}") as Params;
    } catch {
      continue;
    }
    const candidateAgencyId = norm(payload.agency_id);
    const candidateBotPhone = sanitizePhone(payload.bot_phone);
    if (
      (cleanAgencyId && candidateAgencyId &&
        cleanAgencyId === candidateAgencyId) ||
      (cleanBotPhone && candidateBotPhone &&
        cleanBotPhone === candidateBotPhone)
    ) {
      return { id: candidate.id, created_at: candidate.created_at };
    }
  }
  return null;
}

async function writeLog(
  db: SupabaseClient,
  userId: string,
  fn: string,
  level: string,
  message: string,
  detail: string = "",
  conversionId?: string,
  payloadMeta?: string,
  responseMeta?: string,
  payloadReceived?: string,
  result?: string,
): Promise<boolean> {
  const maxAttempts = 3;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await db.from("conversion_logs").insert({
        user_id: userId,
        conversion_id: conversionId ?? null,
        function_name: fn,
        level,
        message,
        detail: detail.slice(0, 4000),
        payload_received: (payloadReceived ?? "").slice(0, 20000),
        result: (result ?? detail ?? "").slice(0, 4000),
        payload_meta: (payloadMeta ?? "").slice(0, 20000),
        response_meta: (responseMeta ?? "").slice(0, 20000),
      });
      return true;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 120 * attempt));
      }
    }
  }
  console.error("[writeLog] failed after retries", {
    function_name: fn,
    level,
    message,
    conversion_id: conversionId ?? null,
    error: String(lastError),
  });
  return false;
}

async function lookupGeoByIp(rawIp: string): Promise<GeoResult | null> {
  const ip = sanitizeIp(rawIp);
  if (!ip || isPrivateOrReservedIp(ip)) return null;
  const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "landing-builder-capi/1.0",
        Accept: "application/json",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;
    const city = norm(json.city);
    const region = norm(json.region || json.region_name);
    const countryName = norm(json.country_name || json.country);
    const zip = norm(json.postal || json.zip);
    return {
      geo_city: city,
      geo_region: region,
      geo_country: countryName,
      ct: city,
      st: region,
      country: countryName,
      zip,
    };
  } catch {
    return null;
  }
}

function resolveGeoForPayload(p: Params): GeoResult {
  return {
    geo_city: norm(p.geo_city || p.ct),
    geo_region: norm(p.geo_region || p.st),
    geo_country: norm(p.geo_country || p.country),
    ct: norm(p.ct || p.geo_city),
    st: norm(p.st || p.geo_region),
    country: norm(p.country || p.geo_country),
    zip: norm(p.zip),
  };
}

function hasPayloadGeo(geo: GeoResult): boolean {
  return Boolean(
    geo.ct || geo.st || geo.country || geo.zip || geo.geo_city ||
      geo.geo_region || geo.geo_country,
  );
}

function normalizeArNationalDigits(phone: string): string {
  let d = sanitizePhone(phone);
  if (!d) return "";
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  return d;
}

function sanitizeLocalidadFromPhonePrefix(raw: unknown): string {
  const base = norm(raw);
  if (!base) return "";
  // Ej: "SAN MARTIN (PROV. MENDOZA)" -> "SAN MARTIN"
  const noParens = base.replace(/\s*\([^)]*\)/g, "");
  return noParens.replace(/\s{2,}/g, " ").trim();
}

async function lookupGeoByPhonePrefix(
  db: SupabaseClient,
  rawPhone: string,
): Promise<GeoResult | null> {
  const national = normalizeArNationalDigits(rawPhone);
  if (!national || national.length < 2) return null;

  const prefixes: string[] = [];
  for (let len = 2; len <= 5; len++) {
    if (national.length >= len) prefixes.push(national.slice(0, len));
  }
  if (!prefixes.length) return null;

  const { data, error } = await db
    .from("ar_phone_area_codes")
    .select("codigo_de_area, localidad, provincia, zip_exacto, zip_aproximado")
    .in("codigo_de_area", prefixes);

  if (error || !data || data.length === 0) return null;

  const picked = [...data]
    .map((r) => ({
      codigo_de_area: norm((r as Record<string, unknown>).codigo_de_area),
      localidad: sanitizeLocalidadFromPhonePrefix(
        (r as Record<string, unknown>).localidad,
      ),
      provincia: norm((r as Record<string, unknown>).provincia),
      zip_exacto: norm((r as Record<string, unknown>).zip_exacto),
      zip_aproximado: norm((r as Record<string, unknown>).zip_aproximado),
    }))
    .sort((a, b) => b.codigo_de_area.length - a.codigo_de_area.length)[0];

  if (!picked?.codigo_de_area) return null;

  const city = picked.localidad;
  const region = picked.provincia;
  const zip = picked.zip_exacto || picked.zip_aproximado;
  return {
    geo_city: city,
    geo_region: region,
    geo_country: "Argentina",
    ct: city,
    st: region,
    country: "Argentina",
    zip,
  };
}

async function ensureGeoOnRow(
  db: SupabaseClient,
  rowId: string,
  phone: string,
  clientIp: string,
  currentGeo: {
    ct: string;
    st: string;
    country: string;
    zip: string;
    geo_city: string;
    geo_region: string;
    geo_country: string;
  },
  currentGeoSource: string,
  config: ConversionsConfig,
): Promise<void> {
  const sourceNow = norm(currentGeoSource).toLowerCase();
  if (sourceNow === "payload") return;

  const needsGeo = config.geo_fill_only_when_missing
    ? (!currentGeo.geo_city || !currentGeo.geo_region ||
      !currentGeo.geo_country || !currentGeo.ct || !currentGeo.st ||
      !currentGeo.country)
    : true;
  if (!needsGeo) return;

  if (config.geo_use_ipapi) {
    const ip = sanitizeIp(clientIp);
    if (ip && !isPrivateOrReservedIp(ip)) {
      const looked = await lookupGeoByIp(ip);
      if (looked) {
        const finalGeo = config.geo_fill_only_when_missing
          ? {
            geo_city: currentGeo.geo_city || looked.geo_city,
            geo_region: currentGeo.geo_region || looked.geo_region,
            geo_country: currentGeo.geo_country || looked.geo_country,
            ct: currentGeo.ct || looked.ct,
            st: currentGeo.st || looked.st,
            country: currentGeo.country || looked.country,
            zip: currentGeo.zip || looked.zip,
            geo_source: "ip",
          }
          : {
            geo_city: looked.geo_city || currentGeo.geo_city,
            geo_region: looked.geo_region || currentGeo.geo_region,
            geo_country: looked.geo_country || currentGeo.geo_country,
            ct: looked.ct || currentGeo.ct,
            st: looked.st || currentGeo.st,
            country: looked.country || currentGeo.country,
            zip: looked.zip || currentGeo.zip,
            geo_source: "ip",
          };
        await db.from("conversions").update(finalGeo).eq("id", rowId);
        return;
      }
    }
  }

  const byPhone = await lookupGeoByPhonePrefix(db, phone);
  if (!byPhone) {
    if (!sourceNow) {
      await db.from("conversions").update({ geo_source: "none" }).eq(
        "id",
        rowId,
      );
    }
    return;
  }

  const finalGeo = config.geo_fill_only_when_missing
    ? {
      geo_city: currentGeo.geo_city || byPhone.geo_city,
      geo_region: currentGeo.geo_region || byPhone.geo_region,
      geo_country: currentGeo.geo_country || byPhone.geo_country,
      ct: currentGeo.ct || byPhone.ct,
      st: currentGeo.st || byPhone.st,
      country: currentGeo.country || byPhone.country,
      zip: currentGeo.zip || byPhone.zip,
      geo_source: "phone_prefix",
    }
    : {
      geo_city: byPhone.geo_city || currentGeo.geo_city,
      geo_region: byPhone.geo_region || currentGeo.geo_region,
      geo_country: byPhone.geo_country || currentGeo.geo_country,
      ct: byPhone.ct || currentGeo.ct,
      st: byPhone.st || currentGeo.st,
      country: byPhone.country || currentGeo.country,
      zip: byPhone.zip || currentGeo.zip,
      geo_source: "phone_prefix",
    };
  await db.from("conversions").update(finalGeo).eq("id", rowId);
}

function resolveEffectiveConfigForPixel(
  baseConfig: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  preferredPixelId?: string,
): ConversionsConfig {
  const preferred = norm(preferredPixelId);
  const byPixel = preferred
    ? pixelConfigs.find((pc) => norm(pc.pixel_id) === preferred)
    : null;
  const byDefault = pixelConfigs.find((pc) => pc.is_default);
  const picked = byPixel ?? byDefault ?? null;
  if (!picked) return baseConfig;
  const legacyPurchaseEnabled = picked.send_purchase_capi !== false;

  return {
    ...baseConfig,
    pixel_id: norm(picked.pixel_id) || baseConfig.pixel_id,
    meta_access_token: norm(picked.meta_access_token) ||
      baseConfig.meta_access_token,
    meta_currency: norm(picked.meta_currency) || baseConfig.meta_currency,
    meta_api_version: norm(picked.meta_api_version) ||
      baseConfig.meta_api_version,
    send_contact_capi: Boolean(picked.send_contact_capi),
    send_lead_capi: picked.send_lead_capi !== false,
    send_complete_registration_capi:
      picked.send_complete_registration_capi === true,
    meta_ads_only_capi: Boolean(picked.meta_ads_only_capi),
    include_purchase_type_capi: picked.include_purchase_type_capi !== false,
    send_first_purchase_capi: picked.send_first_purchase_capi ??
      legacyPurchaseEnabled,
    send_repeat_purchase_capi: picked.send_repeat_purchase_capi ??
      legacyPurchaseEnabled,
    send_purchase_capi: legacyPurchaseEnabled,
    send_geo_capi: picked.send_geo_capi !== false,
    geo_use_ipapi: Boolean(picked.geo_use_ipapi),
    geo_fill_only_when_missing: Boolean(picked.geo_fill_only_when_missing),
  };
}

function resolveCurrencyForPixel(
  baseConfig: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  pixelId?: string,
  fallbackCurrency: unknown = "ARS",
  options: { preferFallbackWithoutPixel?: boolean } = {},
): string {
  const preferredPixel = norm(pixelId);
  const matchedPixel = preferredPixel
    ? pixelConfigs.find((pixel) => norm(pixel.pixel_id) === preferredPixel)
    : null;
  if (matchedPixel) {
    return normalizeCurrencyCode(
      matchedPixel.meta_currency,
      fallbackCurrency,
    );
  }

  const normalizedFallback = String(fallbackCurrency ?? "").trim()
    .toUpperCase();
  if (preferredPixel && normalizedFallback) {
    return normalizeCurrencyCode(normalizedFallback, baseConfig.meta_currency);
  }
  if (
    !preferredPixel && normalizedFallback && options.preferFallbackWithoutPixel
  ) {
    return normalizeCurrencyCode(normalizedFallback, baseConfig.meta_currency);
  }

  const defaultPixel = pixelConfigs.find((pixel) => pixel.is_default);
  return normalizeCurrencyCode(
    defaultPixel?.meta_currency ?? baseConfig.meta_currency,
    fallbackCurrency,
  );
}

function resolvePurchaseType(
  row: Pick<ConversionRow, "purchase_type">,
  customData?: Record<string, unknown>,
): "first" | "repeat" {
  return customData?.purchase_type === "repeat" ||
      row.purchase_type === "repeat"
    ? "repeat"
    : "first";
}

async function resolveChatraceCapiConfig(
  db: SupabaseClient,
  userId: string,
): Promise<ChatraceCapiConfig | null> {
  const { data } = await db
    .from("chatrace_client_configs")
    .select(
      "active, send_meta_capi_events, send_business_messaging_purchase_capi, whatsapp_business_account_id, meta_messaging_dataset_id, meta_messaging_access_token, meta_pixel_id",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data ? data as ChatraceCapiConfig : null;
}

async function sendToMetaCAPI(
  db: SupabaseClient,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  row: ConversionRow,
  rowId: string,
  eventName: "Contact" | "Lead" | "CompleteRegistration" | "Purchase",
  eventId: string,
  eventTime: number,
  customData?: Record<string, unknown>,
  overrideTestEventCode?: string,
  options: {
    allowPixelFallback?: boolean;
    pixelFallbackDisabledReason?: string;
  } = {},
): Promise<boolean> {
  const sourcePlatform = normalizedSourcePlatform(row.source_platform);
  const isChatrace = sourcePlatform === "chatrace";
  const chatraceConfig = isChatrace
    ? await resolveChatraceCapiConfig(db, row.user_id)
    : null;
  const rowPixel = norm(row.pixel_id || row.meta_pixel_id);
  const chatracePixelId = isChatrace && !rowPixel
    ? norm(chatraceConfig?.meta_pixel_id)
    : "";
  const preferredPixelId = rowPixel || chatracePixelId;
  const allowPixelFallback = options.allowPixelFallback !== false;
  const effectiveConfig = preferredPixelId || allowPixelFallback
    ? resolveEffectiveConfigForPixel(config, pixelConfigs, preferredPixelId)
    : { ...config, pixel_id: "" };
  const defaultPixel = norm(pixelConfigs.find((pc) => pc.is_default)?.pixel_id);
  const statusField = eventName === "Contact"
    ? "contact_status_capi"
    : eventName === "Lead"
    ? "lead_status_capi"
    : eventName === "CompleteRegistration"
    ? "registration_status_capi"
    : "purchase_status_capi";
  const retryableField = eventName === "Contact"
    ? "contact_capi_retryable"
    : eventName === "Lead"
    ? "lead_capi_retryable"
    : "";
  const purchaseType = eventName === "Purchase"
    ? resolvePurchaseType(row, customData)
    : null;

  const okMsg = eventName === "Contact"
    ? "CONTACT OK"
    : eventName === "Lead"
    ? "LEAD OK"
    : eventName === "CompleteRegistration"
    ? "COMPLETEREGISTRATION OK"
    : purchaseType === "repeat"
    ? "PURCHASE REPEAT OK"
    : "PURCHASE OK";

  const errMsg = eventName === "Contact"
    ? "ERROR CONTACT"
    : eventName === "Lead"
    ? "ERROR LEAD"
    : eventName === "CompleteRegistration"
    ? "ERROR COMPLETEREGISTRATION"
    : "ERROR PURCHASE";

  if (eventName === "Contact") {
    const metaCrawlerMatch = detectMetaCrawlerContact(row);
    if (metaCrawlerMatch.matched) {
      const { data: current } = await db.from("conversions").select(
        "observaciones",
      ).eq("id", rowId).single();
      const obs = appendObservation(
        current?.observaciones ?? "",
        META_CRAWLER_CONTACT_OBSERVATION,
      );
      const updates: Record<string, unknown> = {
        [statusField]: META_CRAWLER_CONTACT_STATUS,
        observaciones: obs,
      };
      if (retryableField) updates[retryableField] = false;
      await db.from("conversions").update(updates).eq("id", rowId);
      await writeLog(
        db,
        row.user_id,
        "sendToMetaCAPI",
        "INFO",
        "Contact CAPI omitido por crawler de Meta",
        JSON.stringify({
          event_name: eventName,
          row_id: rowId,
          event_id: eventId,
          source_platform: sourcePlatform,
          reason: metaCrawlerMatch.reason,
          client_ip: metaCrawlerMatch.clientIp,
          matched_cidr: metaCrawlerMatch.matchedCidr,
          matched_user_agent_token: metaCrawlerMatch.matchedUserAgentToken,
          user_agent: row.agent_user,
          geo_country: row.geo_country || row.country,
          geo_region: row.geo_region || row.st,
          geo_city: row.geo_city || row.ct,
        }),
        rowId,
        undefined,
        undefined,
        row.contact_payload_raw,
        "Contact CAPI omitido por crawler de Meta",
      );
      return true;
    }
  }

  if (
    isChatrace &&
    (chatraceConfig?.active === false ||
      chatraceConfig?.send_meta_capi_events === false)
  ) {
    const skippedMsg =
      `${eventName.toUpperCase()} CAPI OMITIDO CHATRACE DESACTIVADO`;
    const { data: current } = await db.from("conversions").select(
      "observaciones",
    ).eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", skippedMsg);
    const updates: Record<string, unknown> = {
      [statusField]: "skipped_chatrace_capi_disabled",
      observaciones: obs,
    };
    if (retryableField) updates[retryableField] = false;
    await db.from("conversions").update(updates).eq("id", rowId);
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "INFO",
      "Meta CAPI omitido por config Chatrace",
      JSON.stringify({
        event_name: eventName,
        source_platform: row.source_platform,
      }),
      rowId,
      undefined,
      undefined,
      undefined,
      "Meta CAPI Chatrace desactivado",
    );
    return true;
  }

  let purchaseCapiRoute: "" | "website" | "business_messaging" =
    row.purchase_capi_route === "website" ||
      row.purchase_capi_route === "business_messaging"
      ? row.purchase_capi_route
      : "";
  let purchaseCapiRouteReason = norm(row.purchase_capi_route_reason);
  const ctwaClid = normalizeCtwaClid(row.ctwa_clid);
  const businessMessagingConfigured = Boolean(
    norm(chatraceConfig?.whatsapp_business_account_id) &&
      norm(chatraceConfig?.meta_messaging_dataset_id) &&
      norm(chatraceConfig?.meta_messaging_access_token),
  );

  if (eventName === "Purchase" && !purchaseCapiRoute) {
    const decision = resolvePurchaseCapiRoute({
      source_platform: sourcePlatform,
      business_messaging_enabled:
        chatraceConfig?.send_business_messaging_purchase_capi === true,
      business_messaging_configured: businessMessagingConfigured,
      ctwa_clid: ctwaClid,
    });
    purchaseCapiRoute = decision.route;
    purchaseCapiRouteReason = decision.reason;

    await db.from("conversions").update({
      purchase_capi_route: purchaseCapiRoute,
      purchase_capi_route_reason: purchaseCapiRouteReason,
    }).eq("id", rowId);
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "INFO",
      "Ruta Purchase CAPI fijada",
      JSON.stringify({
        route: purchaseCapiRoute,
        reason: purchaseCapiRouteReason,
        source_platform: sourcePlatform,
        has_ctwa_clid: Boolean(ctwaClid),
        business_messaging_enabled:
          chatraceConfig?.send_business_messaging_purchase_capi === true,
        business_messaging_configured: businessMessagingConfigured,
      }),
      rowId,
    );
  }
  const useBusinessMessaging = eventName === "Purchase" &&
    purchaseCapiRoute === "business_messaging";
  if (shouldSkipCapiForNonMetaOrigin(effectiveConfig, row)) {
    const skippedMsg =
      `${eventName.toUpperCase()} CAPI OMITIDO ORIGEN NO META ADS`;
    const { data: current } = await db
      .from("conversions")
      .select("observaciones")
      .eq("id", rowId)
      .single();
    const obs = appendObservation(current?.observaciones ?? "", skippedMsg);
    const updates: Record<string, unknown> = {
      [statusField]: "skipped_not_meta_ads",
      observaciones: obs,
    };
    if (retryableField) updates[retryableField] = false;
    await db.from("conversions").update(updates).eq("id", rowId);
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "INFO",
      "Meta CAPI omitido por politica de origen",
      JSON.stringify({
        event_name: eventName,
        row_id: rowId,
        from_meta_ads: row.from_meta_ads === true,
        pixel_id: effectiveConfig.pixel_id,
      }),
      rowId,
      undefined,
      undefined,
      eventName === "Contact"
        ? row.contact_payload_raw
        : eventName === "Lead"
        ? row.lead_payload_raw
        : eventName === "CompleteRegistration"
        ? row.registration_payload_raw
        : row.purchase_payload_raw,
      skippedMsg,
    );
    return true;
  }
  if (!useBusinessMessaging && !preferredPixelId && !allowPixelFallback) {
    const skippedMsg = eventName === "Contact"
      ? "CONTACT CAPI OMITIDO SIN PIXEL CONFIABLE"
      : eventName === "Lead"
      ? "LEAD CAPI OMITIDO SIN PIXEL CONFIABLE"
      : eventName === "CompleteRegistration"
      ? "COMPLETEREGISTRATION CAPI OMITIDO SIN PIXEL CONFIABLE"
      : "PURCHASE CAPI OMITIDO SIN PIXEL CONFIABLE";
    const { data: current } = await db.from("conversions").select(
      "observaciones",
    ).eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", skippedMsg);
    const updates: Record<string, unknown> = {
      [statusField]: "skipped_no_trusted_pixel",
      observaciones: obs,
    };
    if (retryableField) updates[retryableField] = false;
    await db.from("conversions").update(updates).eq("id", rowId);
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "WARN",
      "Meta CAPI omitido: pixel fallback deshabilitado",
      JSON.stringify({
        event_name: eventName,
        row_id: rowId,
        reason: options.pixelFallbackDisabledReason ||
          "pixel_fallback_disabled",
        source_platform: sourcePlatform,
      }),
      rowId,
    );
    return true;
  }
  const purchaseCapiDecision = eventName === "Purchase" && purchaseType !== null
    ? resolvePurchaseCapiDecision(
      useBusinessMessaging
        ? { ...effectiveConfig, include_purchase_type_capi: true }
        : effectiveConfig,
      purchaseType,
    )
    : null;
  const eventDisabledByPixelConfig =
    (eventName === "Lead" && effectiveConfig.send_lead_capi === false) ||
    (
      eventName === "CompleteRegistration" &&
      effectiveConfig.send_complete_registration_capi !== true
    ) ||
    (
      eventName === "Purchase" &&
      purchaseCapiDecision !== null &&
      !purchaseCapiDecision.enabled
    );
  if (eventDisabledByPixelConfig) {
    const skippedMsg = eventName === "Lead"
      ? "LEAD CAPI OMITIDO CONFIG DESACTIVADA"
      : eventName === "CompleteRegistration"
      ? "COMPLETEREGISTRATION CAPI OMITIDO CONFIG DESACTIVADA"
      : purchaseCapiDecision?.reason === "purchase_disabled"
      ? "PURCHASE CAPI OMITIDO CONFIG DESACTIVADA"
      : `${
        purchaseType === "repeat" ? "REPEAT" : "FIRST"
      } PURCHASE CAPI OMITIDO CONFIG DESACTIVADA`;
    const skippedStatus = eventName === "Lead"
      ? "skipped_lead_capi_disabled"
      : eventName === "CompleteRegistration"
      ? "skipped_registration_capi_disabled"
      : purchaseCapiDecision?.reason === "purchase_disabled"
      ? "skipped_purchase_capi_disabled"
      : purchaseType === "repeat"
      ? "skipped_repeat_purchase_capi_disabled"
      : "skipped_first_purchase_capi_disabled";
    const { data: current } = await db.from("conversions").select(
      "observaciones",
    ).eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", skippedMsg);
    const updates: Record<string, unknown> = {
      [statusField]: skippedStatus,
      observaciones: obs,
    };
    if (retryableField) updates[retryableField] = false;
    await db.from("conversions").update(updates).eq("id", rowId);
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "INFO",
      "Meta CAPI omitido por config del pixel",
      JSON.stringify({
        event_name: eventName,
        row_id: rowId,
        pixel_id: effectiveConfig.pixel_id,
        source_platform: sourcePlatform,
        purchase_type: purchaseType,
        purchase_capi_mode: purchaseCapiDecision?.includePurchaseType
          ? "segmented"
          : "standard",
        reason: purchaseCapiDecision?.reason,
      }),
      rowId,
      undefined,
      undefined,
      eventName === "Lead"
        ? row.lead_payload_raw
        : eventName === "CompleteRegistration"
        ? row.registration_payload_raw
        : row.purchase_payload_raw,
      skippedMsg,
    );
    return true;
  }

  if (
    !useBusinessMessaging &&
    allowPixelFallback &&
    !rowPixel &&
    !chatracePixelId &&
    norm(effectiveConfig.pixel_id)
  ) {
    const resolvedFallbackPixel = norm(effectiveConfig.pixel_id);
    const fallbackSource =
      defaultPixel && norm(effectiveConfig.pixel_id) === defaultPixel
        ? "default"
        : "base_config";

    // Trazabilidad: para LEAD/REGISTRATION/PURCHASE persistimos el pixel usado por fallback.
    if (
      (eventName === "Lead" ||
        eventName === "CompleteRegistration" ||
        eventName === "Purchase") &&
      resolvedFallbackPixel
    ) {
      await db
        .from("conversions")
        .update({
          meta_pixel_id: resolvedFallbackPixel,
          pixel_id: resolvedFallbackPixel,
        })
        .eq("id", rowId);
    }

    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "INFO",
      "Pixel resuelto por fallback",
      JSON.stringify({
        event_name: eventName,
        row_id: rowId,
        fallback_source: fallbackSource,
        selected_pixel_id: resolvedFallbackPixel,
      }),
      rowId,
      undefined,
      undefined,
      undefined,
      `pixel por fallback (${fallbackSource}: ${resolvedFallbackPixel})`,
    );
  }

  if (isEventTimeTooOldForMetaCapi(eventTime)) {
    const skippedMsg =
      `${eventName.toUpperCase()} CAPI OMITIDO EVENT_TIME ANTIGUO`;
    const { data: current } = await db.from("conversions").select(
      "observaciones",
    ).eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", skippedMsg);
    const updates: Record<string, unknown> = {
      [statusField]: "skipped_old_event_time",
      observaciones: obs,
    };
    if (retryableField) updates[retryableField] = false;
    await db.from("conversions").update(updates).eq("id", rowId);
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "WARN",
      "Meta CAPI omitido por event_time mayor a 7 dias",
      JSON.stringify({
        event_name: eventName,
        row_id: rowId,
        event_id: eventId,
        event_time: eventTime,
        max_age_seconds: META_CAPI_MAX_EVENT_AGE_SECONDS,
      }),
      rowId,
    );
    return true;
  }

  const missingBusinessMessagingConfig = useBusinessMessaging &&
    (
      !ctwaClid ||
      !norm(chatraceConfig?.whatsapp_business_account_id) ||
      !norm(chatraceConfig?.meta_messaging_dataset_id) ||
      !norm(chatraceConfig?.meta_messaging_access_token)
    );
  const missingWebsiteConfig = !useBusinessMessaging &&
    (!effectiveConfig.meta_access_token || !effectiveConfig.pixel_id);
  if (missingBusinessMessagingConfig || missingWebsiteConfig) {
    const missingCfgMsg = eventName === "Contact"
      ? "ERROR CONTACT NO CONFIG"
      : eventName === "Lead"
      ? "ERROR LEAD NO CONFIG"
      : eventName === "CompleteRegistration"
      ? "ERROR COMPLETEREGISTRATION NO CONFIG"
      : "ERROR PURCHASE NO CONFIG";
    const { data: current } = await db.from("conversions").select(
      "observaciones",
    ).eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", missingCfgMsg);
    const updates: Record<string, unknown> = {
      [statusField]: "error",
      observaciones: obs,
    };
    if (retryableField) updates[retryableField] = false;
    await db.from("conversions").update(updates).eq("id", rowId);
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "ERROR",
      "Meta CAPI no configurado",
      JSON.stringify({
        route: useBusinessMessaging ? "business_messaging" : "website",
        has_token: useBusinessMessaging
          ? Boolean(norm(chatraceConfig?.meta_messaging_access_token))
          : !!effectiveConfig.meta_access_token,
        has_destination: useBusinessMessaging
          ? Boolean(norm(chatraceConfig?.meta_messaging_dataset_id))
          : !!effectiveConfig.pixel_id,
        has_waba: Boolean(norm(chatraceConfig?.whatsapp_business_account_id)),
        has_ctwa_clid: Boolean(ctwaClid),
        event_name: eventName,
        row_pixel_id: row.pixel_id ?? "",
      }),
      rowId,
    );
    return false;
  }

  const canonicalCustomData = eventName === "Purchase"
    ? {
      ...(customData ?? {}),
      currency: normalizeCurrencyCode(
        row.currency,
        customData?.currency ?? effectiveConfig.meta_currency,
      ),
    }
    : customData;
  const metaCustomData =
    eventName === "Purchase" && canonicalCustomData && purchaseCapiDecision &&
      !useBusinessMessaging
      ? preparePurchaseCustomDataForMeta(
        canonicalCustomData,
        purchaseCapiDecision.includePurchaseType,
      )
      : canonicalCustomData;

  if (eventName === "Purchase") {
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "INFO",
      "Modo payload Purchase CAPI",
      JSON.stringify({
        route: useBusinessMessaging ? "business_messaging" : "website",
        payload_mode: useBusinessMessaging
          ? "business_messaging_standard"
          : purchaseCapiDecision?.includePurchaseType
          ? "segmented"
          : "standard",
        purchase_type_internal: purchaseType,
        currency: canonicalCustomData?.currency,
        purchase_type_sent: Boolean(
          metaCustomData &&
            Object.prototype.hasOwnProperty.call(
              metaCustomData,
              "purchase_type",
            ),
        ),
      }),
      rowId,
    );
  }

  const metaRequest = useBusinessMessaging
    ? buildMetaBusinessMessagingPurchaseRequest(
      {
        dataset_id: norm(chatraceConfig?.meta_messaging_dataset_id),
        whatsapp_business_account_id: norm(
          chatraceConfig?.whatsapp_business_account_id,
        ),
        meta_access_token: norm(chatraceConfig?.meta_messaging_access_token),
        meta_api_version: effectiveConfig.meta_api_version,
        meta_currency: normalizeCurrencyCode(
          canonicalCustomData?.currency,
          effectiveConfig.meta_currency,
        ),
      },
      ctwaClid,
      eventTime,
      Number(canonicalCustomData?.value ?? row.valor),
    )
    : await buildMetaRequest(
      effectiveConfig as unknown as SharedConversionsConfig,
      row as unknown as SharedConversionRow,
      eventName,
      eventId,
      eventTime,
      metaCustomData as Record<string, unknown> | undefined,
      overrideTestEventCode || norm(row.test_event_code) || undefined,
    );
  const { apiUrl, body } = metaRequest;

  const maxAttempts = 3;
  const baseDelayMs = 500;
  const metaPayloadRaw = JSON.stringify(body);

  const persistError = async (
    detail: string,
    responseRaw = "",
    retryable = false,
  ) => {
    const { data: current } = await db.from("conversions").select(
      "observaciones",
    ).eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", errMsg);
    const updates: Record<string, unknown> = {
      [statusField]: "error",
      observaciones: obs,
    };
    if (retryableField) updates[retryableField] = retryable;
    await db.from("conversions").update(updates).eq("id", rowId);
    await writeLog(
      db,
      row.user_id,
      "sendToMetaCAPI",
      "ERROR",
      "Meta CAPI fallo",
      detail,
      rowId,
      metaPayloadRaw,
      responseRaw,
    );
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        META_CAPI_FETCH_TIMEOUT_MS,
      );
      const res = await (async () => {
        try {
          return await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      })();

      const resText = await res.text();
      const isTransientHttp = res.status === 429 || res.status === 408 ||
        res.status >= 500;

      if (res.status === 200) {
        let responseJson: Record<string, unknown> | null = null;
        try {
          responseJson = resText
            ? JSON.parse(resText) as Record<string, unknown>
            : null;
        } catch {
          responseJson = null;
        }

        const hasErrorObject =
          !!(responseJson && typeof responseJson === "object" &&
            "error" in responseJson);
        const eventsReceivedRaw =
          responseJson && typeof responseJson === "object"
            ? (responseJson as Record<string, unknown>).events_received
            : undefined;
        const eventsReceived = typeof eventsReceivedRaw === "number"
          ? eventsReceivedRaw
          : Number(eventsReceivedRaw);
        const hasZeroEventsReceived = Number.isFinite(eventsReceived) &&
          eventsReceived <= 0;

        if (hasErrorObject || hasZeroEventsReceived) {
          await persistError(
            `HTTP 200 inconsistente (attempt ${attempt}/${maxAttempts}): ${resText}`,
            resText,
            false,
          );
          return false;
        }

        const { data: current } = await db.from("conversions").select(
          "observaciones",
        ).eq("id", rowId).single();
        const obs = appendObservation(current?.observaciones ?? "", okMsg);
        const updates: Record<string, unknown> = {
          [statusField]: "enviado",
          observaciones: obs,
        };
        if (retryableField) updates[retryableField] = false;
        await db.from("conversions").update(updates).eq("id", rowId);
        const primaryLogOk = await writeLog(
          db,
          row.user_id,
          "sendToMetaCAPI",
          "INFO",
          "Meta CAPI respuesta",
          `HTTP 200 (attempt ${attempt}/${maxAttempts})`,
          rowId,
          metaPayloadRaw,
          resText,
        );
        if (!primaryLogOk) {
          const backupOk = await writeLog(
            db,
            row.user_id,
            "sendToMetaCAPI",
            "WARN",
            "Meta CAPI OK sin log primario",
            JSON.stringify({
              event_name: eventName,
              row_id: rowId,
              event_id: eventId,
              note:
                "status enviado confirmado, fallo persistencia del log primario",
            }),
            rowId,
          );
          if (!backupOk) {
            console.error(
              "[sendToMetaCAPI] status enviado pero sin logs persistidos",
              {
                row_id: rowId,
                event_name: eventName,
                event_id: eventId,
              },
            );
          }
        }
        if (attempt > 1) {
          await writeLog(
            db,
            row.user_id,
            "sendToMetaCAPI",
            "INFO",
            "Meta CAPI recuperado tras reintento",
            JSON.stringify({ eventName, eventId, attempt }),
            rowId,
          );
        }
        return true;
      }

      if (!isTransientHttp || attempt === maxAttempts) {
        await persistError(
          `HTTP ${res.status} (attempt ${attempt}/${maxAttempts}): ${resText}`,
          resText,
          isTransientHttp,
        );
        return false;
      }

      await writeLog(
        db,
        row.user_id,
        "sendToMetaCAPI",
        "DEBUG",
        "Reintentando Meta CAPI por error transitorio",
        JSON.stringify({
          eventName,
          eventId,
          status: res.status,
          attempt,
          maxAttempts,
        }),
        rowId,
      );
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    } catch (e) {
      const errorName = e instanceof Error ? e.name : "";
      const errorDetail = errorName === "AbortError"
        ? `Timeout Meta CAPI luego de ${META_CAPI_FETCH_TIMEOUT_MS}ms`
        : String(e);
      if (attempt === maxAttempts) {
        await persistError(
          `Excepcion en llamada Meta (attempt ${attempt}/${maxAttempts}): ${errorDetail}`,
          "",
          true,
        );
        return false;
      }
      await writeLog(
        db,
        row.user_id,
        "sendToMetaCAPI",
        "DEBUG",
        "Reintentando Meta CAPI por excepcion transitoria",
        JSON.stringify({
          eventName,
          eventId,
          attempt,
          maxAttempts,
          error: errorDetail,
        }),
        rowId,
      );
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }

  await persistError("Fallo desconocido luego de agotar reintentos", "", true);
  return false;
}

async function deriveEventSourceUrl(
  db: SupabaseClient,
  landingName: string,
  payloadUrl?: string,
): Promise<string> {
  if (payloadUrl) return payloadUrl;
  const { data } = await db.from("settings").select("url_base").eq("id", 1)
    .maybeSingle();
  const base = (data?.url_base ?? "").replace(/\/$/, "");
  return base ? `${base}/${landingName}` : "";
}

async function findExistingContactDuplicate(
  db: SupabaseClient,
  userId: string,
  contactEventId: string,
  promoCode: string,
): Promise<ContactDuplicateMatch | null> {
  if (contactEventId) {
    const { data: existingByEventId } = await db
      .from("conversions")
      .select("id")
      .eq("user_id", userId)
      .eq("contact_event_id", contactEventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingByEventId?.id) {
      return { id: existingByEventId.id, reason: "contact_event_id" };
    }
  }

  if (promoCode) {
    const { data: existingByPromoCode } = await db
      .from("conversions")
      .select("id")
      .eq("user_id", userId)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingByPromoCode?.id) {
      return { id: existingByPromoCode.id, reason: "promo_code" };
    }
  }

  return null;
}

async function ignoreContactDuplicate(
  db: SupabaseClient,
  userId: string,
  duplicate: ContactDuplicateMatch,
  payloadRaw: string,
  ctx?: ProcessingContext,
  detail?: Record<string, unknown>,
): Promise<Response> {
  const byEventId = duplicate.reason === "contact_event_id";
  await writeLog(
    db,
    userId,
    "handleContact",
    "INFO",
    byEventId
      ? "Duplicado CONTACT ignorado por contact_event_id"
      : "Duplicado CONTACT ignorado por promo_code",
    JSON.stringify({
      user_id: userId,
      existing_conversion_id: duplicate.id,
      dedupe_reason: duplicate.reason,
      ...(detail ?? {}),
    }),
    duplicate.id,
    undefined,
    undefined,
    payloadRaw,
    byEventId
      ? "duplicado ignorado por contact_event_id"
      : "duplicado ignorado por promo_code",
  );
  if (ctx) {
    ctx.conversionId = duplicate.id;
    ctx.inboxStatus = "deduplicated";
  }
  return textResponse(
    byEventId
      ? "Duplicado ignorado (contact_event_id ya procesado)"
      : "Duplicado ignorado (promo_code ya procesado)",
    200,
  );
}

async function ignoreLeadDuplicateByPromoCode(
  db: SupabaseClient,
  userId: string,
  conversionId: string,
  promoCode: string,
  payloadRaw: string,
  ctx?: ProcessingContext,
  detail?: Record<string, unknown>,
): Promise<Response> {
  await writeLog(
    db,
    userId,
    "handleLead",
    "INFO",
    "Duplicado LEAD ignorado por promo_code",
    JSON.stringify({
      user_id: userId,
      existing_conversion_id: conversionId,
      promo_code: promoCode,
      ...(detail ?? {}),
    }),
    conversionId,
    undefined,
    undefined,
    payloadRaw,
    "duplicado ignorado por promo_code",
  );
  if (ctx) {
    ctx.conversionId = conversionId;
    ctx.inboxStatus = "deduplicated";
    ctx.inboxPromoCode = promoCode;
  }
  return textResponse("Duplicado LEAD ignorado (promo_code ya procesado)", 200);
}

async function handleContact(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  ctx?: ProcessingContext,
): Promise<Response> {
  const nowIso = new Date().toISOString();
  const nowSec = Math.floor(Date.now() / 1000);
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);
  const inboundSourcePlatform = norm(p.source_platform);
  const inboundCtwaClid = ctwaClidForSource(p.ctwa_clid, inboundSourcePlatform);
  const inboundContactEventId = norm(p.contact_event_id || p.event_id);
  const inboundPromoCode = derivePromoCodeFromPayload(p);
  const payloadRaw = safePayloadRaw(p);
  const hasLeadCaptureForm = toBool(p.lead_capture_form);
  const formFn = hasLeadCaptureForm ? norm(p.form_fn ?? p.fn) : "";
  const formLn = hasLeadCaptureForm ? norm(p.form_ln ?? p.ln) : "";
  const formEmail = hasLeadCaptureForm
    ? sanitizeEmail(p.form_email ?? p.email)
    : "";
  const formPhone = hasLeadCaptureForm
    ? sanitizeContactPhone(p.form_phone ?? p.phone, p.phone_country_code)
    : "";

  const existingDuplicate = await findExistingContactDuplicate(
    db,
    landing.user_id,
    inboundContactEventId,
    inboundPromoCode,
  );
  if (existingDuplicate) {
    return ignoreContactDuplicate(
      db,
      landing.user_id,
      existingDuplicate,
      payloadRaw,
      ctx,
      {
        dedupe_source: "precheck",
        contact_event_id: inboundContactEventId,
        promo_code: inboundPromoCode,
      },
    );
  }

  const contactEventId = inboundContactEventId || generateEventId();
  const contactEventTime = toValidEventTime(
    p.contact_event_time || p.event_time || nowSec,
  );
  const testEventCode = norm(p.test_event_code);
  const geo = resolveGeoForPayload(p);
  const payloadGeoSource: GeoSource = hasPayloadGeo(geo) ? "payload" : "none";
  const eventSourceUrl = await deriveEventSourceUrl(
    db,
    landing.name,
    norm(p.event_source_url),
  );
  const payloadCuitCuil = deriveCuitCuilFromPayload(p);
  const assignedGerencia = await resolveAssignedGerenciaSnapshot(
    db,
    landing.user_id,
    p.telefono_asignado,
    landing.id,
  );

  const row: Omit<ConversionRow, "id"> = {
    landing_id: landing.id?.trim() || null,
    user_id: landing.user_id,
    landing_name: landing.name,
    phone: sanitizeContactPhone(p.phone, p.phone_country_code),
    email: sanitizeEmail(p.email),
    form_fn: formFn,
    form_ln: formLn,
    form_email: formEmail,
    form_phone: formPhone,
    cuit_cuil: payloadCuitCuil,
    fn: norm(p.fn),
    ln: norm(p.ln),
    ct: norm(geo.ct),
    st: norm(geo.st),
    zip: norm(geo.zip || p.zip),
    country: norm(geo.country),
    fbp: norm(p.fbp),
    fbc: norm(p.fbc),
    geo_source: payloadGeoSource,
    meta_pixel_id: inboundMetaPixelId,
    source_platform: inboundSourcePlatform || "",
    ctwa_clid: inboundCtwaClid,
    pixel_id: inboundMetaPixelId,
    contact_event_id: contactEventId,
    contact_event_time: contactEventTime,
    sendContactPixel: toBool(p.sendContactPixel),
    contact_payload_raw: payloadRaw,
    lead_event_id: "",
    lead_event_time: null,
    lead_payload_raw: "",
    purchase_event_id: "",
    purchase_event_time: null,
    purchase_payload_raw: "",
    test_event_code: testEventCode,
    client_ip: payloadClientIp(p),
    agent_user: inboundUserAgent(p),
    device_type: norm(p.device_type),
    event_source_url: eventSourceUrl,
    estado: "contact",
    valor: 0,
    currency: resolveCurrencyForPixel(
      config,
      pixelConfigs,
      inboundMetaPixelId,
    ),
    contact_status_capi: "",
    lead_status_capi: "",
    purchase_status_capi: "",
    observaciones: "",
    external_id: norm(p.external_id),
    utm_campaign: norm(p.utm_campaign),
    telefono_asignado: norm(p.telefono_asignado),
    ...snapshotPatch(assignedGerencia),
    promo_code: inboundPromoCode,
    geo_city: geo.geo_city,
    geo_region: geo.geo_region,
    geo_country: geo.geo_country,
  };

  const { data: inserted, error } = await db.from("conversions").insert(row)
    .select("id").single();
  if (error || !inserted) {
    if (error?.code === "23505") {
      const duplicateAfterConflict = await findExistingContactDuplicate(
        db,
        landing.user_id,
        inboundContactEventId,
        inboundPromoCode,
      );
      if (duplicateAfterConflict) {
        return ignoreContactDuplicate(
          db,
          landing.user_id,
          duplicateAfterConflict,
          payloadRaw,
          ctx,
          {
            dedupe_source: "unique_violation",
            contact_event_id: inboundContactEventId,
            promo_code: inboundPromoCode,
          },
        );
      }

      await writeLog(
        db,
        landing.user_id,
        "handleContact",
        "WARN",
        "CONTACT con unique violation sin fila recuperable",
        JSON.stringify({
          message: error.message,
          code: error.code,
          details: error.details,
          contact_event_id: inboundContactEventId,
          promo_code: inboundPromoCode,
        }),
        undefined,
        undefined,
        undefined,
        payloadRaw,
        "possible duplicate contact (unique violation)",
      );
      return textResponse("Duplicado ignorado (constraint unique)", 200);
    }

    const errDetail = error
      ? JSON.stringify({
        message: error.message,
        code: error.code,
        details: error.details,
      })
      : "sin error";
    await writeLog(
      db,
      landing.user_id,
      "handleContact",
      "ERROR",
      "Error al insertar contacto",
      errDetail,
      undefined,
      undefined,
      undefined,
      payloadRaw,
      "error al insertar contacto",
    );
    return textResponse(
      `Error al registrar contacto: ${error?.message ?? "unknown"}`,
      500,
    );
  }
  const rowId = inserted.id;
  if (ctx) ctx.conversionId = rowId;

  const effectiveConfig = resolveEffectiveConfigForPixel(
    config,
    pixelConfigs,
    row.pixel_id,
  );
  await ensureGeoOnRow(
    db,
    rowId,
    row.phone,
    row.client_ip,
    {
      ct: row.ct,
      st: row.st,
      country: row.country,
      zip: row.zip,
      geo_city: row.geo_city,
      geo_region: row.geo_region,
      geo_country: row.geo_country,
    },
    row.geo_source ?? "",
    effectiveConfig,
  );
  await ensureSexOnRow(db, rowId, row.cuit_cuil, row.fn);

  await writeLog(
    db,
    landing.user_id,
    "handleContact",
    "INFO",
    "Nuevo contacto registrado",
    JSON.stringify({
      phone: row.phone,
      landing: landing.name,
      contact_event_id: contactEventId,
    }),
    rowId,
    undefined,
    undefined,
    payloadRaw,
    "contacto registrado",
  );

  const ctaTapToRedirectMs = Number(p.cta_tap_to_redirect_ms);
  if (Number.isFinite(ctaTapToRedirectMs) && ctaTapToRedirectMs >= 0) {
    const latencyPayload = JSON.stringify({
      cta_tap_to_redirect_ms: Math.round(ctaTapToRedirectMs),
    });
    await writeLog(
      db,
      landing.user_id,
      "handleContact",
      "INFO",
      "CTA tap->redirect latency",
      latencyPayload,
      rowId,
      undefined,
      undefined,
      latencyPayload,
      "latency registrada",
    );
  }

  const shouldSendContactCapi = effectiveConfig.send_contact_capi;

  if (shouldSendContactCapi) {
    const { data: fresh } = await db.from("conversions").select("*").eq(
      "id",
      rowId,
    ).single();
    const fullRow = (fresh ?? row) as ConversionRow;
    await sendToMetaCAPI(
      db,
      effectiveConfig,
      pixelConfigs,
      fullRow,
      rowId,
      "Contact",
      contactEventId,
      contactEventTime,
      undefined,
      testEventCode || undefined,
    );
  } else {
    const skippedMsg = "CONTACT CAPI OMITIDO CONFIG DESACTIVADA";
    const { data: current } = await db
      .from("conversions")
      .select("observaciones")
      .eq("id", rowId)
      .single();
    await db
      .from("conversions")
      .update({
        contact_status_capi: "skipped_contact_capi_disabled",
        contact_capi_retryable: false,
        observaciones: appendObservation(
          current?.observaciones ?? "",
          skippedMsg,
        ),
      })
      .eq("id", rowId);
    await writeLog(
      db,
      landing.user_id,
      "handleContact",
      "INFO",
      "Contact CAPI omitido por config del pixel",
      JSON.stringify({
        contact_event_id: contactEventId,
        pixel_id: effectiveConfig.pixel_id,
      }),
      rowId,
      undefined,
      undefined,
      payloadRaw,
      skippedMsg,
    );
  }

  return textResponse("Success");
}

async function handleLead(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  ctx?: ProcessingContext,
): Promise<Response> {
  const TIMESTAMP_FALLBACK_WINDOW_SECONDS_BEFORE = 90;
  const TIMESTAMP_FALLBACK_WINDOW_SECONDS_AFTER = 30;
  const toEpochFromIso = (value: unknown): number | null => {
    const raw = norm(value);
    if (!raw) return null;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return Math.floor(ms / 1000);
  };

  const cleanPhone = sanitizePhone(p.phone);
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);
  const inboundSourcePlatform = norm(p.source_platform);
  const inboundCtwaClid = ctwaClidForSource(p.ctwa_clid, inboundSourcePlatform);
  const botPhone = sanitizePhone(p.bot_phone);
  const inboundAgencyId = norm(p.agency_id);
  const leadPlayerUsername = playerUsernameFromPayload(p);
  const inboundBotTimestampSec =
    toEpochFromIso((p as Record<string, unknown>).dateTime) ??
      toEpochFromIso((p as Record<string, unknown>).datetime);
  if (!cleanPhone) {
    await writeLog(
      db,
      landing.user_id,
      "handleLead",
      "ERROR",
      "LEAD rechazado: falta phone",
      safePayloadRaw(p),
      undefined,
      undefined,
      undefined,
      safePayloadRaw(p),
      "rechazado: falta phone",
    );
    return textResponse("Faltan parametros: phone requerido", 400);
  }
  const promoCode = derivePromoCodeFromPayload(p);
  const promoCodeIsFull = isFullPromoCode(
    p.promo_code ?? p.promoCode ?? promoCode,
  );
  const testEventCode = norm(p.test_event_code);
  const leadPayloadRaw = safePayloadRaw(p);

  const { fn: payloadFn, ln: payloadLn } = deriveNameFromPayload(p);
  const payloadEmail = sanitizeEmail(p.email);
  const payloadCuitCuil = deriveCuitCuilFromPayload(p);
  const eventSourceUrl = await deriveEventSourceUrl(
    db,
    landing.name,
    norm(p.event_source_url),
  );
  const geo = resolveGeoForPayload(p);
  const payloadGeoSource: GeoSource = hasPayloadGeo(geo) ? "payload" : "none";
  const eventGerencia = await resolveEventGerenciaSnapshot(
    db,
    landing.user_id,
    inboundAgencyId,
    botPhone,
  );

  // 1) Match by promo_code
  let targetId: string | null = null;
  let leadMatchMode:
    | "promo_code"
    | "bot_phone_timestamp_fallback"
    | "created_new" = "promo_code";
  let promoRow: ConversionRow | null = null;
  let promoCoherence: PromoGerenciaCoherence = "not_found";
  let leadAttributionStatus = "created_new";
  if (promoCodeIsFull) {
    const { data } = await db
      .from("conversions")
      .select("*")
      .eq("user_id", landing.user_id)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    promoRow = data as ConversionRow | null;
    promoCoherence = evaluatePromoGerenciaCoherence({
      promoFound: Boolean(promoRow?.id),
      promoPlayerPhone: promoRow?.phone,
      eventPlayerPhone: cleanPhone,
      promoGerenciaId: promoJourneyGerenciaId(promoRow),
      eventGerenciaId: eventGerencia.gerencia_id,
    });
    if (promoRow?.id && canUsePromoForJourney(promoCoherence)) {
      if (norm(promoRow.lead_event_id)) {
        return ignoreLeadDuplicateByPromoCode(
          db,
          landing.user_id,
          promoRow.id,
          promoCode,
          leadPayloadRaw,
          ctx,
          {
            dedupe_source: "precheck",
            action_event_id: norm(p.action_event_id),
            promo_coherence: promoCoherence,
            event_gerencia_id: eventGerencia.gerencia_id,
          },
        );
      }
      targetId = promoRow.id;
      leadAttributionStatus = `promo_${promoCoherence}`;
    } else if (
      promoCoherence === "gerencia_conflict" ||
      promoCoherence === "player_phone_conflict"
    ) {
      leadMatchMode = "created_new";
      leadAttributionStatus = `promo_${promoCoherence}`;
      await writeLog(
        db,
        landing.user_id,
        "handleLead",
        "WARN",
        "LEAD con promo_code incompatible con el bot receptor",
        JSON.stringify({
          promo_code: promoCode,
          promo_conversion_id: promoRow?.id ?? null,
          promo_gerencia_id: promoJourneyGerenciaId(promoRow),
          event_gerencia_id: eventGerencia.gerencia_id,
          agency_id: inboundAgencyId,
          bot_phone: botPhone,
          coherence: promoCoherence,
        }),
        promoRow?.id,
        undefined,
        undefined,
        leadPayloadRaw,
        "promo recibido conservado solo como trazabilidad; no se atribuye a esa fila",
      );
    } else if (promoCoherence === "not_found") {
      leadAttributionStatus = "promo_not_found";
    }
  }

  // 1.b) Fallback ONLY when promo_code is missing: bot_phone + dateTime window (for CONTACT -> LEAD linking).
  if (!targetId && !promoCodeIsFull) {
    if (botPhone && inboundBotTimestampSec) {
      const fromIso = new Date(
        (inboundBotTimestampSec - TIMESTAMP_FALLBACK_WINDOW_SECONDS_BEFORE) *
          1000,
      ).toISOString();
      const toIso = new Date(
        (inboundBotTimestampSec + TIMESTAMP_FALLBACK_WINDOW_SECONDS_AFTER) *
          1000,
      ).toISOString();
      const { data: candidates } = await db
        .from("conversions")
        .select("id, created_at")
        .eq("user_id", landing.user_id)
        .eq("estado", "contact")
        .eq("telefono_asignado", botPhone)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .limit(5);

      if ((candidates ?? []).length === 1) {
        targetId = candidates![0].id;
        leadMatchMode = "bot_phone_timestamp_fallback";
        leadAttributionStatus = "bot_phone_timestamp_fallback";
      } else if ((candidates ?? []).length > 1) {
        await writeLog(
          db,
          landing.user_id,
          "handleLead",
          "WARN",
          "LEAD no procesado: fallback bot_phone+dateTime ambiguo",
          JSON.stringify({
            bot_phone: botPhone,
            timestamp: inboundBotTimestampSec,
            window_seconds_before: TIMESTAMP_FALLBACK_WINDOW_SECONDS_BEFORE,
            window_seconds_after: TIMESTAMP_FALLBACK_WINDOW_SECONDS_AFTER,
            candidates: candidates?.map((c) => ({
              id: c.id,
              created_at: c.created_at,
            })) ?? [],
          }),
          undefined,
          undefined,
          undefined,
          safePayloadRaw(p),
          "fallback ambiguo (bot_phone+dateTime): se crea LEAD nuevo",
        );
        leadMatchMode = "created_new";
      }
    }

    if (!targetId) {
      await writeLog(
        db,
        landing.user_id,
        "handleLead",
        "ERROR",
        "LEAD sin promo_code valido y fallback bot_phone+dateTime sin match",
        JSON.stringify({
          promo_code: promoCode,
          bot_phone: botPhone,
          timestamp: inboundBotTimestampSec,
          window_seconds_before: TIMESTAMP_FALLBACK_WINDOW_SECONDS_BEFORE,
          window_seconds_after: TIMESTAMP_FALLBACK_WINDOW_SECONDS_AFTER,
        }),
        undefined,
        undefined,
        undefined,
        safePayloadRaw(p),
        "sin match por fallback dateTime: se crea LEAD nuevo",
      );
      leadMatchMode = "created_new";
    }
  }

  const leadEventId = generateEventId();
  const leadEventTime = toValidEventTime(
    p.lead_event_time || p.event_time || Math.floor(Date.now() / 1000),
  );
  const matchSourceToken = leadMatchMode === "promo_code"
    ? "match_source:promo_code"
    : leadMatchMode === "bot_phone_timestamp_fallback"
    ? "match_source:bot_phone_timestamp_fallback"
    : "match_source:created_new";
  const trustedLineage = !targetId
    ? await findLatestTrustedGerenciaLineage(
      db,
      landing.user_id,
      cleanPhone,
      eventGerencia.gerencia_id,
    )
    : null;
  const promoIsConflicting = promoCoherence === "gerencia_conflict" ||
    promoCoherence === "player_phone_conflict";

  // 2) No match -> create new LEAD row to avoid losing conversion
  if (!targetId) {
    const resolvedPixelId = inboundMetaPixelId ||
      norm(trustedLineage?.pixel_id || trustedLineage?.meta_pixel_id);
    const inboundExternalId = norm(p.external_id);
    const generatedExternalId = inboundExternalId ||
      norm(trustedLineage?.external_id) ||
      (cleanPhone ? await sha256(cleanPhone) : generateEventId());
    const assignedGerencia: AssignedGerenciaSnapshot = trustedLineage
      ? {
        assigned_gerencia_id: trustedLineage.assigned_gerencia_id ?? null,
        assigned_gerencia_external_id:
          trustedLineage.assigned_gerencia_external_id ?? null,
        assigned_gerencia_name: norm(trustedLineage.assigned_gerencia_name),
        assigned_gerencia_label: norm(trustedLineage.assigned_gerencia_label),
      }
      : await resolveAssignedGerenciaSnapshot(
        db,
        landing.user_id,
        p.telefono_asignado,
        landing.id,
      );
    const newRow: Omit<ConversionRow, "id"> = {
      landing_id: trustedLineage?.landing_id ?? (landing.id?.trim() || null),
      user_id: landing.user_id,
      landing_name: trustedLineage?.landing_name || landing.name,
      phone: cleanPhone,
      email: payloadEmail || trustedLineage?.email || "",
      form_fn: trustedLineage?.form_fn || "",
      form_ln: trustedLineage?.form_ln || "",
      form_email: trustedLineage?.form_email || "",
      form_phone: trustedLineage?.form_phone || "",
      cuit_cuil: payloadCuitCuil || trustedLineage?.cuit_cuil || "",
      fn: payloadFn || trustedLineage?.fn || "",
      ln: payloadLn || trustedLineage?.ln || "",
      ct: norm(geo.ct) || trustedLineage?.ct || "",
      st: norm(geo.st) || trustedLineage?.st || "",
      zip: norm(geo.zip || p.zip) || trustedLineage?.zip || "",
      country: norm(geo.country) || trustedLineage?.country || "",
      fbp: norm(p.fbp) || trustedLineage?.fbp || "",
      fbc: norm(p.fbc) || trustedLineage?.fbc || "",
      from_meta_ads: trustedLineage?.from_meta_ads ?? false,
      geo_source: payloadGeoSource !== "none"
        ? payloadGeoSource
        : (norm(trustedLineage?.geo_source) || "none"),
      meta_pixel_id: resolvedPixelId,
      pixel_attribution_source: trustedLineage ? "stored_attribution" : "",
      pixel_attribution_conversion_id: trustedLineage?.id ?? null,
      source_platform: inboundSourcePlatform || "",
      ctwa_clid: inboundCtwaClid || trustedLineage?.ctwa_clid || "",
      pixel_id: resolvedPixelId,
      contact_event_id: "",
      contact_event_time: null,
      sendContactPixel: false,
      contact_payload_raw: "",
      lead_event_id: leadEventId,
      lead_event_time: leadEventTime,
      lead_payload_raw: leadPayloadRaw,
      lead_player_username: leadPlayerUsername,
      purchase_event_id: "",
      purchase_event_time: null,
      purchase_payload_raw: "",
      test_event_code: testEventCode,
      client_ip: payloadClientIp(p) || trustedLineage?.client_ip || "",
      agent_user: inboundUserAgent(p) || trustedLineage?.agent_user || "",
      device_type: norm(p.device_type) || trustedLineage?.device_type || "",
      event_source_url: eventSourceUrl || trustedLineage?.event_source_url ||
        "",
      estado: "lead",
      valor: 0,
      currency: resolveCurrencyForPixel(
        config,
        pixelConfigs,
        resolvedPixelId,
      ),
      contact_status_capi: "",
      lead_status_capi: "",
      purchase_status_capi: "",
      observaciones: appendObservation(
        matchSourceToken,
        promoIsConflicting ? `promo_conflict:${promoCoherence}` : "",
      ),
      external_id: generatedExternalId,
      utm_campaign: norm(p.utm_campaign) || trustedLineage?.utm_campaign || "",
      telefono_asignado: norm(p.telefono_asignado) ||
        trustedLineage?.telefono_asignado || "",
      ...snapshotPatch(assignedGerencia),
      ...eventGerenciaPatch(
        "lead",
        eventGerencia,
        promoCode,
        leadAttributionStatus,
        trustedLineage?.id ?? null,
      ),
      promo_code: promoIsConflicting ? "" : promoCode,
      geo_city: geo.geo_city || trustedLineage?.geo_city || "",
      geo_region: geo.geo_region || trustedLineage?.geo_region || "",
      geo_country: geo.geo_country || trustedLineage?.geo_country || "",
    };

    const { data: inserted, error: insertError } = await db
      .from("conversions")
      .insert(newRow)
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      if (insertError?.code === "23505" && promoCodeIsFull) {
        const { data: existingAfterConflict } = await db
          .from("conversions")
          .select("id")
          .eq("user_id", landing.user_id)
          .eq("promo_code", promoCode)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existingAfterConflict?.id) {
          return ignoreLeadDuplicateByPromoCode(
            db,
            landing.user_id,
            existingAfterConflict.id,
            promoCode,
            leadPayloadRaw,
            ctx,
            {
              dedupe_source: "unique_violation",
              action_event_id: norm(p.action_event_id),
              error: insertError.message,
            },
          );
        }
      }

      await writeLog(
        db,
        landing.user_id,
        "handleLead",
        "ERROR",
        "LEAD sin match por promo_code y error al crear fila",
        JSON.stringify({
          promo_code: promoCode,
          phone: cleanPhone,
          error: insertError?.message ?? "unknown",
        }),
        undefined,
        undefined,
        undefined,
        safePayloadRaw(p),
        "sin match por promo_code y fallo al crear fila",
      );
      return textResponse("Error al crear fila LEAD sin match", 500);
    }

    const createdId = inserted.id;
    targetId = createdId;
    leadMatchMode = "created_new";

    await writeLog(
      db,
      landing.user_id,
      "handleLead",
      "INFO",
      "LEAD sin match por promo_code: creado nuevo",
      JSON.stringify({
        promo_code_received: promoCode,
        promo_code_attributed: newRow.promo_code,
        phone: cleanPhone,
        agency_id: inboundAgencyId,
        bot_phone: botPhone,
        event_gerencia_id: eventGerencia.gerencia_id,
        attribution_source_conversion_id: trustedLineage?.id ?? null,
        conversion_id: createdId,
      }),
      createdId,
      undefined,
      undefined,
      safePayloadRaw(p),
      "lead creado sin match (match: created_new)",
    );
    if (!inboundExternalId && cleanPhone) {
      await writeLog(
        db,
        landing.user_id,
        "handleLead",
        "INFO",
        "external_id generado por hash de phone (created_new)",
        JSON.stringify({
          conversion_id: createdId,
          source: "phone_hash",
          phone: cleanPhone,
        }),
        createdId,
        undefined,
        undefined,
        safePayloadRaw(p),
        "external_id generado por hash de phone",
      );
    }
  } else {
    // 4) Update existing row
    const updates: Record<string, unknown> = {
      phone: cleanPhone,
      estado: "lead",
      event_source_url: eventSourceUrl,
      lead_event_id: leadEventId,
      lead_event_time: leadEventTime,
      lead_payload_raw: leadPayloadRaw,
      lead_player_username: leadPlayerUsername,
      ...eventGerenciaPatch(
        "lead",
        eventGerencia,
        promoCode,
        leadAttributionStatus,
        targetId,
      ),
    };
    if (inboundMetaPixelId) {
      updates.meta_pixel_id = inboundMetaPixelId;
      updates.pixel_id = inboundMetaPixelId;
      updates.currency = resolveCurrencyForPixel(
        config,
        pixelConfigs,
        inboundMetaPixelId,
      );
    }
    if (testEventCode) updates.test_event_code = testEventCode;
    if (payloadCuitCuil) updates.cuit_cuil = payloadCuitCuil;
    if (geo.ct) updates.ct = geo.ct;
    if (geo.st) updates.st = geo.st;
    if (geo.zip) updates.zip = geo.zip;
    if (geo.country) updates.country = geo.country;
    if (geo.geo_city) updates.geo_city = geo.geo_city;
    if (geo.geo_region) updates.geo_region = geo.geo_region;
    if (geo.geo_country) updates.geo_country = geo.geo_country;
    if (hasPayloadGeo(geo)) updates.geo_source = "payload";
    const { data: cur } = await db
      .from("conversions")
      .select(
        "promo_code, observaciones, external_id, telefono_asignado, assigned_gerencia_label, source_platform, ctwa_clid",
      )
      .eq("id", targetId)
      .single();
    const currentOriginSource = norm(
      (cur as Record<string, unknown> | null)?.source_platform,
    );
    const effectiveOriginSource = currentOriginSource || inboundSourcePlatform;
    if (!currentOriginSource && inboundSourcePlatform) {
      updates.source_platform = inboundSourcePlatform;
    }
    if (
      normalizedSourcePlatform(effectiveOriginSource) === "chatrace" &&
      !normalizeCtwaClid((cur as Record<string, unknown> | null)?.ctwa_clid) &&
      inboundCtwaClid
    ) {
      updates.ctwa_clid = inboundCtwaClid;
    }
    if (payloadFn) updates.fn = payloadFn;
    if (payloadLn) updates.ln = payloadLn;
    if (payloadEmail) updates.email = payloadEmail;
    // Fill promo_code if row didn't have it
    if (promoCode && isFullPromoCode(promoCode) && !cur?.promo_code) {
      updates.promo_code = promoCode;
    }
    if (
      !norm((cur as Record<string, unknown> | null)?.external_id) && cleanPhone
    ) {
      updates.external_id = await sha256(cleanPhone);
    }
    if (
      !norm((cur as Record<string, unknown> | null)?.assigned_gerencia_label)
    ) {
      const assignedPhone = norm(p.telefono_asignado) ||
        norm((cur as Record<string, unknown> | null)?.telefono_asignado);
      Object.assign(
        updates,
        snapshotPatch(
          await resolveAssignedGerenciaSnapshot(
            db,
            landing.user_id,
            assignedPhone,
            landing.id,
          ),
        ),
      );
    }
    updates.observaciones = appendObservation(
      cur?.observaciones ?? "",
      matchSourceToken,
    );
    await db.from("conversions").update(updates).eq("id", targetId);
  }

  // Geo enrichment
  const { data: row } = await db.from("conversions").select("*").eq(
    "id",
    targetId,
  ).single();
  if (!row) return textResponse("Error al leer fila LEAD", 500);
  if (ctx) ctx.conversionId = targetId ?? undefined;

  const effectiveConfig = resolveEffectiveConfigForPixel(
    config,
    pixelConfigs,
    row.pixel_id,
  );
  await ensureGeoOnRow(
    db,
    targetId!,
    row.phone,
    row.client_ip,
    {
      ct: row.ct,
      st: row.st,
      country: row.country,
      zip: row.zip,
      geo_city: row.geo_city,
      geo_region: row.geo_region,
      geo_country: row.geo_country,
    },
    norm((row as Record<string, unknown>).geo_source),
    effectiveConfig,
  );
  await ensureSexOnRow(db, targetId!, row.cuit_cuil, row.fn);

  const { data: fresh } = await db.from("conversions").select("*").eq(
    "id",
    targetId,
  ).single();
  const fullRow = (fresh ?? row) as ConversionRow;
  if (ctx) ctx.inboxPromoCode = norm(fullRow.promo_code);
  const allowLeadPixelFallback = hasContactContext(fullRow);
  const capiRow = clearUntrustedStoredPixel(fullRow);

  await writeLog(
    db,
    landing.user_id,
    "handleLead",
    "INFO",
    "LEAD procesado",
    JSON.stringify({
      phone: cleanPhone,
      promo_code_received: promoCode,
      promo_code_attributed: fullRow.promo_code,
      matched: !!targetId,
      match_mode: leadMatchMode,
      promo_coherence: promoCoherence,
      event_gerencia_id: eventGerencia.gerencia_id,
      event_gerencia_status: eventGerencia.resolution_status,
    }),
    targetId!,
    undefined,
    undefined,
    safePayloadRaw(p),
    `lead procesado (match: ${leadMatchMode})`,
  );

  const ok = await sendToMetaCAPI(
    db,
    effectiveConfig,
    pixelConfigs,
    capiRow,
    targetId!,
    "Lead",
    leadEventId,
    leadEventTime,
    undefined,
    testEventCode || undefined,
    {
      allowPixelFallback: allowLeadPixelFallback,
      pixelFallbackDisabledReason: "lead_without_contact_payload",
    },
  );
  if (ok) {
    const modeText = leadMatchMode === "promo_code"
      ? "promo_code"
      : leadMatchMode === "bot_phone_timestamp_fallback"
      ? "bot_phone+dateTime"
      : "created_new";
    return textResponse(
      leadMatchMode === "created_new"
        ? "No se encontro un Contact previo para este LEAD (sin match por promo_code ni por fallback de tiempo+telefono asignado). Se creo una nueva fila LEAD y se proceso correctamente. match_mode:created_new"
        : `Fila LEAD procesada. match_mode:${modeText}`,
    );
  }
  const modeText = leadMatchMode === "promo_code"
    ? "promo_code"
    : leadMatchMode === "bot_phone_timestamp_fallback"
    ? "bot_phone+dateTime"
    : "created_new";
  return textResponse(
    leadMatchMode === "created_new"
      ? "No se encontro un Contact previo para este LEAD (sin match por promo_code ni por fallback de tiempo+telefono asignado). Se creo una nueva fila LEAD, pero fallo el envio a Meta CAPI (revisar token, pixel o pestana Logs). match_mode:created_new"
      : `LEAD procesado. Error al enviar a Meta CAPI (revisar token, pixel o pestana Logs). match_mode:${modeText}`,
  );
}

async function handleCompleteRegistration(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  ctx?: ProcessingContext,
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  const botPhone = sanitizePhone(p.bot_phone);
  const inboundAgencyId = norm(p.agency_id);
  const playerUsername = playerUsernameFromPayload(p);
  const promoCode = derivePromoCodeFromPayload(p);
  const promoCodeIsFull = isFullPromoCode(
    p.promo_code ?? p.promoCode ?? promoCode,
  );
  const registrationPayloadRaw = safePayloadRaw(p);
  const registrationEventId =
    norm(p.action_event_id || p.registration_event_id || p.event_id) ||
    generateEventId();
  const registrationEventTime = toValidEventTime(
    p.registration_event_time || p.event_time || Math.floor(Date.now() / 1000),
  );
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);
  const eventGerencia = await resolveEventGerenciaSnapshot(
    db,
    landing.user_id,
    inboundAgencyId,
    botPhone,
  );

  if (!cleanPhone) {
    await writeLog(
      db,
      landing.user_id,
      "handleCompleteRegistration",
      "ERROR",
      "COMPLETEREGISTRATION rechazado: falta phone",
      safePayloadRaw(p),
      undefined,
      undefined,
      undefined,
      registrationPayloadRaw,
      "rechazado: falta phone",
    );
    return textResponse("Faltan parametros: phone requerido", 400);
  }

  let targetRow: ConversionRow | null = null;
  let matchMode = "none";
  let promoCoherence: PromoGerenciaCoherence = "not_found";

  if (promoCodeIsFull) {
    const { data } = await db
      .from("conversions")
      .select("*")
      .eq("user_id", landing.user_id)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const promoRow = data as ConversionRow | null;
    promoCoherence = evaluatePromoGerenciaCoherence({
      promoFound: Boolean(promoRow?.id),
      promoPlayerPhone: promoRow?.phone,
      eventPlayerPhone: cleanPhone,
      promoGerenciaId: promoJourneyGerenciaId(promoRow),
      eventGerenciaId: eventGerencia.gerencia_id,
    });
    if (promoRow?.id && promoCoherence !== "player_phone_conflict") {
      targetRow = promoRow;
      matchMode = `promo_${promoCoherence}`;
    }
  }

  if (!targetRow) {
    const trustedLineage = await findLatestTrustedGerenciaLineage(
      db,
      landing.user_id,
      cleanPhone,
      eventGerencia.gerencia_id,
    );
    if (trustedLineage?.id) {
      targetRow = trustedLineage;
      matchMode = "trusted_gerencia_lineage";
    }
  }

  if (!targetRow) {
    const { data } = await db
      .from("conversions")
      .select("*")
      .eq("user_id", landing.user_id)
      .eq("phone", cleanPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    targetRow = data as ConversionRow | null;
    if (targetRow?.id) matchMode = "latest_phone_fallback";
  }

  const registrationStatus = matchMode === "none" ? "created_new" : matchMode;
  const { fn: payloadFn, ln: payloadLn } = deriveNameFromPayload(p);
  const payloadEmail = sanitizeEmail(p.email);
  const payloadCuitCuil = deriveCuitCuilFromPayload(p);

  if (targetRow?.id) {
    const updates: Record<string, unknown> = {
      phone: cleanPhone,
      estado: norm(targetRow.estado) === "purchase" ? "purchase" : "lead",
      registration_event_id: registrationEventId,
      registration_event_time: registrationEventTime,
      registration_payload_raw: registrationPayloadRaw,
      registration_player_username: playerUsername,
      ...eventGerenciaPatch(
        "registration",
        eventGerencia,
        promoCode,
        registrationStatus,
        targetRow.id,
      ),
    };
    if (inboundMetaPixelId) {
      updates.meta_pixel_id = inboundMetaPixelId;
      updates.pixel_id = inboundMetaPixelId;
      updates.currency = resolveCurrencyForPixel(
        config,
        pixelConfigs,
        inboundMetaPixelId,
        targetRow.currency,
      );
    }
    if (playerUsername && !norm(targetRow.lead_player_username)) {
      updates.lead_player_username = playerUsername;
    }
    if (payloadFn) updates.fn = payloadFn;
    if (payloadLn) updates.ln = payloadLn;
    if (payloadEmail) updates.email = payloadEmail;
    if (payloadCuitCuil) updates.cuit_cuil = payloadCuitCuil;
    await db.from("conversions").update(updates).eq("id", targetRow.id);
    if (ctx) {
      ctx.conversionId = targetRow.id;
      ctx.inboxPromoCode = norm(targetRow.promo_code || promoCode);
    }
    await writeLog(
      db,
      landing.user_id,
      "handleCompleteRegistration",
      "INFO",
      "COMPLETEREGISTRATION procesado",
      JSON.stringify({
        phone: cleanPhone,
        player_username: playerUsername,
        promo_code_received: promoCode,
        match_mode: matchMode,
        promo_coherence: promoCoherence,
        event_gerencia_id: eventGerencia.gerencia_id,
      }),
      targetRow.id,
      undefined,
      undefined,
      registrationPayloadRaw,
      `registro procesado (match: ${matchMode})`,
    );
    const { data: fresh } = await db
      .from("conversions")
      .select("*")
      .eq("id", targetRow.id)
      .single();
    const fullRow = (fresh ?? { ...targetRow, ...updates }) as ConversionRow;
    const effectiveConfig = resolveEffectiveConfigForPixel(
      config,
      pixelConfigs,
      fullRow.pixel_id || fullRow.meta_pixel_id,
    );
    const ok = await sendToMetaCAPI(
      db,
      effectiveConfig,
      pixelConfigs,
      clearUntrustedStoredPixel(fullRow),
      targetRow.id,
      "CompleteRegistration",
      registrationEventId,
      registrationEventTime,
      undefined,
      norm(fullRow.test_event_code) || undefined,
      {
        allowPixelFallback: hasContactContext(fullRow),
        pixelFallbackDisabledReason: "registration_without_contact_payload",
      },
    );
    return textResponse(
      ok
        ? `COMPLETEREGISTRATION procesado. match_mode:${matchMode}`
        : `COMPLETEREGISTRATION procesado, pero fallo el envio a Meta CAPI. match_mode:${matchMode}`,
    );
  }

  const resolvedPixelId = inboundMetaPixelId || config.pixel_id || "";
  const eventSourceUrl = await deriveEventSourceUrl(
    db,
    landing.name,
    norm(p.event_source_url),
  );
  const geo = resolveGeoForPayload(p);
  const payloadGeoSource: GeoSource = hasPayloadGeo(geo) ? "payload" : "none";
  const assignedGerencia = await resolveAssignedGerenciaSnapshot(
    db,
    landing.user_id,
    p.telefono_asignado,
    landing.id,
  );
  const generatedExternalId = norm(p.external_id) ||
    (cleanPhone ? await sha256(cleanPhone) : generateEventId());
  const newRow: Omit<ConversionRow, "id"> = {
    landing_id: landing.id?.trim() || null,
    user_id: landing.user_id,
    landing_name: landing.name,
    phone: cleanPhone,
    email: payloadEmail,
    form_fn: "",
    form_ln: "",
    form_email: "",
    form_phone: "",
    cuit_cuil: payloadCuitCuil,
    fn: payloadFn,
    ln: payloadLn,
    ct: norm(geo.ct),
    st: norm(geo.st),
    zip: norm(geo.zip || p.zip),
    country: norm(geo.country),
    fbp: norm(p.fbp),
    fbc: norm(p.fbc),
    from_meta_ads: false,
    geo_source: payloadGeoSource,
    meta_pixel_id: resolvedPixelId,
    pixel_attribution_source: "",
    pixel_attribution_conversion_id: null,
    source_platform: norm(p.source_platform),
    ctwa_clid: ctwaClidForSource(p.ctwa_clid, p.source_platform),
    pixel_id: resolvedPixelId,
    contact_event_id: "",
    contact_event_time: null,
    sendContactPixel: false,
    contact_payload_raw: "",
    lead_event_id: "",
    lead_event_time: null,
    lead_payload_raw: "",
    purchase_event_id: "",
    purchase_event_time: null,
    purchase_payload_raw: "",
    test_event_code: norm(p.test_event_code),
    client_ip: payloadClientIp(p),
    agent_user: inboundUserAgent(p),
    device_type: norm(p.device_type),
    event_source_url: eventSourceUrl,
    estado: "lead",
    valor: 0,
    currency: resolveCurrencyForPixel(config, pixelConfigs, resolvedPixelId),
    contact_status_capi: "",
    lead_status_capi: "",
    purchase_status_capi: "",
    observaciones: "match_source:complete_registration_created_new",
    external_id: generatedExternalId,
    utm_campaign: norm(p.utm_campaign),
    telefono_asignado: norm(p.telefono_asignado),
    ...snapshotPatch(assignedGerencia),
    lead_player_username: "",
    registration_event_id: registrationEventId,
    registration_event_time: registrationEventTime,
    registration_payload_raw: registrationPayloadRaw,
    registration_player_username: playerUsername,
    ...eventGerenciaPatch(
      "registration",
      eventGerencia,
      promoCode,
      registrationStatus,
      null,
    ),
    purchase_player_username: "",
    promo_code: promoCodeIsFull ? promoCode : "",
    geo_city: geo.geo_city,
    geo_region: geo.geo_region,
    geo_country: geo.geo_country,
  };

  const { data: inserted, error } = await db
    .from("conversions")
    .insert(newRow)
    .select("id")
    .single();
  if (error || !inserted?.id) {
    await writeLog(
      db,
      landing.user_id,
      "handleCompleteRegistration",
      "ERROR",
      "COMPLETEREGISTRATION sin match y error al crear fila",
      JSON.stringify({
        phone: cleanPhone,
        player_username: playerUsername,
        error: error?.message ?? "unknown",
      }),
      undefined,
      undefined,
      undefined,
      registrationPayloadRaw,
      "registro sin match: fallo al crear fila",
    );
    return textResponse(
      "Error al crear fila COMPLETEREGISTRATION sin match",
      500,
    );
  }
  if (ctx) {
    ctx.conversionId = inserted.id;
    ctx.inboxPromoCode = newRow.promo_code;
  }
  await writeLog(
    db,
    landing.user_id,
    "handleCompleteRegistration",
    "INFO",
    "COMPLETEREGISTRATION sin match: creado nuevo",
    JSON.stringify({
      phone: cleanPhone,
      player_username: playerUsername,
      promo_code: promoCode,
      conversion_id: inserted.id,
    }),
    inserted.id,
    undefined,
    undefined,
    registrationPayloadRaw,
    "registro creado sin match",
  );
  const { data: fresh } = await db
    .from("conversions")
    .select("*")
    .eq("id", inserted.id)
    .single();
  const fullRow = (fresh ?? { ...newRow, id: inserted.id }) as ConversionRow;
  const effectiveConfig = resolveEffectiveConfigForPixel(
    config,
    pixelConfigs,
    fullRow.pixel_id || fullRow.meta_pixel_id,
  );
  const ok = await sendToMetaCAPI(
    db,
    effectiveConfig,
    pixelConfigs,
    clearUntrustedStoredPixel(fullRow),
    inserted.id,
    "CompleteRegistration",
    registrationEventId,
    registrationEventTime,
    undefined,
    norm(fullRow.test_event_code) || undefined,
    {
      allowPixelFallback: hasContactContext(fullRow),
      pixelFallbackDisabledReason: "registration_without_contact_payload",
    },
  );
  return textResponse(
    ok
      ? "COMPLETEREGISTRATION recibido sin match: fila creada"
      : "COMPLETEREGISTRATION recibido sin match: fila creada, pero fallo el envio a Meta CAPI",
  );
}

async function handlePurchase(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  ctx?: ProcessingContext,
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);
  const inboundSourcePlatform = norm(p.source_platform);
  const inboundCtwaClid = ctwaClidForSource(p.ctwa_clid, inboundSourcePlatform);
  const botPhone = sanitizePhone(p.bot_phone);
  const inboundAgencyId = norm(p.agency_id);
  const purchasePlayerUsername = playerUsernameFromPayload(p);
  const normalizedAmount = normalizePurchaseAmount(p.amount);
  if (!cleanPhone || !normalizedAmount.ok) {
    let rejectionReason = "missing_phone";
    if (cleanPhone && !normalizedAmount.ok) {
      rejectionReason = normalizedAmount.reason;
    }
    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "ERROR",
      "PURCHASE rechazado: phone o amount invalido",
      JSON.stringify({
        reason: rejectionReason,
        amount_input_type: typeof p.amount,
      }),
      undefined,
      undefined,
      undefined,
      safePayloadRaw(p),
      `rechazado: ${rejectionReason}`,
    );
    return textResponse(
      "Faltan parametros validos: phone y amount monetario > 0",
      400,
    );
  }
  const amount = normalizedAmount.value;
  const testEventCode = norm(p.test_event_code);
  const purchasePayloadRaw = safePayloadRaw(p);
  const coelsaId = normalizeCoelsaId(p.coelsa_id);
  const transactionId = normalizeTransactionId(p.transaction_id);
  const purchaseClaim = await claimPurchaseEvent(db, landing.user_id, p);
  if (!purchaseClaim.claimed) {
    if (ctx) {
      ctx.conversionId = purchaseClaim.conversionId || undefined;
      ctx.inboxStatus = "deduplicated";
    }
    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "INFO",
      "PURCHASE concurrente deduplicado por reserva atomica",
      JSON.stringify({
        event_id: purchaseClaim.eventId,
        claim_id: purchaseClaim.claimId,
        claim_status: purchaseClaim.status,
        protected_by: purchaseClaim.protectedBy,
        existing_conversion_id: purchaseClaim.conversionId,
      }),
      purchaseClaim.conversionId || undefined,
      undefined,
      undefined,
      purchasePayloadRaw,
      "duplicado ignorado por reserva atomica",
    );
    return textResponse(
      "Duplicado ignorado (Purchase ya reservado o procesado)",
      200,
    );
  }
  if (ctx && purchaseClaim.claimId) ctx.purchaseClaimId = purchaseClaim.claimId;

  const promoCode = derivePromoCodeFromPayload(p);
  const promoCodeIsFull = isFullPromoCode(
    p.promo_code ?? p.promoCode ?? promoCode,
  );
  const { fn: payloadFn, ln: payloadLn } = deriveNameFromPayload(p);
  const payloadEmail = sanitizeEmail(p.email);
  const payloadCuitCuil = deriveCuitCuilFromPayload(p);
  const eventSourceUrl = await deriveEventSourceUrl(
    db,
    landing.name,
    norm(p.event_source_url),
  );
  const geo = resolveGeoForPayload(p);
  const payloadGeoSource: GeoSource = hasPayloadGeo(geo) ? "payload" : "none";
  const purchaseEventId = purchaseClaim.eventId;
  const purchaseEventTime = toValidEventTime(
    p.purchase_event_time || p.event_time || Math.floor(Date.now() / 1000),
  );
  const eventGerencia = await resolveEventGerenciaSnapshot(
    db,
    landing.user_id,
    inboundAgencyId,
    botPhone,
  );
  const { data: latestPurchaseRow } = await db
    .from("conversions")
    .select("*")
    .eq("user_id", landing.user_id)
    .eq("phone", cleanPhone)
    .eq("estado", "purchase")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestGlobalPurchase = latestPurchaseRow as ConversionRow | null;
  const hasPreviousPurchase = !!latestPurchaseRow;
  const receiverLeadRow = await findLatestRowForEventGerencia(
    db,
    landing.user_id,
    cleanPhone,
    eventGerencia.gerencia_id,
    "lead",
  );
  const receiverPurchaseRow = await findLatestRowForEventGerencia(
    db,
    landing.user_id,
    cleanPhone,
    eventGerencia.gerencia_id,
    "purchase",
  );
  const receiverPurchaseLineage = !eventGerencia.gerencia_id ||
      (receiverPurchaseRow && rowIsTrustedLineageForGerencia(
        receiverPurchaseRow,
        eventGerencia.gerencia_id,
      ))
    ? receiverPurchaseRow
    : null;
  const trustedReceiverLineage = await findLatestTrustedGerenciaLineage(
    db,
    landing.user_id,
    cleanPhone,
    eventGerencia.gerencia_id,
  );
  const leadIsAfterLatestPurchase = !!(
    receiverLeadRow?.created_at &&
    latestPurchaseRow?.created_at &&
    new Date(receiverLeadRow.created_at).getTime() >
      new Date(latestPurchaseRow.created_at).getTime()
  );
  const canUseLeadFallback = !hasPreviousPurchase || leadIsAfterLatestPurchase;

  // 1) Primary match by full promo_code only.
  let promoRow: ConversionRow | null = null;
  let promoCoherence: PromoGerenciaCoherence = "not_found";
  if (promoCode && promoCodeIsFull) {
    const { data } = await db
      .from("conversions")
      .select("*")
      .eq("user_id", landing.user_id)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    promoRow = data as ConversionRow | null;
    promoCoherence = evaluatePromoGerenciaCoherence({
      promoFound: Boolean(promoRow?.id),
      promoPlayerPhone: promoRow?.phone,
      eventPlayerPhone: cleanPhone,
      promoGerenciaId: promoJourneyGerenciaId(promoRow),
      eventGerenciaId: eventGerencia.gerencia_id,
    });
  } else if (promoCode) {
    const fallbackCandidateId = receiverLeadRow?.id ?? latestPurchaseRow?.id ??
      undefined;
    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "INFO",
      "PURCHASE promo_code incompleto: fallback por phone/lead",
      JSON.stringify({ promo_code: promoCode, phone: cleanPhone }),
      fallbackCandidateId,
      undefined,
      undefined,
      safePayloadRaw(p),
      "fallback por phone/lead (match pendiente)",
    );
  }

  if (
    promoCoherence === "gerencia_conflict" ||
    promoCoherence === "player_phone_conflict"
  ) {
    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "WARN",
      "PURCHASE con promo_code incompatible con el bot receptor",
      JSON.stringify({
        promo_code: promoCode,
        promo_conversion_id: promoRow?.id ?? null,
        promo_gerencia_id: promoJourneyGerenciaId(promoRow),
        event_gerencia_id: eventGerencia.gerencia_id,
        agency_id: inboundAgencyId,
        bot_phone: botPhone,
        coherence: promoCoherence,
      }),
      promoRow?.id,
      undefined,
      undefined,
      purchasePayloadRaw,
      "promo recibido conservado solo como trazabilidad; prevalece el receptor real",
    );
  }

  const decision = choosePurchaseJourney({
    promoRowId: promoRow?.id,
    promoRowAlreadyPurchased:
      norm(promoRow?.estado).toLowerCase() === "purchase",
    promoCoherence,
    receiverLeadId: receiverLeadRow?.id,
    receiverLeadIsEligible: canUseLeadFallback,
    receiverLeadHasTrustedPromo: leadHasTrustedPromo(receiverLeadRow),
    hasPreviousPurchase,
  });
  const targetId = decision.targetId;
  const purchaseType = decision.purchaseType;
  const matchMethod = decision.matchMethod;
  const receiverAttributionSource = targetId
    ? receiverLeadRow?.id === targetId ? receiverLeadRow : promoRow
    : (receiverPurchaseLineage ?? trustedReceiverLineage);
  const attributedPromoCode =
    promoRow?.id && canUsePromoForJourney(promoCoherence)
      ? promoCode
      : (isFullPromoCode(receiverAttributionSource?.promo_code)
        ? norm(receiverAttributionSource?.promo_code)
        : (promoCodeIsFull && promoCoherence === "not_found" ? promoCode : ""));
  const fallbackSendContactPixel = toBool(
    receiverAttributionSource?.sendContactPixel ??
      latestGlobalPurchase?.sendContactPixel,
  );

  // 2.b) If the matching LEAD is still waiting for its CONTACT window, keep PURCHASE queued.
  // PURCHASE never uses the CONTACT->LEAD time window directly; it only waits for the LEAD to settle.
  if (
    !targetId &&
    !(promoRow?.id && canUsePromoForJourney(promoCoherence) &&
      purchaseType === "repeat")
  ) {
    const deferredLead = await findDeferredLeadInboundByPhone(
      db,
      landing.user_id,
      cleanPhone,
      inboundAgencyId,
      botPhone,
    );
    if (deferredLead) {
      if (ctx) ctx.inboxStatus = "deferred";
      await writeLog(
        db,
        landing.user_id,
        "handlePurchase",
        "INFO",
        "PURCHASE en espera por LEAD diferido del mismo phone",
        JSON.stringify({
          phone: cleanPhone,
          promo_code: promoCode,
          deferred_lead_inbox_id: deferredLead.id,
          deferred_lead_created_at: deferredLead.created_at,
        }),
        undefined,
        undefined,
        undefined,
        safePayloadRaw(p),
        "purchase en espera: lead diferido pendiente",
      );
      return textResponse(
        "PURCHASE recibido y en espera: hay un LEAD pendiente para este phone",
        202,
      );
    }
  }

  // 3) Update the coherent promo row or the latest Lead of the real receiver.
  if (targetId) {
    const { data: existing } = await db
      .from("conversions")
      .select("*")
      .eq("id", targetId)
      .single();
    const existingRow = existing as ConversionRow;
    const purchaseCurrency = resolveCurrencyForPixel(
      config,
      pixelConfigs,
      inboundMetaPixelId || norm(existingRow?.pixel_id),
      eventGerencia.workspace_currency || existingRow?.currency,
      { preferFallbackWithoutPixel: Boolean(eventGerencia.workspace_currency) },
    );
    const attributionSourceId =
      norm(existingRow?.lead_attribution_conversion_id) || targetId;
    const purchaseAttributionStatus = promoCoherence === "gerencia_conflict" ||
        promoCoherence === "player_phone_conflict"
      ? `promo_${promoCoherence}_${matchMethod}`
      : `${matchMethod}_${promoCoherence}`;

    const updates: Record<string, unknown> = {
      phone: cleanPhone,
      estado: "purchase",
      valor: amount,
      currency: purchaseCurrency,
      event_source_url: eventSourceUrl || existingRow?.event_source_url || "",
      purchase_event_id: purchaseEventId,
      purchase_event_time: purchaseEventTime,
      purchase_payload_raw: purchasePayloadRaw,
      purchase_player_username: purchasePlayerUsername ||
        norm(existingRow?.registration_player_username) ||
        norm(existingRow?.lead_player_username),
      purchase_coelsa_id: coelsaId,
      purchase_transaction_id: transactionId,
      purchase_type: purchaseType,
      purchase_capi_route: "",
      purchase_capi_route_reason: "",
      ...eventGerenciaPatch(
        "purchase",
        eventGerencia,
        promoCode,
        purchaseAttributionStatus,
        attributionSourceId,
      ),
    };
    if (inboundMetaPixelId) {
      updates.meta_pixel_id = inboundMetaPixelId;
      updates.pixel_id = inboundMetaPixelId;
    }
    const currentOriginSource = norm(existingRow?.source_platform);
    const effectiveOriginSource = currentOriginSource || inboundSourcePlatform;
    if (!currentOriginSource && inboundSourcePlatform) {
      updates.source_platform = inboundSourcePlatform;
    }
    if (
      normalizedSourcePlatform(effectiveOriginSource) === "chatrace" &&
      !normalizeCtwaClid(existingRow?.ctwa_clid) &&
      inboundCtwaClid
    ) {
      updates.ctwa_clid = inboundCtwaClid;
    }
    if (testEventCode) updates.test_event_code = testEventCode;
    if (existingRow?.lead_event_id) {
      updates.lead_event_id = existingRow.lead_event_id;
      if (existingRow.lead_event_time) {
        updates.lead_event_time = existingRow.lead_event_time;
      }
    }
    if (payloadFn) updates.fn = payloadFn;
    if (payloadLn) updates.ln = payloadLn;
    if (payloadEmail) updates.email = payloadEmail;
    if (payloadCuitCuil) updates.cuit_cuil = payloadCuitCuil;
    if (geo.ct) updates.ct = geo.ct;
    if (geo.st) updates.st = geo.st;
    if (geo.zip) updates.zip = geo.zip;
    if (geo.country) updates.country = geo.country;
    if (geo.geo_city) updates.geo_city = geo.geo_city;
    if (geo.geo_region) updates.geo_region = geo.geo_region;
    if (geo.geo_country) updates.geo_country = geo.geo_country;
    if (hasPayloadGeo(geo)) updates.geo_source = "payload";
    if (attributedPromoCode && !existingRow?.promo_code) {
      updates.promo_code = attributedPromoCode;
    }
    if (!norm(existingRow?.assigned_gerencia_label)) {
      Object.assign(
        updates,
        snapshotPatch(
          await resolveAssignedGerenciaSnapshot(
            db,
            landing.user_id,
            existingRow?.telefono_asignado,
            landing.id,
          ),
        ),
      );
    }
    await db.from("conversions").update(updates).eq("id", targetId);

    const { data: row } = await db.from("conversions").select("*").eq(
      "id",
      targetId,
    ).single();
    if (!row) return textResponse("Error al leer fila PURCHASE", 500);
    if (ctx) ctx.conversionId = targetId;
    const effectiveConfig = resolveEffectiveConfigForPixel(
      config,
      pixelConfigs,
      row.pixel_id,
    );
    await ensureGeoOnRow(
      db,
      targetId,
      row.phone,
      row.client_ip,
      {
        ct: row.ct,
        st: row.st,
        country: row.country,
        zip: row.zip,
        geo_city: row.geo_city,
        geo_region: row.geo_region,
        geo_country: row.geo_country,
      },
      norm((row as Record<string, unknown>).geo_source),
      effectiveConfig,
    );
    await ensureSexOnRow(db, targetId, row.cuit_cuil, row.fn);

    const { data: fresh } = await db.from("conversions").select("*").eq(
      "id",
      targetId,
    ).single();
    const fullRow = (fresh ?? row) as ConversionRow;
    const purchasePixel = await resolveAndPersistPurchasePixel(
      db,
      config,
      pixelConfigs,
      fullRow,
      targetId,
      {
        inboundPixelId: inboundMetaPixelId,
        promoCode: attributedPromoCode,
        landingId: fullRow.landing_id ?? landing.id,
      },
    );
    const capiRow = purchasePixel.row;
    const purchaseConfig = resolveEffectiveConfigForPixel(
      config,
      pixelConfigs,
      capiRow.pixel_id,
    );
    const customData = {
      currency: purchaseConfig.meta_currency,
      value: amount,
      purchase_type: purchaseType,
    };

    await traceUnprotectedPurchase(
      db,
      landing.user_id,
      targetId,
      p,
      purchaseClaim,
    );

    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "INFO",
      purchaseType === "first"
        ? "Primera compra procesada"
        : "Recompra procesada",
      JSON.stringify({
        phone: cleanPhone,
        amount,
        promo_code_received: promoCode,
        promo_code_attributed: attributedPromoCode,
        promo_coherence: promoCoherence,
        agency_id: inboundAgencyId,
        bot_phone: botPhone,
        event_gerencia_id: eventGerencia.gerencia_id,
        purchase_type: purchaseType,
        match_method: matchMethod,
      }),
      targetId,
      undefined,
      undefined,
      safePayloadRaw(p),
      `${
        purchaseType === "first" ? "primera compra" : "recompra"
      } procesada (match: ${matchMethod})`,
    );

    const ok = await sendToMetaCAPI(
      db,
      purchaseConfig,
      pixelConfigs,
      capiRow,
      targetId,
      "Purchase",
      purchaseEventId,
      purchaseEventTime,
      customData,
      testEventCode || undefined,
      {
        allowPixelFallback: false,
        pixelFallbackDisabledReason: "purchase_without_contact_payload",
      },
    );
    return textResponse(
      ok
        ? `Fila PURCHASE procesada. match_mode:${matchMethod}`
        : `PURCHASE procesado. Error al enviar a Meta CAPI (revisar token, pixel o Logs). match_mode:${matchMethod}`,
    );
  }

  // 4) No existing row was selected: create a first or repeat row according
  // to the player's global history, but inherit only from the real receiver.
  if (purchaseType === "first") {
    const firstSource = trustedReceiverLineage;
    const firstPixel = inboundMetaPixelId ||
      norm(firstSource?.pixel_id || firstSource?.meta_pixel_id);
    const firstExternalId = norm(p.external_id) ||
      norm(firstSource?.external_id) || await sha256(cleanPhone);
    const newRow: Omit<ConversionRow, "id"> = {
      landing_id: firstSource?.landing_id ?? (landing.id?.trim() || null),
      user_id: landing.user_id,
      landing_name: firstSource?.landing_name || landing.name,
      phone: cleanPhone,
      email: payloadEmail || firstSource?.email || "",
      form_fn: firstSource?.form_fn || "",
      form_ln: firstSource?.form_ln || "",
      form_email: firstSource?.form_email || "",
      form_phone: firstSource?.form_phone || "",
      cuit_cuil: payloadCuitCuil || firstSource?.cuit_cuil || "",
      fn: payloadFn || firstSource?.fn || "",
      ln: payloadLn || firstSource?.ln || "",
      ct: geo.ct || firstSource?.ct || "",
      st: geo.st || firstSource?.st || "",
      zip: geo.zip || firstSource?.zip || "",
      country: geo.country || firstSource?.country || "",
      fbp: firstSource?.fbp || "",
      fbc: firstSource?.fbc || "",
      from_meta_ads: firstSource?.from_meta_ads ?? false,
      geo_source: payloadGeoSource !== "none"
        ? payloadGeoSource
        : (norm(firstSource?.geo_source) || "none"),
      meta_pixel_id: firstPixel,
      pixel_attribution_source: firstSource ? "stored_attribution" : "",
      pixel_attribution_conversion_id: firstSource?.id ?? null,
      source_platform: inboundSourcePlatform || firstSource?.source_platform ||
        "",
      ctwa_clid: inboundCtwaClid || firstSource?.ctwa_clid || "",
      pixel_id: firstPixel,
      contact_event_id: "",
      contact_event_time: null,
      sendContactPixel: fallbackSendContactPixel,
      contact_payload_raw: "",
      lead_event_id: "",
      lead_event_time: null,
      lead_payload_raw: "",
      purchase_event_id: purchaseEventId,
      purchase_event_time: purchaseEventTime,
      purchase_payload_raw: purchasePayloadRaw,
      purchase_player_username: purchasePlayerUsername ||
        norm(firstSource?.registration_player_username) ||
        norm(firstSource?.lead_player_username),
      purchase_coelsa_id: coelsaId,
      purchase_transaction_id: transactionId,
      test_event_code: testEventCode,
      purchase_type: "first",
      purchase_capi_route: "",
      purchase_capi_route_reason: "",
      client_ip: firstSource?.client_ip || "",
      agent_user: firstSource?.agent_user || "",
      device_type: firstSource?.device_type || "",
      event_source_url: eventSourceUrl || firstSource?.event_source_url || "",
      estado: "purchase",
      valor: amount,
      currency: resolveCurrencyForPixel(
        config,
        pixelConfigs,
        firstPixel,
        eventGerencia.workspace_currency || firstSource?.currency,
        {
          preferFallbackWithoutPixel: Boolean(eventGerencia.workspace_currency),
        },
      ),
      contact_status_capi: "",
      lead_status_capi: "",
      purchase_status_capi: "",
      observaciones: promoCoherence === "gerencia_conflict" ||
          promoCoherence === "player_phone_conflict"
        ? `promo_conflict:${promoCoherence}`
        : "",
      external_id: firstExternalId,
      utm_campaign: firstSource?.utm_campaign || "",
      telefono_asignado: firstSource?.telefono_asignado || "",
      assigned_gerencia_id: firstSource?.assigned_gerencia_id ?? null,
      assigned_gerencia_external_id:
        firstSource?.assigned_gerencia_external_id ?? null,
      assigned_gerencia_name: firstSource?.assigned_gerencia_name ?? "",
      assigned_gerencia_label: firstSource?.assigned_gerencia_label ?? "",
      ...eventGerenciaPatch(
        "purchase",
        eventGerencia,
        promoCode,
        `created_first_${promoCoherence}`,
        firstSource?.id ?? null,
      ),
      promo_code: attributedPromoCode,
      geo_city: geo.geo_city || firstSource?.geo_city || "",
      geo_region: geo.geo_region || firstSource?.geo_region || "",
      geo_country: geo.geo_country || firstSource?.geo_country || "",
    };
    const { data: ins, error } = await db.from("conversions").insert(newRow)
      .select("id").single();
    if (error || !ins) return textResponse("Error al crear fila PURCHASE", 500);
    const createdId = ins.id;
    if (ctx) ctx.conversionId = createdId;

    const { data: row } = await db.from("conversions").select("*").eq(
      "id",
      createdId,
    ).single();
    if (!row) return textResponse("Error al leer fila PURCHASE", 500);
    const effectiveConfig = resolveEffectiveConfigForPixel(
      config,
      pixelConfigs,
      row.pixel_id,
    );
    await ensureGeoOnRow(
      db,
      createdId,
      row.phone,
      row.client_ip,
      {
        ct: row.ct,
        st: row.st,
        country: row.country,
        zip: row.zip,
        geo_city: row.geo_city,
        geo_region: row.geo_region,
        geo_country: row.geo_country,
      },
      norm((row as Record<string, unknown>).geo_source),
      effectiveConfig,
    );
    await ensureSexOnRow(db, createdId, row.cuit_cuil, row.fn);

    const { data: fresh } = await db.from("conversions").select("*").eq(
      "id",
      createdId,
    ).single();
    const fullRow = (fresh ?? row) as ConversionRow;
    const purchasePixel = await resolveAndPersistPurchasePixel(
      db,
      config,
      pixelConfigs,
      fullRow,
      createdId,
      {
        inboundPixelId: inboundMetaPixelId,
        promoCode: attributedPromoCode,
        landingId: fullRow.landing_id ?? landing.id,
      },
    );
    const capiRow = purchasePixel.row;
    const purchaseConfig = resolveEffectiveConfigForPixel(
      config,
      pixelConfigs,
      capiRow.pixel_id,
    );
    const customData = {
      currency: purchaseConfig.meta_currency,
      value: amount,
      purchase_type: "first",
    };

    await traceUnprotectedPurchase(
      db,
      landing.user_id,
      createdId,
      p,
      purchaseClaim,
    );

    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "INFO",
      "Primera compra procesada",
      JSON.stringify({
        phone: cleanPhone,
        amount,
        promo_code_received: promoCode,
        promo_code_attributed: attributedPromoCode,
        promo_coherence: promoCoherence,
        agency_id: inboundAgencyId,
        bot_phone: botPhone,
        event_gerencia_id: eventGerencia.gerencia_id,
        attribution_source_conversion_id: firstSource?.id ?? null,
        match_method: "created_first",
      }),
      createdId,
      undefined,
      undefined,
      safePayloadRaw(p),
      "primera compra procesada (match: created_first)",
    );

    const ok = await sendToMetaCAPI(
      db,
      purchaseConfig,
      pixelConfigs,
      capiRow,
      createdId,
      "Purchase",
      purchaseEventId,
      purchaseEventTime,
      customData,
      testEventCode || undefined,
      {
        allowPixelFallback: false,
        pixelFallbackDisabledReason: "purchase_without_contact_payload",
      },
    );
    return textResponse(
      ok
        ? "No se encontro una fila previa para este PURCHASE (sin match por promo_code ni por fallback phone->lead). Se creo una nueva fila PURCHASE y se proceso correctamente. match_mode:created_first"
        : "No se encontro una fila previa para este PURCHASE (sin match por promo_code ni por fallback phone->lead). Se creo una nueva fila PURCHASE, pero fallo el envio a Meta CAPI (revisar token, pixel o Logs). match_mode:created_first",
    );
  }

  // Repeat purchase => inherit only from the same receiver gerencia. If no
  // trustworthy lineage exists there, keep the event direct/unattributed.
  const repeatSourceRow = receiverPurchaseLineage ?? trustedReceiverLineage;
  const repeatAttribution = await resolvePurchasePixelAttribution(db, {
    userId: landing.user_id,
    inboundPixelId: inboundMetaPixelId,
    currentRow: repeatSourceRow,
    promoCode: attributedPromoCode,
    landingId: repeatSourceRow?.landing_id ?? landing.id,
    configuredPixelIds: configuredPixelIds(config, pixelConfigs),
  });
  const repeatInheritedPixel = repeatAttribution?.pixelId ?? "";
  const repeatOriginSource = inboundSourcePlatform ||
    norm(repeatSourceRow?.source_platform);
  const repeatCtwaClid =
    normalizedSourcePlatform(repeatOriginSource) === "chatrace"
      ? inboundCtwaClid || normalizeCtwaClid(repeatSourceRow?.ctwa_clid)
      : "";

  const newRow: Omit<ConversionRow, "id"> = {
    landing_id: repeatSourceRow?.landing_id ?? (landing.id?.trim() || null),
    user_id: landing.user_id,
    landing_name: repeatSourceRow?.landing_name ?? landing.name,
    phone: cleanPhone,
    email: payloadEmail || repeatSourceRow?.email || "",
    form_fn: repeatSourceRow?.form_fn || "",
    form_ln: repeatSourceRow?.form_ln || "",
    form_email: repeatSourceRow?.form_email || "",
    form_phone: repeatSourceRow?.form_phone || "",
    cuit_cuil: payloadCuitCuil || repeatSourceRow?.cuit_cuil || "",
    fn: payloadFn || repeatSourceRow?.fn || "",
    ln: payloadLn || repeatSourceRow?.ln || "",
    ct: geo.ct || repeatSourceRow?.ct || "",
    st: geo.st || repeatSourceRow?.st || "",
    zip: geo.zip || repeatSourceRow?.zip || "",
    country: geo.country || repeatSourceRow?.country || "",
    fbp: repeatSourceRow?.fbp ?? "",
    fbc: repeatSourceRow?.fbc ?? "",
    from_meta_ads: repeatSourceRow?.from_meta_ads ?? false,
    geo_source: payloadGeoSource !== "none"
      ? payloadGeoSource
      : (norm(repeatSourceRow?.geo_source) || "none"),
    meta_pixel_id: repeatInheritedPixel,
    pixel_attribution_source: repeatAttribution?.source ?? "",
    pixel_attribution_conversion_id: repeatAttribution?.sourceConversionId ??
      null,
    source_platform: repeatOriginSource,
    ctwa_clid: repeatCtwaClid,
    pixel_id: repeatInheritedPixel,
    // DO NOT inherit event IDs
    contact_event_id: "",
    contact_event_time: null,
    sendContactPixel: toBool(repeatSourceRow?.sendContactPixel),
    contact_payload_raw: "",
    lead_event_id: "",
    lead_event_time: null,
    lead_payload_raw: "",
    purchase_event_id: purchaseEventId,
    purchase_event_time: purchaseEventTime,
    purchase_payload_raw: purchasePayloadRaw,
    purchase_player_username: purchasePlayerUsername ||
      norm(repeatSourceRow?.registration_player_username) ||
      norm(repeatSourceRow?.lead_player_username),
    purchase_coelsa_id: coelsaId,
    purchase_transaction_id: transactionId,
    test_event_code: testEventCode || repeatSourceRow?.test_event_code || "",
    purchase_type: "repeat",
    purchase_capi_route: "",
    purchase_capi_route_reason: "",
    client_ip: repeatSourceRow?.client_ip ?? "",
    agent_user: repeatSourceRow?.agent_user ?? "",
    device_type: repeatSourceRow?.device_type ?? "",
    event_source_url: eventSourceUrl || repeatSourceRow?.event_source_url || "",
    estado: "purchase",
    valor: amount,
    currency: resolveCurrencyForPixel(
      config,
      pixelConfigs,
      repeatInheritedPixel,
      eventGerencia.workspace_currency || repeatSourceRow?.currency,
      { preferFallbackWithoutPixel: Boolean(eventGerencia.workspace_currency) },
    ),
    // DO NOT inherit statuses
    contact_status_capi: "",
    lead_status_capi: "",
    purchase_status_capi: "",
    observaciones: appendObservation(
      "REPEAT",
      promoCoherence === "gerencia_conflict" ||
        promoCoherence === "player_phone_conflict"
        ? `promo_conflict:${promoCoherence}`
        : "",
    ),
    external_id: norm(p.external_id) || repeatSourceRow?.external_id ||
      await sha256(cleanPhone),
    utm_campaign: repeatSourceRow?.utm_campaign ?? "",
    telefono_asignado: repeatSourceRow?.telefono_asignado ?? "",
    assigned_gerencia_id: repeatSourceRow?.assigned_gerencia_id ?? null,
    assigned_gerencia_external_id:
      repeatSourceRow?.assigned_gerencia_external_id ?? null,
    assigned_gerencia_name: repeatSourceRow?.assigned_gerencia_name ?? "",
    assigned_gerencia_label: repeatSourceRow?.assigned_gerencia_label ?? "",
    ...eventGerenciaPatch(
      "purchase",
      eventGerencia,
      promoCode,
      `created_repeat_${promoCoherence}`,
      repeatSourceRow?.id ?? null,
    ),
    promo_code: attributedPromoCode,
    geo_city: geo.geo_city || repeatSourceRow?.geo_city || "",
    geo_region: geo.geo_region || repeatSourceRow?.geo_region || "",
    geo_country: geo.geo_country || repeatSourceRow?.geo_country || "",
  };

  const { data: ins, error } = await db.from("conversions").insert(newRow)
    .select("id").single();
  if (error || !ins) return textResponse("Error al crear fila recompra", 500);
  const newId = ins.id;
  if (ctx) ctx.conversionId = newId;

  const effectiveRepeatConfig = resolveEffectiveConfigForPixel(
    config,
    pixelConfigs,
    newRow.pixel_id,
  );
  await ensureGeoOnRow(
    db,
    newId,
    newRow.phone,
    newRow.client_ip,
    {
      ct: newRow.ct,
      st: newRow.st,
      country: newRow.country,
      zip: newRow.zip,
      geo_city: newRow.geo_city,
      geo_region: newRow.geo_region,
      geo_country: newRow.geo_country,
    },
    newRow.geo_source ?? "",
    effectiveRepeatConfig,
  );
  await ensureSexOnRow(db, newId, newRow.cuit_cuil, newRow.fn);

  const { data: fresh } = await db.from("conversions").select("*").eq(
    "id",
    newId,
  ).single();
  const fullRow = (fresh ?? newRow) as ConversionRow;
  const customData: Record<string, unknown> = {
    currency: effectiveRepeatConfig.meta_currency,
    value: amount,
    purchase_type: "repeat",
  };
  const repeatCapiRow = repeatInheritedPixel
    ? fullRow
    : clearUntrustedStoredPixel(fullRow);

  await traceUnprotectedPurchase(
    db,
    landing.user_id,
    newId,
    p,
    purchaseClaim,
  );

  await writeLog(
    db,
    landing.user_id,
    "handlePurchase",
    "INFO",
    "Recompra procesada",
    JSON.stringify({
      phone: cleanPhone,
      amount,
      promo_code_received: promoCode,
      promo_code_attributed: attributedPromoCode,
      promo_coherence: promoCoherence,
      agency_id: inboundAgencyId,
      bot_phone: botPhone,
      event_gerencia_id: eventGerencia.gerencia_id,
      inherited_from: repeatSourceRow?.id ?? null,
      match_method: "created_repeat",
    }),
    newId,
    undefined,
    undefined,
    safePayloadRaw(p),
    "recompra procesada (match: created_repeat)",
  );

  if (repeatAttribution) {
    await writeLog(
      db,
      landing.user_id,
      "resolvePurchasePixelAttribution",
      "INFO",
      "Pixel Purchase resuelto",
      JSON.stringify({
        pixel_id: repeatAttribution.pixelId,
        source: repeatAttribution.source,
        source_conversion_id: repeatAttribution.sourceConversionId,
        promo_code: attributedPromoCode,
        landing_id: norm(repeatSourceRow?.landing_id ?? landing.id),
      }),
      newId,
    );
  }

  const ok = await sendToMetaCAPI(
    db,
    effectiveRepeatConfig,
    pixelConfigs,
    repeatCapiRow,
    newId,
    "Purchase",
    purchaseEventId,
    purchaseEventTime,
    customData,
    testEventCode || undefined,
    {
      allowPixelFallback: false,
      pixelFallbackDisabledReason: "purchase_without_contact_payload",
    },
  );
  return textResponse(
    ok
      ? "Fila PURCHASE procesada. match_mode:created_repeat"
      : "PURCHASE procesado. Error al enviar a Meta CAPI (revisar token, pixel o Logs). match_mode:created_repeat",
  );
}

async function handleSimplePurchase(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  ctx?: ProcessingContext,
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);
  const inboundSourcePlatform = norm(p.source_platform);
  const inboundCtwaClid = ctwaClidForSource(p.ctwa_clid, inboundSourcePlatform);
  const botPhone = sanitizePhone(p.bot_phone);
  const inboundAgencyId = norm(p.agency_id);
  const purchasePlayerUsername = playerUsernameFromPayload(p);
  const normalizedAmount = normalizePurchaseAmount(p.amount);
  if (!cleanPhone || !normalizedAmount.ok) {
    let rejectionReason = "missing_phone";
    if (cleanPhone && !normalizedAmount.ok) {
      rejectionReason = normalizedAmount.reason;
    }
    await writeLog(
      db,
      landing.user_id,
      "handleSimplePurchase",
      "ERROR",
      "PURCHASE simple rechazado: phone o amount invalido",
      JSON.stringify({
        reason: rejectionReason,
        amount_input_type: typeof p.amount,
      }),
      undefined,
      undefined,
      undefined,
      safePayloadRaw(p),
      `rechazado: ${rejectionReason}`,
    );
    return textResponse(
      "Faltan parametros validos: phone y amount monetario > 0",
      400,
    );
  }
  const amount = normalizedAmount.value;
  const testEventCode = norm(p.test_event_code);
  const purchasePayloadRaw = safePayloadRaw(p);
  const coelsaId = normalizeCoelsaId(p.coelsa_id);
  const transactionId = normalizeTransactionId(p.transaction_id);
  const purchaseClaim = await claimPurchaseEvent(db, landing.user_id, p);
  if (!purchaseClaim.claimed) {
    if (ctx) {
      ctx.conversionId = purchaseClaim.conversionId || undefined;
      ctx.inboxStatus = "deduplicated";
    }
    await writeLog(
      db,
      landing.user_id,
      "handleSimplePurchase",
      "INFO",
      "PURCHASE simple concurrente deduplicado por reserva atomica",
      JSON.stringify({
        event_id: purchaseClaim.eventId,
        claim_id: purchaseClaim.claimId,
        claim_status: purchaseClaim.status,
        protected_by: purchaseClaim.protectedBy,
        existing_conversion_id: purchaseClaim.conversionId,
      }),
      purchaseClaim.conversionId || undefined,
      undefined,
      undefined,
      purchasePayloadRaw,
      "duplicado ignorado por reserva atomica",
    );
    return textResponse(
      "Duplicado ignorado (Purchase ya reservado o procesado)",
      200,
    );
  }
  if (ctx && purchaseClaim.claimId) ctx.purchaseClaimId = purchaseClaim.claimId;

  const payloadEmail = sanitizeEmail(p.email);
  const payloadCuitCuil = deriveCuitCuilFromPayload(p);
  const { fn: payloadFn, ln: payloadLn } = deriveNameFromPayload(p);
  const eventSourceUrl = await deriveEventSourceUrl(
    db,
    landing.name,
    norm(p.event_source_url),
  );
  const isRepeatSimple = await hasPreviousSuccessfulPurchases(
    db,
    landing.user_id,
    cleanPhone,
  );
  const eventGerencia = await resolveEventGerenciaSnapshot(
    db,
    landing.user_id,
    inboundAgencyId,
    botPhone,
  );

  // Legacy payloads without action still inherit only from the real receiver
  // when agency_id/bot_phone are available.
  const { data: latestAnyRow } = await db
    .from("conversions")
    .select("*")
    .eq("user_id", landing.user_id)
    .eq("phone", cleanPhone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const srcRow = eventGerencia.gerencia_id
    ? await findLatestTrustedGerenciaLineage(
      db,
      landing.user_id,
      cleanPhone,
      eventGerencia.gerencia_id,
    )
    : (latestAnyRow as ConversionRow | null);
  const simpleSourceRow = srcRow as ConversionRow | null;
  const simpleAttribution = await resolvePurchasePixelAttribution(db, {
    userId: landing.user_id,
    inboundPixelId: inboundMetaPixelId,
    currentRow: simpleSourceRow,
    promoCode: "",
    landingId: simpleSourceRow?.landing_id ?? landing.id,
    configuredPixelIds: configuredPixelIds(config, pixelConfigs),
  });
  const simpleInheritedPixel = simpleAttribution?.pixelId ?? "";
  const simpleOriginSource = inboundSourcePlatform ||
    norm(srcRow?.source_platform);
  const simpleCtwaClid =
    normalizedSourcePlatform(simpleOriginSource) === "chatrace"
      ? inboundCtwaClid || normalizeCtwaClid(srcRow?.ctwa_clid)
      : "";

  const purchaseEventId = purchaseClaim.eventId;
  const purchaseEventTime = toValidEventTime(
    p.purchase_event_time || p.event_time || Math.floor(Date.now() / 1000),
  );

  const newRow: Omit<ConversionRow, "id"> = {
    landing_id: srcRow?.landing_id ?? (landing.id?.trim() || null),
    user_id: landing.user_id,
    landing_name: srcRow?.landing_name || landing.name,
    phone: cleanPhone,
    email: payloadEmail || srcRow?.email || "",
    form_fn: srcRow?.form_fn || "",
    form_ln: srcRow?.form_ln || "",
    form_email: srcRow?.form_email || "",
    form_phone: srcRow?.form_phone || "",
    cuit_cuil: payloadCuitCuil || srcRow?.cuit_cuil || "",
    fn: payloadFn || srcRow?.fn || "",
    ln: payloadLn || srcRow?.ln || "",
    ct: srcRow?.ct ?? "",
    st: srcRow?.st ?? "",
    zip: srcRow?.zip ?? "",
    country: srcRow?.country ?? "",
    fbp: srcRow?.fbp ?? "",
    fbc: srcRow?.fbc ?? "",
    from_meta_ads: srcRow?.from_meta_ads ?? false,
    geo_source: norm((srcRow as Record<string, unknown> | null)?.geo_source) ||
      "none",
    meta_pixel_id: simpleInheritedPixel,
    pixel_attribution_source: simpleAttribution?.source ?? "",
    pixel_attribution_conversion_id: simpleAttribution?.sourceConversionId ??
      null,
    source_platform: simpleOriginSource,
    ctwa_clid: simpleCtwaClid,
    pixel_id: simpleInheritedPixel,
    contact_event_id: "",
    contact_event_time: null,
    sendContactPixel: toBool(srcRow?.sendContactPixel),
    contact_payload_raw: "",
    lead_event_id: "",
    lead_event_time: null,
    lead_payload_raw: "",
    purchase_event_id: purchaseEventId,
    purchase_event_time: purchaseEventTime,
    purchase_payload_raw: purchasePayloadRaw,
    purchase_player_username: purchasePlayerUsername ||
      norm(srcRow?.registration_player_username) ||
      norm(srcRow?.lead_player_username),
    purchase_coelsa_id: coelsaId,
    purchase_transaction_id: transactionId,
    test_event_code: testEventCode,
    purchase_type: isRepeatSimple ? "repeat" : "first",
    purchase_capi_route: "",
    purchase_capi_route_reason: "",
    client_ip: srcRow?.client_ip ?? "",
    agent_user: srcRow?.agent_user ?? "",
    device_type: srcRow?.device_type ?? "",
    event_source_url: eventSourceUrl || srcRow?.event_source_url || "",
    estado: "purchase",
    valor: amount,
    currency: resolveCurrencyForPixel(
      config,
      pixelConfigs,
      simpleInheritedPixel,
      eventGerencia.workspace_currency || srcRow?.currency,
      { preferFallbackWithoutPixel: Boolean(eventGerencia.workspace_currency) },
    ),
    contact_status_capi: "",
    lead_status_capi: "",
    purchase_status_capi: "",
    observaciones: "",
    external_id: norm(p.external_id) || srcRow?.external_id ||
      await sha256(cleanPhone),
    utm_campaign: srcRow?.utm_campaign ?? "",
    telefono_asignado: srcRow?.telefono_asignado ?? "",
    assigned_gerencia_id: srcRow?.assigned_gerencia_id ?? null,
    assigned_gerencia_external_id: srcRow?.assigned_gerencia_external_id ??
      null,
    assigned_gerencia_name: srcRow?.assigned_gerencia_name ?? "",
    assigned_gerencia_label: srcRow?.assigned_gerencia_label ?? "",
    ...eventGerenciaPatch(
      "purchase",
      eventGerencia,
      "",
      `simple_${isRepeatSimple ? "repeat" : "first"}`,
      srcRow?.id ?? null,
    ),
    promo_code: "",
    geo_city: srcRow?.geo_city ?? "",
    geo_region: srcRow?.geo_region ?? "",
    geo_country: srcRow?.geo_country ?? "",
  };

  const { data: ins, error } = await db.from("conversions").insert(newRow)
    .select("id").single();
  if (error || !ins) {
    return textResponse("Error al crear fila purchase simple", 500);
  }
  const newId = ins.id;
  if (ctx) ctx.conversionId = newId;

  const effectiveSimpleConfig = resolveEffectiveConfigForPixel(
    config,
    pixelConfigs,
    newRow.pixel_id,
  );
  await ensureGeoOnRow(
    db,
    newId,
    newRow.phone,
    newRow.client_ip,
    {
      ct: newRow.ct,
      st: newRow.st,
      country: newRow.country,
      zip: newRow.zip,
      geo_city: newRow.geo_city,
      geo_region: newRow.geo_region,
      geo_country: newRow.geo_country,
    },
    newRow.geo_source ?? "",
    effectiveSimpleConfig,
  );
  await ensureSexOnRow(db, newId, newRow.cuit_cuil, newRow.fn);

  const { data: fresh } = await db.from("conversions").select("*").eq(
    "id",
    newId,
  ).single();
  const fullRow = (fresh ?? newRow) as ConversionRow;
  const customData = {
    currency: effectiveSimpleConfig.meta_currency,
    value: amount,
    purchase_type: isRepeatSimple ? "repeat" : "first",
  };
  const simpleCapiRow = simpleInheritedPixel
    ? fullRow
    : clearUntrustedStoredPixel(fullRow);

  await traceUnprotectedPurchase(
    db,
    landing.user_id,
    newId,
    p,
    purchaseClaim,
  );

  await writeLog(
    db,
    landing.user_id,
    "handleSimplePurchase",
    "INFO",
    "Purchase simple procesado",
    JSON.stringify({
      phone: cleanPhone,
      amount,
      agency_id: inboundAgencyId,
      bot_phone: botPhone,
      event_gerencia_id: eventGerencia.gerencia_id,
      inherited_from: srcRow?.id ?? null,
    }),
    newId,
  );

  if (simpleAttribution) {
    await writeLog(
      db,
      landing.user_id,
      "resolvePurchasePixelAttribution",
      "INFO",
      "Pixel Purchase resuelto",
      JSON.stringify({
        pixel_id: simpleAttribution.pixelId,
        source: simpleAttribution.source,
        source_conversion_id: simpleAttribution.sourceConversionId,
        promo_code: "",
        landing_id: norm(simpleSourceRow?.landing_id ?? landing.id),
      }),
      newId,
    );
  }

  const ok = await sendToMetaCAPI(
    db,
    effectiveSimpleConfig,
    pixelConfigs,
    simpleCapiRow,
    newId,
    "Purchase",
    purchaseEventId,
    purchaseEventTime,
    customData,
    testEventCode || undefined,
    {
      allowPixelFallback: false,
      pixelFallbackDisabledReason: "purchase_without_contact_payload",
    },
  );
  return textResponse(
    ok
      ? "Evento Purchase enviado"
      : "Purchase procesado. Error al enviar a Meta CAPI (revisar token, pixel o Logs).",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return textResponse("Solo se permite POST", 405);
  }

  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name")?.trim();
    if (!name) return textResponse("Falta parametro 'name' en la URL", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return textResponse("Configuracion del servidor incompleta", 500);
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Lookup client by nombre in profiles.
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id, nombre")
      .eq("nombre", name)
      .maybeSingle();

    if (profileError) {
      console.error("[conversions] profile lookup failed", {
        name,
        error: profileError.message,
      });
      return textResponse("Error al buscar cliente", 500);
    }

    if (!profile) return textResponse("Cliente no encontrado", 404);

    const userId: string = profile.id;

    // Load conversions config for this client
    const { data: configData } = await db
      .from("conversions_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const cfg: ConversionsConfig = (configData as ConversionsConfig) ?? {
      user_id: userId,
      pixel_id: "",
      meta_access_token: "",
      meta_currency: "ARS",
      meta_api_version: "v25.0",
      send_contact_capi: false,
      send_lead_capi: true,
      send_complete_registration_capi: false,
      meta_ads_only_capi: false,
      include_purchase_type_capi: true,
      send_first_purchase_capi: true,
      send_repeat_purchase_capi: true,
      send_purchase_capi: true,
      send_geo_capi: true,
      geo_use_ipapi: false,
      geo_fill_only_when_missing: false,
    };

    const { data: pixelConfigsData } = await db
      .from("conversions_pixel_configs")
      .select(
        "user_id, pixel_id, meta_access_token, meta_currency, meta_api_version, send_contact_capi, send_lead_capi, send_complete_registration_capi, meta_ads_only_capi, send_purchase_capi, include_purchase_type_capi, send_first_purchase_capi, send_repeat_purchase_capi, send_geo_capi, geo_use_ipapi, geo_fill_only_when_missing, is_default",
      )
      .eq("user_id", userId);
    const pixelConfigs: PixelConfigRow[] =
      (pixelConfigsData ?? []) as PixelConfigRow[];

    let params: Params = await req.json().catch(() => ({}));
    // Preserve emitter data; when event_time is missing, freeze it at receive time for deferred replays.
    params = ensurePayloadEventTime(params, Math.floor(Date.now() / 1000));
    params = canonicalizeInboundTrackingPayload(params, {
      clientIpAddress: payloadClientIp(params),
      userAgent: inboundUserAgent(params),
    });

    // landing_name can come from the payload (to track which landing sent this)
    const landingName = norm(params.landing_name || params.landingName || "");

    // Build a virtual LandingRow representing the client endpoint
    const landing: LandingRow = { id: "", name: landingName, user_id: userId };

    const rawAction = canonicalInboundAction(params.action);
    const rawEventName = norm(params.event_name);
    const eventNameAction = canonicalInboundAction(rawEventName);
    const inferredAction = rawAction ||
      (eventNameAction === "CONTACT" ||
          eventNameAction === "COMPLETEREGISTRATION"
        ? eventNameAction
        : "");
    const actionEventId = inferredAction === "CONTACT"
      ? norm(
        params.action_event_id || params.contact_event_id || params.event_id,
      )
      : norm(params.action_event_id);
    const inboxAction = inferredAction || "CONTACT";
    const isDeferredRetry = toBool(params.__deferred_retry);
    const deferredInboxId = norm(params.__inbox_id);
    const incomingPromoCodeForDedupe = derivePromoCodeFromPayload(params);
    const purchaseDedupeIdsForRequest = inferredAction === "PURCHASE"
      ? purchaseDedupeIdsFromPayload(params)
      : [];

    if (
      !isDeferredRetry &&
      actionEventId &&
      (inferredAction === "LEAD" || inferredAction === "COMPLETEREGISTRATION" ||
        inferredAction === "PURCHASE")
    ) {
      const shouldDeduplicateActionByPromo =
        isFullPromoCode(incomingPromoCodeForDedupe) &&
        (inferredAction === "LEAD" ||
          inferredAction === "COMPLETEREGISTRATION");
      const existing = shouldDeduplicateActionByPromo
        ? await findInboundByActionEventIdAndPromo(
          db,
          userId,
          inferredAction,
          actionEventId,
          incomingPromoCodeForDedupe,
        )
        : await findInboundByActionEventId(
          db,
          userId,
          inferredAction,
          actionEventId,
        );
      if (existing) {
        await writeLog(
          db,
          userId,
          "main",
          "INFO",
          shouldDeduplicateActionByPromo
            ? `Duplicado ${inferredAction} ignorado por action_event_id + promo_code`
            : "Duplicado ignorado por action_event_id",
          JSON.stringify({
            action: inferredAction,
            action_event_id: actionEventId,
            promo_code: incomingPromoCodeForDedupe,
            landing_name: landingName,
            existing_inbox_id: existing.id,
            existing_promo_code: existing.promo_code,
          }),
          undefined,
          undefined,
          undefined,
          safePayloadRaw(params),
          shouldDeduplicateActionByPromo
            ? "duplicado ignorado por action_event_id + promo_code"
            : "duplicado ignorado por action_event_id",
        );
        return textResponse(
          shouldDeduplicateActionByPromo
            ? "Duplicado ignorado (action_event_id + promo_code ya procesado)"
            : "Duplicado ignorado (action_event_id ya procesado)",
          200,
        );
      }

      if (shouldDeduplicateActionByPromo) {
        const reused = await findInboundByActionEventId(
          db,
          userId,
          inferredAction,
          actionEventId,
        );
        const reusedPromoCode = normalizePromoCode(reused?.promo_code ?? "");
        if (
          reused && reusedPromoCode &&
          reusedPromoCode !== incomingPromoCodeForDedupe
        ) {
          await writeLog(
            db,
            userId,
            "main",
            "WARN",
            "action_event_id reutilizado con promo_code distinto",
            JSON.stringify({
              action: inferredAction,
              action_event_id: actionEventId,
              promo_code: incomingPromoCodeForDedupe,
              existing_inbox_id: reused.id,
              existing_promo_code: reusedPromoCode,
            }),
            undefined,
            undefined,
            undefined,
            safePayloadRaw(params),
            "se procesa porque el promo_code es distinto",
          );
        }
      }
    }

    let inboxId: string | null = null;
    if (isDeferredRetry && deferredInboxId) {
      inboxId = deferredInboxId;
    } else {
      inboxId = await insertInboundEvent(
        db,
        userId,
        landingName,
        inboxAction,
        params,
      );
    }

    const markDeduplicated = async (
      response: Response,
      conversionId?: string,
    ): Promise<Response> => {
      const bodyText = await response.clone().text().catch(() => "");
      await finalizeInboundEvent(
        db,
        inboxId,
        "deduplicated",
        response.status,
        bodyText,
        conversionId,
      );
      return response;
    };

    const runAndFinalize = async (
      runner: (ctx: ProcessingContext) => Promise<Response>,
    ) => {
      const ctx: ProcessingContext = {};
      let response: Response;
      try {
        response = await runner(ctx);
      } catch (error) {
        await completePurchaseEventClaim(db, ctx, "error");
        throw error;
      }
      const bodyText = await response.clone().text().catch(() => "");
      const finalStatus: InboundStatus = ctx.inboxStatus ??
        (response.status >= 200 && response.status < 400
          ? "processed"
          : "error");
      await completePurchaseEventClaim(db, ctx, finalStatus);
      await finalizeInboundEvent(
        db,
        inboxId,
        finalStatus,
        response.status,
        bodyText,
        ctx.conversionId,
        ctx.inboxPromoCode,
      );
      return response;
    };

    // Route to the correct handler
    if (!rawAction && params.phone && params.amount) {
      return runAndFinalize((ctx) =>
        handleSimplePurchase(db, params, landing, cfg, pixelConfigs, ctx)
      );
    }
    if (inferredAction === "LEAD") {
      const incomingPromoCode = derivePromoCodeFromPayload(params);
      // Deferred queue mode: LEAD without promo_code waits and is retried by cron after 1h.
      if (!isFullPromoCode(incomingPromoCode) && !isDeferredRetry) {
        await writeLog(
          db,
          landing.user_id,
          "main",
          "INFO",
          "LEAD en espera por falta promo_code (deferred 1h)",
          JSON.stringify({
            action: "LEAD",
            action_event_id: actionEventId,
            bot_phone: sanitizePhone(params.bot_phone),
            timestamp: norm(params.timestamp),
            inbox_id: inboxId,
          }),
          undefined,
          undefined,
          undefined,
          safePayloadRaw(params),
          "lead en espera: faltante promo_code, reintento diferido",
        );
        const response = textResponse(
          "LEAD recibido y en espera para reintento diferido (1h)",
          202,
        );
        const bodyText = await response.clone().text().catch(() => "");
        await finalizeInboundEvent(
          db,
          inboxId,
          "deferred",
          response.status,
          bodyText,
        );
        return response;
      }
      return runAndFinalize((ctx) =>
        handleLead(db, params, landing, cfg, pixelConfigs, ctx)
      );
    }
    if (inferredAction === "COMPLETEREGISTRATION") {
      return runAndFinalize((ctx) =>
        handleCompleteRegistration(db, params, landing, cfg, pixelConfigs, ctx)
      );
    }
    if (inferredAction === "PURCHASE") {
      const purchaseDedupeIds = purchaseDedupeIdsForRequest;
      if (purchaseDedupeIds.length > 0) {
        const existingPurchase = await findPurchaseByDedupeIds(
          db,
          userId,
          purchaseDedupeIds,
        );
        if (existingPurchase) {
          await writeLog(
            db,
            userId,
            "main",
            "INFO",
            "Duplicado ignorado por coelsa_id/transaction_id",
            JSON.stringify({
              action: "PURCHASE",
              coelsa_id: normalizeCoelsaId(params.coelsa_id),
              transaction_id: normalizeTransactionId(params.transaction_id),
              dedupe_ids: purchaseDedupeIds,
              landing_name: landingName,
              existing_conversion_id: existingPurchase.id,
            }),
            existingPurchase.id,
            undefined,
            undefined,
            safePayloadRaw(params),
            "duplicado ignorado por coelsa_id/transaction_id",
          );
          return markDeduplicated(
            textResponse(
              "Duplicado ignorado (coelsa_id/transaction_id ya procesado)",
              200,
            ),
            existingPurchase.id,
          );
        }
      }

      const hasIsValidReceipt =
        Object.prototype.hasOwnProperty.call(params, "is_valid_receipt") ||
        Object.prototype.hasOwnProperty.call(params, "isValidReceipt");
      const isValidReceipt = toBool(
        Object.prototype.hasOwnProperty.call(params, "is_valid_receipt")
          ? params.is_valid_receipt
          : params.isValidReceipt,
      );
      if (hasIsValidReceipt && !isValidReceipt) {
        return runAndFinalize(async (_ctx) => {
          await writeLog(
            db,
            landing.user_id,
            "handlePurchase",
            "INFO",
            "PURCHASE recibido pero no procesado (is_valid_receipt=false)",
            JSON.stringify({
              action: "PURCHASE",
              is_valid_receipt:
                Object.prototype.hasOwnProperty.call(params, "is_valid_receipt")
                  ? params.is_valid_receipt
                  : params.isValidReceipt,
              action_event_id: norm(params.action_event_id),
              phone: norm(params.phone),
              promo_code: derivePromoCodeFromPayload(params),
            }),
            undefined,
            undefined,
            undefined,
            safePayloadRaw(params),
            "evento recibido pero no procesado por is_valid_receipt=false",
          );
          return textResponse(
            "Evento PURCHASE recibido pero no procesado: is_valid_receipt=false",
            200,
          );
        });
      }
      return runAndFinalize((ctx) =>
        handlePurchase(db, params, landing, cfg, pixelConfigs, ctx)
      );
    }

    if (inferredAction === "CONTACT") {
      return runAndFinalize((ctx) =>
        handleContact(db, params, landing, cfg, pixelConfigs, ctx)
      );
    }

    if (rawAction) {
      await writeLog(
        db,
        landing.user_id,
        "main",
        "ERROR",
        "Action desconocida recibida",
        JSON.stringify({ action: rawAction, payload: safePayloadRaw(params) }),
        undefined,
        undefined,
        undefined,
        safePayloadRaw(params),
        "action desconocida",
      );
      const response = textResponse(`Action desconocida: ${rawAction}`, 400);
      const bodyText = await response.clone().text().catch(() => "");
      await finalizeInboundEvent(
        db,
        inboxId,
        "error",
        response.status,
        bodyText,
      );
      return response;
    }

    if (rawEventName && eventNameAction !== "CONTACT") {
      await writeLog(
        db,
        landing.user_id,
        "main",
        "ERROR",
        "event_name invalido para flujo Contact",
        JSON.stringify({
          event_name: rawEventName,
          payload: safePayloadRaw(params),
        }),
        undefined,
        undefined,
        undefined,
        safePayloadRaw(params),
        "event_name invalido",
      );
      const response = textResponse(
        `event_name invalido para Contact: ${rawEventName}`,
        400,
      );
      const bodyText = await response.clone().text().catch(() => "");
      await finalizeInboundEvent(
        db,
        inboxId,
        "error",
        response.status,
        bodyText,
      );
      return response;
    }

    // Default: contact from landing
    return runAndFinalize((ctx) =>
      handleContact(db, params, landing, cfg, pixelConfigs, ctx)
    );
  } catch (err) {
    console.error("conversions error:", err);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const errDb = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await writeLog(
          errDb,
          "00000000-0000-0000-0000-000000000000",
          "main",
          "ERROR",
          "Error inesperado en handler",
          String(err),
        );
      }
    } catch { /* ignore */ }
    return textResponse("Error inesperado", 500);
  }
});
