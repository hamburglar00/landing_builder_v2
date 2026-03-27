import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BA_TIMEZONE = "America/Argentina/Buenos_Aires";

type BotConfig = {
  telegram_bot_token: string;
  telegram_bot_username: string;
  telegram_update_offset: number;
};

type NotificationSettings = {
  user_id: string;
  enabled: boolean;
  channel: string;
  telegram_chat_id: string;
  telegram_start_token: string;
  telegram_welcome_sent_at: string | null;
  inactive_days: number;
  renotify_days: number;
  notify_hour: number;
  timezone: string;
};

type TelegramDestination = {
  id: number;
  user_id: string;
  telegram_chat_id: string;
  telegram_username: string;
  telegram_first_name: string;
  telegram_last_name: string;
  telegram_phone: string;
  is_active: boolean;
  welcome_sent_at: string | null;
};

type ConversionRow = {
  user_id: string;
  phone: string;
  estado: string;
  created_at: string;
  valor: number;
  purchase_event_id: string;
};

function getCurrentBAHour(): number {
  const h = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: BA_TIMEZONE,
  }).format(new Date());
  return Number(h);
}

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
  if (lower.startsWith("/start=")) {
    return t.slice("/start=".length).trim() || null;
  }
  if (lower.startsWith("start=")) {
    return t.slice("start=".length).trim() || null;
  }
  return null;
}

function isPlainStart(text: string): boolean {
  return String(text || "").trim().toLowerCase() === "/start";
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

const WELCOME_MESSAGE = "Felicitaciones! Has activado las notificaciones de seguimiento. Recibiras un resumen diario de tus contactos inactivos.";

function relTimeFromDays(days: number): string {
  if (days <= 1) return "1 dia";
  return `${days} dias`;
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
    .select("id, user_id, telegram_chat_id, telegram_username, telegram_first_name, telegram_last_name, telegram_phone, is_active, welcome_sent_at")
    .single();
  if (error) return null;
  return data as TelegramDestination;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Only POST", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("Missing env", { status: 500, headers: corsHeaders });
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
    if (!cronOk && !bootstrapOk) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const currentHour = getCurrentBAHour();

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
    if (updates.ok && updates.results.length > 0) {
      for (const u of updates.results) {
        const updateId = Number(u?.update_id || 0);
        if (updateId >= nextOffset) nextOffset = updateId + 1;

        const text = String(u?.message?.text || "");
        const payload = extractStartPayload(text);
        const fromDest = getDestinationFromUpdate(u);
        const nowIso = new Date().toISOString();

        if (!fromDest.chatId) continue;

        // Main: deep-link with token
        if (payload) {
          const { data: linked } = await db
            .from("notification_settings")
            .select("user_id")
            .eq("telegram_start_token", payload)
            .maybeSingle();

          if (linked?.user_id) {
            const dest = await upsertDestination(db, linked.user_id, fromDest, nowIso);
            // compatibility with old single-chat field
            await db
              .from("notification_settings")
              .update({ telegram_chat_id: fromDest.chatId, updated_at: nowIso })
              .eq("user_id", linked.user_id);

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
          continue;
        }

        // Fallback: /start in already linked chat
        if (isPlainStart(text)) {
          const { data: linkedRows } = await db
            .from("notification_telegram_destinations")
            .select("id, user_id, welcome_sent_at")
            .eq("telegram_chat_id", fromDest.chatId)
            .eq("is_active", true);

          for (const linked of linkedRows ?? []) {
            if (linked.welcome_sent_at) continue;
            const welcome = await sendTelegramMessage(botRow.telegram_bot_token, fromDest.chatId, WELCOME_MESSAGE);
            if (welcome.ok) {
              await db
                .from("notification_telegram_destinations")
                .update({ welcome_sent_at: nowIso, updated_at: nowIso })
                .eq("id", linked.id);
            }
          }
        }
      }

      await db
        .from("notification_bot_config")
        .update({
          telegram_update_offset: nextOffset,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
    }

    const { data: settingsRows } = await db
      .from("notification_settings")
      .select("*")
      .eq("enabled", true)
      .eq("channel", "telegram");

    const settings = (settingsRows ?? []) as NotificationSettings[];

    // One-time welcome for already connected destinations
    for (const s of settings) {
      const nowIso = new Date().toISOString();
      const { data: dests } = await db
        .from("notification_telegram_destinations")
        .select("id, telegram_chat_id, welcome_sent_at, telegram_username, telegram_first_name, telegram_last_name")
        .eq("user_id", s.user_id)
        .eq("is_active", true);
      for (const d of dests ?? []) {
        const missingIdentity =
          !String(d.telegram_username || "").trim() &&
          !String(d.telegram_first_name || "").trim() &&
          !String(d.telegram_last_name || "").trim();
        if (missingIdentity && d.telegram_chat_id) {
          const chatInfo = await fetchTelegramChatInfo(botRow.telegram_bot_token, d.telegram_chat_id);
          if (chatInfo) {
            await db
              .from("notification_telegram_destinations")
              .update({
                telegram_username: chatInfo.username,
                telegram_first_name: chatInfo.firstName,
                telegram_last_name: chatInfo.lastName,
                updated_at: nowIso,
              })
              .eq("id", d.id);
          }
        }

        if (!d.telegram_chat_id || d.welcome_sent_at) continue;
        const welcome = await sendTelegramMessage(botRow.telegram_bot_token, d.telegram_chat_id, WELCOME_MESSAGE);
        if (welcome.ok) {
          await db
            .from("notification_telegram_destinations")
            .update({ welcome_sent_at: nowIso, updated_at: nowIso })
            .eq("id", d.id);
        }
      }
    }

    let sentUsers = 0;
    let sentMessages = 0;

    if (currentHour < 8 || currentHour > 22) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "outside-window", sentUsers, sentMessages }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    for (const s of settings) {
      if (s.notify_hour !== currentHour) continue;

      const { data: destinationsRows } = await db
        .from("notification_telegram_destinations")
        .select("id, telegram_chat_id")
        .eq("user_id", s.user_id)
        .eq("is_active", true);
      const destinations = destinationsRows ?? [];
      if (!destinations.length) continue;

      const { data: rows } = await db
        .from("conversions")
        .select("user_id, phone, estado, created_at, valor, purchase_event_id")
        .eq("user_id", s.user_id)
        .order("created_at", { ascending: false });
      const conv = (rows ?? []) as ConversionRow[];
      if (!conv.length) continue;

      const byPhone = new Map<string, ConversionRow[]>();
      for (const r of conv) {
        if (!r.phone) continue;
        if (r.estado === "contact") continue;
        const arr = byPhone.get(r.phone) ?? [];
        arr.push(r);
        byPhone.set(r.phone, arr);
      }

      const { data: alertsRows } = await db
        .from("notification_contact_alerts")
        .select("phone, last_notified_at, last_notified_activity_at")
        .eq("user_id", s.user_id);
      const alertMap = new Map<string, { last_notified_at: string; last_notified_activity_at: string }>();
      for (const a of alertsRows ?? []) {
        alertMap.set(String(a.phone), {
          last_notified_at: String(a.last_notified_at),
          last_notified_activity_at: String(a.last_notified_activity_at),
        });
      }

      const now = new Date();
      const inactiveThreshold = new Date(now.getTime() - s.inactive_days * 24 * 60 * 60 * 1000);
      const renotifyThreshold = new Date(now.getTime() - s.renotify_days * 24 * 60 * 60 * 1000);

      const candidates: Array<{
        phone: string;
        lastActivity: Date;
        isLead: boolean;
        avg: number;
        total: number;
      }> = [];

      for (const [phone, group] of byPhone.entries()) {
        const sorted = [...group].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const latest = sorted[0];
        if (!latest?.created_at) continue;
        const lastActivity = new Date(latest.created_at);
        if (lastActivity > inactiveThreshold) continue;

        const purchaseRows = sorted.filter((x) => String(x.purchase_event_id || "").trim());
        const total = purchaseRows.reduce((acc, x) => acc + Number(x.valor || 0), 0);
        const avg = purchaseRows.length ? total / purchaseRows.length : 0;
        const isLead = purchaseRows.length === 0;

        const prev = alertMap.get(phone);
        const hasNewActivity = prev
          ? lastActivity.getTime() > new Date(prev.last_notified_activity_at).getTime()
          : false;
        const canRenotifyByTime = prev
          ? new Date(prev.last_notified_at).getTime() <= renotifyThreshold.getTime()
          : true;
        if (prev && !hasNewActivity && !canRenotifyByTime) continue;

        candidates.push({ phone, lastActivity, isLead, avg, total });
      }

      if (!candidates.length) continue;
      sentUsers += 1;

      const chunks: typeof candidates[] = [];
      for (let i = 0; i < candidates.length; i += 10) {
        chunks.push(candidates.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const lines = chunk.map((c) => {
          const wa = `https://wa.me/${c.phone}`;
          const inactiveDays = Math.max(
            1,
            Math.floor((now.getTime() - c.lastActivity.getTime()) / (24 * 60 * 60 * 1000)),
          );
          if (c.isLead) {
            return `- <a href="${wa}">${c.phone}</a>: inactivo hace ${relTimeFromDays(inactiveDays)}. Aun no realizo una carga.`;
          }
          return `- <a href="${wa}">${c.phone}</a>: inactivo hace ${relTimeFromDays(inactiveDays)}. Carga promedio: $${Math.round(c.avg)}. Total cargado: $${Math.round(c.total)}.`;
        });
        const text = [
          "?? <b>Resumen de inactividad</b>",
          `Contactos detectados: ${chunk.length}`,
          "",
          ...lines,
        ].join("\n");

        let delivered = false;
        for (const destination of destinations) {
          if (!destination.telegram_chat_id) continue;
          const sent = await sendTelegramMessage(botRow.telegram_bot_token, destination.telegram_chat_id, text);
          if (sent.ok) {
            sentMessages += 1;
            delivered = true;
          }
        }

        if (!delivered) continue;

        for (const c of chunk) {
          await db
            .from("notification_contact_alerts")
            .upsert(
              {
                user_id: s.user_id,
                phone: c.phone,
                last_notified_at: now.toISOString(),
                last_notified_activity_at: c.lastActivity.toISOString(),
                updated_at: now.toISOString(),
              },
              { onConflict: "user_id,phone" },
            );
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sentUsers, sentMessages }), {
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

