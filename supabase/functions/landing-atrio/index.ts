import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Solo se permiten GET y POST" }, 405);
  }

  try {
    let name = "";
    if (req.method === "GET") {
      const url = new URL(req.url);
      name = url.searchParams.get("name")?.trim() ?? "";
    } else {
      const body = await req.json().catch(() => null) as
        | { name?: string | null }
        | null;
      name = body?.name?.trim() ?? "";
    }

    if (!name) {
      return jsonResponse({
        error: "Falta el nombre de la landing (parametro 'name').",
      }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Configuracion del servidor incompleta." },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: ownerRow, error: ownerError } = await supabase
      .from("landings")
      .select("user_id")
      .eq("name", name)
      .limit(1)
      .maybeSingle();

    if (ownerError) {
      return jsonResponse(
        { error: "Error al validar el plan del cliente." },
        500,
      );
    }

    const ownerUserId = String(
      (ownerRow as { user_id?: unknown } | null)?.user_id ?? "",
    );
    if (!ownerUserId) {
      return jsonResponse({ error: "Landing no encontrada." }, 404);
    }

    const { data: isBlocked, error: planError } = await supabase.rpc(
      "is_client_access_blocked",
      { p_user_id: ownerUserId },
    );
    if (planError) {
      return jsonResponse(
        { error: "Error al validar el plan del cliente." },
        500,
      );
    }
    if (isBlocked === true) {
      return jsonResponse({ error: "Plan vencido o inactivo." }, 403);
    }

    const { data, error } = await supabase.rpc("get_atrio_for_landing", {
      p_landing_name: name,
    });
    if (error) {
      console.error("[landing-atrio] get_atrio_for_landing failed", error);
      return jsonResponse({ error: "Error al obtener el cliente Atrio." }, 500);
    }

    const result = data as Record<string, unknown> | null;
    const status = String(result?._status ?? "");
    if (status === "not_found") {
      return jsonResponse({ error: "Landing no encontrada." }, 404);
    }
    if (status === "not_atrio") {
      return jsonResponse({ error: "La landing no redirige a Atrio." }, 400);
    }
    if (status === "no_atrio_clients") {
      return jsonResponse({
        error: "La landing no tiene clientes Atrio asignados.",
      }, 404);
    }
    if (status && status !== "ok") {
      return jsonResponse({ error: "No se pudo resolver Atrio." }, 503);
    }

    const payload = { ...(result ?? {}) };
    delete payload._status;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[landing-atrio] unexpected error", error);
    return jsonResponse({ error: "Error inesperado." }, 500);
  }
});
