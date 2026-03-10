import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Configura la URL de sync-phones en public.cron_config para que el cron
 * pueda invocar la Edge Function. Ejecutar UNA VEZ tras aplicar la migración
 * del cron y desplegar las funciones.
 *
 * POST body: { "bootstrap_secret": "<BOOTSTRAP_SECRET de Secrets>" }
 * En Dashboard > Edge Functions > bootstrap-cron-config > Secrets: añadí BOOTSTRAP_SECRET.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Solo POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const expectedSecret = Deno.env.get("BOOTSTRAP_SECRET");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error: "Faltan SUPABASE_URL o SERVICE_ROLE_KEY.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!expectedSecret || expectedSecret.length < 16) {
      return new Response(
        JSON.stringify({
          error:
            "Configurá BOOTSTRAP_SECRET en Secrets de esta función (mín. 16 caracteres).",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      bootstrap_secret?: string | null;
    } | null;
    const secret = body?.bootstrap_secret ?? null;

    if (secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "bootstrap_secret inválido." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const syncPhonesUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/sync-phones`;

    const { error } = await supabase
      .from("cron_config")
      .upsert(
        { key: "sync_phones_url", value: syncPhonesUrl },
        { onConflict: "key" },
      );

    if (error) {
      return new Response(
        JSON.stringify({ error: "Error al escribir cron_config: " + error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "cron_config actualizado. El cron cada 5 min ya puede invocar sync-phones.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
