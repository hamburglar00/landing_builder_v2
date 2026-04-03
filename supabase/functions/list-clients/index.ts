import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ListClientsQuery = {
  page?: number;
  perPage?: number;
};

function computeEffectivePlanStatus(input: {
  status?: string | null;
  expires_at?: string | null;
  grace_days?: number | null;
}): "active" | "paused" | "expired" {
  const base = (input.status ?? "active").toLowerCase();
  if (base === "paused") return "paused";
  if (base === "expired") return "expired";
  if (!input.expires_at) return "active";
  const expMs = new Date(input.expires_at).getTime();
  if (!Number.isFinite(expMs)) return "active";
  const graceDays = Number(input.grace_days ?? 5);
  const blockedAt = expMs + graceDays * 24 * 60 * 60 * 1000;
  return Date.now() > blockedAt ? "expired" : "active";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({
          error:
            "Faltan variables de entorno SUPABASE_URL, SERVICE_ROLE_KEY o SUPABASE_ANON_KEY.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Falta encabezado Authorization." }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const supabaseForUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseForUser.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No se pudo autenticar al usuario." }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Solo un administrador puede listar clientes.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    let page = 1;
    let perPage = 50;

    if (req.method === "POST") {
      const body = (await req.json()) as ListClientsQuery;
      if (typeof body.page === "number" && body.page > 0) {
        page = body.page;
      }
      if (typeof body.perPage === "number" && body.perPage > 0) {
        perPage = body.perPage;
      }
    }

    const { data: usersData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

    if (listError || !usersData?.users) {
      return new Response(
        JSON.stringify({
          error:
            listError?.message ??
            "No se pudieron obtener los usuarios clientes.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const clientUsers = usersData.users.filter((u) => !u.is_sso_user);
    const ids = clientUsers.map((u) => u.id);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, nombre")
      .in("id", ids);

    const { data: cfgRows } = await supabaseAdmin
      .from("conversions_config")
      .select("user_id, visible_columns, show_logs")
      .in("user_id", ids);
    const { data: subsRows } = await supabaseAdmin
      .from("client_subscriptions")
      .select("user_id, plan_code, max_landings, max_phones, status, expires_at, grace_days")
      .in("user_id", ids);

    const nombreById = new Map(
      (profiles ?? []).map((p) => [p.id, p.nombre ?? null]),
    );
    const cfgByUserId = new Map(
      (cfgRows ?? []).map((r) => [r.user_id, {
        visible_columns: r.visible_columns ?? [],
        show_logs: r.show_logs ?? true,
      }]),
    );
    const subsByUserId = new Map(
      (subsRows ?? []).map((r) => [r.user_id, r]),
    );

    return new Response(
      JSON.stringify({
        users: clientUsers.map((u) => ({
          id: u.id,
          email: u.email,
          nombre: nombreById.get(u.id) ?? null,
          visible_columns: cfgByUserId.get(u.id)?.visible_columns ?? [],
          show_logs: cfgByUserId.get(u.id)?.show_logs ?? true,
          plan_code: subsByUserId.get(u.id)?.plan_code ?? "starter",
          max_landings: subsByUserId.get(u.id)?.max_landings ?? 2,
          max_phones: subsByUserId.get(u.id)?.max_phones ?? 5,
          plan_status: subsByUserId.get(u.id)?.status ?? "active",
          plan_status_effective: computeEffectivePlanStatus({
            status: subsByUserId.get(u.id)?.status ?? "active",
            expires_at: subsByUserId.get(u.id)?.expires_at ?? null,
            grace_days: subsByUserId.get(u.id)?.grace_days ?? 5,
          }),
          expires_at: subsByUserId.get(u.id)?.expires_at ?? null,
          grace_days: subsByUserId.get(u.id)?.grace_days ?? 5,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        })),
        page,
        perPage,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error: "Error inesperado al listar los clientes.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});

