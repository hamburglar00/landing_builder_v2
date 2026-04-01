import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BA_TIMEZONE = "America/Argentina/Buenos_Aires";

type BotConfig = {
  telegram_bot_token: string;
  telegram_bot_username: string;
};

type NotificationSettings = {
  user_id: string;
  enabled: boolean;
  channel: string;
  inactive_days: number;
  renotify_days: number;
  notify_hour: number | string | null;
};

type RankingRule = {
  indicator: string;
  maxTotal: number;
};

const DEFAULT_RANKING_RULES: RankingRule[] = [
  { indicator: "\u{1F4A9}", maxTotal: 1000 },
  { indicator: "\u{1F7E2}", maxTotal: 5000 },
  { indicator: "\u{1F7E1}", maxTotal: 10000 },
  { indicator: "\u{1F7E0}", maxTotal: 50000 },
  { indicator: "\u{1F534}", maxTotal: 100000 },
  { indicator: "\u{26AB}", maxTotal: 300000 },
  { indicator: "\u{1F525}", maxTotal: 500000 },
];
const DEFAULT_OVERFLOW_INDICATOR = "\u{1F4A3}";
const LEAD_INDICATOR = "\u{1F4F2}";

type ConversionRow = {
  user_id: string;
  phone: string;
  estado: string;
  created_at: string;
  valor: number;
  purchase_event_id: string;
  test_event_code?: string | null;
};

function getCurrentBAHour(): number {
  const h = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: BA_TIMEZONE,
  }).format(new Date());
  return Number(h);
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

function relTimeFromDays(days: number): string {
  if (days <= 1) return "1 dia";
  return `${days} dias`;
}

function indicatorFor(total: number, rules: RankingRule[], overflow: string): string {
  const ordered = [...rules].sort((a, b) => a.maxTotal - b.maxTotal);
  for (const r of ordered) {
    if (total < r.maxTotal) return r.indicator || "-";
  }
  return overflow || "-";
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
      .select("telegram_bot_token, telegram_bot_username")
      .eq("id", 1)
      .single<BotConfig>();
    if (!botRow?.telegram_bot_token || !botRow?.telegram_bot_username) {
      return new Response(JSON.stringify({ ok: true, skipped: "bot-not-configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentUsers = 0;
    let sentMessages = 0;
    let usersTotal = 0;
    let usersSkippedBeforeHour = 0;
    let usersSkippedNoDestinations = 0;
    let usersSkippedNoConversions = 0;
    let usersSkippedNoCandidates = 0;

    const { data: settingsRows } = await db
      .from("notification_settings")
      .select("*")
      .eq("enabled", true)
      .eq("channel", "telegram");

    const settings = (settingsRows ?? []) as NotificationSettings[];

    for (const s of settings) {
      usersTotal += 1;
      const notifyHour = Number(s.notify_hour ?? 0);
      if (!Number.isFinite(notifyHour) || currentHour < notifyHour) {
        usersSkippedBeforeHour += 1;
        continue;
      }

      const { data: destinationsRows } = await db
        .from("notification_telegram_destinations")
        .select("telegram_chat_id")
        .eq("user_id", s.user_id)
        .eq("is_active", true);
      const destinations = destinationsRows ?? [];
      if (!destinations.length) {
        usersSkippedNoDestinations += 1;
        continue;
      }

      const { data: rows } = await db
        .from("conversions")
        .select("user_id, phone, estado, created_at, valor, purchase_event_id, test_event_code")
        .eq("user_id", s.user_id)
        .order("created_at", { ascending: false });
      const conv = (rows ?? []).filter((r) => !String(r.test_event_code ?? "").trim()) as ConversionRow[];
      if (!conv.length) {
        usersSkippedNoConversions += 1;
        continue;
      }

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

      const candidates: Array<{ phone: string; lastActivity: Date; isLead: boolean; avg: number; total: number }> = [];

      const { data: cfg } = await db
        .from("conversions_config")
        .select("tracking_ranking_config")
        .eq("user_id", s.user_id)
        .maybeSingle();
      const cfgAny = (cfg as Record<string, unknown> | null)?.tracking_ranking_config as Record<string, unknown> | null;
      const rankingRules = Array.isArray(cfgAny?.rules)
        ? (cfgAny?.rules as Array<Record<string, unknown>>)
            .map((r) => ({
              indicator: String(r.indicator ?? ""),
              maxTotal: Number(r.maxTotal ?? 0),
            }))
            .filter((r) => r.maxTotal > 0 && r.indicator)
        : DEFAULT_RANKING_RULES;
      const overflowIndicator = typeof cfgAny?.overflowIndicator === "string" && cfgAny.overflowIndicator.trim()
        ? cfgAny.overflowIndicator
        : DEFAULT_OVERFLOW_INDICATOR;

      for (const [phone, group] of byPhone.entries()) {
        const sorted = [...group].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
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

      if (!candidates.length) {
        usersSkippedNoCandidates += 1;
        continue;
      }
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
          const rank = c.isLead ? LEAD_INDICATOR : indicatorFor(c.total, rankingRules, overflowIndicator);
          if (c.isLead) {
            return `• ${rank} <a href="${wa}">${c.phone}</a>\n⏳ Inactivo hace ${relTimeFromDays(inactiveDays)}.\n📭 Aun no realizo una carga.`;
          }
          return `• ${rank} <a href="${wa}">${c.phone}</a>\n⏳ Inactivo hace ${relTimeFromDays(inactiveDays)}.\n💵 Carga promedio: $${Math.round(c.avg)}.\n🏦 Total cargado: $${Math.round(c.total)}.`;
        });

        const text = [
          "<b>RESUMEN DE INACTIVIDAD</b> 🔔",
          `📊 Contactos inactivos: ${chunk.length}/${candidates.length}`,
          "",
          lines.join("\n\n"),
          "",
          "🤝 Recordatorio: escribiles desde Seguimiento para reactivar.",
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

    return new Response(JSON.stringify({
      ok: true,
      sentUsers,
      sentMessages,
      diagnostics: {
        currentHour,
        usersTotal,
        usersSkippedBeforeHour,
        usersSkippedNoDestinations,
        usersSkippedNoConversions,
        usersSkippedNoCandidates,
      },
    }), {
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
