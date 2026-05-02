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
  return String(value ?? "").replace(/\D/g, "").slice(0, 32);
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().slice(0, 254);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function enrichConversionsEmail(
  db: DbClient,
  userId: string,
  phone: string,
  email: string,
): Promise<string[]> {
  const { data: rows, error: fetchError } = await db
    .from("conversions")
    .select("id, email")
    .eq("user_id", userId)
    .eq("phone", phone);

  if (fetchError) throw fetchError;

  const typedRows = (rows ?? []) as Array<{ id: string; email: string | null }>;
  const idsToUpdate = typedRows
    .filter((row) => !String(row.email ?? "").trim())
    .map((row) => String(row.id));

  if (!idsToUpdate.length) return [];

  const { error: updateError } = await db
    .from("conversions")
    .update({ email })
    .in("id", idsToUpdate);

  if (updateError) throw updateError;
  return idsToUpdate;
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
    const phone = normalizePhone(body?.phone);
    const email = normalizeEmail(body?.email);
    const visitorToken = cleanText(body?.visitor_token, 120);

    if (!slug || !username || !phone || !email || !visitorToken) {
      return jsonResponse({ error: "Nombre de usuario, telefono y email son obligatorios." }, 400);
    }
    if (phone.length < 7) return jsonResponse({ error: "Telefono invalido." }, 400);
    if (!isValidEmail(email)) return jsonResponse({ error: "Email invalido." }, 400);

    const { data: promotion, error: promotionError } = await db
      .from("promotions")
      .select("id, user_id, title, draw_at, status, winner_participant_id")
      .eq("slug", slug)
      .maybeSingle<Promotion>();

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
      const updatedConversionIds = await enrichConversionsEmail(
        db,
        promotion.user_id,
        existing.phone,
        existing.email,
      );
      if (updatedConversionIds.length) {
        const mergedIds = Array.from(new Set([...(existing.matched_conversion_ids ?? []), ...updatedConversionIds]));
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
        enriched_conversions: updatedConversionIds.length,
      });
    }

    const updatedConversionIds = await enrichConversionsEmail(db, promotion.user_id, phone, email);

    const { data: inserted, error: insertError } = await db
      .from("promotion_participants")
      .insert({
        promotion_id: promotion.id,
        user_id: promotion.user_id,
        username,
        phone,
        email,
        visitor_token: visitorToken,
        matched_conversion_count: updatedConversionIds.length,
        matched_conversion_ids: updatedConversionIds,
      })
      .select("*")
      .single<Participant>();

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
      enriched_conversions: updatedConversionIds.length,
    });
  } catch (err) {
    console.error("promotion-participate error:", err);
    return jsonResponse({ error: "Error al registrar la participacion." }, 500);
  }
});
