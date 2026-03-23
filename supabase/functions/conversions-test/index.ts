import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildFakeConversionRow,
  buildMetaRequest,
  type ConversionRow,
  type ConversionsConfig,
  type MetaEventName,
  generateEventId,
  hasPreviousSuccessfulPurchases,
} from "../conversions/shared.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface TestRequestBody {
  event: MetaEventName;
  test_event_code: string;
}

async function loadConfigByUserId(db: SupabaseClient, userId: string): Promise<ConversionsConfig | null> {
  const { data, error } = await db
    .from("conversions_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ConversionsConfig;
}

async function pickRandomConversionRowByUser(
  db: SupabaseClient,
  userId: string,
): Promise<ConversionRow | null> {
  const { data, error } = await db
    .from("conversions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data || data.length === 0) return null;
  const idx = Math.floor(Math.random() * data.length);
  return data[idx] as unknown as ConversionRow;
}

function deriveEventIdentity(row: ConversionRow, event: MetaEventName): { id: string; time: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  if (event === "Contact") {
    const id = row.contact_event_id || generateEventId();
    const time = row.contact_event_time ?? nowSec;
    return { id, time };
  }
  if (event === "Lead") {
    const id = row.lead_event_id || generateEventId();
    const time = row.lead_event_time ?? nowSec;
    return { id, time };
  }
  const id = row.purchase_event_id || generateEventId();
  const time = row.purchase_event_time ?? nowSec;
  return { id, time };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? url.origin.replace(/\/functions\/v1.*$/, "");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "Missing authorization header" }, 401);
  }

  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const userId = userData.user?.id ?? "";
  if (userErr || !userId) {
    return jsonResponse({ error: "Invalid JWT" }, 401);
  }

  let body: TestRequestBody;
  try {
    body = (await req.json()) as TestRequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const event = body.event;
  const testCode = (body.test_event_code || "").trim();
  if (!event || !["Contact", "Lead", "Purchase"].includes(event)) {
    return jsonResponse({ error: "Invalid event type" }, 400);
  }
  if (!testCode) {
    return jsonResponse({ error: "test_event_code is required" }, 400);
  }

  const config = await loadConfigByUserId(db, userId);
  if (!config || !config.pixel_id || !config.meta_access_token) {
    return jsonResponse({ error: "No hay configuracion valida de Meta CAPI (conversions_config)" }, 400);
  }

  let row: ConversionRow | null = await pickRandomConversionRowByUser(db, userId);
  let usedFake = false;
  if (!row) {
    row = buildFakeConversionRow(event);
    row.user_id = userId;
    usedFake = true;
  }

  const identity = deriveEventIdentity(row, event);

  let customData: Record<string, unknown> | undefined;
  if (event === "Purchase") {
    const isRepeat = !usedFake && (await hasPreviousSuccessfulPurchases(db, row.user_id, row.phone));
    customData = {
      currency: config.meta_currency,
      value: row.valor || 0,
      ...(isRepeat ? { purchase_type: "repeat" } : {}),
    };
  }

  const metaReq = await buildMetaRequest(config, row, event, identity.id, identity.time, customData, testCode);

  let status = 0;
  let ok = false;
  let metaText = "";
  let error: unknown = null;

  try {
    const res = await fetch(metaReq.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaReq.body),
    });
    status = res.status;
    metaText = await res.text();
    ok = res.ok;
  } catch (e) {
    error = e;
  }

  const debug = {
    userId,
    event,
    sampleRowSource: usedFake ? "fake" : "real",
    sampleRowPreview: {
      id: row.id ?? null,
      phone: row.phone,
      email: row.email,
      estado: row.estado,
      valor: row.valor,
      event_source_url: row.event_source_url,
      contact_event_id: row.contact_event_id,
      lead_event_id: row.lead_event_id,
      purchase_event_id: row.purchase_event_id,
      ct: row.ct,
      st: row.st,
      zip: row.zip,
      country: row.country,
      geo_city: row.geo_city,
      geo_region: row.geo_region,
      geo_country: row.geo_country,
    },
    conversionId: row.id ?? null,
    metaApiUrl: metaReq.apiUrl,
    payload: metaReq.body,
    eventPayload: metaReq.eventPayload,
    status,
    ok,
    metaResponseRaw: metaText,
    error: error
      ? error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error)
      : null,
  };

  console.log("[conversions-test] Debug:", debug);

  return jsonResponse(debug, ok ? 200 : 500);
});
