import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildMetaRequest,
  type ConversionRow as SharedConversionRow,
  type ConversionsConfig as SharedConversionsConfig,
  generateEventId as sharedGenerateEventId,
  toValidEventTime,
  hasPreviousSuccessfulPurchases,
} from "./shared.ts";


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
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  is_default: boolean;
}

interface LandingRow {
  id: string;
  name: string;
  user_id: string;
}

interface ConversionRow {
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
  meta_pixel_id: string;
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
  test_event_code?: string;
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

interface GeoResult {
  geo_city: string;
  geo_region: string;
  geo_country: string;
  ct: string;
  st: string;
  country: string;
  zip: string;
}

type InboundStatus = "received" | "processed" | "error";

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;


const norm = (s: unknown): string => String(s ?? "").trim();

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

function sanitizePhone(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
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

function extractClientIpFromHeaders(req: Request): string {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-vercel-forwarded-for"),
    req.headers.get("fly-client-ip"),
  ];

  for (const c of candidates) {
    const ip = sanitizeIp(c);
    if (ip) return ip;
  }
  return "";
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function normalizeIpToMeta(rawIp: string): Record<string, string> {
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
  return new Response(msg, { status, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
}

async function insertInboundEvent(
  db: SupabaseClient,
  userId: string,
  landingName: string,
  action: string,
  payload: Params,
): Promise<string | null> {
  const { data } = await db
    .from("conversion_inbox")
    .insert({
      user_id: userId,
      landing_name: landingName,
      action,
      action_event_id: norm(payload.action_event_id),
      promo_code: norm(payload.promo_code),
      phone: sanitizePhone(payload.phone),
      payload_raw: safePayloadRaw(payload),
      status: "received",
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

async function findInboundByActionEventId(
  db: SupabaseClient,
  userId: string,
  action: string,
  actionEventId: string,
): Promise<{ id: string; status: InboundStatus; http_status: number | null; response_body: string } | null> {
  if (!actionEventId) return null;
  const { data } = await db
    .from("conversion_inbox")
    .select("id, status, http_status, response_body")
    .eq("user_id", userId)
    .eq("action", action)
    .eq("action_event_id", actionEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; status: InboundStatus; http_status: number | null; response_body: string } | null) ?? null;
}

async function finalizeInboundEvent(
  db: SupabaseClient,
  inboxId: string | null,
  status: InboundStatus,
  httpStatus: number,
  responseBody: string,
  conversionId?: string,
): Promise<void> {
  if (!inboxId) return;
  await db.from("conversion_inbox").update({
    status,
    http_status: httpStatus,
    response_body: (responseBody ?? "").slice(0, 4000),
    conversion_id: conversionId ?? null,
    processed_at: new Date().toISOString(),
  }).eq("id", inboxId);
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
): Promise<void> {
  try {
    await db.from("conversion_logs").insert({
      user_id: userId,
      conversion_id: conversionId ?? null,
      function_name: fn,
      level,
      message,
      detail: detail.slice(0, 4000),
      payload_meta: (payloadMeta ?? "").slice(0, 20000),
      response_meta: (responseMeta ?? "").slice(0, 20000),
    });
  } catch {
    // non-critical
  }
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
      headers: { "User-Agent": "landing-builder-capi/1.0", Accept: "application/json" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;
    const city = norm(json.city);
    const region = norm(json.region || json.region_name);
    const countryName = norm(json.country_name || json.country);
    const zip = norm(json.postal || json.zip);
    return { geo_city: city, geo_region: region, geo_country: countryName, ct: city, st: region, country: countryName, zip };
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

async function ensureGeoOnRow(
  db: SupabaseClient,
  rowId: string,
  clientIp: string,
  currentGeo: { ct: string; st: string; country: string; zip: string; geo_city: string; geo_region: string; geo_country: string },
  config: ConversionsConfig,
): Promise<void> {
  if (!config.geo_use_ipapi) return;
  const ip = sanitizeIp(clientIp);
  if (!ip || isPrivateOrReservedIp(ip)) return;

  const needsGeo = config.geo_fill_only_when_missing
    ? (!currentGeo.geo_city || !currentGeo.geo_region || !currentGeo.geo_country || !currentGeo.ct || !currentGeo.st || !currentGeo.country)
    : true;
  if (!needsGeo) return;

  const looked = await lookupGeoByIp(ip);
  if (!looked) return;

  const finalGeo = config.geo_fill_only_when_missing
    ? {
        geo_city: currentGeo.geo_city || looked.geo_city,
        geo_region: currentGeo.geo_region || looked.geo_region,
        geo_country: currentGeo.geo_country || looked.geo_country,
        ct: currentGeo.ct || looked.ct,
        st: currentGeo.st || looked.st,
        country: currentGeo.country || looked.country,
        zip: currentGeo.zip || looked.zip,
      }
    : {
        geo_city: looked.geo_city || currentGeo.geo_city,
        geo_region: looked.geo_region || currentGeo.geo_region,
        geo_country: looked.geo_country || currentGeo.geo_country,
        ct: looked.ct || currentGeo.ct,
        st: looked.st || currentGeo.st,
        country: looked.country || currentGeo.country,
        zip: looked.zip || currentGeo.zip,
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

  return {
    ...baseConfig,
    pixel_id: norm(picked.pixel_id) || baseConfig.pixel_id,
    meta_access_token: norm(picked.meta_access_token) || baseConfig.meta_access_token,
    meta_currency: norm(picked.meta_currency) || baseConfig.meta_currency,
    meta_api_version: norm(picked.meta_api_version) || baseConfig.meta_api_version,
    send_contact_capi: Boolean(picked.send_contact_capi),
    geo_use_ipapi: Boolean(picked.geo_use_ipapi),
    geo_fill_only_when_missing: Boolean(picked.geo_fill_only_when_missing),
  };
}

async function sendToMetaCAPI(
  db: SupabaseClient,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
  row: ConversionRow,
  rowId: string,
  eventName: "Contact" | "Lead" | "Purchase",
  eventId: string,
  eventTime: number,
  customData?: Record<string, unknown>,
  overrideTestEventCode?: string,
): Promise<boolean> {
  const effectiveConfig = resolveEffectiveConfigForPixel(config, pixelConfigs, row.pixel_id);

  if (!effectiveConfig.meta_access_token || !effectiveConfig.pixel_id) {
    const statusField =
      eventName === "Contact" ? "contact_status_capi" :
      eventName === "Lead" ? "lead_status_capi" :
      "purchase_status_capi";
    const missingCfgMsg =
      eventName === "Contact" ? "ERROR CONTACT NO CONFIG" :
      eventName === "Lead" ? "ERROR LEAD NO CONFIG" :
      "ERROR PURCHASE NO CONFIG";
    const { data: current } = await db.from("conversions").select("observaciones").eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", missingCfgMsg);
    await db.from("conversions").update({ [statusField]: "error", observaciones: obs }).eq("id", rowId);
    await writeLog(db, row.user_id, "sendToMetaCAPI", "ERROR", "Meta CAPI no configurado", JSON.stringify({
      has_token: !!effectiveConfig.meta_access_token,
      has_pixel: !!effectiveConfig.pixel_id,
      event_name: eventName,
      row_pixel_id: row.pixel_id ?? "",
    }), rowId);
    return false;
  }

  const sharedRow = row as unknown as SharedConversionRow;
  const sharedConfig = effectiveConfig as unknown as SharedConversionsConfig;
  const effectiveTestEventCode = overrideTestEventCode || norm(row.test_event_code);
  const { apiUrl, body } = await buildMetaRequest(
    sharedConfig,
    sharedRow,
    eventName,
    eventId,
    eventTime,
    customData as Record<string, unknown> | undefined,
    effectiveTestEventCode || undefined,
  );

  const statusField =
    eventName === "Contact" ? "contact_status_capi" :
    eventName === "Lead" ? "lead_status_capi" :
    "purchase_status_capi";

  const okMsg =
    eventName === "Contact" ? "CONTACT OK" :
    eventName === "Lead" ? "LEAD OK" :
    customData?.purchase_type === "repeat" ? "PURCHASE REPEAT OK" : "PURCHASE OK";

  const errMsg =
    eventName === "Contact" ? "ERROR CONTACT" :
    eventName === "Lead" ? "ERROR LEAD" :
    "ERROR PURCHASE";

  const maxAttempts = 3;
  const baseDelayMs = 500;
  const metaPayloadRaw = JSON.stringify(body);

  const persistError = async (detail: string, responseRaw = "") => {
    const { data: current } = await db.from("conversions").select("observaciones").eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", errMsg);
    await db.from("conversions").update({ [statusField]: "error", observaciones: obs }).eq("id", rowId);
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
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resText = await res.text();
      const isTransientHttp = res.status === 429 || res.status === 408 || res.status >= 500;

      if (res.status === 200) {
        let responseJson: Record<string, unknown> | null = null;
        try {
          responseJson = resText ? JSON.parse(resText) as Record<string, unknown> : null;
        } catch {
          responseJson = null;
        }

        const hasErrorObject = !!(responseJson && typeof responseJson === "object" && "error" in responseJson);
        const eventsReceivedRaw = responseJson && typeof responseJson === "object"
          ? (responseJson as Record<string, unknown>).events_received
          : undefined;
        const eventsReceived = typeof eventsReceivedRaw === "number"
          ? eventsReceivedRaw
          : Number(eventsReceivedRaw);
        const hasZeroEventsReceived = Number.isFinite(eventsReceived) && eventsReceived <= 0;

        if (hasErrorObject || hasZeroEventsReceived) {
          await persistError(`HTTP 200 inconsistente (attempt ${attempt}/${maxAttempts}): ${resText}`, resText);
          return false;
        }

        const { data: current } = await db.from("conversions").select("observaciones").eq("id", rowId).single();
        const obs = appendObservation(current?.observaciones ?? "", okMsg);
        await db.from("conversions").update({ [statusField]: "enviado", observaciones: obs }).eq("id", rowId);
        await writeLog(
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
        await persistError(`HTTP ${res.status} (attempt ${attempt}/${maxAttempts}): ${resText}`, resText);
        return false;
      }

      await writeLog(
        db,
        row.user_id,
        "sendToMetaCAPI",
        "DEBUG",
        "Reintentando Meta CAPI por error transitorio",
        JSON.stringify({ eventName, eventId, status: res.status, attempt, maxAttempts }),
        rowId,
      );
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    } catch (e) {
      if (attempt === maxAttempts) {
        await persistError(`Excepcion en llamada Meta (attempt ${attempt}/${maxAttempts}): ${String(e)}`);
        return false;
      }
      await writeLog(
        db,
        row.user_id,
        "sendToMetaCAPI",
        "DEBUG",
        "Reintentando Meta CAPI por excepcion transitoria",
        JSON.stringify({ eventName, eventId, attempt, maxAttempts, error: String(e) }),
        rowId,
      );
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }

  await persistError("Fallo desconocido luego de agotar reintentos");
  return false;
}


async function deriveEventSourceUrl(
  db: SupabaseClient,
  landingName: string,
  payloadUrl?: string,
): Promise<string> {
  if (payloadUrl) return payloadUrl;
  const { data } = await db.from("settings").select("url_base").eq("id", 1).maybeSingle();
  const base = (data?.url_base ?? "").replace(/\/$/, "");
  return base ? `${base}/${landingName}` : "";
}


async function handleContact(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
): Promise<Response> {
  const nowIso = new Date().toISOString();
  const nowSec = Math.floor(Date.now() / 1000);
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);

  const contactEventId = norm(p.contact_event_id || p.event_id) || generateEventId();
  const contactEventTime = toValidEventTime(p.contact_event_time || p.event_time || nowSec);
  const testEventCode = norm(p.test_event_code);
  const geo = resolveGeoForPayload(p);
  const eventSourceUrl = await deriveEventSourceUrl(db, landing.name, norm(p.event_source_url));

  const row: Omit<ConversionRow, "id"> = {
    landing_id: landing.id?.trim() || null,
    user_id: landing.user_id,
    landing_name: landing.name,
    phone: sanitizePhone(p.phone),
    email: norm(p.email),
    fn: norm(p.fn),
    ln: norm(p.ln),
    ct: norm(geo.ct),
    st: norm(geo.st),
    zip: norm(geo.zip || p.zip),
    country: norm(geo.country),
    fbp: norm(p.fbp),
    fbc: norm(p.fbc),
    meta_pixel_id: inboundMetaPixelId,
    pixel_id: inboundMetaPixelId,
    contact_event_id: contactEventId,
    contact_event_time: contactEventTime,
    sendContactPixel: toBool(p.sendContactPixel),
    contact_payload_raw: safePayloadRaw(p),
    lead_event_id: "",
    lead_event_time: null,
    lead_payload_raw: "",
    purchase_event_id: "",
    purchase_event_time: null,
    purchase_payload_raw: "",
    test_event_code: testEventCode,
    client_ip: norm(p.clientIP),
    agent_user: norm(p.agentuser),
    device_type: norm(p.device_type),
    event_source_url: eventSourceUrl,
    estado: "contact",
    valor: 0,
    contact_status_capi: "",
    lead_status_capi: "",
    purchase_status_capi: "",
    observaciones: "",
    external_id: norm(p.external_id),
    utm_campaign: norm(p.utm_campaign),
    telefono_asignado: norm(p.telefono_asignado),
    promo_code: norm(p.promo_code),
    geo_city: geo.geo_city,
    geo_region: geo.geo_region,
    geo_country: geo.geo_country,
  };

  const { data: inserted, error } = await db.from("conversions").insert(row).select("id").single();
  if (error || !inserted) {
    const errDetail = error ? JSON.stringify({ message: error.message, code: error.code, details: error.details }) : "sin error";
    await writeLog(db, landing.user_id, "handleContact", "ERROR", "Error al insertar contacto", errDetail);
    return textResponse(`Error al registrar contacto: ${error?.message ?? "unknown"}`, 500);
  }
  const rowId = inserted.id;

  const effectiveConfig = resolveEffectiveConfigForPixel(config, pixelConfigs, row.pixel_id);
  await ensureGeoOnRow(db, rowId, row.client_ip, { ct: row.ct, st: row.st, country: row.country, zip: row.zip, geo_city: row.geo_city, geo_region: row.geo_region, geo_country: row.geo_country }, effectiveConfig);

  await writeLog(db, landing.user_id, "handleContact", "INFO", "Nuevo contacto registrado", JSON.stringify({ phone: row.phone, landing: landing.name, contact_event_id: contactEventId }), rowId);

  const ctaTapToRedirectMs = Number(p.cta_tap_to_redirect_ms);
  if (Number.isFinite(ctaTapToRedirectMs) && ctaTapToRedirectMs >= 0) {
    await writeLog(
      db,
      landing.user_id,
      "handleContact",
      "INFO",
      "CTA tap->redirect latency",
      JSON.stringify({ cta_tap_to_redirect_ms: Math.round(ctaTapToRedirectMs) }),
      rowId,
    );
  }

  if (effectiveConfig.send_contact_capi) {
    const { data: fresh } = await db.from("conversions").select("*").eq("id", rowId).single();
    const fullRow = (fresh ?? row) as ConversionRow;
    const ok = await sendToMetaCAPI(
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
    return textResponse(ok ? "Contact registrado y enviado por CAPI" : "Contact registrado; error al enviar CAPI");
  }

  return textResponse("Success");
}

async function handleLead(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);
  if (!cleanPhone) {
    await writeLog(db, landing.user_id, "handleLead", "ERROR", "LEAD rechazado: falta phone", safePayloadRaw(p));
    return textResponse("Faltan parámetros: phone requerido", 400);
  }
  const promoCode = norm(p.promo_code);
  if (!promoCode) {
    await writeLog(db, landing.user_id, "handleLead", "ERROR", "LEAD rechazado: falta promo_code", safePayloadRaw(p));
    return textResponse("Faltan parámetros: promo_code requerido", 400);
  }
  const testEventCode = norm(p.test_event_code);
  const leadPayloadRaw = safePayloadRaw(p);

  const { fn: payloadFn, ln: payloadLn } = deriveNameFromPayload(p);
  const payloadEmail = norm(p.email);
  const eventSourceUrl = await deriveEventSourceUrl(db, landing.name, norm(p.event_source_url));
  const geo = resolveGeoForPayload(p);

  // 1) Match by promo_code
  let targetId: string | null = null;
  if (promoCode) {
    const { data } = await db
      .from("conversions")
      .select("id")
      .eq("user_id", landing.user_id)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) targetId = data.id;
  }

  const leadEventId = generateEventId();
  const leadEventTime = toValidEventTime(p.lead_event_time || p.event_time || Math.floor(Date.now() / 1000));

  // 2) No match -> stop (promo_code should exist)
  if (!targetId) {
    await writeLog(
      db,
      landing.user_id,
      "handleLead",
      "ERROR",
      "LEAD sin match por promo_code",
      JSON.stringify({ promo_code: promoCode, phone: cleanPhone }),
    );
    return textResponse("No se encontro fila para promo_code", 404);
  } else {
    // 4) Update existing row
    const updates: Record<string, unknown> = {
      phone: cleanPhone,
      estado: "lead",
      event_source_url: eventSourceUrl,
      lead_event_id: leadEventId,
      lead_event_time: leadEventTime,
      lead_payload_raw: leadPayloadRaw,
    };
    if (inboundMetaPixelId) {
      updates.meta_pixel_id = inboundMetaPixelId;
      updates.pixel_id = inboundMetaPixelId;
    }
    if (testEventCode) updates.test_event_code = testEventCode;
    if (payloadFn) updates.fn = payloadFn;
    if (payloadLn) updates.ln = payloadLn;
    if (payloadEmail) updates.email = payloadEmail;
    if (geo.ct) updates.ct = geo.ct;
    if (geo.st) updates.st = geo.st;
    if (geo.zip) updates.zip = geo.zip;
    if (geo.country) updates.country = geo.country;
    if (geo.geo_city) updates.geo_city = geo.geo_city;
    if (geo.geo_region) updates.geo_region = geo.geo_region;
    if (geo.geo_country) updates.geo_country = geo.geo_country;
    // Fill promo_code if row didn't have it
    if (promoCode) {
      const { data: cur } = await db.from("conversions").select("promo_code").eq("id", targetId).single();
      if (!cur?.promo_code) updates.promo_code = promoCode;
    }
    await db.from("conversions").update(updates).eq("id", targetId);
  }

  // Geo enrichment
  const { data: row } = await db.from("conversions").select("*").eq("id", targetId).single();
  if (!row) return textResponse("Error al leer fila LEAD", 500);

  const effectiveConfig = resolveEffectiveConfigForPixel(config, pixelConfigs, row.pixel_id);
  await ensureGeoOnRow(db, targetId!, row.client_ip, { ct: row.ct, st: row.st, country: row.country, zip: row.zip, geo_city: row.geo_city, geo_region: row.geo_region, geo_country: row.geo_country }, effectiveConfig);

  const { data: fresh } = await db.from("conversions").select("*").eq("id", targetId).single();
  const fullRow = (fresh ?? row) as ConversionRow;

  await writeLog(db, landing.user_id, "handleLead", "INFO", "LEAD procesado", JSON.stringify({ phone: cleanPhone, promo_code: promoCode, matched: !!targetId }), targetId!);

  const ok = await sendToMetaCAPI(db, effectiveConfig, pixelConfigs, fullRow, targetId!, "Lead", leadEventId, leadEventTime, undefined, testEventCode || undefined);
  return textResponse(ok ? "Fila LEAD procesada" : "LEAD procesado. Error al enviar a Meta CAPI (revisar token, pixel o pestana Logs).");
}

async function handlePurchase(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);
  const amount = parseFloat(p.amount);
  if (!cleanPhone || isNaN(amount) || amount <= 0) {
    await writeLog(db, landing.user_id, "handlePurchase", "ERROR", "PURCHASE rechazado: falta phone o amount", safePayloadRaw(p));
    return textResponse("Faltan parametros validos: phone y amount > 0", 400);
  }
  const testEventCode = norm(p.test_event_code);
  const purchasePayloadRaw = safePayloadRaw(p);

  const promoCode = norm(p.promo_code);
  const promoCodeIsFull = isFullPromoCode(p.promo_code ?? p.promoCode ?? promoCode);
  const { fn: payloadFn, ln: payloadLn } = deriveNameFromPayload(p);
  const payloadEmail = norm(p.email);
  const eventSourceUrl = await deriveEventSourceUrl(db, landing.name, norm(p.event_source_url));
  const geo = resolveGeoForPayload(p);
  const purchaseEventId = generateEventId();
  const purchaseEventTime = toValidEventTime(p.purchase_event_time || p.event_time || Math.floor(Date.now() / 1000));
  const { data: latestLeadRow } = await db
    .from("conversions")
    .select("id, created_at")
    .eq("user_id", landing.user_id)
    .eq("phone", cleanPhone)
    .eq("estado", "lead")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: latestPurchaseRow } = await db
    .from("conversions")
    .select("id, created_at")
    .eq("user_id", landing.user_id)
    .eq("phone", cleanPhone)
    .eq("estado", "purchase")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const hasPreviousPurchase = !!latestPurchaseRow;
  const leadIsAfterLatestPurchase = !!(
    latestLeadRow?.created_at &&
    latestPurchaseRow?.created_at &&
    new Date(latestLeadRow.created_at).getTime() > new Date(latestPurchaseRow.created_at).getTime()
  );
  const canUseLeadFallback = !hasPreviousPurchase || leadIsAfterLatestPurchase;

  // 1) Primary match by full promo_code only.
  let targetId: string | null = null;
  let matchMethod: "promo_code" | "phone_lead" | "created_first" | "created_repeat" = "created_first";
  if (promoCode && promoCodeIsFull) {
    const { data } = await db
      .from("conversions")
      .select("id")
      .eq("user_id", landing.user_id)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) {
      targetId = data.id;
      matchMethod = "promo_code";
    }
  } else if (promoCode) {
    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "INFO",
      "PURCHASE promo_code incompleto: fallback por phone/lead",
      JSON.stringify({ promo_code: promoCode, phone: cleanPhone }),
    );
  }

  // 2) Fallback by phone => most recent LEAD only.
  // Only when there are no purchases yet, or lead is newer than latest purchase.
  if (!targetId && canUseLeadFallback) {
    const { data } = await db
      .from("conversions")
      .select("id")
      .eq("user_id", landing.user_id)
      .eq("phone", cleanPhone)
      .eq("estado", "lead")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      targetId = data.id;
      matchMethod = "phone_lead";
    }
  }

  // 3) If we matched an existing row (promo or phone->lead), update to first purchase.
  if (targetId) {
    const { data: existing } = await db
      .from("conversions")
      .select("lead_event_id, lead_event_time")
      .eq("id", targetId)
      .single();

    const updates: Record<string, unknown> = {
      phone: cleanPhone,
      estado: "purchase",
      valor: amount,
      event_source_url: eventSourceUrl,
      purchase_event_id: purchaseEventId,
      purchase_event_time: purchaseEventTime,
      purchase_payload_raw: purchasePayloadRaw,
      purchase_type: "first",
    };
    if (inboundMetaPixelId) {
      updates.meta_pixel_id = inboundMetaPixelId;
      updates.pixel_id = inboundMetaPixelId;
    }
    if (testEventCode) updates.test_event_code = testEventCode;
    if (existing?.lead_event_id) {
      updates.lead_event_id = existing.lead_event_id;
      if (existing.lead_event_time) updates.lead_event_time = existing.lead_event_time;
    }
    if (payloadFn) updates.fn = payloadFn;
    if (payloadLn) updates.ln = payloadLn;
    if (payloadEmail) updates.email = payloadEmail;
    if (geo.ct) updates.ct = geo.ct;
    if (geo.st) updates.st = geo.st;
    if (geo.zip) updates.zip = geo.zip;
    if (geo.country) updates.country = geo.country;
    if (geo.geo_city) updates.geo_city = geo.geo_city;
    if (geo.geo_region) updates.geo_region = geo.geo_region;
    if (geo.geo_country) updates.geo_country = geo.geo_country;
    if (promoCode) {
      const { data: cur } = await db.from("conversions").select("promo_code").eq("id", targetId).single();
      if (!cur?.promo_code) updates.promo_code = promoCode;
    }
    await db.from("conversions").update(updates).eq("id", targetId);

    const { data: row } = await db.from("conversions").select("*").eq("id", targetId).single();
    if (!row) return textResponse("Error al leer fila PURCHASE", 500);
    const effectiveConfig = resolveEffectiveConfigForPixel(config, pixelConfigs, row.pixel_id);
    await ensureGeoOnRow(db, targetId, row.client_ip, { ct: row.ct, st: row.st, country: row.country, zip: row.zip, geo_city: row.geo_city, geo_region: row.geo_region, geo_country: row.geo_country }, effectiveConfig);

    const { data: fresh } = await db.from("conversions").select("*").eq("id", targetId).single();
    const fullRow = (fresh ?? row) as ConversionRow;
    const customData = { currency: effectiveConfig.meta_currency, value: amount };

    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "INFO",
      "Primera compra procesada",
      JSON.stringify({ phone: cleanPhone, amount, promo_code: promoCode, match_method: matchMethod }),
      targetId,
    );

    const ok = await sendToMetaCAPI(db, effectiveConfig, pixelConfigs, fullRow, targetId, "Purchase", purchaseEventId, purchaseEventTime, customData, testEventCode || undefined);
    return textResponse(ok ? "Primera compra enviada (Purchase)" : "Purchase procesado. Error al enviar a Meta CAPI (revisar token, pixel o Logs).");
  }

  // 4) No promo match and no eligible LEAD pending => apply repeat logic.
  const isRepeat = hasPreviousPurchase;
  if (!isRepeat) {
    const newRow: Omit<ConversionRow, "id"> = {
      landing_id: landing.id?.trim() || null,
      user_id: landing.user_id,
      landing_name: landing.name,
      phone: cleanPhone,
      email: payloadEmail,
      fn: payloadFn,
      ln: payloadLn,
      ct: geo.ct,
      st: geo.st,
      zip: geo.zip,
      country: geo.country,
      fbp: "",
      fbc: "",
      meta_pixel_id: inboundMetaPixelId,
      pixel_id: inboundMetaPixelId,
      contact_event_id: "",
      contact_event_time: null,
      contact_payload_raw: "",
      lead_event_id: "",
      lead_event_time: null,
      lead_payload_raw: "",
      purchase_event_id: purchaseEventId,
      purchase_event_time: purchaseEventTime,
      purchase_payload_raw: purchasePayloadRaw,
      test_event_code: testEventCode,
      purchase_type: "first",
      client_ip: "",
      agent_user: "",
      device_type: "",
      event_source_url: eventSourceUrl,
      estado: "purchase",
      valor: amount,
      contact_status_capi: "",
      lead_status_capi: "",
      purchase_status_capi: "",
      observaciones: "",
      external_id: "",
      utm_campaign: "",
      telefono_asignado: "",
      promo_code: promoCode,
      geo_city: geo.geo_city,
      geo_region: geo.geo_region,
      geo_country: geo.geo_country,
    };
    const { data: ins, error } = await db.from("conversions").insert(newRow).select("id").single();
    if (error || !ins) return textResponse("Error al crear fila PURCHASE", 500);
    const createdId = ins.id;

    const { data: row } = await db.from("conversions").select("*").eq("id", createdId).single();
    if (!row) return textResponse("Error al leer fila PURCHASE", 500);
    const effectiveConfig = resolveEffectiveConfigForPixel(config, pixelConfigs, row.pixel_id);
    await ensureGeoOnRow(db, createdId, row.client_ip, { ct: row.ct, st: row.st, country: row.country, zip: row.zip, geo_city: row.geo_city, geo_region: row.geo_region, geo_country: row.geo_country }, effectiveConfig);

    const { data: fresh } = await db.from("conversions").select("*").eq("id", createdId).single();
    const fullRow = (fresh ?? row) as ConversionRow;
    const customData = { currency: effectiveConfig.meta_currency, value: amount };

    await writeLog(
      db,
      landing.user_id,
      "handlePurchase",
      "INFO",
      "Primera compra procesada",
      JSON.stringify({ phone: cleanPhone, amount, promo_code: promoCode, match_method: "created_first" }),
      createdId,
    );

    const ok = await sendToMetaCAPI(db, effectiveConfig, pixelConfigs, fullRow, createdId, "Purchase", purchaseEventId, purchaseEventTime, customData, testEventCode || undefined);
    return textResponse(ok ? "Primera compra enviada (Purchase)" : "Purchase procesado. Error al enviar a Meta CAPI (revisar token, pixel o Logs).");
  }

  // Repeat purchase => inherit from most recent PURCHASE row of this phone.
  const { data: srcRow } = await db
    .from("conversions")
    .select("*")
    .eq("user_id", landing.user_id)
    .eq("phone", cleanPhone)
    .eq("estado", "purchase")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newRow: Omit<ConversionRow, "id"> = {
    landing_id: srcRow?.landing_id ?? (landing.id?.trim() || null),
    user_id: landing.user_id,
    landing_name: srcRow?.landing_name ?? landing.name,
    phone: cleanPhone,
    email: payloadEmail || srcRow?.email || "",
    fn: payloadFn || srcRow?.fn || "",
    ln: payloadLn || srcRow?.ln || "",
    ct: srcRow?.ct ?? "",
    st: srcRow?.st ?? "",
    zip: srcRow?.zip ?? "",
    country: srcRow?.country ?? "",
    fbp: srcRow?.fbp ?? "",
    fbc: srcRow?.fbc ?? "",
    meta_pixel_id: srcRow?.meta_pixel_id ?? srcRow?.pixel_id ?? inboundMetaPixelId,
    pixel_id: srcRow?.pixel_id ?? inboundMetaPixelId,
    // DO NOT inherit event IDs
    contact_event_id: "",
    contact_event_time: null,
    contact_payload_raw: "",
    lead_event_id: "",
    lead_event_time: null,
    lead_payload_raw: "",
    purchase_event_id: purchaseEventId,
    purchase_event_time: purchaseEventTime,
    purchase_payload_raw: purchasePayloadRaw,
    test_event_code: testEventCode || srcRow?.test_event_code || "",
    purchase_type: "repeat",
    client_ip: srcRow?.client_ip ?? "",
    agent_user: srcRow?.agent_user ?? "",
    device_type: srcRow?.device_type ?? "",
    event_source_url: eventSourceUrl || srcRow?.event_source_url || "",
    estado: "purchase",
    valor: amount,
    // DO NOT inherit statuses
    contact_status_capi: "",
    lead_status_capi: "",
    purchase_status_capi: "",
    observaciones: "REPEAT",
    external_id: srcRow?.external_id ?? "",
    utm_campaign: srcRow?.utm_campaign ?? "",
    telefono_asignado: srcRow?.telefono_asignado ?? "",
    promo_code: promoCode || srcRow?.promo_code || "",
    geo_city: srcRow?.geo_city ?? "",
    geo_region: srcRow?.geo_region ?? "",
    geo_country: srcRow?.geo_country ?? "",
  };

  const { data: ins, error } = await db.from("conversions").insert(newRow).select("id").single();
  if (error || !ins) return textResponse("Error al crear fila recompra", 500);
  const newId = ins.id;

  const effectiveRepeatConfig = resolveEffectiveConfigForPixel(config, pixelConfigs, newRow.pixel_id);
  await ensureGeoOnRow(db, newId, newRow.client_ip, { ct: newRow.ct, st: newRow.st, country: newRow.country, zip: newRow.zip, geo_city: newRow.geo_city, geo_region: newRow.geo_region, geo_country: newRow.geo_country }, effectiveRepeatConfig);

  const { data: fresh } = await db.from("conversions").select("*").eq("id", newId).single();
  const fullRow = (fresh ?? newRow) as ConversionRow;
  const customData: Record<string, unknown> = { currency: effectiveRepeatConfig.meta_currency, value: amount, purchase_type: "repeat" };

  await writeLog(
    db,
    landing.user_id,
    "handlePurchase",
    "INFO",
    "Recompra procesada",
    JSON.stringify({ phone: cleanPhone, amount, inherited_from: srcRow?.id, match_method: "created_repeat" }),
    newId,
  );

  const ok = await sendToMetaCAPI(db, effectiveRepeatConfig, pixelConfigs, fullRow, newId, "Purchase", purchaseEventId, purchaseEventTime, customData, testEventCode || undefined);
  return textResponse(ok ? "Recompra enviada (Purchase_Repeat)" : "Recompra procesada. Error al enviar a Meta CAPI (revisar token, pixel o Logs).");
}

async function handleSimplePurchase(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
  pixelConfigs: PixelConfigRow[],
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  const inboundMetaPixelId = norm(p.meta_pixel_id || p.pixel_id);
  const amount = parseFloat(p.amount);
  if (!cleanPhone || isNaN(amount) || amount <= 0) {
    return textResponse("Faltan parametros validos: phone y amount > 0", 400);
  }
  const testEventCode = norm(p.test_event_code);
  const purchasePayloadRaw = safePayloadRaw(p);

  const payloadEmail = norm(p.email);
  const { fn: payloadFn, ln: payloadLn } = deriveNameFromPayload(p);
  const eventSourceUrl = await deriveEventSourceUrl(db, landing.name, norm(p.event_source_url));
  const isRepeatSimple = await hasPreviousSuccessfulPurchases(db, landing.user_id, cleanPhone);

  // Inherit from most recent row of this phone
  const { data: srcRow } = await db
    .from("conversions")
    .select("*")
    .eq("user_id", landing.user_id)
    .eq("phone", cleanPhone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const purchaseEventId = generateEventId();
  const purchaseEventTime = toValidEventTime(p.purchase_event_time || p.event_time || Math.floor(Date.now() / 1000));

  const newRow: Omit<ConversionRow, "id"> = {
    landing_id: landing.id?.trim() || null,
    user_id: landing.user_id,
    landing_name: landing.name,
    phone: cleanPhone,
    email: payloadEmail || srcRow?.email || "",
    fn: payloadFn || srcRow?.fn || "",
    ln: payloadLn || srcRow?.ln || "",
    ct: srcRow?.ct ?? "",
    st: srcRow?.st ?? "",
    zip: srcRow?.zip ?? "",
    country: srcRow?.country ?? "",
    fbp: srcRow?.fbp ?? "",
    fbc: srcRow?.fbc ?? "",
    meta_pixel_id: srcRow?.meta_pixel_id ?? srcRow?.pixel_id ?? inboundMetaPixelId,
    pixel_id: srcRow?.pixel_id ?? inboundMetaPixelId,
    contact_event_id: "",
    contact_event_time: null,
    contact_payload_raw: "",
    lead_event_id: "",
    lead_event_time: null,
    lead_payload_raw: "",
    purchase_event_id: purchaseEventId,
    purchase_event_time: purchaseEventTime,
    purchase_payload_raw: purchasePayloadRaw,
    test_event_code: testEventCode,
    purchase_type: isRepeatSimple ? "repeat" : "first",
    client_ip: srcRow?.client_ip ?? "",
    agent_user: srcRow?.agent_user ?? "",
    device_type: srcRow?.device_type ?? "",
    event_source_url: eventSourceUrl || srcRow?.event_source_url || "",
    estado: "purchase",
    valor: amount,
    contact_status_capi: "",
    lead_status_capi: "",
    purchase_status_capi: "",
    observaciones: "",
    external_id: srcRow?.external_id ?? "",
    utm_campaign: srcRow?.utm_campaign ?? "",
    telefono_asignado: srcRow?.telefono_asignado ?? "",
    promo_code: "",
    geo_city: srcRow?.geo_city ?? "",
    geo_region: srcRow?.geo_region ?? "",
    geo_country: srcRow?.geo_country ?? "",
  };

  const { data: ins, error } = await db.from("conversions").insert(newRow).select("id").single();
  if (error || !ins) return textResponse("Error al crear fila purchase simple", 500);
  const newId = ins.id;

  const effectiveSimpleConfig = resolveEffectiveConfigForPixel(config, pixelConfigs, newRow.pixel_id);
  await ensureGeoOnRow(db, newId, newRow.client_ip, { ct: newRow.ct, st: newRow.st, country: newRow.country, zip: newRow.zip, geo_city: newRow.geo_city, geo_region: newRow.geo_region, geo_country: newRow.geo_country }, effectiveSimpleConfig);

  const { data: fresh } = await db.from("conversions").select("*").eq("id", newId).single();
  const fullRow = (fresh ?? newRow) as ConversionRow;
  const customData = { currency: effectiveSimpleConfig.meta_currency, value: amount };

  await writeLog(db, landing.user_id, "handleSimplePurchase", "INFO", "Purchase simple procesado", JSON.stringify({ phone: cleanPhone, amount, inherited_from: srcRow?.id }), newId);

  const ok = await sendToMetaCAPI(db, effectiveSimpleConfig, pixelConfigs, fullRow, newId, "Purchase", purchaseEventId, purchaseEventTime, customData, testEventCode || undefined);
  return textResponse(ok ? "Evento Purchase enviado" : "Purchase procesado. Error al enviar a Meta CAPI (revisar token, pixel o Logs).");
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
    if (!supabaseUrl || !serviceRoleKey) return textResponse("Configuracion del servidor incompleta", 500);

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Lookup client by nombre in profiles
    const { data: profile } = await db
      .from("profiles")
      .select("id, nombre")
      .eq("nombre", name)
      .maybeSingle();

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
      geo_use_ipapi: false,
      geo_fill_only_when_missing: false,
    };

    const { data: pixelConfigsData } = await db
      .from("conversions_pixel_configs")
      .select("user_id, pixel_id, meta_access_token, meta_currency, meta_api_version, send_contact_capi, geo_use_ipapi, geo_fill_only_when_missing, is_default")
      .eq("user_id", userId);
    const pixelConfigs: PixelConfigRow[] = (pixelConfigsData ?? []) as PixelConfigRow[];

    const params: Params = await req.json().catch(() => ({}));
    // Keep payload exactly as sent by emitter; do not infer client IP from request headers.

    // landing_name can come from the payload (to track which landing sent this)
    const landingName = norm(params.landing_name || params.landingName || "");

    // Build a virtual LandingRow representing the client endpoint
    const landing: LandingRow = { id: "", name: landingName, user_id: userId };

    const rawAction = norm(params.action).toUpperCase();
    const actionEventId = norm(params.action_event_id);
    const inboxAction = rawAction || "CONTACT";

    if (
      actionEventId &&
      (rawAction === "LEAD" || rawAction === "PURCHASE")
    ) {
      const existing = await findInboundByActionEventId(db, userId, rawAction, actionEventId);
      if (existing) {
        return textResponse("Duplicado ignorado (action_event_id ya procesado)", 200);
      }
    }

    const inboxId = await insertInboundEvent(db, userId, landingName, inboxAction, params);

    const runAndFinalize = async (runner: () => Promise<Response>) => {
      const response = await runner();
      const bodyText = await response.clone().text().catch(() => "");
      const finalStatus: InboundStatus = response.status >= 200 && response.status < 400 ? "processed" : "error";
      await finalizeInboundEvent(db, inboxId, finalStatus, response.status, bodyText);
      return response;
    };

    // Route to the correct handler
    if (!rawAction && params.phone && params.amount) {
      return runAndFinalize(() => handleSimplePurchase(db, params, landing, cfg, pixelConfigs));
    }
    if (rawAction === "LEAD") {
      return runAndFinalize(() => handleLead(db, params, landing, cfg, pixelConfigs));
    }
    if (rawAction === "PURCHASE") {
      return runAndFinalize(() => handlePurchase(db, params, landing, cfg, pixelConfigs));
    }

    if (rawAction) {
      await writeLog(
        db,
        landing.user_id,
        "main",
        "ERROR",
        "Action desconocida recibida",
        JSON.stringify({ action: rawAction, payload: safePayloadRaw(params) }),
      );
    }

    // Default: contact from landing
    return runAndFinalize(() => handleContact(db, params, landing, cfg, pixelConfigs));
  } catch (err) {
    console.error("conversions error:", err);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const errDb = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
        await writeLog(errDb, "00000000-0000-0000-0000-000000000000", "main", "ERROR", "Error inesperado en handler", String(err));
      }
    } catch { /* ignore */ }
    return textResponse("Error inesperado", 500);
  }
});

