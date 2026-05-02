import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Promotion = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  prize: string;
  draw_at: string;
  status: string;
  winner_participant_id: string | null;
  winner_username: string;
  winner_selected_at: string | null;
  winner_notified_at: string | null;
};

type Participant = {
  id: string;
  username: string;
  phone: string;
  email: string;
  created_at: string;
};

type BotConfig = {
  telegram_bot_token: string;
};

type TelegramDestination = {
  telegram_chat_id: string;
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

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return { ok: res.ok, body: await res.text().catch(() => "") };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    if (!slug) return jsonResponse({ error: "Falta slug." }, 400);

    const { data: promotion, error: promotionError } = await db
      .from("promotions")
      .select("id, user_id, title, slug, prize, draw_at, status, winner_participant_id, winner_username, winner_selected_at, winner_notified_at")
      .eq("slug", slug)
      .maybeSingle<Promotion>();

    if (promotionError) throw promotionError;
    if (!promotion || promotion.status !== "active") {
      return jsonResponse({ error: "Promocion no disponible." }, 404);
    }

    const drawAtMs = new Date(promotion.draw_at).getTime();
    if (drawAtMs > Date.now()) {
      return jsonResponse({ error: "El sorteo todavia no esta listo.", draw_at: promotion.draw_at }, 409);
    }

    if (promotion.winner_participant_id) {
      return jsonResponse({
        ok: true,
        already_drawn: true,
        winner_username: promotion.winner_username,
        prize: promotion.prize,
        winner_selected_at: promotion.winner_selected_at,
      });
    }

    const { data: participants, error: participantsError } = await db
      .from("promotion_participants")
      .select("id, username, phone, email, created_at")
      .eq("promotion_id", promotion.id)
      .limit(5000);

    if (participantsError) throw participantsError;
    const pool = (participants ?? []) as Participant[];
    if (!pool.length) return jsonResponse({ error: "No hay participantes para sortear." }, 409);

    const winner = pool[Math.floor(Math.random() * pool.length)];
    const nowIso = new Date().toISOString();

    const { data: updatedWinner, error: updateError } = await db
      .from("promotions")
      .update({
        winner_participant_id: winner.id,
        winner_username: winner.username,
        winner_selected_at: nowIso,
      })
      .eq("id", promotion.id)
      .is("winner_participant_id", null)
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedWinner) {
      const { data: fresh } = await db
        .from("promotions")
        .select("winner_username, prize, winner_selected_at")
        .eq("id", promotion.id)
        .maybeSingle<Pick<Promotion, "winner_username" | "prize" | "winner_selected_at">>();
      return jsonResponse({
        ok: true,
        already_drawn: true,
        winner_username: fresh?.winner_username ?? "",
        prize: fresh?.prize ?? promotion.prize,
        winner_selected_at: fresh?.winner_selected_at ?? null,
      });
    }

    let notified = 0;
    let notificationSkipped = "";
    const { data: botRow } = await db
      .from("notification_bot_config")
      .select("telegram_bot_token")
      .eq("id", 1)
      .maybeSingle<BotConfig>();

    if (!botRow?.telegram_bot_token) {
      notificationSkipped = "bot-not-configured";
    } else {
      const { data: destinations } = await db
        .from("notification_telegram_destinations")
        .select("telegram_chat_id")
        .eq("user_id", promotion.user_id)
        .eq("is_active", true);

      const rows = (destinations ?? []) as TelegramDestination[];
      if (!rows.length) {
        notificationSkipped = "no-telegram-destinations";
      } else {
        const text = [
          `<b>Resultado del sorteo</b>`,
          `Promocion: ${escapeHtml(promotion.title)}`,
          `Ganador: ${escapeHtml(winner.username)}`,
          `Telefono: ${escapeHtml(winner.phone)}`,
          `Email: ${escapeHtml(winner.email)}`,
          `Premio: ${escapeHtml(promotion.prize || "-")}`,
        ].join("\n");

        for (const destination of rows) {
          if (!destination.telegram_chat_id) continue;
          const sent = await sendTelegramMessage(botRow.telegram_bot_token, destination.telegram_chat_id, text);
          if (sent.ok) notified += 1;
        }

        if (notified > 0) {
          await db
            .from("promotions")
            .update({ winner_notified_at: nowIso })
            .eq("id", promotion.id);
        }
      }
    }

    return jsonResponse({
      ok: true,
      already_drawn: false,
      winner_username: winner.username,
      prize: promotion.prize,
      winner_selected_at: nowIso,
      notified,
      notification_skipped: notificationSkipped || null,
    });
  } catch (err) {
    console.error("promotion-draw error:", err);
    return jsonResponse({ error: "Error al realizar el sorteo." }, 500);
  }
});
