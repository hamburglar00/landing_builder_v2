import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type UpdateClientPayload = {
  userId?: string;
  email?: string;
  password?: string;
  nombre?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST" && req.method !== "PATCH") {
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
          error: "Solo un administrador puede editar clientes.",
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

    const payload = (await req.json()) as UpdateClientPayload;
    const userId = payload.userId;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Falta el identificador del usuario." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const attributes: { email?: string; password?: string } = {};

    if (payload.email) {
      attributes.email = payload.email.trim().toLowerCase();
    }

    if (payload.password) {
      attributes.password = payload.password;
    }

    const nombre =
      payload.nombre !== undefined ? (payload.nombre?.trim() || null) : undefined;

    if (nombre !== undefined && !nombre) {
      return new Response(
        JSON.stringify({
          error: "Nombre no puede quedar vacío. Es obligatorio para el endpoint de conversiones.",
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

    if (
      !attributes.email &&
      !attributes.password &&
      nombre === undefined
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Debes enviar al menos email, password o nombre para actualizar.",
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

    if (attributes.email || attributes.password) {
      const { data: updated, error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(userId, attributes);

      if (updateError || !updated.user) {
        return new Response(
          JSON.stringify({
            error:
              updateError?.message ??
              "No se pudo actualizar el usuario cliente en Supabase Auth.",
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
    }

    if (nombre !== undefined) {
      await supabaseAdmin
        .from("profiles")
        .update({ nombre })
        .eq("id", userId);
    }

    const { data: updatedUser } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("nombre")
      .eq("id", userId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        id: userId,
        email: updatedUser?.user?.email ?? null,
        nombre: profileRow?.nombre ?? null,
        updated_at: updatedUser?.user?.updated_at ?? null,
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
        error: "Error inesperado al actualizar el cliente.",
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

