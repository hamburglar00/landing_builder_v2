import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClickBody {
  landingName?: string | null;
  atrioClientId?: string | null;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Solo se permite POST" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Configuracion del servidor incompleta." },
        500,
      );
    }

    const body = await req.json().catch(() => null) as ClickBody | null;
    const landingName = body?.landingName?.trim() ?? "";
    const atrioClientId = body?.atrioClientId?.trim() ?? "";
    if (!landingName || !atrioClientId) {
      return jsonResponse({
        error:
          "Parametros invalidos. Se requieren 'landingName' y 'atrioClientId'.",
      }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: landing, error: landingError } = await supabase
      .from("landings")
      .select("id, name, user_id")
      .eq("name", landingName)
      .maybeSingle();

    if (landingError) {
      return jsonResponse({ error: "Error al obtener la landing." }, 500);
    }
    if (!landing) return jsonResponse({ error: "Landing no encontrada." }, 404);

    const { data: assignment, error: assignmentError } = await supabase
      .from("landings_atrio_clients")
      .select("landing_id, atrio_client_id, user_id")
      .eq("landing_id", landing.id)
      .eq("atrio_client_id", atrioClientId)
      .maybeSingle();

    if (assignmentError) {
      return jsonResponse({
        error: "Error al verificar asignacion de Atrio a la landing.",
      }, 500);
    }
    if (!assignment) {
      return jsonResponse({
        error: "El cliente Atrio no esta asignado a esta landing.",
      }, 400);
    }

    const { error: incrementError } = await supabase.rpc(
      "increment_atrio_assignment_scope_usage",
      {
        p_atrio_client_id: atrioClientId,
        p_scope_type: "landing",
        p_scope_id: landing.id,
        p_user_id: landing.user_id,
      },
    );

    if (incrementError) {
      console.error("[atrio-click] increment failed", incrementError);
      return jsonResponse({
        ok: false,
        error: "No se pudo actualizar contador.",
      }, 500);
    }

    return jsonResponse({
      ok: true,
      landingId: landing.id,
      landingName: landing.name,
      atrioClientId,
    }, 200);
  } catch (error) {
    console.error("[atrio-click] unexpected error", error);
    return jsonResponse({ error: "Error inesperado." }, 500);
  }
});
