import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

// The project does not use generated Supabase DB types for Edge Functions.
// Keep this client dynamic so new migration tables do not typecheck as `never`.
// deno-lint-ignore no-explicit-any
type SupabaseDb = any;

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string | null;
    changes?: Array<{
      field?: string | null;
      value?: {
        metadata?: { phone_number_id?: string | null } | null;
        phone_number_id?: string | null;
        current_quality_rating?: string | null;
        quality_rating?: string | null;
        current_limit?: string | null;
        messages?: Array<Record<string, unknown>> | null;
        statuses?: Array<Record<string, unknown>> | null;
        errors?: Array<Record<string, unknown>> | null;
      } | null;
    }> | null;
  }> | null;
};

type WebhookConfig = {
  id: string;
  user_id: string;
  workspace_currency?: string | null;
  meta_app_secret?: string | null;
};

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

async function hmacSha256(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  return hex(signature);
}

async function verifyMetaSignature(
  req: Request,
  rawBody: string,
  appSecret: string,
): Promise<boolean> {
  const secret = appSecret.trim();
  if (!secret) return false;
  const header = req.headers.get("x-hub-signature-256")?.trim() ?? "";
  const expectedPrefix = "sha256=";
  if (!header.toLowerCase().startsWith(expectedPrefix)) return false;
  const received = header.slice(expectedPrefix.length);
  const expected = await hmacSha256(secret, rawBody);
  return timingSafeEqual(received, expected);
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

async function verifyChallenge(db: SupabaseDb, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode") ?? "";
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (mode !== "subscribe" || !token || !challenge) {
    return textResponse("Invalid verification request", 400);
  }

  const envToken = Deno.env.get("WHATSAPP_CLOUD_API_VERIFY_TOKEN")?.trim() ?? "";
  if (envToken && timingSafeEqual(token, envToken)) {
    return textResponse(challenge);
  }

  const { data, error } = await db
    .from("whatsapp_cloud_api_configs")
    .select("id")
    .eq("webhook_verify_token", token)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[whatsapp-cloud-webhook] verify token lookup failed", error);
    return textResponse("Verification failed", 500);
  }
  return (data as { id?: string } | null)?.id
    ? textResponse(challenge)
    : textResponse("Forbidden", 403);
}

function normalizeId(value: unknown): string {
  return String(value ?? "").trim();
}

function extractWabaIds(payload: MetaWebhookPayload): string[] {
  const ids = new Set<string>();
  for (const entry of payload.entry ?? []) {
    const id = normalizeId(entry.id);
    if (id) ids.add(id);
  }
  return [...ids];
}

function extractPhoneNumberIds(payload: MetaWebhookPayload): string[] {
  const ids = new Set<string>();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = normalizeId(change.value?.metadata?.phone_number_id);
      if (phoneNumberId) ids.add(phoneNumberId);
      const directPhoneNumberId = normalizeId(change.value?.phone_number_id);
      if (directPhoneNumberId) ids.add(directPhoneNumberId);
    }
  }
  return [...ids];
}

async function resolveWebhookConfigForSignature(
  db: SupabaseDb,
  phoneNumberIds: string[],
wabaIds: string[],
): Promise<WebhookConfig | null> {
  const ids = phoneNumberIds.filter(Boolean);
  if (ids.length > 0) {
    const { data, error } = await db
      .from("whatsapp_cloud_api_configs")
      .select("id,user_id,workspace_currency,meta_app_secret")
      .in("phone_number_id", ids)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[whatsapp-cloud-webhook] app secret lookup failed", error);
      return null;
    }
    if (data) return data as WebhookConfig;
  }

  const waba = wabaIds.filter(Boolean);
  if (waba.length === 0) return null;
  const { data, error } = await db
    .from("whatsapp_cloud_api_configs")
    .select("id,user_id,workspace_currency,meta_app_secret")
    .in("whatsapp_business_account_id", waba)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[whatsapp-cloud-webhook] app secret lookup failed by waba", error);
    return null;
  }
  return (data as WebhookConfig | null) ?? null;
}

async function resolveConfig(
  db: SupabaseDb,
  input: { phoneNumberId: string; wabaId: string },
): Promise<WebhookConfig | null> {
  const phoneNumberId = normalizeId(input.phoneNumberId);
  const wabaId = normalizeId(input.wabaId);
  if (!phoneNumberId && !wabaId) return null;
  let query = db
    .from("whatsapp_cloud_api_configs")
    .select("id,user_id,workspace_currency")
    .eq("active", true);
  query = phoneNumberId
    ? query.eq("phone_number_id", phoneNumberId)
    : query.eq("whatsapp_business_account_id", wabaId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[whatsapp-cloud-webhook] config lookup failed", {
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      error: error.message,
    });
    return null;
  }
  return (data as WebhookConfig | null) ?? null;
}

async function insertRequestLog(
  db: SupabaseDb,
  input: {
    config?: WebhookConfig | null;
    object?: string;
    phoneNumberId?: string;
    wabaId?: string;
    requestStatus: "received" | "accepted" | "rejected" | "failed";
    reason: string;
    httpStatus?: number | null;
    signatureChecked?: boolean;
    signatureValid?: boolean | null;
    payload?: Record<string, unknown>;
    error?: string;
  },
): Promise<void> {
  const row = {
    config_id: input.config?.id ?? null,
    user_id: input.config?.user_id ?? null,
    workspace_currency: input.config?.workspace_currency ?? null,
    object: normalizeId(input.object),
    phone_number_id: normalizeId(input.phoneNumberId),
    whatsapp_business_account_id: normalizeId(input.wabaId),
    request_status: input.requestStatus,
    reason: input.reason,
    http_status: input.httpStatus ?? null,
    signature_checked: Boolean(input.signatureChecked),
    signature_valid: typeof input.signatureValid === "boolean" ? input.signatureValid : null,
    payload: input.payload ?? {},
    error: normalizeId(input.error),
  };
  const { error } = await db
    .from("whatsapp_cloud_api_webhook_request_logs")
    .insert(row);
  if (error) {
    console.error("[whatsapp-cloud-webhook] request log insert failed", error.message);
  }
}

async function insertEvent(
  db: SupabaseDb,
  input: {
    object: string;
    phoneNumberId: string;
    configId: string | null;
    userId: string | null;
    eventType: "message" | "status" | "error" | "quality_update" | "unknown";
    metaMessageId?: string;
    metaStatusId?: string;
    payload: Record<string, unknown>;
  },
): Promise<"inserted" | "duplicate" | "failed"> {
  const row = {
    config_id: input.configId,
    user_id: input.userId,
    object: input.object,
    phone_number_id: input.phoneNumberId,
    meta_message_id: normalizeId(input.metaMessageId),
    meta_status_id: normalizeId(input.metaStatusId),
    event_type: input.eventType,
    payload: input.payload,
    status: "pending",
  };
  const { error } = await db
    .from("whatsapp_cloud_api_webhook_events")
    .insert(row);
  if (!error) return "inserted";
  if (error.code === "23505") return "duplicate";
  console.error("[whatsapp-cloud-webhook] insert failed", {
    error: error.message,
    meta_message_id: row.meta_message_id,
    meta_status_id: row.meta_status_id,
  });
  return "failed";
}

async function enqueueWorker(): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return;
  const workerUrl = `${supabaseUrl}/functions/v1/whatsapp-cloud-worker`;
  try {
    await fetch(workerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "webhook" }),
    });
  } catch (error) {
    console.error("[whatsapp-cloud-webhook] worker enqueue failed", String(error));
  }
}

Deno.serve(async (req) => {
  try {
    const db = getDb();

    if (req.method === "GET") return await verifyChallenge(db, req);
    if (req.method !== "POST") {
      await insertRequestLog(db, {
        requestStatus: "rejected",
        reason: "method_not_allowed",
        httpStatus: 405,
        error: req.method,
      });
      return textResponse("Method not allowed", 405);
    }

    const rawBody = await req.text();
    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as MetaWebhookPayload;
    } catch {
      await insertRequestLog(db, {
        requestStatus: "rejected",
        reason: "invalid_json",
        httpStatus: 400,
        payload: { raw_body_preview: rawBody.slice(0, 2000), raw_body_size: rawBody.length },
      });
      return textResponse("Invalid JSON", 400);
    }

    const phoneNumberIds = extractPhoneNumberIds(payload);
    const wabaIds = extractWabaIds(payload);
    const signatureConfig = await resolveWebhookConfigForSignature(db, phoneNumberIds, wabaIds);
    const firstPhoneNumberId = phoneNumberIds[0] ?? "";
    const firstWabaId = wabaIds[0] ?? "";
    const object = normalizeId(payload.object);
    const appSecret = normalizeId(signatureConfig?.meta_app_secret);
    if (!appSecret) {
      console.warn("[whatsapp-cloud-webhook] missing app secret for phone number", {
        phone_number_ids: phoneNumberIds,
        waba_ids: wabaIds,
      });
      await insertRequestLog(db, {
        config: signatureConfig,
        object,
        phoneNumberId: firstPhoneNumberId,
        wabaId: firstWabaId,
        requestStatus: "rejected",
        reason: signatureConfig ? "missing_app_secret" : "unmatched_config",
        httpStatus: 401,
        signatureChecked: false,
        signatureValid: null,
        payload: payload as Record<string, unknown>,
      });
      return textResponse("Missing App Secret", 401);
    }
    const signatureOk = await verifyMetaSignature(req, rawBody, appSecret);
    if (!signatureOk) {
      console.warn("[whatsapp-cloud-webhook] invalid signature");
      await insertRequestLog(db, {
        config: signatureConfig,
        object,
        phoneNumberId: firstPhoneNumberId,
        wabaId: firstWabaId,
        requestStatus: "rejected",
        reason: "invalid_signature",
        httpStatus: 401,
        signatureChecked: true,
        signatureValid: false,
        payload: payload as Record<string, unknown>,
      });
      return textResponse("Invalid signature", 401);
    }

    const results = { inserted: 0, duplicate: 0, failed: 0, unknown: 0 };
    const requestConfig = signatureConfig;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const entryWabaId = normalizeId(entry.id);
        const phoneNumberId = normalizeId(value.metadata?.phone_number_id) ||
          normalizeId(value.phone_number_id);
        const field = normalizeId(change.field);
        const config = await resolveConfig(db, { phoneNumberId, wabaId: entryWabaId });
        const basePayload = {
          object,
          entry,
          change,
        } as Record<string, unknown>;

        for (const message of value.messages ?? []) {
          const inserted = await insertEvent(db, {
            object,
            phoneNumberId,
            configId: config?.id ?? null,
            userId: config?.user_id ?? null,
            eventType: "message",
            metaMessageId: normalizeId(message.id),
            payload: { ...basePayload, message },
          });
          results[inserted]++;
        }

        for (const status of value.statuses ?? []) {
          const inserted = await insertEvent(db, {
            object,
            phoneNumberId,
            configId: config?.id ?? null,
            userId: config?.user_id ?? null,
            eventType: "status",
            metaStatusId: normalizeId(status.id),
            payload: { ...basePayload, status },
          });
          results[inserted]++;
        }

        for (const error of value.errors ?? []) {
          const inserted = await insertEvent(db, {
            object,
            phoneNumberId,
            configId: config?.id ?? null,
            userId: config?.user_id ?? null,
            eventType: "error",
            metaStatusId: normalizeId(error.code),
            payload: { ...basePayload, error },
          });
          results[inserted]++;
        }

        if (
          (value.messages?.length ?? 0) === 0 &&
          (value.statuses?.length ?? 0) === 0 &&
          (value.errors?.length ?? 0) === 0
        ) {
          const eventType = field === "phone_number_quality_update"
            ? "quality_update"
            : "unknown";
          const inserted = await insertEvent(db, {
            object,
            phoneNumberId,
            configId: config?.id ?? null,
            userId: config?.user_id ?? null,
            eventType,
            payload: basePayload,
          });
          results[inserted]++;
          if (eventType === "unknown") results.unknown++;
        }
      }
    }

    await insertRequestLog(db, {
      config: requestConfig,
      object,
      phoneNumberId: firstPhoneNumberId,
      wabaId: firstWabaId,
      requestStatus: results.failed > 0 ? "failed" : "accepted",
      reason: "accepted",
      httpStatus: 200,
      signatureChecked: true,
      signatureValid: true,
      payload: payload as Record<string, unknown>,
    });

    const waitUntil = (globalThis as unknown as {
      EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
    }).EdgeRuntime?.waitUntil;
    if (results.inserted > 0) {
      if (waitUntil) waitUntil(enqueueWorker());
      else void enqueueWorker();
    }

    return jsonResponse({ ok: true, ...results });
  } catch (error) {
    console.error("[whatsapp-cloud-webhook] unexpected error", String(error));
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
