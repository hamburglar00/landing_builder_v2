import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Reset de usage_count para teléfonos del usuario.
 * Body: { user_id: string, gerencia_id?: number }. Si gerencia_id se omite, resetea todas las gerencias del usuario.
 *
 * Uso: POST /functions/v1/reset-phone-counters
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Solo se permite POST" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error:
            "Faltan variables de entorno SUPABASE_URL o SERVICE_ROLE_KEY.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { user_id?: string | null; gerencia_id?: number | null }
      | null;
    const userId = body?.user_id ?? null;
    const singleGerenciaId = body?.gerencia_id ?? null;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Falta user_id en el cuerpo de la petición." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let query = supabaseAdmin
      .from("gerencias")
      .select("id")
      .eq("user_id", userId);
    if (singleGerenciaId != null) {
      query = query.eq("id", singleGerenciaId);
    }
    const { data: gerencias, error: gerenciasError } = await query;

    if (gerenciasError) {
      return new Response(
        JSON.stringify({
          error: "Error al obtener las gerencias del usuario.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const gerenciaIds = (gerencias ?? []).map((g) => g.id);
    if (singleGerenciaId != null && gerenciaIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: "La gerencia indicada no existe o no pertenece al usuario.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!gerenciaIds.length) {
      return new Response(
        JSON.stringify({
          success: true,
          reset_count: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: phones, error: phonesError } = await supabaseAdmin
      .from("gerencia_phones")
      .select("id")
      .in("gerencia_id", gerenciaIds);

    if (phonesError) {
      return new Response(
        JSON.stringify({
          error: "Error al obtener los teléfonos para resetear.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const phoneIds = (phones ?? []).map((p) => p.id);
    if (!phoneIds.length) {
      return new Response(
        JSON.stringify({
          success: true,
          reset_count: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("gerencia_phones")
      .update({ usage_count: 0 })
      .in("id", phoneIds);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: "No se pudieron resetear los contadores.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reset_count: phoneIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error inesperado al resetear contadores." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

