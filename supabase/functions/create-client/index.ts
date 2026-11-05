import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { initializeClientDefaults } from "../_shared/initialize-client.ts";
import { parseModuleVisibility } from "../_shared/client-module-permissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CreateClientPayload = {
  email?: string;
  password?: string;
  nombre?: string;
  visibleColumns?: string[];
  showLogs?: boolean;
  showAiAssistant?: boolean;
  showPromotions?: boolean;
  moduleVisibility?: unknown;
};

function isValidClientName(value: string): boolean {
  return /^[a-z0-9]+$/i.test(value);
}

async function cleanupSignupApproval(
  supabaseAdmin: SupabaseClient,
  email: string,
) {
  const { error } = await supabaseAdmin
    .from("auth_signup_approvals")
    .delete()
    .eq("email", email);

  if (error) {
    console.error("Error limpiando aprobacion temporal de alta:", error);
  }
}

async function rollbackCreatedUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("Error revirtiendo usuario creado parcialmente:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no permitido" }), {
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
          error: "Solo un administrador puede crear clientes.",
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

    let payload: CreateClientPayload;
    try {
      payload = (await req.json()) as CreateClientPayload;
    } catch {
      return new Response(
        JSON.stringify({ error: "Cuerpo de la peticion invalido (JSON)." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;
    const nombreRaw = payload.nombre?.trim() || null;
    const nombre = nombreRaw ? nombreRaw.toLowerCase() : null;
    try {
      parseModuleVisibility(payload.moduleVisibility);
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !password) {
      return new Response(
        JSON.stringify({
          error: "Email y password son obligatorios.",
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

    if (!nombre) {
      return new Response(
        JSON.stringify({
          error:
            "Nombre es obligatorio. Se usa como identificador para el endpoint de conversiones.",
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

    if (!isValidClientName(nombre)) {
      return new Response(
        JSON.stringify({
          error:
            "Nombre invalido. Solo letras y numeros, sin espacios ni caracteres especiales.",
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

    const approvedUserId = crypto.randomUUID();

    const { error: approvalError } = await supabaseAdmin
      .from("auth_signup_approvals")
      .upsert(
        {
          email,
          user_id: approvedUserId,
          requested_by: user.id,
          role: "client",
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        },
        { onConflict: "email" },
      );

    if (approvalError) {
      console.error(
        "Error creando aprobacion temporal de alta:",
        approvalError,
      );
      return new Response(
        JSON.stringify({
          error: "No se pudo autorizar temporalmente el alta del cliente.",
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

    const { data: created, error: createError } = await supabaseAdmin.auth.admin
      .createUser({
        id: approvedUserId,
        email,
        password,
        email_confirm: true,
        app_metadata: {
          panelbot_admin_created: true,
          panelbot_created_by: user.id,
          panelbot_role: "client",
        },
      });

    if (createError || !created.user) {
      await cleanupSignupApproval(supabaseAdmin, email);
      return new Response(
        JSON.stringify({
          error: createError?.message ??
            "No se pudo crear el usuario cliente en Supabase Auth.",
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

    const { error: profileWriteError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: created.user.id,
          role: "client",
          nombre,
        },
        { onConflict: "id" },
      );

    if (profileWriteError) {
      console.error(
        "Error inicializando profile para cliente:",
        profileWriteError,
      );
      await cleanupSignupApproval(supabaseAdmin, email);
      await rollbackCreatedUser(supabaseAdmin, created.user.id);
      return new Response(
        JSON.stringify({
          error: "No se pudo inicializar el perfil del cliente.",
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

    try {
      await initializeClientDefaults(supabaseAdmin, created.user.id, user.id, payload);
    } catch {
      await cleanupSignupApproval(supabaseAdmin, email);
      await rollbackCreatedUser(supabaseAdmin, created.user.id);
      return new Response(JSON.stringify({ error: "No se pudo inicializar la cuenta del cliente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await cleanupSignupApproval(supabaseAdmin, email);

    return new Response(
      JSON.stringify({
        id: created.user.id,
        email: created.user.email,
        nombre,
        created_at: created.user.created_at,
      }),
      {
        status: 201,
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
        error: "Error inesperado al crear el cliente.",
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
