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
  visibleColumns?: string[] | null;
  showLogs?: boolean;
  planCode?: "starter" | "plus" | "pro" | "premium" | "scale";
  maxLandings?: number;
  maxPhones?: number;
  planStatus?: "active" | "paused" | "expired";
  expiresAt?: string | null;
  graceDays?: number;
};

function getPlanDefaults(planCode: "starter" | "plus" | "pro" | "premium" | "scale"): {
  maxLandings: number;
  maxPhones: number;
} {
  switch (planCode) {
    case "plus":
      return { maxLandings: 4, maxPhones: 5 };
    case "pro":
      return { maxLandings: 8, maxPhones: 10 };
    case "premium":
      return { maxLandings: 12, maxPhones: 20 };
    case "scale":
      return { maxLandings: 999, maxPhones: 999 };
    case "starter":
    default:
      return { maxLandings: 2, maxPhones: 2 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST" && req.method !== "PATCH") {
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

    const visibleColumns =
      payload.visibleColumns === undefined ? undefined : (payload.visibleColumns ?? []);
    const showLogs = payload.showLogs === undefined ? undefined : Boolean(payload.showLogs);
    const planCode = payload.planCode;
    const maxLandings = Number.isFinite(Number(payload.maxLandings))
      ? Number(payload.maxLandings)
      : undefined;
    const maxPhones = Number.isFinite(Number(payload.maxPhones))
      ? Number(payload.maxPhones)
      : undefined;
    const planStatus = payload.planStatus;
    const expiresAt = payload.expiresAt === undefined ? undefined : payload.expiresAt;
    const graceDays = Number.isFinite(Number(payload.graceDays))
      ? Number(payload.graceDays)
      : undefined;

    if (
      !attributes.email &&
      !attributes.password &&
      visibleColumns === undefined &&
      showLogs === undefined &&
      planCode === undefined &&
      maxLandings === undefined &&
      maxPhones === undefined &&
      planStatus === undefined &&
      expiresAt === undefined &&
      graceDays === undefined
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Debes enviar al menos email, password o configuracion para actualizar.",
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

    if (visibleColumns !== undefined || showLogs !== undefined) {
      const upsertPayload: Record<string, unknown> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
      };
      if (visibleColumns !== undefined) upsertPayload.visible_columns = visibleColumns;
      if (showLogs !== undefined) upsertPayload.show_logs = showLogs;

      const { error: cfgError } = await supabaseAdmin
        .from("conversions_config")
        .upsert(upsertPayload, { onConflict: "user_id" });

      if (cfgError) {
        return new Response(
          JSON.stringify({ error: cfgError.message || "No se pudo actualizar conversions_config." }),
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

    if (
      planCode !== undefined ||
      maxLandings !== undefined ||
      maxPhones !== undefined ||
      planStatus !== undefined ||
      expiresAt !== undefined ||
      graceDays !== undefined
    ) {
      const defaults = planCode ? getPlanDefaults(planCode) : null;
      const payloadSub: Record<string, unknown> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
      };
      if (planCode !== undefined) payloadSub.plan_code = planCode;
      if (maxLandings !== undefined) payloadSub.max_landings = maxLandings;
      else if (defaults) payloadSub.max_landings = defaults.maxLandings;
      if (maxPhones !== undefined) payloadSub.max_phones = maxPhones;
      else if (defaults) payloadSub.max_phones = defaults.maxPhones;
      if (planStatus !== undefined) payloadSub.status = planStatus;
      if (graceDays !== undefined) payloadSub.grace_days = graceDays;
      if (expiresAt !== undefined) {
        payloadSub.expires_at = expiresAt === null || expiresAt === ""
          ? null
          : new Date(expiresAt).toISOString();
      }

      const { error: subError } = await supabaseAdmin
        .from("client_subscriptions")
        .upsert(payloadSub, { onConflict: "user_id" });

      if (subError) {
        return new Response(
          JSON.stringify({ error: subError.message || "No se pudo actualizar el plan del cliente." }),
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

    const { data: updatedUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("nombre")
      .eq("id", userId)
      .maybeSingle();
    const { data: subRow } = await supabaseAdmin
      .from("client_subscriptions")
      .select("plan_code, max_landings, max_phones, status, expires_at, grace_days")
      .eq("user_id", userId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        id: userId,
        email: updatedUser?.user?.email ?? null,
        nombre: profileRow?.nombre ?? null,
        plan_code: subRow?.plan_code ?? "starter",
        max_landings: subRow?.max_landings ?? 2,
        max_phones: subRow?.max_phones ?? 2,
        plan_status: subRow?.status ?? "active",
        expires_at: subRow?.expires_at ?? null,
        grace_days: subRow?.grace_days ?? 5,
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
