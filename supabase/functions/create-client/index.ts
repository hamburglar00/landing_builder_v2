import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CreateClientPayload = {
  email?: string;
  password?: string;
  nombre?: string;
};

type PlanCode = "starter" | "plus" | "pro" | "premium" | "scale";

function isValidClientName(value: string): boolean {
  return /^[a-z0-9]+$/i.test(value);
}

function getPlanDefaults(planCode: PlanCode): { maxLandings: number; maxPhones: number } {
  switch (planCode) {
    case "plus":
      return { maxLandings: 4, maxPhones: 10 };
    case "pro":
      return { maxLandings: 8, maxPhones: 20 };
    case "premium":
      return { maxLandings: 12, maxPhones: 50 };
    case "scale":
      return { maxLandings: 999, maxPhones: 999 };
    case "starter":
    default:
      return { maxLandings: 2, maxPhones: 5 };
  }
}

const FALLBACK_VISIBLE_COLUMNS = [
  "phone",
  "email",
  "fn",
  "ln",
  "ct",
  "st",
  "zip",
  "country",
  "fbp",
  "fbc",
  "meta_pixel_id",
  "contact_event_id",
  "contact_event_time",
  "sendContactPixel",
  "contact_payload_raw",
  "lead_event_id",
  "lead_event_time",
  "lead_payload_raw",
  "purchase_event_id",
  "purchase_event_time",
  "purchase_payload_raw",
  "timestamp",
  "clientIP",
  "agentuser",
  "estado",
  "valor",
  "purchase_type",
  "contact_status_capi",
  "lead_status_capi",
  "purchase_status_capi",
  "observaciones",
  "external_id",
  "utm_campaign",
  "telefono_asignado",
  "promo_code",
  "device_type",
  "geo_city",
  "geo_region",
  "geo_country",
];

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

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError || !created.user) {
      return new Response(
        JSON.stringify({
          error:
            createError?.message ??
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

    await supabaseAdmin
      .from("profiles")
      .update({ nombre })
      .eq("id", created.user.id);

    const { data: adminCfg } = await supabaseAdmin
      .from("conversions_config")
      .select("visible_columns, funnel_premium_threshold")
      .eq("user_id", user.id)
      .maybeSingle();

    const inheritedVisibleColumns = Array.isArray(adminCfg?.visible_columns) &&
        adminCfg.visible_columns.length > 0
      ? adminCfg.visible_columns
      : FALLBACK_VISIBLE_COLUMNS;

    const premiumThreshold = Number(adminCfg?.funnel_premium_threshold);

    const { error: cfgError } = await supabaseAdmin
      .from("conversions_config")
      .upsert(
        {
          user_id: created.user.id,
          visible_columns: inheritedVisibleColumns,
          funnel_premium_threshold: Number.isFinite(premiumThreshold)
            ? premiumThreshold
            : 50000,
          show_logs: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (cfgError) {
      console.error("Error inicializando conversions_config para cliente:", cfgError);
    }

    const defaults = getPlanDefaults("starter");
    const { error: subError } = await supabaseAdmin
      .from("client_subscriptions")
      .upsert(
        {
          user_id: created.user.id,
          plan_code: "starter",
          max_landings: defaults.maxLandings,
          max_phones: defaults.maxPhones,
          status: "active",
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          grace_days: 5,
        },
        { onConflict: "user_id" },
      );

    if (subError) {
      console.error("Error inicializando client_subscriptions para cliente:", subError);
    }

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

