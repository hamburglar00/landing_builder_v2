import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { frozenLandingCtaEvent } from "./landing_cta_event.ts";
import { normalizeMetaFbc, normalizeMetaFbp } from "./meta_cookies.ts";
import { resolveMetaActionSource } from "./meta_action_source.ts";
import { sanitizeMetaEventSourceUrl } from "./meta_source_url.ts";

// Shared types kept in sync with conversions/index.ts
export interface ConversionsConfig {
  capi_workspace_settings?: Record<string, boolean>;
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  send_lead_capi?: boolean;
  send_complete_registration_capi?: boolean;
  meta_ads_only_capi?: boolean;
  send_purchase_capi?: boolean;
  include_purchase_type_capi?: boolean;
  send_first_purchase_capi?: boolean;
  send_repeat_purchase_capi?: boolean;
  repeat_purchase_capi_window_days?: number | null;
  purchase_capi_min_amount_enabled?: boolean;
  purchase_capi_min_amount?: number;
  purchase_capi_min_amounts?: Record<string, number>;
  send_geo_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
}

export interface ConversionRow {
  id?: string;
  landing_id: string | null;
  user_id: string;
  landing_name: string;
  phone: string;
  email: string;
  fn: string;
  ln: string;
  ct: string;
  st: string;
  zip: string;
  country: string;
  fbp: string;
  fbc: string;
  from_meta_ads?: boolean;
  meta_origin_evidence?: import("./meta_origin.ts").MetaOriginEvidence;
  source_platform?: string;
  ctwa_clid?: string;
  atrio_id?: string;
  atrio_client_id?: string | null;
  atrio_slug?: string;
  atrio_players_id?: string;
  lead_atrio_id?: string;
  purchase_atrio_id?: string;
  registration_atrio_id?: string;
  lead_atrio_players_id?: string;
  purchase_atrio_players_id?: string;
  registration_atrio_players_id?: string;
  dataset_id?: string;
  pixel_id: string;
  meta_pixel_id?: string;
  pixel_attribution_source?: string;
  pixel_attribution_conversion_id?: string | null;
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
  purchase_status_capi: string;
  observaciones: string;
  external_id: string;
  landing?: string | null;
  landing_resolution?: string | null;
  facebook?: string | null;
  portofolio?: string | null;
  cp?: string | null;
  campana?: string | null;
  conjunto?: string | null;
  anuncio?: string | null;
  utm_campaign: string;
  telefono_asignado: string;
  assigned_gerencia_id?: number | null;
  assigned_gerencia_external_id?: number | null;
  assigned_gerencia_name?: string | null;
  assigned_gerencia_label?: string | null;
  promo_code: string;
  geo_city: string;
  geo_region: string;
  geo_country: string;
}

export function shouldSkipCapiForNonMetaOrigin(
  config: Pick<ConversionsConfig, "meta_ads_only_capi">,
  row: Pick<ConversionRow, "from_meta_ads" | "ctwa_clid">,
): boolean {
  return config.meta_ads_only_capi === true &&
    row.from_meta_ads !== true &&
    !normalizeCtwaClid(row.ctwa_clid);
}

export type PurchaseType = "first" | "repeat";

export type PurchaseCapiMinimumDecision = {
  enabled: boolean;
  amount: number;
  currency: string;
  threshold: number;
  reason:
    | "filter_disabled"
    | "currency_without_threshold"
    | "meets_threshold"
    | "below_threshold";
};

/**
 * Applies the destination pixel's monetary gate only to Meta CAPI delivery.
 * Legacy configurations without a pixel row retain their currency map.
 */
export function resolvePurchaseCapiMinimumDecision(
  config: Partial<Pick<
    ConversionsConfig,
    | "purchase_capi_min_amount_enabled"
    | "purchase_capi_min_amount"
    | "purchase_capi_min_amounts"
    | "meta_currency"
  >>,
  amountInput: unknown,
  currencyInput: unknown,
): PurchaseCapiMinimumDecision {
  const amount = Number(amountInput);
  const currency = String(currencyInput ?? "").trim().toUpperCase();

  if (config.purchase_capi_min_amount_enabled !== true) {
    return {
      enabled: true,
      amount,
      currency,
      threshold: 0,
      reason: "filter_disabled",
    };
  }

  const pixelCurrency = String(config.meta_currency ?? "").trim().toUpperCase();
  const configuredThreshold = config.purchase_capi_min_amount !== undefined
    ? (pixelCurrency === currency ? config.purchase_capi_min_amount : undefined)
    : config.purchase_capi_min_amounts?.[currency];

  if (configuredThreshold === undefined || configuredThreshold === null) {
    return {
      enabled: true,
      amount,
      currency,
      threshold: 0,
      reason: "currency_without_threshold",
    };
  }

  const numericThreshold = Number(configuredThreshold);
  const threshold = Number.isFinite(numericThreshold) && numericThreshold >= 0
    ? numericThreshold
    : 0;
  const enabled = Number.isFinite(amount) && amount >= threshold;

  return {
    enabled,
    amount,
    currency,
    threshold,
    reason: enabled ? "meets_threshold" : "below_threshold",
  };
}

export type RepeatPurchaseCapiWindowDecision = {
  enabled: boolean;
  reason: "unlimited" | "within_window" | "outside_window" |
    "invalid_window" | "missing_event_time" | "event_before_first";
};

/** The event timestamp, rather than the retry timestamp, determines eligibility. */
export function resolveRepeatPurchaseCapiWindowDecision(
  windowDays: number | null | undefined,
  firstPurchaseEventTime: number | null,
  repeatPurchaseEventTime: number | null,
): RepeatPurchaseCapiWindowDecision {
  if (windowDays == null) return { enabled: true, reason: "unlimited" };
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 30) {
    return { enabled: false, reason: "invalid_window" };
  }
  if (
    !Number.isFinite(firstPurchaseEventTime) ||
    !Number.isFinite(repeatPurchaseEventTime) ||
    (firstPurchaseEventTime ?? 0) <= 0 ||
    (repeatPurchaseEventTime ?? 0) <= 0
  ) {
    return { enabled: false, reason: "missing_event_time" };
  }
  const elapsed = repeatPurchaseEventTime! - firstPurchaseEventTime!;
  if (elapsed < 0) return { enabled: false, reason: "event_before_first" };
  return {
    enabled: elapsed <= windowDays * 24 * 60 * 60,
    reason: elapsed <= windowDays * 24 * 60 * 60
      ? "within_window"
      : "outside_window",
  };
}

/** Uses the same client, phone and currency scope as repeat classification. */
export async function findFirstPurchaseEventTime(
  db: SupabaseClient,
  userId: string,
  phone: string,
  currency: string,
  excludeRowId: string,
): Promise<number | null> {
  if (!userId || !phone || !currency) return null;
  const base = () => db.from("conversions")
    .select("purchase_event_time, created_at")
    .eq("user_id", userId)
    .eq("phone", phone)
    .eq("currency", currency.trim().toUpperCase())
    .eq("estado", "purchase")
    .neq("id", excludeRowId);
  const { data: first, error: firstError } = await base()
    .eq("purchase_type", "first")
    .order("created_at", { ascending: true })
    .limit(1).maybeSingle();
  if (firstError) throw firstError;
  let anchor = first;
  if (!anchor) {
    const { data: oldest, error } = await base()
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    if (error) throw error;
    anchor = oldest;
  }
  const eventTime = Number(anchor?.purchase_event_time);
  if (Number.isFinite(eventTime) && eventTime > 0) return eventTime;
  const recordedTime = Date.parse(String(anchor?.created_at ?? ""));
  return Number.isFinite(recordedTime) && recordedTime > 0
    ? Math.floor(recordedTime / 1000)
    : null;
}

export type PurchaseCapiDecision = {
  enabled: boolean;
  includePurchaseType: boolean;
  reason:
    | "enabled_standard"
    | "enabled_first"
    | "enabled_repeat"
    | "purchase_disabled"
    | "first_disabled"
    | "repeat_disabled";
};

/**
 * Purchase is always classified internally. This decision only controls what is
 * delivered to Meta and whether the internal type is exposed in custom_data.
 */
export function resolvePurchaseCapiDecision(
  config: Pick<
    ConversionsConfig,
    | "send_purchase_capi"
    | "include_purchase_type_capi"
    | "send_first_purchase_capi"
    | "send_repeat_purchase_capi"
  >,
  purchaseType: PurchaseType,
): PurchaseCapiDecision {
  if (config.send_purchase_capi === false) {
    return {
      enabled: false,
      includePurchaseType: config.include_purchase_type_capi !== false,
      reason: "purchase_disabled",
    };
  }

  const includePurchaseType = config.include_purchase_type_capi !== false;
  if (!includePurchaseType) {
    return {
      enabled: true,
      includePurchaseType: false,
      reason: "enabled_standard",
    };
  }

  const typeEnabled = purchaseType === "repeat"
    ? (config.send_repeat_purchase_capi ?? true)
    : (config.send_first_purchase_capi ?? true);
  return {
    enabled: typeEnabled,
    includePurchaseType: true,
    reason: typeEnabled
      ? (purchaseType === "repeat" ? "enabled_repeat" : "enabled_first")
      : (purchaseType === "repeat" ? "repeat_disabled" : "first_disabled"),
  };
}

export function preparePurchaseCustomDataForMeta(
  customData: Record<string, unknown>,
  includePurchaseType: boolean,
): Record<string, unknown> {
  const prepared = { ...customData };
  if (!includePurchaseType) delete prepared.purchase_type;
  return prepared;
}

export type MetaEventName =
  | "Contact"
  | "Lead"
  | "CompleteRegistration"
  | "Purchase";

export interface MetaUserData {
  [key: string]: string;
}

export function sanitizePhone(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export type PurchaseAmountNormalization =
  | {
    ok: true;
    value: number;
    inputFormat:
      | "number"
      | "plain"
      | "decimal_dot"
      | "decimal_comma"
      | "grouped_dot"
      | "grouped_comma"
      | "grouped_space"
      | "grouped_dot_decimal_comma"
      | "grouped_comma_decimal_dot";
  }
  | {
    ok: false;
    reason:
      | "missing"
      | "unsupported_type"
      | "invalid_format"
      | "non_finite"
      | "non_positive"
      | "too_many_decimals"
      | "unsafe_precision";
  };

function finalizePurchaseAmount(
  value: number,
  inputFormat: Extract<
    PurchaseAmountNormalization,
    { ok: true }
  >["inputFormat"],
): PurchaseAmountNormalization {
  if (!Number.isFinite(value)) return { ok: false, reason: "non_finite" };
  if (value <= 0) return { ok: false, reason: "non_positive" };

  const rounded = Math.round(value * 100) / 100;
  if (rounded <= 0) return { ok: false, reason: "non_positive" };
  if (Math.abs(value - rounded) > 1e-9) {
    return { ok: false, reason: "too_many_decimals" };
  }
  if (!Number.isSafeInteger(Math.round(rounded * 100))) {
    return { ok: false, reason: "unsafe_precision" };
  }

  return { ok: true, value: rounded, inputFormat };
}

/**
 * Converts inbound monetary values to the JSON number Meta expects.
 *
 * Numeric JSON is preferred. String input is accepted only when the complete
 * value matches a supported canonical or thousands-grouped monetary format.
 * Partial parsing (for example "100000ARS") is intentionally rejected.
 */
export function normalizePurchaseAmount(
  value: unknown,
): PurchaseAmountNormalization {
  if (typeof value === "number") {
    return finalizePurchaseAmount(value, "number");
  }
  if (typeof value !== "string") {
    return value == null
      ? { ok: false, reason: "missing" }
      : { ok: false, reason: "unsupported_type" };
  }

  const raw = value.trim();
  if (!raw) return { ok: false, reason: "missing" };

  let normalized = "";
  let inputFormat: Extract<
    PurchaseAmountNormalization,
    { ok: true }
  >["inputFormat"];

  if (/^\d+$/.test(raw)) {
    normalized = raw;
    inputFormat = "plain";
  } else if (/^\d+\.\d{1,2}$/.test(raw)) {
    normalized = raw;
    inputFormat = "decimal_dot";
  } else if (/^\d+,\d{1,2}$/.test(raw)) {
    normalized = raw.replace(",", ".");
    inputFormat = "decimal_comma";
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    normalized = raw.replaceAll(".", "");
    inputFormat = "grouped_dot";
  } else if (/^\d{1,3}(?:,\d{3})+$/.test(raw)) {
    normalized = raw.replaceAll(",", "");
    inputFormat = "grouped_comma";
  } else if (/^\d{1,3}(?:[ \u00A0]\d{3})+$/.test(raw)) {
    normalized = raw.replace(/[ \u00A0]/g, "");
    inputFormat = "grouped_space";
  } else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(raw)) {
    normalized = raw.replaceAll(".", "").replace(",", ".");
    inputFormat = "grouped_dot_decimal_comma";
  } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(raw)) {
    normalized = raw.replaceAll(",", "");
    inputFormat = "grouped_comma_decimal_dot";
  } else {
    return { ok: false, reason: "invalid_format" };
  }

  return finalizePurchaseAmount(Number(normalized), inputFormat);
}

const SUPPORTED_META_CURRENCY_CODES = new Set([
  "ARS",
  "PYG",
  "USD",
  "EUR",
  "BRL",
  "CLP",
  "MXN",
  "COP",
]);

function isSupportedMetaCurrencyCode(value: string): boolean {
  return SUPPORTED_META_CURRENCY_CODES.has(value);
}

export function normalizeCurrencyCode(
  value: unknown,
  fallback: unknown = "ARS",
): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (isSupportedMetaCurrencyCode(normalized)) return normalized;
  const normalizedFallback = String(fallback ?? "").trim().toUpperCase();
  return isSupportedMetaCurrencyCode(normalizedFallback)
    ? normalizedFallback
    : "ARS";
}

export function sanitizeIp(v: unknown): string {
  let ip = String(v ?? "").trim();
  if (!ip) return "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) ip = bracketed[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(":")[0];
  }
  // Never repair arbitrary text into an apparently real client IP.
  if (!/^[\dA-Fa-f:.]+$/.test(ip)) return "";
  return ip;
}

function isValidPublicIpv4(ip: string): boolean {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(ip)) return false;
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
  let canonical: string;
  try {
    canonical = new URL(`http://[${lower}]/`).hostname.slice(1, -1);
  } catch { return false; }
  if (canonical === "::" || canonical === "::1") return false;
  if (
    canonical.startsWith("fc") || canonical.startsWith("fd") ||
    /^fe[89ab]/.test(canonical) || /^fe[cdef]/.test(canonical)
  ) return false;
  if (canonical.startsWith("ff")) return false;
  if (canonical.startsWith("2001:db8:")) return false;
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(canonical);
  if (mapped) {
    const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
    return isValidPublicIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return true;
}

export function normalizePublicClientIp(rawIp: unknown): string {
  const ip = sanitizeIp(rawIp);
  if (!ip) return "";
  if (!ip.includes(":") && ip.includes(".") && isValidPublicIpv4(ip)) return ip;
  if (ip.includes(":") && isLikelyPublicIpv6(ip)) return ip;
  return "";
}

export function normalizeIpToMeta(rawIp: string): Record<string, string> {
  const ip = normalizePublicClientIp(rawIp);
  if (!ip) return {};
  return { client_ip_address: ip };
}

export async function sha256(value: string): Promise<string> {
  return await sha256Exact(value.trim().toLowerCase());
}

async function sha256Exact(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeBase(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeEmail(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePhoneForMeta(value: string): string {
  let phone = String(value ?? "").trim().replace(/[^\d]/g, "");
  if (!phone) return "";
  // Common cleanup for intl prefix typed as 00...
  phone = phone.replace(/^0+/, "");
  return phone;
}

function normalizeName(value: string): string {
  // Meta recommends lowercase and removing punctuation/symbols.
  return String(value ?? "").trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, "")
    .replace(/\s+/g, "");
}

function normalizeExternalId(value: string): string {
  // This is an opaque advertiser ID, also given to Pixel. Do not turn two
  // different case/accent/space-sensitive identifiers into the same identity.
  return String(value ?? "").trim();
}

function normalizeCity(value: string): string {
  return normalizeBase(value).replace(/\s+/g, "");
}

function normalizePostalCode(value: string): string {
  return normalizeBase(value).replace(/[\s-]/g, "");
}

function normalizeCountry(value: string): string {
  const s = normalizeBase(value).replace(/[^a-z]/g, "");
  if (s.length === 2) return s;
  const known: Record<string, string> = {
    argentina: "ar",
    mexico: "mx",
    uruguay: "uy",
    paraguay: "py",
    chile: "cl",
    bolivia: "bo",
    peru: "pe",
    colombia: "co",
    brasil: "br",
    brazil: "br",
    espana: "es",
    spain: "es",
    usa: "us",
    eeuu: "us",
    estadosunidos: "us",
    unitedstates: "us",
  };
  return known[s] ?? s;
}

function normalizeState(value: string, countryRaw: string): string {
  const country = normalizeCountry(countryRaw);
  let s = normalizeBase(value).replace(/[^\p{L}\p{N}\s]/gu, "");
  s = s.replace(/\s+/g, "");

  if (country === "us") {
    const us: Record<string, string> = {
      california: "ca",
      texas: "tx",
      florida: "fl",
      newyork: "ny",
      illinois: "il",
      pennsylvania: "pa",
      ohio: "oh",
      georgia: "ga",
      northcarolina: "nc",
      michigan: "mi",
      newjersey: "nj",
      virginia: "va",
      washington: "wa",
      arizona: "az",
      massachusetts: "ma",
      tennessee: "tn",
      indiana: "in",
      missouri: "mo",
      maryland: "md",
      wisconsin: "wi",
      colorado: "co",
      minnesota: "mn",
      southcarolina: "sc",
      alabama: "al",
      louisiana: "la",
      kentucky: "ky",
      oregon: "or",
      oklahoma: "ok",
      connecticut: "ct",
      utah: "ut",
      iowa: "ia",
      nevada: "nv",
      arkansas: "ar",
      mississippi: "ms",
      kansas: "ks",
      newmexico: "nm",
      nebraska: "ne",
      idaho: "id",
      westvirginia: "wv",
      hawaii: "hi",
      newhampshire: "nh",
      maine: "me",
      montana: "mt",
      rhodeisland: "ri",
      delaware: "de",
      southdakota: "sd",
      northdakota: "nd",
      alaska: "ak",
      districtofcolumbia: "dc",
      vermont: "vt",
      wyoming: "wy",
    };
    if (s.length === 2) return s;
    return us[s] ?? s;
  }

  return s;
}

export async function buildUserData(
  row: ConversionRow,
  includeGeo = true,
): Promise<MetaUserData> {
  const ud: MetaUserData = {};
  const normalizedCountry = includeGeo ? normalizeCountry(row.country) : "";
  const normalizedState = includeGeo ? normalizeState(row.st, row.country) : "";
  const normalizedCity = includeGeo ? normalizeCity(row.ct) : "";
  const normalizedZip = includeGeo ? normalizePostalCode(row.zip) : "";
  const email = normalizeEmail(String(row.email ?? ""));
  const phone = normalizePhoneForMeta(String(row.phone ?? ""));
  const firstName = normalizeName(String(row.fn ?? ""));
  const lastName = normalizeName(String(row.ln ?? ""));
  const externalId = normalizeExternalId(String(row.external_id ?? ""));

  if (email) ud.em = await sha256(email);
  if (phone) ud.ph = await sha256(phone);
  if (firstName) ud.fn = await sha256(firstName);
  if (lastName) ud.ln = await sha256(lastName);
  if (normalizedCity) ud.ct = await sha256(normalizedCity);
  if (normalizedState) ud.st = await sha256(normalizedState);
  if (normalizedZip) ud.zp = await sha256(normalizedZip);
  if (normalizedCountry) ud.country = await sha256(normalizedCountry);
  const normalizedFbp = normalizeMetaFbp(row.fbp);
  const normalizedFbc = normalizeMetaFbc(row.fbc);
  if (normalizedFbp) ud.fbp = normalizedFbp;
  if (normalizedFbc) ud.fbc = normalizedFbc;
  if (row.client_ip) Object.assign(ud, normalizeIpToMeta(row.client_ip));
  if (row.agent_user) ud.client_user_agent = row.agent_user;
  if (externalId) ud.external_id = await sha256Exact(externalId);
  return ud;
}

export async function buildBusinessMessagingUserData(
  row: ConversionRow,
  includeGeo = true,
  options: { includeNames?: boolean } = {},
): Promise<MetaUserData> {
  const ud: MetaUserData = {};
  const includeNames = options.includeNames !== false;
  const normalizedCountry = includeGeo ? normalizeCountry(row.country) : "";
  const normalizedState = includeGeo ? normalizeState(row.st, row.country) : "";
  const normalizedCity = includeGeo ? normalizeCity(row.ct) : "";
  const normalizedZip = includeGeo ? normalizePostalCode(row.zip) : "";
  const email = normalizeEmail(String(row.email ?? ""));
  const phone = normalizePhoneForMeta(String(row.phone ?? ""));
  const firstName = includeNames ? normalizeName(String(row.fn ?? "")) : "";
  const lastName = includeNames ? normalizeName(String(row.ln ?? "")) : "";
  const externalId = normalizeExternalId(String(row.external_id ?? ""));

  if (email) ud.em = await sha256(email);
  if (phone) ud.ph = await sha256(phone);
  if (firstName) ud.fn = await sha256(firstName);
  if (lastName) ud.ln = await sha256(lastName);
  if (normalizedCity) ud.ct = await sha256(normalizedCity);
  if (normalizedState) ud.st = await sha256(normalizedState);
  if (normalizedZip) ud.zp = await sha256(normalizedZip);
  if (normalizedCountry) ud.country = await sha256(normalizedCountry);
  if (externalId) ud.external_id = await sha256Exact(externalId);
  return ud;
}

export interface MetaRequest {
  apiUrl: string;
  body: Record<string, unknown>;
  eventPayload: Record<string, unknown>;
}

export interface MetaBusinessMessagingConfig {
  dataset_id: string;
  whatsapp_business_account_id: string;
  meta_access_token: string;
  meta_api_version: string;
  meta_currency: string;
}

/**
 * ctwa_clid is an opaque Meta identifier. It must be sent raw (not hashed).
 * Empty values and unresolved Chatrace template placeholders are rejected.
 */
export function normalizeCtwaClid(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 2048) return "";
  if (/^(?:null|undefined)$/i.test(normalized)) return "";
  if (
    normalized.includes("{{") ||
    normalized.includes("}}") ||
    normalized.includes("<") ||
    normalized.includes(">")
  ) {
    return "";
  }
  return normalized;
}

export type PurchaseCapiRoute = "website" | "business_messaging";

export interface PurchaseCapiRouteDecision {
  route: PurchaseCapiRoute;
  reason:
    | "eligible_chatrace_ctwa"
    | "eligible_whatsapp_cloud_api_ctwa"
    | "source_not_click_to_whatsapp"
    | "business_messaging_disabled"
    | "missing_ctwa_clid"
    | "missing_business_messaging_config";
}

/**
 * Business Messaging is deliberately limited to Click-to-WhatsApp origins.
 * Chatrace keeps its explicit opt-in switch. WhatsApp Cloud API is the
 * official endpoint we control, so it can use the route when attribution data
 * and destination config are present.
 */
export function resolvePurchaseCapiRoute(input: {
  source_platform: unknown;
  business_messaging_enabled: boolean;
  business_messaging_configured: boolean;
  ctwa_clid: unknown;
}): PurchaseCapiRouteDecision {
  const source = String(input.source_platform ?? "").trim().toLowerCase();
  const isChatrace = source === "chatrace";
  const isWhatsappCloudApi = source === "whatsapp_cloud_api";
  if (!isChatrace && !isWhatsappCloudApi) {
    return { route: "website", reason: "source_not_click_to_whatsapp" };
  }
  if (isChatrace && !input.business_messaging_enabled) {
    return { route: "website", reason: "business_messaging_disabled" };
  }
  if (!normalizeCtwaClid(input.ctwa_clid)) {
    return { route: "website", reason: "missing_ctwa_clid" };
  }
  if (!input.business_messaging_configured) {
    return { route: "website", reason: "missing_business_messaging_config" };
  }
  return {
    route: "business_messaging",
    reason: isWhatsappCloudApi
      ? "eligible_whatsapp_cloud_api_ctwa"
      : "eligible_chatrace_ctwa",
  };
}

/**
 * Payload aligned with Meta's WhatsApp Business Messaging CAPI shape.
 * Attribution uses only the WABA + raw ctwa_clid pair.
 */
export function buildMetaBusinessMessagingRequest(
  config: MetaBusinessMessagingConfig,
  eventName: Extract<MetaEventName, "Lead" | "Purchase">,
  ctwaClid: string,
  eventTime: number,
  customData?: Record<string, unknown>,
  additionalUserData: MetaUserData = {},
): MetaRequest {
  const businessMessagingEventName = eventName === "Lead"
    ? "LeadSubmitted"
    : eventName;
  const eventPayload: Record<string, unknown> = {
    event_name: businessMessagingEventName,
    event_time: eventTime,
    action_source: "business_messaging",
    messaging_channel: "whatsapp",
    user_data: {
      ...additionalUserData,
      whatsapp_business_account_id: config.whatsapp_business_account_id,
      ctwa_clid: ctwaClid,
    },
  };
  if (customData) eventPayload.custom_data = customData;
  const body: Record<string, unknown> = { data: [eventPayload] };
  const apiVersion = String(config.meta_api_version || "v26.0").trim();
  const apiUrl =
    `https://graph.facebook.com/${apiVersion}/${config.dataset_id}/events?access_token=${
      encodeURIComponent(config.meta_access_token)
    }`;
  return { apiUrl, body, eventPayload };
}

export function buildMetaBusinessMessagingPurchaseRequest(
  config: MetaBusinessMessagingConfig,
  ctwaClid: string,
  eventTime: number,
  value: number,
  additionalUserData: MetaUserData = {},
  purchaseType: "first" | "repeat" | null = null,
): MetaRequest {
  return buildMetaBusinessMessagingRequest(
    config,
    "Purchase",
    ctwaClid,
    eventTime,
    {
      currency: config.meta_currency,
      value,
      ...(purchaseType ? { purchase_type: purchaseType } : {}),
    },
    additionalUserData,
  );
}

export async function buildMetaRequest(
  config: ConversionsConfig,
  row: ConversionRow,
  eventName: MetaEventName,
  eventId: string,
  eventTime: number,
  customData?: Record<string, unknown>,
  overrideTestEventCode?: string,
): Promise<MetaRequest> {
  const userData = await buildUserData(row, config.send_geo_capi !== false);
  const actionSource = resolveMetaActionSource(row, eventName);
  const srcUrl = sanitizeMetaEventSourceUrl(row.event_source_url);
  const metaEventName = eventName === "Contact" ? frozenLandingCtaEvent(row) || eventName : eventName;

  // deno-lint-ignore no-explicit-any
  const eventPayload: Record<string, any> = {
    event_name: metaEventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: actionSource,
    ...(actionSource === "website" ? { event_source_url: srcUrl } : {}),
    user_data: userData,
  };
  if (customData || metaEventName === "CompleteRegistration") eventPayload.custom_data = {
    ...(metaEventName === "CompleteRegistration" ? { status: "registered" } : {}), ...customData,
  };

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = { data: [eventPayload] };
  const testCode = overrideTestEventCode;
  if (testCode) body.test_event_code = testCode;

  const apiUrl =
    `https://graph.facebook.com/${config.meta_api_version}/${config.pixel_id}/events?access_token=${config.meta_access_token}`;
  return { apiUrl, body, eventPayload };
}

export function generateEventId(): string {
  return crypto.randomUUID();
}

export function resolvePurchaseRetryIdentity(
  persistedEventId: unknown,
  persistedEventTime: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  createEventId: () => string = generateEventId,
): {
  eventId: string;
  eventTime: number;
  needsPersistence: boolean;
} {
  const currentEventId = String(persistedEventId ?? "").trim();
  const currentEventTime = Number(persistedEventTime);
  const hasEventId = Boolean(currentEventId);
  const hasEventTime = Number.isFinite(currentEventTime) &&
    currentEventTime > 0;

  return {
    eventId: hasEventId ? currentEventId : createEventId(),
    eventTime: hasEventTime
      ? Math.floor(currentEventTime)
      : Math.floor(nowSeconds),
    needsPersistence: !hasEventId || !hasEventTime,
  };
}

export function toValidEventTime(value: unknown): number {
  const n = Number(value);
  const now = Math.floor(Date.now() / 1000);
  if (!isNaN(n) && n > 0) return Math.floor(n);
  return now;
}

export async function pickRandomConversionRow(
  db: SupabaseClient,
): Promise<ConversionRow | null> {
  const { data, error } = await db
    .from("conversions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data || data.length === 0) return null;
  const idx = Math.floor(Math.random() * data.length);
  // deno-lint-ignore no-explicit-any
  return data[idx] as any as ConversionRow;
}

export function buildFakeConversionRow(event: MetaEventName): ConversionRow {
  return {
    landing_id: null,
    user_id: "00000000-0000-0000-0000-000000000000",
    landing_name: "fake-landing",
    phone: "5491160000000",
    email: "test@example.com",
    fn: "Juan",
    ln: "Perez",
    ct: "Buenos Aires",
    st: "Buenos Aires",
    zip: "1000",
    country: "AR",
    fbp: "fb.1.1699999999000.1234567890",
    fbc: "fb.1.1699999999000.AbCdEfGhIj",
    pixel_id: "",
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
    purchase_type: null,
    client_ip: "201.213.0.10",
    agent_user: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    device_type: "desktop",
    event_source_url: "https://fake-landing.test/landing",
    estado: event === "Purchase"
      ? "purchase"
      : event === "Lead"
      ? "lead"
      : "contact",
    valor: event === "Purchase" ? 10000 : 0,
    currency: "ARS",
    contact_status_capi: "",
    lead_status_capi: "",
    purchase_status_capi: "",
    observaciones: "",
    external_id: "fake-external-id",
    utm_campaign: "fake-campaign",
    telefono_asignado: "",
    promo_code: "",
    geo_city: "Buenos Aires",
    geo_region: "Buenos Aires",
    geo_country: "Argentina",
  };
}

// Purchase helpers shared between production and tests

/** Indica si el telefono ya tiene al menos una compra registrada (para detectar recargas).
 * No depende de purchase_status_capi: una compra cuenta aunque Meta CAPI haya fallado. */
export async function hasPreviousSuccessfulPurchases(
  db: SupabaseClient,
  userId: string,
  phone: string,
): Promise<boolean> {
  const { count } = await db
    .from("conversions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("phone", phone)
    .eq("estado", "purchase");

  return (count ?? 0) > 0;
}
