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
  created_at: string;
  matched_conversion_count: number;
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
  winner_eligible_by_purchase?: boolean;
  participant_count?: number;
  eligible_participant_count?: number;
};

const PARTICIPANT_PAGE_SIZE = 1000;
const PARTICIPANT_SELECT = "id, username, phone, email, created_at, matched_conversion_count";

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

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchPromotionParticipants(db: any, promotionId: string): Promise<Participant[]> {
  const participants: Participant[] = [];
  let from = 0;

  for (;;) {
    const to = from + PARTICIPANT_PAGE_SIZE - 1;
    const { data, error } = await db
      .from("promotion_participants")
      .select(PARTICIPANT_SELECT)
      .eq("promotion_id", promotionId)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = (data ?? []) as Participant[];
    participants.push(...rows);
    if (rows.length < PARTICIPANT_PAGE_SIZE) break;
    from += PARTICIPANT_PAGE_SIZE;
  }

  return participants;
}

function filterMatchedParticipants(participants: Participant[]): Participant[] {
  return participants.filter((participant) => Number(participant.matched_conversion_count ?? 0) > 0);
}

async function pickWinnerWithPurchaseFallback(
  db: any,
  userId: string,
  participants: Participant[],
): Promise<{ winner: Participant; eligibleByPurchase: boolean }> {
  const randomized = shuffled(participants);
  const phones = Array.from(new Set(
    randomized
      .map((participant) => String(participant.phone || "").trim())
      .filter(Boolean),
  ));

  if (!phones.length) {
    return { winner: randomized[0], eligibleByPurchase: false };
  }

  const { data, error } = await db
    .from("conversions")
    .select("phone")
    .eq("user_id", userId)
    .in("phone", phones)
    .or("purchase_event_id.neq.,estado.eq.purchase");

  if (error) throw error;

  const purchaserPhones = new Set(
    ((data ?? []) as Array<{ phone: string | null }>)
      .map((row) => String(row.phone || "").trim())
      .filter(Boolean),
  );
  const eligibleWinner = randomized.find((participant) => purchaserPhones.has(String(participant.phone || "").trim()));

  return {
    winner: eligibleWinner ?? randomized[0],
    eligibleByPurchase: Boolean(eligibleWinner),
  };
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
    .maybeSingle();

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
  const pool = await fetchPromotionParticipants(db, promotion.id);
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
    return {
      promotion_id: promotion.id,
      skipped: "no-participants",
      draw_status: "no_participants",
      participant_count: 0,
      eligible_participant_count: 0,
    };
  }

  const matchedPool = filterMatchedParticipants(pool);
  if (!matchedPool.length) {
    const { error: noMatchedParticipantsError } = await db
      .from("promotions")
      .update({
        draw_status: "no_participants",
        draw_processed_at: nowIso,
      })
      .eq("id", promotion.id)
      .eq("draw_status", "pending")
      .is("winner_participant_id", null);
    if (noMatchedParticipantsError) throw noMatchedParticipantsError;
    return {
      promotion_id: promotion.id,
      skipped: "no-matched-participants",
      draw_status: "no_participants",
      participant_count: pool.length,
      eligible_participant_count: 0,
    };
  }

  const { winner, eligibleByPurchase } = await pickWinnerWithPurchaseFallback(db, promotion.user_id, matchedPool);

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

  return {
    promotion_id: promotion.id,
    winner_username: winner.username,
    notified,
    draw_status: "completed",
    winner_eligible_by_purchase: eligibleByPurchase,
    participant_count: pool.length,
    eligible_participant_count: matchedPool.length,
  };
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
      .maybeSingle();
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
