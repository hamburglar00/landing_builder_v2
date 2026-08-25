import { createClient } from "supabase-js";

// The project does not use generated Supabase DB types for Edge Functions.
// Keep this client dynamic so new migration tables do not typecheck as `never`.
// deno-lint-ignore no-explicit-any
type SupabaseDb = any;
type Json = Record<string, unknown>;

type RetargetKind = "new" | "contact";

type RetargetCandidate = {
  retarget_id: string;
  retarget_kind: RetargetKind;
  contact_id: string;
  config_id: string;
  user_id: string;
  assignment_id: string | null;
  wa_id: string;
  profile_name: string;
  last_inbound_at: string;
  phone_number_id: string;
  meta_access_token: string;
  meta_api_version: string;
  redirect_token: string;
  promo_code: string;
  retarget_message_template: string;
};

type WhatsappConfig = {
  phone_number_id: string;
  meta_access_token: string;
  meta_api_version: string;
};

type SendResult = {
  ok: boolean;
  status: number;
  response: Json;
  metaMessageId: string;
  error: string;
  payload: Json;
};

const GRAPH_TIMEOUT_MS = 8000;
const MAX_CANDIDATES = 25;
const MAX_AGE_MINUTES = 23 * 60;
const DEFAULT_MIN_AGE_MINUTES = 30;
const DEFAULT_RETARGET_MESSAGE =
  "👋 ¡Hola! Tu asesor ya está listo para atenderte 🙋‍♂️💬\n\n👇 Tocá el botón de abajo y enviale el mensaje para comenzar ahora. Te va a guiar paso a paso y brindarte atención personalizada. 🚀✨";

const RETARGET_COPY: Record<
  RetargetKind,
  { message?: string; button: string; messageType: string }
> = {
  new: {
    message:
      "👋 ¡Hola! Tu asesor ya está listo para atenderte 🙋‍♂️💬\n\n👇 Tocá el botón de abajo y enviale el mensaje para comenzar ahora. Te va a guiar paso a paso y brindarte atención personalizada. 🚀✨",
    button: "ABRIR WHATSAPP",
    messageType: "retarget_new_cta_url",
  },
  contact: {
    message:
      "👋 ¡Hola! Tu asesor ya está listo para atenderte 🙋‍♂️💬\n\n👇 Tocá el botón de abajo y enviale el mensaje para comenzar ahora. Te va a guiar paso a paso y brindarte atención personalizada. 🚀✨",
    button: "ABRIR WHATSAPP",
    messageType: "retarget_contact_cta_url",
  },
};

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

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Json
    : {};
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function clampLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_CANDIDATES;
  return Math.max(1, Math.min(Math.trunc(parsed), 100));
}

async function cronSecretMatches(
  db: SupabaseDb,
  value: unknown,
): Promise<boolean> {
  const candidate = str(value);
  if (!candidate) return false;
  const { data, error } = await db
    .from("cron_config")
    .select("value")
    .eq("key", "sync_phones_cron_secret")
    .maybeSingle();
  if (error) {
    console.error(
      "[whatsapp-cloud-retarget] cron secret lookup failed",
      error.message,
    );
    return false;
  }
  return candidate === str((data as { value?: string } | null)?.value);
}

async function assertInternalAuth(
  db: SupabaseDb,
  req: Request,
  body: Json,
): Promise<Response | null> {
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const header = req.headers.get("authorization") ?? "";
  if (!serviceRoleKey || header !== `Bearer ${serviceRoleKey}`) {
    const allowedByCronSecret = await cronSecretMatches(db, body.cron_secret);
    if (!allowedByCronSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }
  return null;
}

function trackedRedirectUrl(token: string): string {
  const shortlinkBaseUrl = str(
    Deno.env.get("WHATSAPP_CLOUD_SHORTLINK_BASE_URL"),
  ) || "https://mkt.panelbotadmin.com";
  return `${shortlinkBaseUrl.replace(/\/+$/, "")}/w/${
    encodeURIComponent(token)
  }`;
}

async function sendWhatsappCtaUrl(
  config: WhatsappConfig,
  to: string,
  body: string,
  buttonTitle: string,
  urlToOpen: string,
): Promise<SendResult> {
  const apiVersion = str(config.meta_api_version) || "v25.0";
  const url = `https://graph.facebook.com/${apiVersion}/${
    encodeURIComponent(config.phone_number_id)
  }/messages`;
  const title = str(buttonTitle).slice(0, 20) || "IR AL ASESOR";
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: body },
      action: {
        name: "cta_url",
        parameters: {
          display_text: title,
          url: urlToOpen,
        },
      },
    },
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
        return {
          ok: true,
          status: res.status,
          response: json,
          metaMessageId,
          error: "",
          payload,
        };
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
          payload,
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
          payload,
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }

  return {
    ok: false,
    status: 0,
    response: {},
    metaMessageId: "",
    error: "Unknown send failure",
    payload,
  };
}

async function markRetarget(
  db: SupabaseDb,
  candidate: RetargetCandidate,
  status: "sent" | "failed" | "skipped",
  sendResult: SendResult | null,
  outboundMessageId: string | null,
  error: string,
): Promise<void> {
  const { error: updateError } = await db
    .from("whatsapp_cloud_api_retarget_messages")
    .update({
      status,
      meta_message_id: sendResult?.metaMessageId ?? "",
      outbound_message_id: outboundMessageId,
      last_error: error.slice(0, 4000),
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", candidate.retarget_id);

  if (updateError) {
    console.error(
      "[whatsapp-cloud-retarget] retarget update failed",
      candidate.retarget_id,
      updateError.message,
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const db = getDb();
  let body: Json = {};
  try {
    body = asRecord(await req.json());
  } catch {
    body = {};
  }

  const authError = await assertInternalAuth(db, req, body);
  if (authError) return authError;

  const limit = clampLimit(body.limit);
  const { data, error } = await db.rpc(
    "claim_whatsapp_cloud_api_retarget_candidates",
    {
      p_limit: limit,
      p_max_age_minutes: MAX_AGE_MINUTES,
      p_min_age_minutes: DEFAULT_MIN_AGE_MINUTES,
    },
  );

  if (error) {
    console.error("[whatsapp-cloud-retarget] candidate claim failed", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return jsonResponse({ error: error.message }, 500);
  }

  const candidates = Array.isArray(data) ? data as RetargetCandidate[] : [];
  const results: Json[] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const copy = RETARGET_COPY[candidate.retarget_kind];
    const token = str(candidate.redirect_token);
    if (!copy || !token) {
      skipped++;
      const reason = !copy ? "Unknown retarget kind" : "Missing redirect token";
      await markRetarget(db, candidate, "skipped", null, null, reason);
      results.push({
        retarget_id: candidate.retarget_id,
        contact_id: candidate.contact_id,
        status: "skipped",
        error: reason,
      });
      continue;
    }

    const sendResult = await sendWhatsappCtaUrl(
      {
        phone_number_id: candidate.phone_number_id,
        meta_access_token: candidate.meta_access_token,
        meta_api_version: candidate.meta_api_version,
      },
      candidate.wa_id,
      str(candidate.retarget_message_template) || DEFAULT_RETARGET_MESSAGE,
      copy.button,
      trackedRedirectUrl(token),
    );

    const { data: outbound, error: outboundError } = await db
      .from("whatsapp_cloud_api_outbound_messages")
      .insert({
        config_id: candidate.config_id,
        user_id: candidate.user_id,
        assignment_id: candidate.assignment_id,
        meta_message_id: sendResult.metaMessageId,
        recipient_wa_id: candidate.wa_id,
        message_type: copy.messageType,
        payload: sendResult.payload,
        response: sendResult.response,
        status: sendResult.ok ? "accepted" : "failed",
        last_error: sendResult.error,
        sent_at: sendResult.ok ? new Date().toISOString() : null,
      })
      .select("id")
      .maybeSingle();

    if (outboundError) {
      console.error(
        "[whatsapp-cloud-retarget] outbound insert failed",
        candidate.retarget_id,
        outboundError.message,
      );
    }

    const outboundMessageId = str((outbound as { id?: string } | null)?.id) ||
      null;
    if (sendResult.ok) {
      sent++;
      await markRetarget(
        db,
        candidate,
        "sent",
        sendResult,
        outboundMessageId,
        "",
      );
    } else {
      failed++;
      await markRetarget(
        db,
        candidate,
        "failed",
        sendResult,
        outboundMessageId,
        sendResult.error,
      );
    }

    results.push({
      retarget_id: candidate.retarget_id,
      contact_id: candidate.contact_id,
      kind: candidate.retarget_kind,
      status: sendResult.ok ? "sent" : "failed",
      meta_message_id: sendResult.metaMessageId,
      outbound_message_id: outboundMessageId,
      error: sendResult.error,
    });
  }

  return jsonResponse({
    ok: true,
    claimed: candidates.length,
    sent,
    failed,
    skipped,
    window_minutes: MAX_AGE_MINUTES,
    default_min_age_minutes: DEFAULT_MIN_AGE_MINUTES,
    results,
  });
});
