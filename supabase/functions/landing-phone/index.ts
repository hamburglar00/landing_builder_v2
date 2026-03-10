import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * API público: devuelve 1 número de teléfono para una landing.
 * Toda la lógica corre en la DB (get_phone_for_landing) para 1 solo round-trip.
 * Uso: GET /functions/v1/landing-phone?name=MiLanding
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Solo se permiten GET y POST" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    let name: string | undefined;

    if (req.method === "GET") {
      const url = new URL(req.url);
      name = url.searchParams.get("name")?.trim() || undefined;
    } else {
      const body = (await req.json().catch(() => null)) as
        | { name?: string | null }
        | null;
      name = body?.name?.trim() || undefined;
    }

    if (!name) {
      return new Response(
        JSON.stringify({
          error: "Falta el nombre de la landing (parámetro 'name').",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error: "Configuración del servidor incompleta.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.rpc("get_phone_for_landing", {
      p_landing_name: name,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: "Error al obtener el teléfono." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = data as Record<string, unknown> | null;
    const status = result?._status as string | undefined;

    if (status === "not_found") {
      return new Response(
        JSON.stringify({ error: "Landing no encontrada." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (status === "no_assignments") {
      return new Response(
        JSON.stringify({ error: "La landing no tiene gerencias asignadas." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (status === "no_phones") {
      return new Response(
        JSON.stringify({
          error:
            "No hay teléfonos activos que cumplan con la configuración de la landing.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Éxito: result tiene phoneId, phone, landingId, landingName, phoneMode, phoneKind, gerencia
    const payload = { ...result };
    delete (payload as Record<string, unknown>)._status;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error inesperado." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
