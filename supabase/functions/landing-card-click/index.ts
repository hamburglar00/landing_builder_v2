import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return response(405, { error: "Solo se permite POST." });

  try {
    const raw = await request.text();
    if (raw.length > 512) return response(400, { error: "Solicitud inválida." });
    const body = JSON.parse(raw) as Record<string, unknown>;
    const landingId = body?.landingId;
    const cardIndex = body?.cardIndex;
    const eventId = body?.eventId;
    if (typeof landingId !== "string" || !uuid.test(landingId) ||
        typeof eventId !== "string" || !uuid.test(eventId) ||
        typeof cardIndex !== "number" || !Number.isInteger(cardIndex) ||
        cardIndex < 1 || cardIndex > 6) {
      return response(400, { error: "Tarjeta o landing inválida." });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SERVICE_ROLE_KEY");
    if (!url || !key) return response(500, { error: "Servicio no disponible." });

    const db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await db.rpc("record_template6_card_click", {
      p_landing_id: landingId,
      p_card_index: cardIndex,
      p_event_id: eventId,
    });
    if (error) {
      console.error("landing-card-click: database error", error.code);
      return response(500, { error: "No se pudo registrar el toque." });
    }
    if (data !== true) return response(400, { error: "Tarjeta no disponible." });
    return response(200, { ok: true });
  } catch {
    return response(400, { error: "Solicitud inválida." });
  }
});
