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

const norm = (s: unknown): string => String(s ?? "").trim();

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

/** Normaliza según requisitos Meta: city sin espacios, zip sin espacios ni guiones. */
function normalizeForMetaHash(value: string, field: "ct" | "zp"): string {
  let s = value.trim().toLowerCase();
  if (field === "zp") s = s.replace(/[\s-]/g, "");
  if (field === "ct") s = s.replace(/\s/g, "");
  return s;
}

export async function buildUserData(row: ConversionRow): Promise<MetaUserData> {
  const ud: MetaUserData = {};
  if (row.email) ud.em = await sha256(row.email);
  if (row.phone) ud.ph = await sha256(sanitizePhone(row.phone));
  if (row.fn) ud.fn = await sha256(row.fn);
  if (row.ln) ud.ln = await sha256(row.ln);
  if (row.ct) ud.ct = await sha256(normalizeForMetaHash(row.ct, "ct"));
  if (row.st) ud.st = await sha256(row.st);
  if (row.zip) ud.zp = await sha256(normalizeForMetaHash(row.zip, "zp"));
  if (row.country) ud.country = await sha256(row.country);
  if (row.fbp) ud.fbp = row.fbp;
  if (row.fbc) ud.fbc = row.fbc;
  if (row.client_ip) Object.assign(ud, normalizeIpToMeta(row.client_ip));
  if (row.agent_user) ud.client_user_agent = row.agent_user;
  if (row.external_id) ud.external_id = await sha256(row.external_id);
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
    action_source: "website",
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
  const now = Math.floor(Date.now() / 1000);
  return {
    landing_id: null,
    user_id: "00000000-0000-0000-0000-000000000000",
    landing_name: "fake-landing",
    phone: "5491160000000",
    email: "test@example.com",
    fn: "Juan",
    ln: "Pérez",
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

// ─── Purchase helpers shared between production and tests ────────────────────

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
    .eq("purchase_status_capi", "enviado");

  return (count ?? 0) > 0;
}


