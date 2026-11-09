import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await request.json();
    const secret = await db.from("cron_config").select("value").eq("key", "sync_phones_cron_secret").maybeSingle();
    const expected = Deno.env.get("CRON_SECRET") || secret.data?.value;
    if (!expected || body?.cron_secret !== expected) return json({ error: "unauthorized" }, 401);
    const origin = new URL(Deno.env.get("ATRIO_DIRECTORY_ORIGIN") || "");
    const key = Deno.env.get("ATRIO_DAILY_RESET_KEY");
    if (!key || origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) return json({ error: "server_not_configured" }, 503);
    let completed = 0;
    // Bounded invocations; the minute cron resumes any remaining durable jobs.
    for (let batch = 0; batch < 5; batch++) {
      const pending = await db.rpc("read_bot_daily_resets");
      if (pending.error) throw pending.error;
      if (!pending.data?.length) break;
      const items = pending.data.map((row: { advisor_id: string; reset_date: string }) => ({ advisor_id: row.advisor_id, reset_date: row.reset_date }));
      const upstream = await fetch(new URL("/api/gateway/manager-destinations/reset_daily", origin), {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ items }), signal: AbortSignal.timeout(15000), redirect: "error",
      });
      const result = await upstream.json().catch(() => null);
      if (!upstream.ok || result?.ok !== true) throw Error("reset_unavailable");
      const ack = await db.rpc("ack_bot_daily_resets", { p_items: items });
      if (ack.error) throw ack.error;
      completed += items.length;
    }
    return json({ ok: true, completed });
  } catch {
    return json({ error: "daily_reset_unavailable" }, 503);
  }
});
