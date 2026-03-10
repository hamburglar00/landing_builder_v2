import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClickBody {
  landingName?: string | null;
  phoneId?: number | null;
  phone?: string | null;
}

/**
 * API público: registra un click real en un número de teléfono de una landing.
 *
 * Uso desde la landing pública (browser):
 * POST /functions/v1/phone-click
 * {
 *   "landingName": "kobe",
 *   "phoneId": 123
 * }
 *
 * Esta función valida que el teléfono pertenezca a alguna gerencia asignada a
 * la landing indicada y, si es así, incrementa usage_count en 1.
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
          error: "Configuración del servidor incompleta.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => null) as ClickBody | null;
    const landingName = body?.landingName?.trim();
    const phoneId = body?.phoneId ?? null;
    const phone = body?.phone?.trim();

    if (!landingName || !phoneId || Number.isNaN(phoneId) || !phone) {
      return new Response(
        JSON.stringify({
          error:
            "Parámetros inválidos. Se requieren 'landingName' (string), 'phoneId' (number) y 'phone' (string).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Obtener landing por nombre
    const { data: landing, error: landingError } = await supabase
      .from("landings")
      .select("id, name")
      .eq("name", landingName)
      .maybeSingle();

    if (landingError) {
      return new Response(
        JSON.stringify({ error: "Error al obtener la landing." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!landing) {
      return new Response(
        JSON.stringify({ error: "Landing no encontrada." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2) Obtener teléfono por id (incluye usage_count para incrementar)
    const { data: phoneRow, error: phoneError } = await supabase
      .from("gerencia_phones")
      .select("id, gerencia_id, phone, status, usage_count")
      .eq("id", phoneId)
      .maybeSingle();

    if (phoneError) {
      return new Response(
        JSON.stringify({ error: "Error al obtener el teléfono." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!phoneRow) {
      return new Response(
        JSON.stringify({ error: "Teléfono no encontrado." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3) Verificar que la gerencia del teléfono esté asignada a la landing
    const { data: assignment, error: assignError } = await supabase
      .from("landings_gerencias")
      .select("landing_id, gerencia_id")
      .eq("landing_id", landing.id)
      .eq("gerencia_id", phoneRow.gerencia_id)
      .maybeSingle();

    if (assignError) {
      return new Response(
        JSON.stringify({
          error: "Error al verificar asignación de gerencia a la landing.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!assignment) {
      return new Response(
        JSON.stringify({
          error:
            "El teléfono no pertenece a ninguna gerencia asignada a esta landing.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4) Incrementar usage_count
    const currentCount = Number(phoneRow.usage_count) || 0;
    const { error: updateError } = await supabase
      .from("gerencia_phones")
      .update({ usage_count: currentCount + 1 })
      .eq("id", phoneRow.id);

    if (updateError) {
      // No rompemos la experiencia si falla la métrica
      console.error("Error al actualizar usage_count en phone-click:", updateError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No se pudo actualizar usage_count.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        landingId: landing.id,
        landingName: landing.name,
        phoneId: phoneRow.id,
        phone: phoneRow.phone,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
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

