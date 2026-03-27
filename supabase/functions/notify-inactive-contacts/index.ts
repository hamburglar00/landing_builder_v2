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
  if (!t.toLowerCase().startsWith("/start")) return null;
  const parts = t.split(" ");
  if (parts.length < 2) return null;
  return parts.slice(1).join(" ").trim();
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

const WELCOME_MESSAGE =
  "🔔 ¡Felicidades! Has activado las notificaciones de seguimiento. Recibirás un resumen diario de tus contactos inactivos.";

function relTimeFromDays(days: number): string {
  if (days <= 1) return "1 dia";
  return `${days} dias`;
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
        const chatId = String(u?.message?.chat?.id || "");
        if (!chatId) continue;
        const nowIso = new Date().toISOString();

        // Caso principal: deep-link con token (/start <token>)
        if (payload) {
          const { data: linked } = await db
            .from("notification_settings")
            .update({ telegram_chat_id: chatId, updated_at: nowIso })
            .eq("telegram_start_token", payload)
            .select("user_id, telegram_welcome_sent_at")
            .maybeSingle();
          if (linked?.user_id && !linked.telegram_welcome_sent_at) {
            const welcome = await sendTelegramMessage(botRow.telegram_bot_token, chatId, WELCOME_MESSAGE);
            if (welcome.ok) {
              await db
                .from("notification_settings")
                .update({ telegram_welcome_sent_at: nowIso, updated_at: nowIso })
                .eq("user_id", linked.user_id);
            }
          }
          continue;
        }

        // Fallback: /start sin token en chat ya vinculado.
        if (isPlainStart(text)) {
          const { data: linkedRows } = await db
            .from("notification_settings")
            .select("user_id, telegram_welcome_sent_at")
            .eq("telegram_chat_id", chatId);
          for (const linked of linkedRows ?? []) {
            if (linked.telegram_welcome_sent_at) continue;
            const welcome = await sendTelegramMessage(botRow.telegram_bot_token, chatId, WELCOME_MESSAGE);
            if (welcome.ok) {
              await db
                .from("notification_settings")
                .update({ telegram_welcome_sent_at: nowIso, updated_at: nowIso })
                .eq("user_id", linked.user_id);
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

    // Backfill armonizado: enviar bienvenida una sola vez a clientes ya conectados.
    for (const s of settings) {
      if (!s.telegram_chat_id || s.telegram_welcome_sent_at) continue;
      const nowIso = new Date().toISOString();
      const welcome = await sendTelegramMessage(botRow.telegram_bot_token, s.telegram_chat_id, WELCOME_MESSAGE);
      if (welcome.ok) {
        await db
          .from("notification_settings")
          .update({ telegram_welcome_sent_at: nowIso, updated_at: nowIso })
          .eq("user_id", s.user_id);
        s.telegram_welcome_sent_at = nowIso;
      }
    }

    let sentUsers = 0;
    let sentMessages = 0;

    // Solo el resumen de inactividad respeta ventana horaria.
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
      if (!s.telegram_chat_id) continue;
      if (s.notify_hour !== currentHour) continue;

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
          "🔔 <b>Resumen de inactividad</b>",
          `Contactos detectados: ${chunk.length}`,
          "",
          ...lines,
        ].join("\n");
        const sent = await sendTelegramMessage(botRow.telegram_bot_token, s.telegram_chat_id, text);
        if (!sent.ok) continue;
        sentMessages += 1;

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
