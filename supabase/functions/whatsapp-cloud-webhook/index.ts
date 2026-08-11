import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

// The project does not use generated Supabase DB types for Edge Functions.
// Keep this client dynamic so new migration tables do not typecheck as `never`.
// deno-lint-ignore no-explicit-any
type SupabaseDb = any;

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string | null } | null;
        messages?: Array<Record<string, unknown>> | null;
        statuses?: Array<Record<string, unknown>> | null;
        errors?: Array<Record<string, unknown>> | null;
      } | null;
    }> | null;
  }> | null;
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

function extractPhoneNumberIds(payload: MetaWebhookPayload): string[] {
  const ids = new Set<string>();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = normalizeId(change.value?.metadata?.phone_number_id);
      if (phoneNumberId) ids.add(phoneNumberId);
    }
  }
  return [...ids];
}

async function resolveSignatureSecret(
  db: SupabaseDb,
  phoneNumberIds: string[],
): Promise<string> {
  const ids = phoneNumberIds.filter(Boolean);
  if (ids.length === 0) return "";
  const { data, error } = await db
    .from("whatsapp_cloud_api_configs")
    .select("meta_app_secret")
    .in("phone_number_id", ids)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[whatsapp-cloud-webhook] app secret lookup failed", error);
    return "";
  }
  return normalizeId((data as { meta_app_secret?: string } | null)?.meta_app_secret);
}

async function resolveConfig(
  db: SupabaseDb,
  phoneNumberId: string,
): Promise<{ id: string; user_id: string } | null> {
  if (!phoneNumberId) return null;
  const { data, error } = await db
    .from("whatsapp_cloud_api_configs")
    .select("id,user_id")
    .eq("phone_number_id", phoneNumberId)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    console.error("[whatsapp-cloud-webhook] config lookup failed", {
      phone_number_id: phoneNumberId,
      error: error.message,
    });
    return null;
  }
  return (data as { id: string; user_id: string } | null) ?? null;
}

async function insertEvent(
  db: SupabaseDb,
  input: {
    object: string;
    phoneNumberId: string;
    configId: string | null;
    userId: string | null;
    eventType: "message" | "status" | "error" | "unknown";
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
    if (req.method !== "POST") return textResponse("Method not allowed", 405);

    const rawBody = await req.text();
    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as MetaWebhookPayload;
    } catch {
      return textResponse("Invalid JSON", 400);
    }

    const phoneNumberIds = extractPhoneNumberIds(payload);
    const appSecret = await resolveSignatureSecret(db, phoneNumberIds);
    if (!appSecret) {
      console.warn("[whatsapp-cloud-webhook] missing app secret for phone number", {
        phone_number_ids: phoneNumberIds,
      });
      return textResponse("Missing App Secret", 401);
    }
    const signatureOk = await verifyMetaSignature(req, rawBody, appSecret);
    if (!signatureOk) {
      console.warn("[whatsapp-cloud-webhook] invalid signature");
      return textResponse("Invalid signature", 401);
    }

    const object = normalizeId(payload.object);
    const results = { inserted: 0, duplicate: 0, failed: 0, unknown: 0 };

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const phoneNumberId = normalizeId(value.metadata?.phone_number_id);
        const config = await resolveConfig(db, phoneNumberId);
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
          const inserted = await insertEvent(db, {
            object,
            phoneNumberId,
            configId: config?.id ?? null,
            userId: config?.user_id ?? null,
            eventType: "unknown",
            payload: basePayload,
          });
          results[inserted]++;
          results.unknown++;
        }
      }
    }

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
