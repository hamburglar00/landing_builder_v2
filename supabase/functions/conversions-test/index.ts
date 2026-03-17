import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildFakeConversionRow,
  buildMetaRequest,
  pickRandomConversionRow,
  type ConversionRow,
  type ConversionsConfig,
  type MetaEventName,
  generateEventId,
  toValidEventTime,
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

async function loadAnyConfig(db: ReturnType<typeof createClient>): Promise<ConversionsConfig | null> {
  const { data, error } = await db
    .from("conversions_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  // deno-lint-ignore no-explicit-any
  return data[0] as any as ConversionsConfig;
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
  // Purchase
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

  const config = await loadAnyConfig(db);
  if (!config || !config.pixel_id || !config.meta_access_token) {
    return jsonResponse({ error: "No hay configuración válida de Meta CAPI (conversions_config)" }, 400);
  }

  let row: ConversionRow | null = await pickRandomConversionRow(db);
  let usedFake = false;
  if (!row) {
    row = buildFakeConversionRow(event);
    usedFake = true;
  }

  const identity = deriveEventIdentity(row, event);

  let customData: Record<string, unknown> | undefined;
  if (event === "Purchase") {
    customData = {
      currency: config.meta_currency,
      value: row.valor || 0,
    };
    if (!usedFake && (row.observaciones || "").includes("REPEAT")) {
      customData.purchase_type = "repeat";
    }
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

  // También logueamos en el entorno de la función para inspección en Supabase.
  console.log("[conversions-test] Debug:", debug);

  return jsonResponse(debug, ok ? 200 : 500);
});

