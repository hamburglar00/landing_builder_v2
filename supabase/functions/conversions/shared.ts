import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared types kept in sync with conversions/index.ts
export interface ConversionsConfig {
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  test_event_code: string;
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
  contact_event_id: string;
  contact_event_time: number | null;
  lead_event_id: string;
  lead_event_time: number | null;
  purchase_event_id: string;
  purchase_event_time: number | null;
  purchase_type?: "first" | "repeat" | null;
  client_ip: string;
  agent_user: string;
  device_type: string;
  event_source_url: string;
  estado: string;
  valor: number;
  contact_status_capi: string;
  lead_status_capi: string;
  purchase_status_capi: string;
  observaciones: string;
  external_id: string;
  utm_campaign: string;
  telefono_asignado: string;
  promo_code: string;
  geo_city: string;
  geo_region: string;
  geo_country: string;
}

export type MetaEventName = "Contact" | "Lead" | "Purchase";

export interface MetaUserData {
  [key: string]: string;
}

export function sanitizePhone(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function sanitizeIp(v: unknown): string {
  let ip = String(v ?? "").trim();
  if (!ip) return "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  ip = ip.replace(/[^\dA-Fa-f:.]/g, "");
  return ip;
}

export function normalizeIpToMeta(rawIp: string): Record<string, string> {
  let ip = sanitizeIp(rawIp);
  if (!ip) return {};
  if (!ip.includes(".") && !ip.includes(":") && ip.length === 12) {
    ip = ip.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, "$1.$2.$3.$4");
  }
  if (!ip.includes(".") && !ip.includes(":") && ip.length >= 8 && ip.length <= 11) {
    const m = ip.match(/\d{1,3}/g);
    if (m) ip = m.join(".");
  }
  return { client_ip_address: ip };
}

export async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
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

export async function buildUserData(row: ConversionRow): Promise<MetaUserData> {
  const ud: MetaUserData = {};
  const normalizedCountry = normalizeCountry(row.country);
  const normalizedState = normalizeState(row.st, row.country);
  const normalizedCity = normalizeCity(row.ct);
  const normalizedZip = normalizePostalCode(row.zip);
  const email = String(row.email ?? "").trim();
  const phone = sanitizePhone(row.phone);
  const firstName = String(row.fn ?? "").trim();
  const lastName = String(row.ln ?? "").trim();
  const externalId = String(row.external_id ?? "").trim();

  if (email) ud.em = await sha256(email);
  if (phone) ud.ph = await sha256(phone);
  if (firstName) ud.fn = await sha256(firstName);
  if (lastName) ud.ln = await sha256(lastName);
  if (normalizedCity) ud.ct = await sha256(normalizedCity);
  if (normalizedState) ud.st = await sha256(normalizedState);
  if (normalizedZip) ud.zp = await sha256(normalizedZip);
  if (normalizedCountry) ud.country = await sha256(normalizedCountry);
  if (row.fbp) ud.fbp = row.fbp;
  if (row.fbc) ud.fbc = row.fbc;
  if (row.client_ip) Object.assign(ud, normalizeIpToMeta(row.client_ip));
  if (row.agent_user) ud.client_user_agent = row.agent_user;
  if (externalId) ud.external_id = await sha256(externalId);
  return ud;
}

export interface MetaRequest {
  apiUrl: string;
  body: Record<string, unknown>;
  eventPayload: Record<string, unknown>;
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
  const userData = await buildUserData(row);
  const srcUrl = row.event_source_url || "";

  // deno-lint-ignore no-explicit-any
  const eventPayload: Record<string, any> = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: eventName === "Contact" ? "website" : "business_messaging",
    event_source_url: srcUrl,
    user_data: userData,
  };
  if (customData) eventPayload.custom_data = customData;

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = { data: [eventPayload] };
  const testCode = overrideTestEventCode ?? config.test_event_code;
  if (testCode) body.test_event_code = testCode;

  const apiUrl = `https://graph.facebook.com/${config.meta_api_version}/${config.pixel_id}/events?access_token=${config.meta_access_token}`;
  return { apiUrl, body, eventPayload };
}

export function generateEventId(): string {
  return crypto.randomUUID();
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
    fbp: "fb.1.1699999999.1234567890",
    fbc: "fb.1.1699999999.AbCdEfGhIj",
    contact_event_id: "",
    contact_event_time: null,
    lead_event_id: "",
    lead_event_time: null,
    purchase_event_id: "",
    purchase_event_time: null,
    purchase_type: null,
    client_ip: "201.213.0.10",
    agent_user: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    device_type: "desktop",
    event_source_url: "https://fake-landing.test/landing",
    estado: event === "Purchase" ? "purchase" : event === "Lead" ? "lead" : "contact",
    valor: event === "Purchase" ? 10000 : 0,
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
