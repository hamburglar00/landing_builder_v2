import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Promotion = {
  id: string;
  user_id: string;
  title: string;
  draw_at: string;
  status: string;
  winner_participant_id: string | null;
};

type Participant = {
  id: string;
  promotion_id: string;
  user_id: string;
  username: string;
  phone: string;
  email: string;
  visitor_token: string;
  matched_conversion_count: number;
  matched_conversion_ids: string[];
  created_at: string;
};

type DbClient = any;

type ConversionEmailMatch = {
  matchedIds: string[];
  updatedIds: string[];
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("549")) return digits.length === 13 ? digits : "";
  if (digits.startsWith("54")) return digits.length === 12 ? `549${digits.slice(2)}` : "";
  return digits.length === 10 ? `549${digits}` : "";
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().slice(0, 254);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function enrichConversionsEmail(
  db: DbClient,
  phone: string,
  email: string,
): Promise<ConversionEmailMatch> {
  const { data: rows, error: fetchError } = await db
    .from("conversions")
    .select("id, email")
    .eq("phone", phone);

  if (fetchError) throw fetchError;

  const typedRows = (rows ?? []) as Array<{ id: string; email: string | null }>;
  const matchedIds = typedRows.map((row) => String(row.id)).filter(Boolean);
  const idsToUpdate = typedRows
    .filter((row) => !String(row.email ?? "").trim())
    .map((row) => String(row.id));

  if (!idsToUpdate.length) return { matchedIds, updatedIds: [] };

  const { error: updateError } = await db
    .from("conversions")
    .update({ email })
    .in("id", idsToUpdate);

  if (updateError) throw updateError;
  return { matchedIds, updatedIds: idsToUpdate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Solo se permite POST." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuracion del servidor incompleta." }, 500);
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const slug = cleanText(body?.slug, 120).toLowerCase();
    const username = cleanText(body?.username, 80);
    const rawPhone = cleanText(body?.phone, 32);
    const phone = normalizePhone(body?.phone);
    const email = normalizeEmail(body?.email);
    const visitorToken = cleanText(body?.visitor_token, 120);

    if (!slug || !username || !rawPhone || !email || !visitorToken) {
      return jsonResponse({ error: "Nombre de usuario, telefono y email son obligatorios." }, 400);
    }
    if (!phone) {
      return jsonResponse({ error: "Telefono invalido. Ingresa 10 digitos, 12 empezando con 54 o 13 empezando con 549." }, 400);
    }
    if (!isValidEmail(email)) return jsonResponse({ error: "Email invalido." }, 400);

    const { data: promotion, error: promotionError } = await db
      .from("promotions")
      .select("id, user_id, title, draw_at, status, winner_participant_id")
      .eq("slug", slug)
      .maybeSingle();

    if (promotionError) throw promotionError;
    if (!promotion || promotion.status !== "active") {
      return jsonResponse({ error: "Promocion no disponible." }, 404);
    }
    if (promotion.winner_participant_id) {
      return jsonResponse({ error: "El sorteo ya fue realizado." }, 409);
    }
    if (new Date(promotion.draw_at).getTime() <= Date.now()) {
      return jsonResponse({ error: "La inscripcion al sorteo ya finalizo." }, 409);
    }

    const { data: existingRows, error: existingError } = await db
      .from("promotion_participants")
      .select("*")
      .eq("promotion_id", promotion.id)
      .or(`phone.eq.${phone},email.eq.${email},visitor_token.eq.${visitorToken}`)
      .limit(1);

    if (existingError) throw existingError;
    const existing = (existingRows ?? [])[0] as Participant | undefined;
    if (existing) {
      const conversionMatch = await enrichConversionsEmail(db, existing.phone, existing.email);
      if (conversionMatch.matchedIds.length) {
        const mergedIds = Array.from(new Set([...(existing.matched_conversion_ids ?? []), ...conversionMatch.matchedIds]));
        await db
          .from("promotion_participants")
          .update({
            matched_conversion_count: mergedIds.length,
            matched_conversion_ids: mergedIds,
          })
          .eq("id", existing.id);
        existing.matched_conversion_count = mergedIds.length;
        existing.matched_conversion_ids = mergedIds;
      }
      return jsonResponse({
        ok: true,
        already_participated: true,
        participant: existing,
        enriched_conversions: conversionMatch.updatedIds.length,
        matched_conversions: conversionMatch.matchedIds.length,
      });
    }

    const conversionMatch = await enrichConversionsEmail(db, phone, email);

    const { data: inserted, error: insertError } = await db
      .from("promotion_participants")
      .insert({
        promotion_id: promotion.id,
        user_id: promotion.user_id,
        username,
        phone,
        email,
        visitor_token: visitorToken,
        matched_conversion_count: conversionMatch.matchedIds.length,
        matched_conversion_ids: conversionMatch.matchedIds,
      })
      .select("*")
      .single();

    if (insertError) {
      if (String(insertError.code) === "23505") {
        return jsonResponse({ error: "Ya existe una participacion con esos datos." }, 409);
      }
      throw insertError;
    }

    return jsonResponse({
      ok: true,
      already_participated: false,
      participant: inserted,
      enriched_conversions: conversionMatch.updatedIds.length,
      matched_conversions: conversionMatch.matchedIds.length,
    });
  } catch (err) {
    console.error("promotion-participate error:", err);
    return jsonResponse({ error: "Error al registrar la participacion." }, 500);
  }
});
