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
  draw_status: "pending" | "completed" | "no_participants";
  draw_processed_at: string | null;
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

type Profile = {
  role: string;
};

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function animationUsernamesFromParticipants(participants: Participant[]): string[] {
  const names = participants
    .map((participant) => String(participant.username || "").trim())
    .filter(Boolean);
  return shuffled(names).slice(0, 80);
}

async function fetchAnimationUsernames(db: any, promotionId: string): Promise<string[]> {
  const { data } = await db
    .from("promotion_participants")
    .select("id, username, phone, email, created_at")
    .eq("promotion_id", promotionId)
    .limit(5000);
  return animationUsernamesFromParticipants((data ?? []) as Participant[]);
}

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuracion del servidor incompleta." }, 500);
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const slug = cleanText(body?.slug, 120).toLowerCase();
    const force = body?.force === true;
    if (!slug) return jsonResponse({ error: "Falta slug." }, 400);

    const { data: promotion, error: promotionError } = await db
      .from("promotions")
      .select("id, user_id, title, slug, prize, draw_at, status, winner_participant_id, winner_username, winner_selected_at, winner_notified_at, draw_status, draw_processed_at")
      .eq("slug", slug)
      .maybeSingle<Promotion>();

    if (promotionError) throw promotionError;
    if (!promotion || promotion.status !== "active") {
      return jsonResponse({ error: "Promocion no disponible." }, 404);
    }

    const drawAtMs = new Date(promotion.draw_at).getTime();
    if (drawAtMs > Date.now()) {
      if (!force) {
        return jsonResponse({ error: "El sorteo todavia no esta listo.", draw_at: promotion.draw_at }, 409);
      }

      if (!anonKey) {
        return jsonResponse({ error: "Configuracion de autenticacion incompleta." }, 500);
      }

      const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
      if (!authHeader) {
        return jsonResponse({ error: "Falta autenticacion para forzar el sorteo." }, 401);
      }

      const supabaseForUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: authError,
      } = await supabaseForUser.auth.getUser();

      if (authError || !user) {
        return jsonResponse({ error: "No se pudo autenticar al usuario." }, 401);
      }

      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<Profile>();

      if (profileError) throw profileError;
      const isOwner = user.id === promotion.user_id;
      const isAdmin = profile?.role === "admin";
      if (!isOwner && !isAdmin) {
        return jsonResponse({ error: "No tenes permiso para forzar este sorteo." }, 403);
      }
    }

    if (promotion.winner_participant_id) {
      const animationUsernames = await fetchAnimationUsernames(db, promotion.id);
      return jsonResponse({
        ok: true,
        already_drawn: true,
        draw_status: "completed",
        winner_username: promotion.winner_username,
        prize: promotion.prize,
        winner_selected_at: promotion.winner_selected_at,
        animation_usernames: animationUsernames,
      });
    }

    if (promotion.draw_status === "no_participants") {
      return jsonResponse({
        ok: true,
        already_drawn: true,
        draw_status: "no_participants",
        prize: promotion.prize,
        draw_processed_at: promotion.draw_processed_at,
        animation_usernames: [],
      });
    }

    const { data: participants, error: participantsError } = await db
      .from("promotion_participants")
      .select("id, username, phone, email, created_at")
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
      return jsonResponse({
        ok: true,
        already_drawn: false,
        draw_status: "no_participants",
        prize: promotion.prize,
        draw_processed_at: nowIso,
        animation_usernames: [],
      });
    }

    const winner = pool[Math.floor(Math.random() * pool.length)];
    const animationUsernames = animationUsernamesFromParticipants(pool);

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
    if (!updatedWinner) {
      const { data: fresh } = await db
        .from("promotions")
        .select("winner_username, prize, winner_selected_at, draw_status, draw_processed_at")
        .eq("id", promotion.id)
        .maybeSingle<Pick<Promotion, "winner_username" | "prize" | "winner_selected_at" | "draw_status" | "draw_processed_at">>();
      return jsonResponse({
        ok: true,
        already_drawn: true,
        draw_status: fresh?.draw_status ?? "pending",
        winner_username: fresh?.winner_username ?? "",
        prize: fresh?.prize ?? promotion.prize,
        winner_selected_at: fresh?.winner_selected_at ?? null,
        draw_processed_at: fresh?.draw_processed_at ?? null,
        animation_usernames: await fetchAnimationUsernames(db, promotion.id),
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
      draw_status: "completed",
      winner_username: winner.username,
      prize: promotion.prize,
      winner_selected_at: nowIso,
      draw_processed_at: nowIso,
      animation_usernames: animationUsernames,
      notified,
      notification_skipped: notificationSkipped || null,
    });
  } catch (err) {
    console.error("promotion-draw error:", err);
    return jsonResponse({ error: "Error al realizar el sorteo." }, 500);
  }
});
