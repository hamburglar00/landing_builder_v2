import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BotConfig = {
  telegram_bot_token: string;
  telegram_bot_username: string;
  telegram_update_offset: number;
};

type TelegramDestination = {
  id: number;
  user_id: string;
  telegram_chat_id: string;
  welcome_sent_at: string | null;
};

const WELCOME_MESSAGE =
  "Felicitaciones! Has activado las notificaciones de seguimiento. Recibiras un resumen diario de tus contactos inactivos.";

async function fetchTelegramUpdates(token: string, offset: number) {
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offset, timeout: 0, allowed_updates: ["message"] }),
  });
  if (!res.ok) return { ok: false, results: [] as any[] };
  const data = await res.json();
  return { ok: !!data?.ok, results: data?.result ?? [] };
}

function extractStartPayload(text: string): string | null {
  const t = (text || "").trim();
  const lower = t.toLowerCase();
  if (lower.startsWith("/start ")) {
    const parts = t.split(" ");
    if (parts.length < 2) return null;
    return parts.slice(1).join(" ").trim();
  }
  if (lower.startsWith("/start=")) return t.slice("/start=".length).trim() || null;
  if (lower.startsWith("start=")) return t.slice("start=".length).trim() || null;
  return null;
}

function normalizeTokenCandidate(text: string): string {
  return String(text || "").trim().replace(/^\/+/, "").replace(/^start=/i, "").replace(/^start\s+/i, "");
}

function isPlainStart(text: string): boolean {
  return String(text || "").trim().toLowerCase() === "/start";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return new Response("Missing env", { status: 500, headers: corsHeaders });

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
    if (!cronOk && !bootstrapOk) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const { data: botRow } = await db
      .from("notification_bot_config")
      .select("telegram_bot_token, telegram_bot_username, telegram_update_offset")
      .eq("id", 1)
      .single<BotConfig>();

    if (!botRow?.telegram_bot_token || !botRow?.telegram_bot_username) {
      return new Response(JSON.stringify({ ok: true, skipped: "bot-not-configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates = await fetchTelegramUpdates(
      botRow.telegram_bot_token,
      Math.max(0, Number(botRow.telegram_update_offset || 0)),
    );

    let nextOffset = Number(botRow.telegram_update_offset || 0);
    let linked = 0;
    let welcomed = 0;

    if (updates.ok && updates.results.length > 0) {
      for (const u of updates.results) {
        const updateId = Number(u?.update_id || 0);
        if (updateId >= nextOffset) nextOffset = updateId + 1;

        const text = String(u?.message?.text || "");
        let payload = extractStartPayload(text);
        const fromDest = getDestinationFromUpdate(u);
        const nowIso = new Date().toISOString();
        if (!fromDest.chatId) continue;

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

            linked += 1;

            if (dest && !dest.welcome_sent_at) {
              const welcome = await sendTelegramMessage(botRow.telegram_bot_token, fromDest.chatId, WELCOME_MESSAGE);
              if (welcome.ok) {
                welcomed += 1;
                await db
                  .from("notification_telegram_destinations")
                  .update({ welcome_sent_at: nowIso, updated_at: nowIso })
                  .eq("id", dest.id);
              }
            }
          }
          continue;
        }

        if (isPlainStart(text)) {
          const { data: linkedRows } = await db
            .from("notification_telegram_destinations")
            .select("id, welcome_sent_at")
            .eq("telegram_chat_id", fromDest.chatId)
            .eq("is_active", true);
          for (const row of linkedRows ?? []) {
            if (row.welcome_sent_at) continue;
            const welcome = await sendTelegramMessage(botRow.telegram_bot_token, fromDest.chatId, WELCOME_MESSAGE);
            if (welcome.ok) {
              welcomed += 1;
              await db
                .from("notification_telegram_destinations")
                .update({ welcome_sent_at: nowIso, updated_at: nowIso })
                .eq("id", row.id);
            }
          }
        }
      }

      await db
        .from("notification_bot_config")
        .update({ telegram_update_offset: nextOffset, updated_at: new Date().toISOString() })
        .eq("id", 1);
    }

    const { data: dests } = await db
      .from("notification_telegram_destinations")
      .select("id, telegram_chat_id, telegram_username, telegram_first_name, telegram_last_name")
      .eq("is_active", true);

    let enriched = 0;
    for (const d of dests ?? []) {
      const missingIdentity =
        !String(d.telegram_username || "").trim() &&
        !String(d.telegram_first_name || "").trim() &&
        !String(d.telegram_last_name || "").trim();
      if (!missingIdentity || !d.telegram_chat_id) continue;
      const chatInfo = await fetchTelegramChatInfo(botRow.telegram_bot_token, d.telegram_chat_id);
      if (!chatInfo) continue;
      await db
        .from("notification_telegram_destinations")
        .update({
          telegram_username: chatInfo.username,
          telegram_first_name: chatInfo.firstName,
          telegram_last_name: chatInfo.lastName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", d.id);
      enriched += 1;
    }

    return new Response(JSON.stringify({ ok: true, linked, welcomed, enriched }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
