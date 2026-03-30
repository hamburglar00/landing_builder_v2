import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildMetaRequest, type ConversionRow, type ConversionsConfig } from "../conversions/shared.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron de reintentos: busca purchases con status != 'enviado' y reintenta el envío a Meta CAPI.
 * Invocado por pg_cron o manualmente.
 *
 * POST /functions/v1/retry-failed-conversions
 * Body: { "cron_secret": "..." }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Solo POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Config incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate cron secret
    const body = await req.json().catch(() => ({})) as { cron_secret?: string };
    const cronSecret = body.cron_secret ?? "";
    const envSecret = Deno.env.get("CRON_SECRET") ?? "";

    if (!cronSecret || cronSecret !== envSecret) {
      // Also check DB secret
      const dbCheck = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: row } = await dbCheck
        .from("cron_config")
        .select("value")
        .eq("key", "sync_phones_cron_secret")
        .maybeSingle();
      const dbSecret = row?.value ?? "";
      if (!cronSecret || cronSecret !== dbSecret) {
        return new Response(JSON.stringify({ error: "No autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find purchases that need retry
    const { data: rows, error } = await db
      .from("conversions")
      .select("id, user_id, phone, purchase_event_id, purchase_event_time, valor, event_source_url, email, fn, ln, ct, st, zip, country, fbp, fbc, client_ip, agent_user, external_id, observaciones")
      .eq("estado", "purchase")
      .neq("purchase_status_capi", "enviado")
      .gt("valor", 0)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      return new Response(JSON.stringify({ error: "Error al buscar conversiones" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ success: true, retried: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user to get their configs
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: configs } = await db
      .from("conversions_config")
      .select("*")
      .in("user_id", userIds);

    const configMap = new Map<string, Record<string, unknown>>();
    for (const c of configs ?? []) {
      configMap.set(c.user_id, c);
    }

    let retried = 0;
    let succeeded = 0;

    for (const row of rows) {
      const cfg = configMap.get(row.user_id);
      if (!cfg) continue;

      const accessToken = String(cfg.meta_access_token ?? "");
      const pixelId = String(cfg.pixel_id ?? "");
      const apiVersion = String(cfg.meta_api_version ?? "v25.0");
      const currency = String(cfg.meta_currency ?? "ARS");

      if (!accessToken || !pixelId) continue;

      const amount = parseFloat(row.valor) || 0;
      if (amount <= 0) continue;

      let eventId = String(row.purchase_event_id ?? "").trim();
      if (!eventId) eventId = crypto.randomUUID();
      const eventTime = row.purchase_event_time ?? Math.floor(Date.now() / 1000);

      // Count previous successful purchases to determine repeat
      const { count: prevCount } = await db
        .from("conversions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", row.user_id)
        .eq("phone", row.phone)
        .eq("purchase_status_capi", "enviado")
        .neq("id", row.id);

      const isRepeat = (prevCount ?? 0) > 0;

      const customData: Record<string, unknown> = { currency, value: amount };
      if (isRepeat) customData.purchase_type = "repeat";
      const conversionRow: ConversionRow = {
        landing_id: null,
        user_id: row.user_id,
        landing_name: "",
        phone: row.phone ?? "",
        email: row.email ?? "",
        fn: row.fn ?? "",
        ln: row.ln ?? "",
        ct: row.ct ?? "",
        st: row.st ?? "",
        zip: row.zip ?? "",
        country: row.country ?? "",
        fbp: row.fbp ?? "",
        fbc: row.fbc ?? "",
        contact_event_id: "",
        contact_event_time: null,
        contact_payload_raw: "",
        lead_event_id: "",
        lead_event_time: null,
        lead_payload_raw: "",
        purchase_event_id: eventId,
        purchase_event_time: eventTime,
        purchase_payload_raw: "",
        client_ip: row.client_ip ?? "",
        agent_user: row.agent_user ?? "",
        device_type: "",
        event_source_url: row.event_source_url ?? "",
        estado: "purchase",
        valor: amount,
        contact_status_capi: "",
        lead_status_capi: "",
        purchase_status_capi: "",
        observaciones: row.observaciones ?? "",
        external_id: row.external_id ?? "",
        utm_campaign: "",
        telefono_asignado: "",
        promo_code: "",
        geo_city: "",
        geo_region: "",
        geo_country: "",
      };

      const cfgObj: ConversionsConfig = {
        user_id: row.user_id,
        pixel_id: pixelId,
        meta_access_token: accessToken,
        meta_currency: currency,
        meta_api_version: apiVersion,
        send_contact_capi: false,
        geo_use_ipapi: false,
        geo_fill_only_when_missing: false,
      };

      const metaReq = await buildMetaRequest(
        cfgObj,
        conversionRow,
        "Purchase",
        eventId,
        eventTime,
        customData,
      );

      retried++;

      try {
        const res = await fetch(metaReq.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metaReq.body),
        });

        const successMsg = isRepeat ? "✅ PURCHASE REPEAT OK" : "✅ PURCHASE OK";

        if (res.status === 200) {
          const obs = appendObs(row.observaciones ?? "", successMsg);
          await db.from("conversions").update({
            purchase_status_capi: "enviado",
            purchase_event_id: eventId,
            purchase_event_time: eventTime,
            observaciones: obs,
          }).eq("id", row.id);
          succeeded++;
        } else {
          const obs = appendObs(row.observaciones ?? "", "ERROR PURCHASE");
          await db.from("conversions").update({
            purchase_status_capi: "error",
            purchase_event_id: eventId,
            purchase_event_time: eventTime,
            observaciones: obs,
          }).eq("id", row.id);
        }
      } catch {
        const obs = appendObs(row.observaciones ?? "", "ERROR PURCHASE");
        await db.from("conversions").update({
          purchase_status_capi: "error",
          observaciones: obs,
        }).eq("id", row.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, retried, succeeded }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("retry-failed-conversions error:", err);
    return new Response(JSON.stringify({ error: "Error inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function appendObs(current: string, token: string): string {
  const clean = token.trim();
  if (!clean) return current;
  const cur = current.trim();
  if (!cur) return clean;
  const parts = cur.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.includes(clean)) return cur;
  parts.push(clean);
  return parts.join(" | ");
}
