import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PhoneKind = "carga" | "ads" | "mkt";

type ExternalResponse = {
  code?: string;
  error?: string;
  load?: {
    whatsapp?: string[];
    telegram?: string[];
  };
  ads?: {
    whatsapp?: string[];
  };
  mkt?: {
    whatsapp?: string[];
  };
  whatsapp?: string[]; // legacy: carga (por un tiempo; luego solo load.whatsapp)
  telegram?: string[];
};

const normalizeAndValidateArPhone = (
  raw: string | null | undefined,
): string | null => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  // Formato esperado para móvil AR internacional: 549 + 10 dígitos locales = 13
  if (!digits.startsWith("549")) return null;
  if (digits.length !== 13) return null;
  return digits;
};

/**
 * Sincroniza los teléfonos de TODAS las gerencias del usuario autenticado
 * llamando a la API externa api.asesadmin.com y actualizando la tabla
 * public.gerencia_phones:
 *
 * - Inserta teléfonos nuevos (status=active, kind=ads|carga, usage_count=0).
 * - Actualiza tipo y status=active de los existentes que sigan llegando.
 * - Marca como inactive los teléfonos de la gerencia que NO vinieron en la última llamada.
 *
 * Uso: POST /functions/v1/sync-phones
 * Requiere Authorization: Bearer <JWT de Supabase>.
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
    const externalBaseUrl =
      Deno.env.get("ASESADMIN_BASE_URL") ?? "https://api.asesadmin.com";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error:
            "Faltan variables de entorno SUPABASE_URL o SERVICE_ROLE_KEY.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => null)) as
      | {
          user_id?: string | null;
          gerencia_id?: number | null;
          cron_secret?: string | null;
        }
      | null;
    const userId = body?.user_id ?? null;
    const singleGerenciaId = body?.gerencia_id ?? null;
    const cronSecret = body?.cron_secret ?? null;

    let isCronMode = false;
    if (cronSecret != null && cronSecret.length > 0) {
      const envSecret = Deno.env.get("CRON_SECRET");
      if (envSecret != null && envSecret.length > 0 && cronSecret === envSecret) {
        isCronMode = true;
      } else {
        const { data: row } = await supabaseAdmin
          .from("cron_config")
          .select("value")
          .eq("key", "sync_phones_cron_secret")
          .maybeSingle();
        const dbSecret = row?.value ?? null;
        if (dbSecret != null && dbSecret.length > 0 && cronSecret === dbSecret) {
          isCronMode = true;
        }
      }
    }

    if (!isCronMode && !userId) {
      return new Response(
        JSON.stringify({ error: "Falta user_id en el cuerpo de la petición." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1) Obtener gerencias: cron = todas; si no, del usuario (o solo la indicada)
    let query = supabaseAdmin
      .from("gerencias")
      .select("id, user_id, gerencia_id, source_type")
      .eq("source_type", "pbadmin");
    if (!isCronMode) {
      query = query.eq("user_id", userId!);
      if (singleGerenciaId != null) {
        query = query.eq("id", singleGerenciaId);
      }
    }
    const { data: gerencias, error: gerenciasError } = await query;

    if (gerenciasError) {
      return new Response(
        JSON.stringify({
          error: "Error al obtener las gerencias del usuario.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let gerenciaRows = gerencias ?? [];
    if (
      !isCronMode &&
      singleGerenciaId != null &&
      gerenciaRows.length === 0
    ) {
      return new Response(
        JSON.stringify({
          error: "La gerencia indicada no existe o no pertenece al usuario.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!gerenciaRows.length) {
      return new Response(
        JSON.stringify({
          success: true,
          processed_gerencias: 0,
          total_active_phones: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let processedGerencias = 0;
    let totalActivePhones = 0;
    const touchedUserIds = new Set<string>();

    for (const g of gerenciaRows) {
      if (g.user_id) touchedUserIds.add(g.user_id);
      const externalId = g.gerencia_id;
      if (externalId == null) continue;

      const url = `${externalBaseUrl}/api/v1/agency/${externalId}/random-contact`;

      let json: ExternalResponse | null = null;
      try {
        const res = await fetch(url);
        const raw = await res.text();
        let parsed: ExternalResponse | null = null;
        try {
          parsed = raw ? (JSON.parse(raw) as ExternalResponse) : null;
        } catch {
          parsed = null;
        }

        const noManagersFound = parsed?.code === "no_managers_found";
        // Flexible behavior:
        // - If we can parse a payload, we process it as "current snapshot" even on non-2xx.
        // - If there are no phones in that snapshot, phones for this gerencia are set inactive.
        // - Only skip when response is non-2xx and body is not parseable.
        if (!res.ok && !parsed && !noManagersFound) {
          console.error(
            `Error ${res.status} al llamar API externa para gerencia ${g.id}`,
          );
          continue;
        }

        // no_managers_found se trata como sync valida con 0 telefonos activos.
        json = noManagersFound ? ({ load: { whatsapp: [] }, ads: { whatsapp: [] }, mkt: { whatsapp: [] } } as ExternalResponse) : parsed;
      } catch (e) {
        console.error("Error llamando API externa:", e);
        continue;
      }

      if (!json) continue;

      const cargaWhatsapps = json.load?.whatsapp ?? json.whatsapp ?? [];
      const adsWhatsapps = json.ads?.whatsapp ?? [];
      const mktWhatsapps = json.mkt?.whatsapp ?? [];

      const phoneKindMap = new Map<string, PhoneKind>();

      for (const phone of cargaWhatsapps) {
        const normalized = normalizeAndValidateArPhone(phone);
        if (!normalized) continue;
        phoneKindMap.set(normalized, "carga");
      }
      for (const phone of adsWhatsapps) {
        const normalized = normalizeAndValidateArPhone(phone);
        if (!normalized) continue;
        phoneKindMap.set(normalized, "ads");
      }
      for (const phone of mktWhatsapps) {
        const normalized = normalizeAndValidateArPhone(phone);
        if (!normalized) continue;
        phoneKindMap.set(normalized, "mkt");
      }

      const entries = Array.from(phoneKindMap.entries());
      const nowIso = new Date().toISOString();

      const activeRows = entries.map(([phone, kind]) => ({
        gerencia_id: g.id,
        phone,
        kind,
        status: "active",
        last_seen_at: nowIso,
      }));

      // 2) Upsert de teléfonos activos (inserta nuevos y actualiza tipo/status/last_seen_at)
      if (activeRows.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from("gerencia_phones")
          .upsert(activeRows, {
            onConflict: "gerencia_id,phone",
          });

        if (upsertError) {
          console.error(
            "Error al hacer upsert de gerencia_phones:",
            upsertError,
          );
          continue;
        }

        totalActivePhones += activeRows.length;

        // 3) Marcar como inactivos los que no vinieron en esta llamada.
        // Supabase .not('col', 'in', ...) espera un string del tipo '(a,b,c)'.
        const phoneList = entries.map(([phone]) => String(phone).trim());
        const inList =
          phoneList.length > 0
            ? `(${phoneList.map((p) => `"${p.replace(/"/g, '""')}"`).join(",")})`
            : "()";
        const { error: inactivateError } = await supabaseAdmin
          .from("gerencia_phones")
          .update({ status: "inactive", last_seen_at: nowIso })
          .eq("gerencia_id", g.id)
          .not("phone", "in", inList);

        if (inactivateError) {
          console.error(
            "Error al marcar teléfonos inactivos en gerencia_phones:",
            inactivateError,
          );
        }
      } else {
        // Si no hay teléfonos activos desde la API, marcamos todos como inactivos
        const { error: inactivateAllError } = await supabaseAdmin
          .from("gerencia_phones")
          .update({ status: "inactive", last_seen_at: nowIso })
          .eq("gerencia_id", g.id);

        if (inactivateAllError) {
          console.error(
            "Error al marcar todos los teléfonos inactivos en gerencia_phones:",
            inactivateAllError,
          );
        }
      }

      processedGerencias += 1;
    }

    // Respetar limite de telefonos activos por plan de cada cliente.
    const capResultsByUser = new Map<
      string,
      { attempted: number; allowed: number; deactivated: number }
    >();

    for (const uid of touchedUserIds) {
      const { data: sub } = await supabaseAdmin
        .from("client_subscriptions")
        .select("max_phones")
        .eq("user_id", uid)
        .maybeSingle();
      const maxPhones = Number(sub?.max_phones ?? 0);
      if (!Number.isFinite(maxPhones) || maxPhones <= 0) continue;

      const { data: activeRows } = await supabaseAdmin
        .from("gerencia_phones")
        .select("id")
        .eq("status", "active")
        .in(
          "gerencia_id",
          (
            await supabaseAdmin
              .from("gerencias")
              .select("id")
              .eq("user_id", uid)
          ).data?.map((x) => x.id) ?? [],
        )
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      const rows = activeRows ?? [];
      let deactivated = 0;
      if (rows.length > maxPhones) {
        const overflowIds = rows.slice(maxPhones).map((r) => r.id);
        if (overflowIds.length > 0) {
          await supabaseAdmin
            .from("gerencia_phones")
            .update({ status: "inactive" })
            .in("id", overflowIds);
          deactivated = overflowIds.length;
        }
      }

      capResultsByUser.set(uid, {
        attempted: rows.length,
        allowed: maxPhones,
        deactivated,
      });
    }

    const capResultForRequester = userId ? capResultsByUser.get(userId) : null;

    return new Response(
      JSON.stringify({
        success: true,
        processed_gerencias: processedGerencias,
        total_active_phones: totalActivePhones,
        plan_cap: capResultForRequester
          ? {
              attempted_active: capResultForRequester.attempted,
              allowed_active: capResultForRequester.allowed,
              deactivated_by_cap: capResultForRequester.deactivated,
              capped: capResultForRequester.deactivated > 0,
            }
          : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error inesperado al sincronizar teléfonos." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
