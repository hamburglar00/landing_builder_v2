import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

type TelegramDestination = {
  id: number;
  user_id: string;
  telegram_chat_id: string;
  welcome_sent_at: string | null;
};

const WELCOME_MESSAGE =
  "Felicitaciones! Has activado las notificaciones de seguimiento. Recibiras un resumen diario de tus contactos inactivos.";

function extractStartPayload(text: string): string | null {
  const t = (text || "").trim();
  const m = t.match(/^\/start(?:@\w+)?(?:\s+|=)(.+)$/i);
  if (m?.[1]) return m[1].trim() || null;
  if (/^start=/i.test(t)) return t.slice("start=".length).trim() || null;
  return null;
}

function normalizeTokenCandidate(text: string): string {
  return String(text || "").trim().replace(/^\/+/, "").replace(/^start=/i, "").replace(/^start\s+/i, "");
}

function isPlainStart(text: string): boolean {
  return /^\/start(?:@\w+)?$/i.test(String(text || "").trim());
}

function getDestinationFromUpdate(update: any) {
  const chatId = String(update?.message?.chat?.id || "").trim();
  const from = update?.message?.from || {};
  const contact = update?.message?.contact || {};
  return {
    chatId,
    username: String(from?.username || "").trim(),
    firstName: String(from?.first_name || "").trim(),
    lastName: String(from?.last_name || "").trim(),
    phone: String(contact?.phone_number || "").trim(),
  };
}

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, body };
}

async function fetchTelegramChatInfo(token: string, chatId: string) {
  const url = `https://api.telegram.org/bot${token}/getChat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const result = data?.result;
  if (!result) return null;
  return {
    username: String(result.username || "").trim(),
    firstName: String(result.first_name || "").trim(),
    lastName: String(result.last_name || "").trim(),
  };
}

async function upsertDestination(
  db: ReturnType<typeof createClient>,
  userId: string,
  d: { chatId: string; username: string; firstName: string; lastName: string; phone: string },
  nowIso: string,
): Promise<TelegramDestination | null> {
  if (!d.chatId) return null;
  const { data, error } = await db
    .from("notification_telegram_destinations")
    .upsert(
      {
        user_id: userId,
        telegram_chat_id: d.chatId,
        telegram_username: d.username,
        telegram_first_name: d.firstName,
        telegram_last_name: d.lastName,
        telegram_phone: d.phone,
        is_active: true,
        updated_at: nowIso,
      },
      { onConflict: "user_id,telegram_chat_id" },
    )
    .select("id, user_id, telegram_chat_id, welcome_sent_at")
    .single();
  if (error) return null;
  return data as TelegramDestination;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Only POST", { status: 405, headers: corsHeaders });

  try {
    const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
    // Keep webhook working even if Telegram webhook secret header is not present/mismatched.
    // This avoids broken reconnect flows when the provider sends updates without the header.
    const secretMatches = !expectedSecret || gotSecret === expectedSecret;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return new Response("Missing env", { status: 500, headers: corsHeaders });

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: botRow } = await db
      .from("notification_bot_config")
      .select("telegram_bot_token, telegram_bot_username")
      .eq("id", 1)
      .single();

    if (!botRow?.telegram_bot_token || !botRow?.telegram_bot_username) {
      return new Response("Bot not configured", { status: 200, headers: corsHeaders });
    }

    const update = await req.json().catch(() => null);
    if (!update) return new Response("ok", { status: 200, headers: corsHeaders });
    if (!secretMatches && !update?.message?.text) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const text = String(update?.message?.text || "");
    let payload = extractStartPayload(text);
    const fromDest = getDestinationFromUpdate(update);
    const nowIso = new Date().toISOString();

    if (!fromDest.chatId) return new Response("ok", { status: 200, headers: corsHeaders });

    if (!payload) {
      const candidate = normalizeTokenCandidate(text);
      if (/^[a-f0-9]{20,}$/i.test(candidate)) {
        payload = candidate;
      }
    }

    if (payload) {
      const { data: linkedUser } = await db
        .from("notification_settings")
        .select("user_id")
        .eq("telegram_start_token", payload)
        .maybeSingle();

      if (linkedUser?.user_id) {
        const dest = await upsertDestination(db, linkedUser.user_id, fromDest, nowIso);
        await db
          .from("notification_settings")
          .update({ telegram_chat_id: fromDest.chatId, updated_at: nowIso })
          .eq("user_id", linkedUser.user_id);

        // enrich identity if still missing from the update
        if (dest) {
          const chatInfo = await fetchTelegramChatInfo(botRow.telegram_bot_token, fromDest.chatId);
          if (chatInfo) {
            await db
              .from("notification_telegram_destinations")
              .update({
                telegram_username: fromDest.username || chatInfo.username,
                telegram_first_name: fromDest.firstName || chatInfo.firstName,
                telegram_last_name: fromDest.lastName || chatInfo.lastName,
                telegram_phone: fromDest.phone || "",
                updated_at: nowIso,
              })
              .eq("id", dest.id);
          }
        }

        if (dest && !dest.welcome_sent_at) {
          const welcome = await sendTelegramMessage(botRow.telegram_bot_token, fromDest.chatId, WELCOME_MESSAGE);
          if (welcome.ok) {
            await db
              .from("notification_telegram_destinations")
              .update({ welcome_sent_at: nowIso, updated_at: nowIso })
              .eq("id", dest.id);
          }
        }
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (isPlainStart(text)) {
      const { data: linkedRows } = await db
        .from("notification_telegram_destinations")
        .select("id, welcome_sent_at")
        .eq("telegram_chat_id", fromDest.chatId)
        .eq("is_active", true);

      for (const row of linkedRows ?? []) {
        if (!row.welcome_sent_at) {
          const welcome = await sendTelegramMessage(botRow.telegram_bot_token, fromDest.chatId, WELCOME_MESSAGE);
          if (welcome.ok) {
            await db
              .from("notification_telegram_destinations")
              .update({ welcome_sent_at: nowIso, updated_at: nowIso })
              .eq("id", row.id);
          }
        }
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
