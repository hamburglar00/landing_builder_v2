import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Only POST", { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    const bootstrapSecret = Deno.env.get("BOOTSTRAP_SECRET") || "";
    if (!supabaseUrl || !serviceRoleKey || !webhookSecret || !bootstrapSecret) {
      return new Response("Missing env", { status: 500, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.bootstrap_secret !== bootstrapSecret) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: bot } = await db
      .from("notification_bot_config")
      .select("telegram_bot_token")
      .eq("id", 1)
      .single();

    const token = String(bot?.telegram_bot_token || "").trim();
    if (!token) return new Response("Bot token not configured", { status: 400, headers: corsHeaders });

    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message"],
        drop_pending_updates: false,
      }),
    });
    const tgBody = await tgRes.text();

    return new Response(tgBody, {
      status: tgRes.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

