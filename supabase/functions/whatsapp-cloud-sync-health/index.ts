import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SupabaseDb = any;
type Json = Record<string, unknown>;

type ConfigRow = {
  id: string;
  user_id: string;
  name?: string;
  active: boolean;
  phone_number_id: string;
  display_phone_number?: string;
  meta_access_token: string;
  meta_api_version: string;
  phone_number_status?: string | null;
  quality_rating?: string | null;
  messaging_limit_tier?: string | null;
  health_checked_at?: string | null;
};

function jsonResponse(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return { ok: res.ok, body: await res.text().catch(() => "") };
}

function qualityAlertMessage(quality: string, tier: string, status: string): string {
  const normalizedQuality = quality.toUpperCase();
  const normalizedStatus = status.toUpperCase();
  if (normalizedQuality === "GREEN" || normalizedQuality === "HIGH") return "";
  if (!quality && !status && !tier) return "";
  const parts = [
    quality ? `calidad ${quality}` : "",
    status ? `estado ${status}` : "",
    tier ? `limite ${tier}` : "",
  ].filter(Boolean).join(", ");
  if (["RED", "LOW"].includes(normalizedQuality)) {
    return `Alerta Meta: baja reputacion del numero (${parts}).`;
  }
  if (["YELLOW", "MEDIUM"].includes(normalizedQuality)) {
    return `Alerta Meta: reputacion media del numero (${parts}).`;
  }
  if (["LIMITED", "BLOCKED", "FLAGGED", "DISABLED", "RESTRICTED"].includes(normalizedStatus)) {
    return `Alerta Meta: revisar estado del numero (${parts}).`;
  }
  return "";
}

function healthChanged(config: ConfigRow, result: {
  status: string;
  quality: string;
  tier: string;
}): boolean {
  if (!config.health_checked_at) return false;
  return (
    str(config.phone_number_status) !== str(result.status) ||
    str(config.quality_rating) !== str(result.quality) ||
    str(config.messaging_limit_tier) !== str(result.tier)
  );
}

async function notifyHealthChange(
  db: SupabaseDb,
  config: ConfigRow,
  result: { status: string; quality: string; tier: string },
): Promise<number> {
  if (!healthChanged(config, result)) return 0;

  const { data: botRow } = await db
    .from("notification_bot_config")
    .select("telegram_bot_token")
    .eq("id", 1)
    .maybeSingle();
  const token = str((botRow as { telegram_bot_token?: string } | null)?.telegram_bot_token);
  if (!token) return 0;

  const { data: settingsRow } = await db
    .from("notification_settings")
    .select("enabled, channel, whatsapp_cloud_api_health_notifications_enabled")
    .eq("user_id", config.user_id)
    .maybeSingle();
  if (
    settingsRow &&
    ((settingsRow as { enabled?: boolean }).enabled === false ||
      str((settingsRow as { channel?: string }).channel) !== "telegram" ||
      (settingsRow as {
        whatsapp_cloud_api_health_notifications_enabled?: boolean;
      }).whatsapp_cloud_api_health_notifications_enabled === false)
  ) {
    return 0;
  }

  const { data: destinations } = await db
    .from("notification_telegram_destinations")
    .select("telegram_chat_id")
    .eq("user_id", config.user_id)
    .eq("is_active", true);
  const rows = (destinations ?? []) as Array<{ telegram_chat_id?: string }>;
  if (!rows.length) return 0;

  const internalName = str(config.name) || "-";
  const visiblePhone = str(config.display_phone_number) || "-";
  const text = [
    "<b>Alerta WhatsApp Cloud API</b>",
    `Nombre interno: ${escapeHtml(internalName)}`,
    `Telefono visible: ${escapeHtml(visiblePhone)}`,
    `Calidad: ${escapeHtml(str(config.quality_rating) || "-")} -> ${escapeHtml(str(result.quality) || "-")}`,
    `Limite: ${escapeHtml(str(config.messaging_limit_tier) || "-")} -> ${escapeHtml(str(result.tier) || "-")}`,
    `Estado: ${escapeHtml(str(config.phone_number_status) || "-")} -> ${escapeHtml(str(result.status) || "-")}`,
  ].join("\n");

  let sent = 0;
  for (const destination of rows) {
    const chatId = str(destination.telegram_chat_id);
    if (!chatId) continue;
    const res = await sendTelegramMessage(token, chatId, text);
    if (res.ok) sent += 1;
  }
  return sent;
}

function serviceDb(): SupabaseDb {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function userDb(authHeader: string): SupabaseDb {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function isAdmin(db: SupabaseDb, userId: string): Promise<boolean> {
  const { data } = await db
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return str((data as { role?: string } | null)?.role) === "admin";
}

async function cronSecretMatches(db: SupabaseDb, value: unknown): Promise<boolean> {
  const candidate = str(value);
  if (!candidate) return false;
  const { data, error } = await db
    .from("cron_config")
    .select("value")
    .eq("key", "sync_phones_cron_secret")
    .maybeSingle();
  if (error) return false;
  return candidate === str((data as { value?: string } | null)?.value);
}

async function resolveAuth(req: Request, body: Json, db: SupabaseDb): Promise<{
  ok: boolean;
  internal: boolean;
  userId: string;
  isAdmin: boolean;
}> {
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return { ok: true, internal: true, userId: "", isAdmin: true };
  }
  if (await cronSecretMatches(db, body.cron_secret)) {
    return { ok: true, internal: true, userId: "", isAdmin: true };
  }
  if (!authHeader) return { ok: false, internal: false, userId: "", isAdmin: false };

  const authDb = userDb(authHeader);
  const { data: auth, error } = await authDb.auth.getUser();
  const userId = auth.user?.id ?? "";
  if (error || !userId) return { ok: false, internal: false, userId: "", isAdmin: false };
  return {
    ok: true,
    internal: false,
    userId,
    isAdmin: await isAdmin(db, userId),
  };
}

async function fetchMetaHealth(config: ConfigRow): Promise<{
  ok: boolean;
  status: string;
  quality: string;
  tier: string;
  error: string;
}> {
  const apiVersion = str(config.meta_api_version) || "v25.0";
  const fieldSets = [
    ["display_phone_number", "verified_name", "quality_rating", "messaging_limit_tier", "name_status", "status"],
    ["quality_rating", "messaging_limit_tier", "status"],
    ["quality_rating", "messaging_limit_tier"],
    ["display_phone_number", "verified_name"],
  ];
  let lastError = "";

  for (const fields of fieldSets) {
    const url =
      `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(config.phone_number_id)}` +
      `?fields=${encodeURIComponent(fields.join(","))}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.meta_access_token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await res.text();
      let json: Json = {};
      try {
        json = text ? JSON.parse(text) as Json : {};
      } catch {
        json = { raw: text };
      }
      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${text}`.slice(0, 4000);
        continue;
      }
      return {
        ok: true,
        status: str(json.status || json.name_status),
        quality: str(json.quality_rating),
        tier: str(json.messaging_limit_tier),
        error: "",
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = String(error).slice(0, 4000);
    }
  }

  return {
    ok: false,
    status: "",
    quality: "",
    tier: "",
    error: lastError || "Meta health request failed",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({})) as Json;
    const db = serviceDb();
    const auth = await resolveAuth(req, body, db);
    if (!auth.ok) return jsonResponse({ error: "Unauthorized" }, 401);

    const configId = str(body.config_id);
    let query = db
      .from("whatsapp_cloud_api_configs")
      .select("id,user_id,name,active,phone_number_id,display_phone_number,meta_access_token,meta_api_version,phone_number_status,quality_rating,messaging_limit_tier,health_checked_at")
      .not("phone_number_id", "eq", "")
      .not("meta_access_token", "eq", "");

    if (configId) query = query.eq("id", configId);
    else query = query.eq("active", true).limit(25);

    if (!auth.internal && !auth.isAdmin) query = query.eq("user_id", auth.userId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const configs = (data ?? []) as ConfigRow[];

    let ok = 0;
    let failed = 0;
    let notified = 0;
    for (const config of configs) {
      const result = await fetchMetaHealth(config);
      const update = result.ok
        ? {
          phone_number_status: result.status,
          quality_rating: result.quality,
          messaging_limit_tier: result.tier,
          health_checked_at: new Date().toISOString(),
          health_last_error: qualityAlertMessage(result.quality, result.tier, result.status),
        }
        : {
          health_checked_at: new Date().toISOString(),
          health_last_error: result.error,
        };
      const { error: updateError } = await db
        .from("whatsapp_cloud_api_configs")
        .update(update)
        .eq("id", config.id);
      if (result.ok && !updateError) {
        notified += await notifyHealthChange(db, config, result);
      }
      if (result.ok && !updateError) ok++;
      else failed++;
    }

    return jsonResponse({ ok: true, checked: configs.length, updated: ok, failed, notified });
  } catch (error) {
    console.error("[whatsapp-cloud-sync-health] unexpected error", String(error));
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
