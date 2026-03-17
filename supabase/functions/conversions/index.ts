import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ───────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConversionsConfig {
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

interface GeoResult {
  geo_city: string;
  geo_region: string;
  geo_country: string;
  ct: string;
  st: string;
  country: string;
  zip: string;
}

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;

// ─── Helpers ────────────────────────────────────────────────────────────────

const norm = (s: unknown): string => String(s ?? "").trim();

function sanitizePhone(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function sanitizeIp(v: unknown): string {
  let ip = String(v ?? "").trim();
  if (!ip) return "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  ip = ip.replace(/[^\dA-Fa-f:.]/g, "");
  return ip;
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

function toValidEventTime(value: unknown): number {
  const n = Number(value);
  const now = Math.floor(Date.now() / 1000);
  if (!isNaN(n) && n > 0) return Math.floor(n);
  return now;
}

function generateEventId(): string {
  return crypto.randomUUID();
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

// ─── Logging ─────────────────────────────────────────────────────────────────

async function writeLog(
  db: SupabaseClient,
  userId: string,
  fn: string,
  level: string,
  message: string,
  detail: string = "",
  conversionId?: string,
): Promise<void> {
  try {
    await db.from("conversion_logs").insert({
      user_id: userId,
      conversion_id: conversionId ?? null,
      function_name: fn,
      level,
      message,
      detail: detail.slice(0, 4000),
    });
  } catch {
    // non-critical
  }
}

// ─── Geo enrichment via ipapi.co ────────────────────────────────────────────

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

// Geo enrichment always runs for analytics (geo_city/geo_region/geo_country).
// geo_fill_only_when_missing controls whether IP geo overwrites payload geo or only fills blanks.
async function ensureGeoOnRow(
  db: SupabaseClient,
  rowId: string,
  clientIp: string,
  currentGeo: { ct: string; st: string; country: string; zip: string; geo_city: string; geo_region: string; geo_country: string },
  config: ConversionsConfig,
): Promise<void> {
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

// ─── Meta CAPI ──────────────────────────────────────────────────────────────

interface MetaUserData {
  [key: string]: string;
}

async function buildUserData(row: ConversionRow, config: ConversionsConfig): Promise<MetaUserData> {
  const ud: MetaUserData = {};
  if (row.email) ud.em = await sha256(row.email);
  if (row.phone) ud.ph = await sha256(sanitizePhone(row.phone));
  if (row.fn) ud.fn = await sha256(row.fn);
  if (row.ln) ud.ln = await sha256(row.ln);
  if (config.geo_use_ipapi) {
    if (row.ct) ud.ct = await sha256(row.ct);
    if (row.st) ud.st = await sha256(row.st);
    if (row.zip) ud.zip = await sha256(row.zip);
    if (row.country) ud.country = await sha256(row.country);
  }
  if (row.fbp) ud.fbp = row.fbp;
  if (row.fbc) ud.fbc = row.fbc;
  if (row.client_ip) Object.assign(ud, normalizeIpToMeta(row.client_ip));
  if (row.agent_user) ud.client_user_agent = row.agent_user;
  if (row.external_id) ud.external_id = await sha256(row.external_id);
  return ud;
}

async function sendToMetaCAPI(
  db: SupabaseClient,
  config: ConversionsConfig,
  row: ConversionRow,
  rowId: string,
  eventName: "Contact" | "Lead" | "Purchase",
  eventId: string,
  eventTime: number,
  customData?: Record<string, unknown>,
): Promise<boolean> {
  if (!config.meta_access_token || !config.pixel_id) return false;

  const userData = await buildUserData(row, config);
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
  if (config.test_event_code) body.test_event_code = config.test_event_code;

  const apiUrl = `https://graph.facebook.com/${config.meta_api_version}/${config.pixel_id}/events?access_token=${config.meta_access_token}`;

  const statusField =
    eventName === "Contact" ? "contact_status_capi" :
    eventName === "Lead" ? "lead_status_capi" :
    "purchase_status_capi";

  const okMsg =
    eventName === "Contact" ? "✅ CONTACT OK" :
    eventName === "Lead" ? "✅ LEAD OK" :
    customData?.purchase_type === "repeat" ? "✅ PURCHASE REPEAT OK" : "✅ PURCHASE OK";

  const errMsg =
    eventName === "Contact" ? "ERROR CONTACT" :
    eventName === "Lead" ? "ERROR LEAD" :
    "ERROR PURCHASE";

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 200) {
      const { data: current } = await db.from("conversions").select("observaciones").eq("id", rowId).single();
      const obs = appendObservation(current?.observaciones ?? "", okMsg);
      await db.from("conversions").update({ [statusField]: "enviado", observaciones: obs }).eq("id", rowId);
      return true;
    } else {
      const { data: current } = await db.from("conversions").select("observaciones").eq("id", rowId).single();
      const obs = appendObservation(current?.observaciones ?? "", errMsg);
      await db.from("conversions").update({ [statusField]: "error", observaciones: obs }).eq("id", rowId);
      return false;
    }
  } catch {
    const { data: current } = await db.from("conversions").select("observaciones").eq("id", rowId).single();
    const obs = appendObservation(current?.observaciones ?? "", errMsg);
    await db.from("conversions").update({ [statusField]: "error", observaciones: obs }).eq("id", rowId);
    return false;
  }
}

// ─── Derive event_source_url ────────────────────────────────────────────────

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

// ─── A) Contact from landing ────────────────────────────────────────────────

async function handleContact(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
): Promise<Response> {
  const nowIso = new Date().toISOString();
  const nowSec = Math.floor(Date.now() / 1000);

  const contactEventId = norm(p.contact_event_id || p.event_id) || generateEventId();
  const contactEventTime = toValidEventTime(p.contact_event_time || p.event_time || nowSec);
  const geo = resolveGeoForPayload(p);
  const eventSourceUrl = await deriveEventSourceUrl(db, landing.name, norm(p.event_source_url));

  const row: Omit<ConversionRow, "id"> = {
    landing_id: landing.id,
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
    contact_event_id: contactEventId,
    contact_event_time: contactEventTime,
    lead_event_id: "",
    lead_event_time: null,
    purchase_event_id: "",
    purchase_event_time: null,
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
    await writeLog(db, landing.user_id, "handleContact", "ERROR", "Error al insertar contacto", JSON.stringify(error));
    return textResponse("Error al registrar contacto", 500);
  }
  const rowId = inserted.id;

  await ensureGeoOnRow(db, rowId, row.client_ip, { ct: row.ct, st: row.st, country: row.country, zip: row.zip, geo_city: row.geo_city, geo_region: row.geo_region, geo_country: row.geo_country }, config);

  await writeLog(db, landing.user_id, "handleContact", "INFO", "Nuevo contacto registrado", JSON.stringify({ phone: row.phone, landing: landing.name, contact_event_id: contactEventId }), rowId);

  if (config.send_contact_capi) {
    const { data: fresh } = await db.from("conversions").select("*").eq("id", rowId).single();
    const fullRow = (fresh ?? row) as ConversionRow;
    const ok = await sendToMetaCAPI(db, config, fullRow, rowId, "Contact", contactEventId, contactEventTime);
    await writeLog(db, landing.user_id, "sendToMetaCAPI", ok ? "INFO" : "ERROR", ok ? "Contact CAPI enviado" : "Error Contact CAPI", JSON.stringify({ event_id: contactEventId }), rowId);
    return textResponse(ok ? "Contact registrado y enviado por CAPI" : "Contact registrado; error al enviar CAPI");
  }

  return textResponse("Success");
}

// ─── B1) ACTION: LEAD ───────────────────────────────────────────────────────

async function handleLead(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  if (!cleanPhone) return textResponse("Faltan parámetros: phone requerido", 400);

  const promoCode = norm(p.promo_code);
  const payloadFn = norm(p.fn);
  const payloadLn = norm(p.ln);
  const payloadEmail = norm(p.email);
  const eventSourceUrl = await deriveEventSourceUrl(db, landing.name, norm(p.event_source_url));

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

  // 2) Match by phone (most recent)
  if (!targetId && cleanPhone) {
    const { data } = await db
      .from("conversions")
      .select("id")
      .eq("user_id", landing.user_id)
      .eq("phone", cleanPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) targetId = data.id;
  }

  const leadEventId = generateEventId();
  const leadEventTime = Math.floor(Date.now() / 1000);

  // 3) No match -> create new row
  if (!targetId) {
    const newRow: Omit<ConversionRow, "id"> = {
      landing_id: landing.id,
      user_id: landing.user_id,
      landing_name: landing.name,
      phone: cleanPhone,
      email: payloadEmail,
      fn: payloadFn,
      ln: payloadLn,
      ct: "",
      st: "",
      zip: "",
      country: "",
      fbp: "",
      fbc: "",
      contact_event_id: "",
      contact_event_time: null,
      lead_event_id: leadEventId,
      lead_event_time: leadEventTime,
      purchase_event_id: "",
      purchase_event_time: null,
      client_ip: "",
      agent_user: "",
      device_type: "",
      event_source_url: eventSourceUrl,
      estado: "lead",
      valor: 0,
      contact_status_capi: "",
      lead_status_capi: "",
      purchase_status_capi: "",
      observaciones: "",
      external_id: "",
      utm_campaign: "",
      telefono_asignado: "",
      promo_code: promoCode,
      geo_city: "",
      geo_region: "",
      geo_country: "",
    };

    const { data: ins, error } = await db.from("conversions").insert(newRow).select("id").single();
    if (error || !ins) return textResponse("Error al crear fila LEAD", 500);
    targetId = ins.id;
  } else {
    // 4) Update existing row
    const updates: Record<string, unknown> = {
      phone: cleanPhone,
      estado: "lead",
      event_source_url: eventSourceUrl,
      lead_event_id: leadEventId,
      lead_event_time: leadEventTime,
    };
    if (payloadFn) updates.fn = payloadFn;
    if (payloadLn) updates.ln = payloadLn;
    if (payloadEmail) updates.email = payloadEmail;
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

  await ensureGeoOnRow(db, targetId!, row.client_ip, { ct: row.ct, st: row.st, country: row.country, zip: row.zip, geo_city: row.geo_city, geo_region: row.geo_region, geo_country: row.geo_country }, config);

  const { data: fresh } = await db.from("conversions").select("*").eq("id", targetId).single();
  const fullRow = (fresh ?? row) as ConversionRow;

  await writeLog(db, landing.user_id, "handleLead", "INFO", "LEAD procesado", JSON.stringify({ phone: cleanPhone, promo_code: promoCode, matched: !!targetId }), targetId!);

  const ok = await sendToMetaCAPI(db, config, fullRow, targetId!, "Lead", leadEventId, leadEventTime);
  await writeLog(db, landing.user_id, "sendToMetaCAPI", ok ? "INFO" : "ERROR", ok ? "Lead CAPI enviado" : "Error Lead CAPI", JSON.stringify({ event_id: leadEventId }), targetId!);
  return textResponse(ok ? "Fila LEAD procesada" : "Error al enviar LEAD");
}

// ─── B2) ACTION: PURCHASE ───────────────────────────────────────────────────

async function handlePurchase(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  const amount = parseFloat(p.amount);
  if (!cleanPhone || isNaN(amount)) return textResponse("Faltan parámetros: phone y amount", 400);

  const promoCode = norm(p.promo_code);
  const payloadFn = norm(p.fn);
  const payloadLn = norm(p.ln);
  const payloadEmail = norm(p.email);
  const eventSourceUrl = await deriveEventSourceUrl(db, landing.name, norm(p.event_source_url));

  // Count previous successful purchases for this phone
  const { count: prevCount } = await db
    .from("conversions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", landing.user_id)
    .eq("phone", cleanPhone)
    .eq("purchase_status_capi", "enviado");

  const isRepeat = (prevCount ?? 0) > 0;

  if (!isRepeat) {
    // ── First purchase ──

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

    // 2) Match by phone
    if (!targetId && cleanPhone) {
      const { data } = await db
        .from("conversions")
        .select("id")
        .eq("user_id", landing.user_id)
        .eq("phone", cleanPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) targetId = data.id;
    }

    const purchaseEventId = generateEventId();
    const purchaseEventTime = Math.floor(Date.now() / 1000);

    // 3) No match -> create new row
    if (!targetId) {
      const newRow: Omit<ConversionRow, "id"> = {
        landing_id: landing.id,
        user_id: landing.user_id,
        landing_name: landing.name,
        phone: cleanPhone,
        email: payloadEmail,
        fn: payloadFn,
        ln: payloadLn,
        ct: "",
        st: "",
        zip: "",
        country: "",
        fbp: "",
        fbc: "",
        contact_event_id: "",
        contact_event_time: null,
        lead_event_id: "",
        lead_event_time: null,
        purchase_event_id: purchaseEventId,
        purchase_event_time: purchaseEventTime,
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
        geo_city: "",
        geo_region: "",
        geo_country: "",
      };
      const { data: ins, error } = await db.from("conversions").insert(newRow).select("id").single();
      if (error || !ins) return textResponse("Error al crear fila PURCHASE", 500);
      targetId = ins.id;
    } else {
      // 4) Update existing row
      const updates: Record<string, unknown> = {
        phone: cleanPhone,
        estado: "purchase",
        valor: amount,
        event_source_url: eventSourceUrl,
        purchase_event_id: purchaseEventId,
        purchase_event_time: purchaseEventTime,
      };
      if (payloadFn) updates.fn = payloadFn;
      if (payloadLn) updates.ln = payloadLn;
      if (payloadEmail) updates.email = payloadEmail;
      if (promoCode) {
        const { data: cur } = await db.from("conversions").select("promo_code").eq("id", targetId).single();
        if (!cur?.promo_code) updates.promo_code = promoCode;
      }
      await db.from("conversions").update(updates).eq("id", targetId);
    }

    // Geo + send
    const { data: row } = await db.from("conversions").select("*").eq("id", targetId).single();
    if (!row) return textResponse("Error al leer fila PURCHASE", 500);
    await ensureGeoOnRow(db, targetId!, row.client_ip, { ct: row.ct, st: row.st, country: row.country, zip: row.zip, geo_city: row.geo_city, geo_region: row.geo_region, geo_country: row.geo_country }, config);

    const { data: fresh } = await db.from("conversions").select("*").eq("id", targetId).single();
    const fullRow = (fresh ?? row) as ConversionRow;
    const customData = { currency: config.meta_currency, value: amount };

    await writeLog(db, landing.user_id, "handlePurchase", "INFO", "Primera compra procesada", JSON.stringify({ phone: cleanPhone, amount, promo_code: promoCode }), targetId!);

    const ok = await sendToMetaCAPI(db, config, fullRow, targetId!, "Purchase", purchaseEventId, purchaseEventTime, customData);
    await writeLog(db, landing.user_id, "sendToMetaCAPI", ok ? "INFO" : "ERROR", ok ? "Purchase CAPI enviado" : "Error Purchase CAPI", JSON.stringify({ event_id: purchaseEventId, type: "first" }), targetId!);
    return textResponse(ok ? "Primera compra enviada (Purchase)" : "Error al enviar primera compra");
  }

  // ── Repeat purchase ──

  // Find most recent row of this phone to inherit identity
  const { data: srcRow } = await db
    .from("conversions")
    .select("*")
    .eq("user_id", landing.user_id)
    .eq("phone", cleanPhone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const purchaseEventId = generateEventId();
  const purchaseEventTime = Math.floor(Date.now() / 1000);

  const newRow: Omit<ConversionRow, "id"> = {
    landing_id: srcRow?.landing_id ?? landing.id,
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
    // DO NOT inherit event IDs
    contact_event_id: "",
    contact_event_time: null,
    lead_event_id: "",
    lead_event_time: null,
    purchase_event_id: purchaseEventId,
    purchase_event_time: purchaseEventTime,
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
    // DO NOT inherit observaciones
    observaciones: "",
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

  await ensureGeoOnRow(db, newId, newRow.client_ip, { ct: newRow.ct, st: newRow.st, country: newRow.country, zip: newRow.zip, geo_city: newRow.geo_city, geo_region: newRow.geo_region, geo_country: newRow.geo_country }, config);

  const { data: fresh } = await db.from("conversions").select("*").eq("id", newId).single();
  const fullRow = (fresh ?? newRow) as ConversionRow;
  const customData: Record<string, unknown> = { currency: config.meta_currency, value: amount, purchase_type: "repeat" };

  await writeLog(db, landing.user_id, "handlePurchase", "INFO", "Recompra procesada", JSON.stringify({ phone: cleanPhone, amount, inherited_from: srcRow?.id }), newId);

  const ok = await sendToMetaCAPI(db, config, fullRow, newId, "Purchase", purchaseEventId, purchaseEventTime, customData);
  await writeLog(db, landing.user_id, "sendToMetaCAPI", ok ? "INFO" : "ERROR", ok ? "Purchase Repeat CAPI enviado" : "Error Purchase Repeat CAPI", JSON.stringify({ event_id: purchaseEventId, type: "repeat" }), newId);
  return textResponse(ok ? "Recompra enviada (Purchase_Repeat)" : "Error al enviar recompra");
}

// ─── C) Simple purchase { phone, amount } ───────────────────────────────────

async function handleSimplePurchase(
  db: SupabaseClient,
  p: Params,
  landing: LandingRow,
  config: ConversionsConfig,
): Promise<Response> {
  const cleanPhone = sanitizePhone(p.phone);
  const amount = parseFloat(p.amount);
  if (!cleanPhone || isNaN(amount)) return textResponse("Faltan parámetros: phone y amount", 400);

  const payloadEmail = norm(p.email);
  const eventSourceUrl = await deriveEventSourceUrl(db, landing.name, norm(p.event_source_url));

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
  const purchaseEventTime = Math.floor(Date.now() / 1000);

  const newRow: Omit<ConversionRow, "id"> = {
    landing_id: landing.id,
    user_id: landing.user_id,
    landing_name: landing.name,
    phone: cleanPhone,
    email: payloadEmail || srcRow?.email || "",
    fn: srcRow?.fn ?? "",
    ln: srcRow?.ln ?? "",
    ct: srcRow?.ct ?? "",
    st: srcRow?.st ?? "",
    zip: srcRow?.zip ?? "",
    country: srcRow?.country ?? "",
    fbp: srcRow?.fbp ?? "",
    fbc: srcRow?.fbc ?? "",
    contact_event_id: "",
    contact_event_time: null,
    lead_event_id: "",
    lead_event_time: null,
    purchase_event_id: purchaseEventId,
    purchase_event_time: purchaseEventTime,
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

  await ensureGeoOnRow(db, newId, newRow.client_ip, { ct: newRow.ct, st: newRow.st, country: newRow.country, zip: newRow.zip, geo_city: newRow.geo_city, geo_region: newRow.geo_region, geo_country: newRow.geo_country }, config);

  const { data: fresh } = await db.from("conversions").select("*").eq("id", newId).single();
  const fullRow = (fresh ?? newRow) as ConversionRow;
  const customData = { currency: config.meta_currency, value: amount };

  await writeLog(db, landing.user_id, "handleSimplePurchase", "INFO", "Purchase simple procesado", JSON.stringify({ phone: cleanPhone, amount, inherited_from: srcRow?.id }), newId);

  const ok = await sendToMetaCAPI(db, config, fullRow, newId, "Purchase", purchaseEventId, purchaseEventTime, customData);
  await writeLog(db, landing.user_id, "sendToMetaCAPI", ok ? "INFO" : "ERROR", ok ? "Simple Purchase CAPI enviado" : "Error Simple Purchase CAPI", JSON.stringify({ event_id: purchaseEventId }), newId);
  return textResponse(ok ? "Evento Purchase enviado" : "Error al enviar Purchase");
}

// ─── Main handler ───────────────────────────────────────────────────────────

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
    if (!name) return textResponse("Falta parámetro 'name' en la URL", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return textResponse("Configuración del servidor incompleta", 500);

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
      test_event_code: "",
    };

    const params: Params = await req.json().catch(() => ({}));

    // landing_name can come from the payload (to track which landing sent this)
    const landingName = norm(params.landing_name || params.landingName || "");

    // Build a virtual LandingRow representing the client endpoint
    const landing: LandingRow = { id: "", name: landingName, user_id: userId };

    // Route to the correct handler
    if (!params.action && params.phone && params.amount) {
      return handleSimplePurchase(db, params, landing, cfg);
    }
    if (params.action === "LEAD") {
      return handleLead(db, params, landing, cfg);
    }
    if (params.action === "PURCHASE") {
      return handlePurchase(db, params, landing, cfg);
    }

    // Default: contact from landing
    return handleContact(db, params, landing, cfg);
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
