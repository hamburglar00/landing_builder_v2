import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Promotion = {
  id: string;
  user_id: string;
  title: string;
  prize: string;
  draw_at: string;
  draw_status: "pending" | "completed" | "no_participants";
};

type Participant = {
  id: string;
  username: string;
  phone: string;
  email: string;
};

type BotConfig = {
  telegram_bot_token: string;
};

type TelegramDestination = {
  telegram_chat_id: string;
};

type NotificationSettings = {
  promotion_winner_notifications_enabled?: boolean | null;
};

type DrawResult = {
  promotion_id: string;
  winner_username?: string;
  notified?: number;
  skipped?: string;
  draw_status?: "completed" | "no_participants";
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

async function notifyWinner(
  db: any,
  token: string,
  promotion: Promotion,
  winner: Participant,
  nowIso: string,
): Promise<number> {
  const { data: settings } = await db
    .from("notification_settings")
    .select("promotion_winner_notifications_enabled")
    .eq("user_id", promotion.user_id)
    .maybeSingle<NotificationSettings>();

  if (settings?.promotion_winner_notifications_enabled === false) return 0;

  const { data: destinations } = await db
    .from("notification_telegram_destinations")
    .select("telegram_chat_id")
    .eq("user_id", promotion.user_id)
    .eq("is_active", true);

  const rows = (destinations ?? []) as TelegramDestination[];
  if (!rows.length) return 0;

  const text = [
    `<b>Resultado del sorteo</b>`,
    `Promocion: ${escapeHtml(promotion.title)}`,
    `Ganador: ${escapeHtml(winner.username)}`,
    `Telefono: ${escapeHtml(winner.phone)}`,
    `Email: ${escapeHtml(winner.email)}`,
    `Premio: ${escapeHtml(promotion.prize || "-")}`,
  ].join("\n");

  let notified = 0;
  for (const destination of rows) {
    if (!destination.telegram_chat_id) continue;
    const sent = await sendTelegramMessage(token, destination.telegram_chat_id, text);
    if (sent.ok) notified += 1;
  }

  if (notified > 0) {
    await db
      .from("promotions")
      .update({ winner_notified_at: nowIso })
      .eq("id", promotion.id);
  }

  return notified;
}

async function drawPromotion(db: any, promotion: Promotion, botToken: string): Promise<DrawResult> {
  const { data: participants, error: participantsError } = await db
    .from("promotion_participants")
    .select("id, username, phone, email")
    .eq("promotion_id", promotion.id)
    .limit(5000);

  if (participantsError) throw participantsError;
  const pool = (participants ?? []) as Participant[];
  const nowIso = new Date().toISOString();
  if (!pool.length) {
    const { error: noParticipantsError } = await db
      .from("promotions")
      .update({
        draw_status: "no_participants",
        draw_processed_at: nowIso,
      })
      .eq("id", promotion.id)
      .eq("draw_status", "pending")
      .is("winner_participant_id", null);
    if (noParticipantsError) throw noParticipantsError;
    return { promotion_id: promotion.id, skipped: "no-participants", draw_status: "no_participants" };
  }

  const winner = pool[Math.floor(Math.random() * pool.length)];

  const { data: updatedWinner, error: updateError } = await db
    .from("promotions")
    .update({
      winner_participant_id: winner.id,
      winner_username: winner.username,
      winner_selected_at: nowIso,
      draw_status: "completed",
      draw_processed_at: nowIso,
    })
    .eq("id", promotion.id)
    .eq("draw_status", "pending")
    .is("winner_participant_id", null)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updatedWinner) return { promotion_id: promotion.id, skipped: "already-drawn" };

  const notified = botToken
    ? await notifyWinner(db, botToken, promotion, winner, nowIso)
    : 0;

  return { promotion_id: promotion.id, winner_username: winner.username, notified, draw_status: "completed" };
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
    const { data: cronSecret } = await db
      .from("cron_config")
      .select("value")
      .eq("key", "sync_phones_cron_secret")
      .maybeSingle();
    const expectedBootstrap = Deno.env.get("BOOTSTRAP_SECRET") || "";
    const cronOk = !!cronSecret?.value && body?.cron_secret === cronSecret.value;
    const bootstrapOk = !!expectedBootstrap && body?.bootstrap_secret === expectedBootstrap;
    if (!cronOk && !bootstrapOk) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: botRow } = await db
      .from("notification_bot_config")
      .select("telegram_bot_token")
      .eq("id", 1)
      .maybeSingle<BotConfig>();
    const botToken = String(botRow?.telegram_bot_token ?? "");

    const { data: promotions, error: promotionsError } = await db
      .from("promotions")
      .select("id, user_id, title, prize, draw_at, draw_status")
      .eq("status", "active")
      .eq("draw_status", "pending")
      .lte("draw_at", new Date().toISOString())
      .order("draw_at", { ascending: true })
      .limit(50);

    if (promotionsError) throw promotionsError;

    const results: DrawResult[] = [];
    for (const promotion of (promotions ?? []) as Promotion[]) {
      results.push(await drawPromotion(db, promotion, botToken));
    }

    return jsonResponse({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("promotion-draw-due error:", err);
    return jsonResponse({ error: "Error al procesar sorteos pendientes." }, 500);
  }
});
