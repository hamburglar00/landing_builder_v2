import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SupabaseDb = any;
type Json = Record<string, unknown>;

function jsonResponse(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Json
    : {};
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

async function callMetaDatasetEndpoint(input: {
  wabaId: string;
  accessToken: string;
  apiVersion: string;
  method: "GET" | "POST";
}): Promise<{ datasetId: string; response: Json; status: number; ok: boolean; detail: string }> {
  const url =
    `https://graph.facebook.com/${encodeURIComponent(input.apiVersion)}/${
      encodeURIComponent(input.wabaId)
    }/dataset?access_token=${encodeURIComponent(input.accessToken)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: input.method,
      headers: { "Content-Type": "application/json" },
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
    const firstData = Array.isArray(json.data) ? asRecord(json.data[0]) : {};
    const datasetId = digits(json.id) || digits(firstData.id);
    const errorObj = asRecord(json.error);
    const detail = str(errorObj.message) || text || "Meta no devolvio dataset_id.";
    return { datasetId, response: json, status: res.status, ok: res.ok, detail };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return jsonResponse({ error: "Falta Authorization." }, 401);

    const authDb = userDb(authHeader);
    const { data: auth, error: authError } = await authDb.auth.getUser();
    const requesterId = auth.user?.id ?? "";
    if (authError || !requesterId) return jsonResponse({ error: "Sesion invalida." }, 401);

    const db = serviceDb();
    const requesterIsAdmin = await isAdmin(db, requesterId);
    const body = await req.json().catch(() => ({})) as Json;
    const configId = str(body.config_id);
    const targetUserId = str(body.user_id) || requesterId;
    if (!requesterIsAdmin && targetUserId !== requesterId) {
      return jsonResponse({ error: "No autorizado." }, 403);
    }

    let wabaId = digits(body.whatsapp_business_account_id);
    let accessToken = str(body.meta_access_token);
    let apiVersion = str(body.meta_api_version) || "v25.0";
    const forceCreate = Boolean(body.force_create);

    if (configId) {
      let query = db
        .from("whatsapp_cloud_api_configs")
        .select("id,user_id,whatsapp_business_account_id,meta_access_token,meta_api_version,meta_messaging_dataset_id")
        .eq("id", configId);
      if (!requesterIsAdmin) query = query.eq("user_id", requesterId);
      const { data: config, error } = await query.maybeSingle();
      if (error) throw new Error(error.message);
      const row = config as {
        user_id?: string;
        whatsapp_business_account_id?: string;
        meta_access_token?: string;
        meta_api_version?: string;
        meta_messaging_dataset_id?: string;
      } | null;
      if (!row) return jsonResponse({ error: "Configuracion no encontrada." }, 404);
      const storedDatasetId = digits(row.meta_messaging_dataset_id);
      const storedWabaId = digits(row.whatsapp_business_account_id);
      const requestedSameWaba = !wabaId || wabaId === storedWabaId;
      if (storedDatasetId && !forceCreate && requestedSameWaba) {
        return jsonResponse({
          ok: true,
          dataset_id: storedDatasetId,
          source: "stored",
        });
      }
      wabaId = wabaId || digits(row.whatsapp_business_account_id);
      accessToken = accessToken || str(row.meta_access_token);
      apiVersion = apiVersion || str(row.meta_api_version) || "v25.0";
    }

    if (!wabaId) return jsonResponse({ error: "WABA ID requerido." }, 400);
    if (!accessToken) return jsonResponse({ error: "Meta access token requerido." }, 400);

    if (!forceCreate) {
      const existing = await callMetaDatasetEndpoint({
        wabaId,
        accessToken,
        apiVersion,
        method: "GET",
      });
      if (existing.ok && existing.datasetId) {
        return jsonResponse({
          ok: true,
          dataset_id: existing.datasetId,
          source: "meta_existing",
          meta_response: existing.response,
        });
      }
      if (!existing.ok && existing.status !== 404) {
        console.warn("[whatsapp-cloud-ensure-dataset] GET dataset failed, trying POST", {
          status: existing.status,
          detail: existing.detail,
        });
      }
    }

    const result = await callMetaDatasetEndpoint({
      wabaId,
      accessToken,
      apiVersion,
      method: "POST",
    });
    if (!result.ok || !result.datasetId) {
      throw new Error(`Meta dataset HTTP ${result.status}: ${result.detail}`);
    }

    return jsonResponse({
      ok: true,
      dataset_id: result.datasetId,
      source: "meta_ensure",
      meta_response: result.response,
    });
  } catch (error) {
    console.error("[whatsapp-cloud-ensure-dataset] error", String(error));
    return jsonResponse({
      error: error instanceof Error ? error.message : "No se pudo obtener el dataset.",
    }, 400);
  }
});
