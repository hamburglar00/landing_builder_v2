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

    const nombreById = new Map(
      (profiles ?? []).map((p) => [p.id, p.nombre ?? null]),
    );

    return new Response(
      JSON.stringify({
        users: clientUsers.map((u) => ({
          id: u.id,
          email: u.email,
          nombre: nombreById.get(u.id) ?? null,
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

