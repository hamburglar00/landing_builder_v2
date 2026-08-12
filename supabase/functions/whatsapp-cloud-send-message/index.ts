import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH_TIMEOUT_MS = 8000;
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

// The project does not use generated Supabase DB types for Edge Functions.
// deno-lint-ignore no-explicit-any
type SupabaseDb = any;
type Json = Record<string, unknown>;

type WhatsappConfig = {
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

async function latestInboundAt(
  db: SupabaseDb,
  configId: string,
  waId: string,
): Promise<string> {
  const { data, error } = await db
    .from("whatsapp_cloud_api_webhook_events")
    .select("received_at")
    .eq("config_id", configId)
    .eq("event_type", "message")
    .contains("payload", { message: { from: waId } })
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return str((data as { received_at?: string } | null)?.received_at);
}

async function sendWhatsappText(
  config: WhatsappConfig,
  to: string,
  body: string,
): Promise<{ ok: boolean; status: number; response: Json; metaMessageId: string; error: string }> {
  const apiVersion = str(config.meta_api_version) || "v25.0";
  const url =
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(config.phone_number_id)}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { preview_url: true, body },
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.meta_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
    const messages = Array.isArray(json.messages) ? json.messages : [];
    const first = asRecord(messages[0]);
    const metaMessageId = str(first.id);
    if (res.ok && metaMessageId) {
      return { ok: true, status: res.status, response: json, metaMessageId, error: "" };
    }
    return {
      ok: false,
      status: res.status,
      response: json,
      metaMessageId,
      error: `HTTP ${res.status}: ${text}`.slice(0, 4000),
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      status: 0,
      response: {},
      metaMessageId: "",
      error: String(error).slice(0, 4000),
    };
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

    const body = await req.json().catch(() => ({}));
    const contactId = str(body.contact_id);
    const messageBody = str(body.body);
    if (!contactId) return jsonResponse({ error: "contact_id requerido." }, 400);
    if (!messageBody) return jsonResponse({ error: "Mensaje requerido." }, 400);
    if (messageBody.length > 4096) return jsonResponse({ error: "Mensaje demasiado largo." }, 400);

    const db = serviceDb();
    const requesterIsAdmin = await isAdmin(db, requesterId);
    const { data: contact, error: contactError } = await db
      .from("whatsapp_cloud_api_contacts")
      .select("id,config_id,user_id,wa_id")
      .eq("id", contactId)
      .maybeSingle();
    if (contactError) throw new Error(contactError.message);
    const contactRow = contact as { id: string; config_id: string; user_id: string; wa_id: string } | null;
    if (!contactRow) return jsonResponse({ error: "Contacto no encontrado." }, 404);
    if (!requesterIsAdmin && contactRow.user_id !== requesterId) {
      return jsonResponse({ error: "No autorizado." }, 403);
    }

    const { data: config, error: configError } = await db
      .from("whatsapp_cloud_api_configs")
      .select("id,user_id,active,phone_number_id,meta_access_token,meta_api_version")
      .eq("id", contactRow.config_id)
      .maybeSingle();
    if (configError) throw new Error(configError.message);
    const configRow = config as WhatsappConfig | null;
    if (!configRow?.active) return jsonResponse({ error: "Integracion inactiva." }, 400);
    if (!str(configRow.meta_access_token)) return jsonResponse({ error: "Meta access token no configurado." }, 400);

    const inboundAt = await latestInboundAt(db, contactRow.config_id, contactRow.wa_id);
    if (!inboundAt) {
      await db.from("whatsapp_cloud_api_outbound_messages").insert({
        config_id: contactRow.config_id,
        user_id: contactRow.user_id,
        recipient_wa_id: contactRow.wa_id,
        message_type: "manual_text",
        payload: { body: messageBody },
        status: "failed",
        last_error: "No inbound message found for 24h window validation",
      });
      return jsonResponse({ error: "No hay mensaje entrante para validar ventana de 24 hs." }, 400);
    }
    const expiresAt = new Date(new Date(inboundAt).getTime() + CUSTOMER_SERVICE_WINDOW_MS);
    if (Date.now() > expiresAt.getTime()) {
      await db.from("whatsapp_cloud_api_outbound_messages").insert({
        config_id: contactRow.config_id,
        user_id: contactRow.user_id,
        recipient_wa_id: contactRow.wa_id,
        message_type: "manual_text",
        payload: { body: messageBody },
        status: "failed",
        last_error: `Customer service window expired at ${expiresAt.toISOString()}`,
      });
      return jsonResponse({ error: "Ventana de 24 hs vencida. No se envio el mensaje." }, 400);
    }

    const result = await sendWhatsappText(configRow, contactRow.wa_id, messageBody);
    await db.from("whatsapp_cloud_api_outbound_messages").insert({
      config_id: contactRow.config_id,
      user_id: contactRow.user_id,
      recipient_wa_id: contactRow.wa_id,
      meta_message_id: result.metaMessageId,
      message_type: "manual_text",
      payload: {
        messaging_product: "whatsapp",
        to: contactRow.wa_id,
        type: "text",
        text: { preview_url: true, body: messageBody },
      },
      response: result.response,
      status: result.ok ? "accepted" : "failed",
      last_error: result.error,
      sent_at: result.ok ? new Date().toISOString() : null,
    });

    if (!result.ok) return jsonResponse({ error: result.error || "No se pudo enviar." }, 502);
    return jsonResponse({
      ok: true,
      meta_message_id: result.metaMessageId,
      customer_service_window_expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[whatsapp-cloud-send-message] unexpected error", String(error));
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
