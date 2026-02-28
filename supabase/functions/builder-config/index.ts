import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * API público: devuelve toda la configuración de una landing por su nombre.
 * Uso: GET /functions/v1/builder-config?name=MiLanding
 * Pensado para consumir desde el dominio base al estilo https://url_base/name
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Solo se permite GET" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name")?.trim();

    if (!name) {
      return new Response(
        JSON.stringify({
          error: "Falta el parámetro de consulta 'name' (nombre de la landing).",
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

    const { data, error } = await supabase
      .from("landings")
      .select("id, name, pixel_id, comment, config")
      .eq("name", name)
      .maybeSingle();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Error al obtener la landing." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Landing no encontrada." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Respuesta en camelCase para el cliente (pixel_id -> pixelId)
    const payload = {
      id: data.id,
      name: data.name,
      pixelId: data.pixel_id ?? "",
      comment: data.comment ?? "",
      config: data.config ?? {},
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
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
