import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The project does not use generated Supabase DB types for Edge Functions.
// Keep this client dynamic so new migration tables do not typecheck as `never`.
// deno-lint-ignore no-explicit-any
type SupabaseDb = any;
type Json = Record<string, unknown>;

type WebhookEvent = {
  id: string;
  config_id: string | null;
  user_id: string | null;
  meta_message_id: string;
  event_type: "message" | "status" | "error" | "unknown";
  payload: Json;
  attempts: number;
};

type WhatsappConfig = {
  id: string;
  user_id: string;
  name: string;
  active: boolean;
  phone_number_id: string;
  whatsapp_business_account_id: string;
  meta_access_token: string;
  meta_api_version: string;
  pixel_id: string;
  landing_tag: string;
  send_contact_capi: boolean;
  redirect_message_template: string;
  fallback_message_template: string;
};

const MAX_EVENTS = 10;
const GRAPH_TIMEOUT_MS = 8000;

function jsonResponse(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getDb(): SupabaseDb {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function assertInternalAuth(req: Request): Response | null {
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const header = req.headers.get("authorization") ?? "";
  if (!serviceRoleKey || header !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  return null;
}

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Json
    : {};
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function metaTimestamp(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

function unixSeconds(value: unknown): number {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return Math.floor(Date.now() / 1000);
}

function firstName(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean).slice(0, -1).join(" ") ||
    fullName;
}

function lastName(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function promoCode(tag: string): string {
  const prefix = str(tag).replace(/[^A-Za-z0-9]/g, "") || "WCA";
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}-${suffix}`;
}

function waLink(phone: string, promo: string): string {
  const text = encodeURIComponent(`Hola, mi codigo es ${promo}`);
  return `https://wa.me/${digits(phone)}?text=${text}`;
}

function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) =>
    values[String(key)] ?? ""
  );
}

function payloadMessage(event: WebhookEvent): Json {
  return asRecord(event.payload.message);
}

function payloadStatus(event: WebhookEvent): Json {
  return asRecord(event.payload.status);
}

function payloadChangeValue(event: WebhookEvent): Json {
  const change = asRecord(event.payload.change);
  return asRecord(change.value);
}

function firstContactProfileName(event: WebhookEvent, waId: string): string {
  const value = payloadChangeValue(event);
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  for (const candidate of contacts) {
    const contact = asRecord(candidate);
    if (str(contact.wa_id) && str(contact.wa_id) !== waId) continue;
    const profile = asRecord(contact.profile);
    const name = str(profile.name);
    if (name) return name;
  }
  return "";
}

function referralFromMessage(message: Json): Json {
  return asRecord(message.referral);
}

async function claimEvent(db: SupabaseDb, event: WebhookEvent): Promise<boolean> {
  const { data, error } = await db
    .from("whatsapp_cloud_api_webhook_events")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      attempts: Number(event.attempts ?? 0) + 1,
      last_error: "",
    })
    .eq("id", event.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[whatsapp-cloud-worker] claim failed", error.message);
    return false;
  }
  return Boolean((data as { id?: string } | null)?.id);
}

async function finalizeEvent(
  db: SupabaseDb,
  eventId: string,
  status: "processed" | "deduplicated" | "failed",
  lastError = "",
): Promise<void> {
  await db
    .from("whatsapp_cloud_api_webhook_events")
    .update({
      status,
      processed_at: new Date().toISOString(),
      last_error: lastError.slice(0, 4000),
    })
    .eq("id", eventId);
}

async function loadConfig(
  db: SupabaseDb,
  configId: string,
): Promise<WhatsappConfig | null> {
  const { data, error } = await db
    .from("whatsapp_cloud_api_configs")
    .select("*")
    .eq("id", configId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as WhatsappConfig | null;
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
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
      const retryable = res.status === 429 || res.status === 408 ||
        res.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        return {
          ok: false,
          status: res.status,
          response: json,
          metaMessageId,
          error: `HTTP ${res.status}: ${text}`.slice(0, 4000),
        };
      }
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === maxAttempts) {
        return {
          ok: false,
          status: 0,
          response: {},
          metaMessageId: "",
          error: String(error).slice(0, 4000),
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  return { ok: false, status: 0, response: {}, metaMessageId: "", error: "Unknown send failure" };
}

async function createInternalContact(input: {
  config: WhatsappConfig;
  profileName: string;
  waId: string;
  messageId: string;
  messageTimestamp: number;
  assignedPhone: string;
  promo: string;
  ctwaClid: string;
  referral: Json;
}): Promise<{ ok: boolean; conversionId: string; error: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, conversionId: "", error: "Missing Supabase env" };
  }

  const db = getDb();
  const { data: profile } = await db
    .from("profiles")
    .select("nombre")
    .eq("id", input.config.user_id)
    .maybeSingle();
  const clientName = str((profile as { nombre?: string } | null)?.nombre);
  if (!clientName) {
    return { ok: false, conversionId: "", error: "Client profile name not found" };
  }

  const externalId = await sha256(
    `whatsapp_cloud_api:${input.config.id}:${input.waId}`,
  );
  const payload = {
    event_name: "Contact",
    event_id: input.messageId,
    contact_event_id: input.messageId,
    event_time: input.messageTimestamp,
    contact_event_time: input.messageTimestamp,
    phone: digits(input.waId),
    fn: firstName(input.profileName),
    ln: lastName(input.profileName),
    external_id: externalId,
    promo_code: input.promo,
    telefono_asignado: digits(input.assignedPhone),
    meta_pixel_id: input.config.pixel_id,
    pixel_id: input.config.pixel_id,
    source_platform: "whatsapp_cloud_api",
    ctwa_clid: input.ctwaClid,
    from_meta_ads: Boolean(input.ctwaClid),
    sendContactPixel: input.config.send_contact_capi,
    event_source_url: `whatsapp-cloud-api://${input.config.phone_number_id}`,
    whatsapp_cloud_api_config_id: input.config.id,
    whatsapp_cloud_api_referral: input.referral,
  };

  const res = await fetch(
    `${supabaseUrl}/functions/v1/conversions?name=${encodeURIComponent(clientName)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, conversionId: "", error: `Contact failed HTTP ${res.status}: ${text}` };
  }

  const { data } = await db
    .from("conversions")
    .select("id")
    .eq("user_id", input.config.user_id)
    .eq("contact_event_id", input.messageId)
    .maybeSingle();
  return {
    ok: true,
    conversionId: str((data as { id?: string } | null)?.id),
    error: "",
  };
}

async function handleStatus(db: SupabaseDb, event: WebhookEvent): Promise<void> {
  const status = payloadStatus(event);
  const metaMessageId = str(status.id);
  const metaStatus = str(status.status);
  if (!metaMessageId || !metaStatus) {
    await finalizeEvent(db, event.id, "processed");
    return;
  }
  const mapped = ["sent", "delivered", "read", "failed"].includes(metaStatus)
    ? metaStatus
    : "accepted";
  await db
    .from("whatsapp_cloud_api_outbound_messages")
    .update({
      status: mapped,
      response: status,
      last_error: mapped === "failed" ? JSON.stringify(status).slice(0, 4000) : "",
    })
    .eq("meta_message_id", metaMessageId);
  await finalizeEvent(db, event.id, "processed");
}

async function handleMessage(db: SupabaseDb, event: WebhookEvent): Promise<void> {
  if (!event.config_id || !event.user_id) {
    await finalizeEvent(db, event.id, "failed", "No active config for phone_number_id");
    return;
  }
  const config = await loadConfig(db, event.config_id);
  if (!config) {
    await finalizeEvent(db, event.id, "failed", "Config inactive or not found");
    return;
  }
  if (!str(config.meta_access_token)) {
    await finalizeEvent(db, event.id, "failed", "Meta access token missing");
    return;
  }

  const message = payloadMessage(event);
  const messageId = str(message.id || event.meta_message_id);
  const waId = digits(message.from);
  if (!messageId || !waId) {
    await finalizeEvent(db, event.id, "failed", "Missing message id or sender wa_id");
    return;
  }

  const { data: existingAssignment } = await db
    .from("whatsapp_cloud_api_assignments")
    .select("id")
    .eq("first_message_id", messageId)
    .maybeSingle();
  if ((existingAssignment as { id?: string } | null)?.id) {
    await finalizeEvent(db, event.id, "deduplicated");
    return;
  }

  const profileName = firstContactProfileName(event, waId);
  const messageAt = metaTimestamp(message.timestamp);
  const messageTime = unixSeconds(message.timestamp);
  const referral = referralFromMessage(message);
  const ctwaClid = str(referral.ctwa_clid);

  const externalId = await sha256(`whatsapp_cloud_api:${config.id}:${waId}`);
  const { data: contact, error: contactError } = await db
    .from("whatsapp_cloud_api_contacts")
    .upsert(
      {
        config_id: config.id,
        user_id: config.user_id,
        wa_id: waId,
        phone: waId,
        profile_name: profileName,
        first_message_id: messageId,
        first_message_at: messageAt,
        last_message_at: messageAt,
        external_id: externalId,
      },
      { onConflict: "config_id,wa_id" },
    )
    .select("id")
    .single();
  const contactRow = contact as { id?: string } | null;
  if (contactError || !contactRow?.id) {
    await finalizeEvent(db, event.id, "failed", contactError?.message ?? "Contact upsert failed");
    return;
  }

  if (!ctwaClid) {
    const { data: recentAssignment } = await db
      .from("whatsapp_cloud_api_assignments")
      .select("id,created_at")
      .eq("contact_id", contactRow.id)
      .neq("status", "failed")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if ((recentAssignment as { id?: string } | null)?.id) {
      await finalizeEvent(db, event.id, "deduplicated");
      return;
    }
  }

  const { data: session, error: sessionError } = await db
    .from("whatsapp_cloud_api_attribution_sessions")
    .insert({
      config_id: config.id,
      user_id: config.user_id,
      contact_id: contactRow.id,
      ctwa_clid: ctwaClid,
      source_id: str(referral.source_id),
      source_url: str(referral.source_url),
      source_type: str(referral.source_type),
      headline: str(referral.headline),
      referral,
      first_message_id: messageId,
      started_at: messageAt,
      last_message_at: messageAt,
    })
    .select("id")
    .single();
  const sessionRow = session as { id?: string } | null;
  if (sessionError || !sessionRow?.id) {
    await finalizeEvent(db, event.id, "failed", sessionError?.message ?? "Attribution session insert failed");
    return;
  }

  const { data: phoneResult, error: phoneError } = await db.rpc(
    "get_phone_for_whatsapp_cloud_api",
    { p_config_id: config.id },
  );
  const phonePayload = asRecord(phoneResult);
  const status = str(phonePayload._status);
  if (phoneError || status) {
    const fallback = renderTemplate(config.fallback_message_template, {
      name: config.name,
      promo_code: "",
      phone: "",
      wa_link: "",
    });
    await sendWhatsappText(config, waId, fallback);
    await db.from("whatsapp_cloud_api_assignments").insert({
      config_id: config.id,
      user_id: config.user_id,
      contact_id: contactRow.id,
      attribution_session_id: sessionRow.id,
      webhook_event_id: event.id,
      first_message_id: messageId,
      status: "failed",
      last_error: phoneError?.message || status || "No phone available",
    });
    await finalizeEvent(db, event.id, "failed", phoneError?.message || status || "No phone available");
    return;
  }

  const assignedPhone = digits(phonePayload.phone);
  const generatedPromo = promoCode(config.landing_tag);
  const link = waLink(assignedPhone, generatedPromo);
  const text = renderTemplate(config.redirect_message_template, {
    name: config.name,
    phone: assignedPhone,
    promo_code: generatedPromo,
    wa_link: link,
  });

  const contactResult = await createInternalContact({
    config,
    profileName,
    waId,
    messageId,
    messageTimestamp: messageTime,
    assignedPhone,
    promo: generatedPromo,
    ctwaClid,
    referral,
  });
  if (!contactResult.ok) {
    await finalizeEvent(db, event.id, "failed", contactResult.error);
    return;
  }

  const gerencia = asRecord(phonePayload.gerencia);
  const { data: assignment, error: assignmentError } = await db
    .from("whatsapp_cloud_api_assignments")
    .insert({
      config_id: config.id,
      user_id: config.user_id,
      contact_id: contactRow.id,
      attribution_session_id: sessionRow.id,
      webhook_event_id: event.id,
      first_message_id: messageId,
      assigned_phone: assignedPhone,
      assigned_phone_id: Number(phonePayload.phoneId) || null,
      assigned_gerencia_id: Number(gerencia.id) || null,
      assigned_gerencia_external_id: Number(gerencia.externalId) || null,
      assigned_gerencia_label: gerencia.externalId
        ? `Gerencia ${gerencia.externalId}`
        : "",
      promo_code: generatedPromo,
      conversion_id: contactResult.conversionId || null,
      status: "pending",
    })
    .select("id")
    .single();
  const assignmentRow = assignment as { id?: string } | null;
  if (assignmentError || !assignmentRow?.id) {
    await finalizeEvent(db, event.id, "failed", assignmentError?.message ?? "Assignment insert failed");
    return;
  }

  const sendResult = await sendWhatsappText(config, waId, text);
  await db.from("whatsapp_cloud_api_outbound_messages").insert({
    config_id: config.id,
    user_id: config.user_id,
    assignment_id: assignmentRow.id,
    meta_message_id: sendResult.metaMessageId,
    recipient_wa_id: waId,
    message_type: "text",
    payload: {
      messaging_product: "whatsapp",
      to: waId,
      type: "text",
      text: { preview_url: true, body: text },
    },
    response: sendResult.response,
    status: sendResult.ok ? "accepted" : "failed",
    last_error: sendResult.error,
    sent_at: sendResult.ok ? new Date().toISOString() : null,
  });
  await db.from("whatsapp_cloud_api_assignments").update({
    redirect_message_id: sendResult.metaMessageId,
    redirect_sent_at: sendResult.ok ? new Date().toISOString() : null,
    status: sendResult.ok ? "sent" : "failed",
    last_error: sendResult.error,
  }).eq("id", assignmentRow.id);

  if (!sendResult.ok) {
    await finalizeEvent(db, event.id, "failed", sendResult.error);
    return;
  }

  const assignedPhoneId = Number(phonePayload.phoneId) || 0;
  if (assignedPhoneId > 0) {
    const { error: usageError } = await db.rpc(
      "increment_gerencia_phone_usage",
      { p_phone_id: assignedPhoneId },
    );
    if (usageError) {
      console.error("[whatsapp-cloud-worker] usage_count increment failed", {
        phone_id: assignedPhoneId,
        error: usageError.message,
      });
    }
  }

  await finalizeEvent(db, event.id, "processed");
}

async function processPending(db: SupabaseDb): Promise<Record<string, number>> {
  const stats = { processed: 0, deduplicated: 0, failed: 0, skipped: 0 };
  const { data, error } = await db
    .from("whatsapp_cloud_api_webhook_events")
    .select("id,config_id,user_id,meta_message_id,event_type,payload,attempts")
    .eq("status", "pending")
    .order("received_at", { ascending: true })
    .limit(MAX_EVENTS);
  if (error) throw new Error(error.message);

  for (const event of (data ?? []) as WebhookEvent[]) {
    const claimed = await claimEvent(db, event);
    if (!claimed) {
      stats.skipped++;
      continue;
    }
    try {
      if (event.event_type === "status") await handleStatus(db, event);
      else if (event.event_type === "message") await handleMessage(db, event);
      else await finalizeEvent(db, event.id, "processed");
    } catch (error) {
      console.error("[whatsapp-cloud-worker] event failed", {
        event_id: event.id,
        error: String(error),
      });
      await finalizeEvent(db, event.id, "failed", String(error));
    }

    const { data: fresh } = await db
      .from("whatsapp_cloud_api_webhook_events")
      .select("status")
      .eq("id", event.id)
      .maybeSingle();
    const finalStatus = str((fresh as { status?: string } | null)?.status);
    if (finalStatus === "processed") stats.processed++;
    else if (finalStatus === "deduplicated") stats.deduplicated++;
    else if (finalStatus === "failed") stats.failed++;
    else stats.skipped++;
  }
  return stats;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const auth = assertInternalAuth(req);
  if (auth) return auth;

  try {
    const db = getDb();
    const stats = await processPending(db);
    return jsonResponse({ ok: true, ...stats });
  } catch (error) {
    console.error("[whatsapp-cloud-worker] unexpected error", String(error));
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
