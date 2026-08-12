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
  active: boolean;
  phone_number_id: string;
  meta_access_token: string;
  meta_api_version: string;
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
      .select("id,user_id,active,phone_number_id,meta_access_token,meta_api_version")
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
    for (const config of configs) {
      const result = await fetchMetaHealth(config);
      const update = result.ok
        ? {
          phone_number_status: result.status,
          quality_rating: result.quality,
          messaging_limit_tier: result.tier,
          health_checked_at: new Date().toISOString(),
          health_last_error: "",
        }
        : {
          health_checked_at: new Date().toISOString(),
          health_last_error: result.error,
        };
      const { error: updateError } = await db
        .from("whatsapp_cloud_api_configs")
        .update(update)
        .eq("id", config.id);
      if (result.ok && !updateError) ok++;
      else failed++;
    }

    return jsonResponse({ ok: true, checked: configs.length, updated: ok, failed });
  } catch (error) {
    console.error("[whatsapp-cloud-sync-health] unexpected error", String(error));
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
