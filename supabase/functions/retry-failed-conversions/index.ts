import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildMetaRequest, type ConversionRow, type ConversionsConfig } from "../conversions/shared.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const BACKFILL_WINDOW_BEFORE_SECONDS = 90;
const BACKFILL_WINDOW_AFTER_SECONDS = 30;

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
      .select("id, user_id, phone, pixel_id, purchase_event_id, purchase_event_time, valor, event_source_url, email, fn, ln, ct, st, zip, country, fbp, fbc, client_ip, agent_user, external_id, observaciones")
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

    // Group by user to get their legacy and per-pixel configs
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: configs } = await db
      .from("conversions_config")
      .select("*")
      .in("user_id", userIds);
    const { data: pixelConfigs } = await db
      .from("conversions_pixel_configs")
      .select("user_id, pixel_id, meta_access_token, meta_currency, meta_api_version, is_default")
      .in("user_id", userIds);

    const configMap = new Map<string, Record<string, unknown>>();
    for (const c of configs ?? []) {
      configMap.set(c.user_id, c);
    }
    const pixelConfigMap = new Map<string, Array<Record<string, unknown>>>();
    for (const pc of pixelConfigs ?? []) {
      const list = pixelConfigMap.get(String(pc.user_id)) ?? [];
      list.push(pc as Record<string, unknown>);
      pixelConfigMap.set(String(pc.user_id), list);
    }

    let retried = 0;
    let succeeded = 0;

    for (const row of rows) {
      const cfg = configMap.get(row.user_id);
      if (!cfg) continue;

      const rowPixel = String(row.pixel_id ?? "").trim();
      const userPixelConfigs = pixelConfigMap.get(String(row.user_id)) ?? [];
      const matchedPixelCfg = rowPixel
        ? userPixelConfigs.find((pc) => String(pc.pixel_id ?? "").trim() === rowPixel)
        : null;
      const defaultPixelCfg = userPixelConfigs.find((pc) => Boolean(pc.is_default));
      const selected = matchedPixelCfg ?? defaultPixelCfg ?? null;

      const accessToken = selected
        ? String(selected.meta_access_token ?? "")
        : String(cfg.meta_access_token ?? "");
      const pixelId = selected
        ? String(selected.pixel_id ?? "")
        : String(cfg.pixel_id ?? "");
      const apiVersion = selected
        ? String(selected.meta_api_version ?? "v25.0")
        : String(cfg.meta_api_version ?? "v25.0");
      const currency = selected
        ? String(selected.meta_currency ?? "ARS")
        : String(cfg.meta_currency ?? "ARS");

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
        pixel_id: row.pixel_id ?? "",
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

    // Deferred LEAD replay (without promo_code): process after 1h.
    let deferredLeadsPicked = 0;
    let deferredLeadsProcessed = 0;
    let deferredLeadsFailed = 0;

    const cutoffIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: deferredRows } = await db
      .from("conversion_inbox")
      .select("id, user_id, landing_name, payload_raw, created_at")
      .eq("status", "received")
      .eq("action", "LEAD")
      .lte("created_at", cutoffIso)
      .order("created_at", { ascending: true })
      .limit(50);

    const deferred = (deferredRows ?? []) as DeferredLeadInboxRow[];
    if (deferred.length > 0) {
      deferredLeadsPicked = deferred.length;
      const userIdsForDeferred = [...new Set(deferred.map((r) => r.user_id))];
      const { data: profiles } = await db
        .from("profiles")
        .select("id, nombre")
        .in("id", userIdsForDeferred);
      const profileNameByUserId = new Map<string, string>();
      for (const p of profiles ?? []) {
        profileNameByUserId.set(String(p.id), String(p.nombre ?? "").trim());
      }

      for (const row of deferred) {
        const clientName = profileNameByUserId.get(String(row.user_id)) ?? "";
        if (!clientName) {
          await db
            .from("conversion_inbox")
            .update({
              status: "error",
              http_status: 500,
              response_body: "Deferred LEAD retry error: client name not found",
              processed_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          deferredLeadsFailed++;
          continue;
        }

        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(row.payload_raw || "{}") as Record<string, unknown>;
        } catch {
          payload = {};
        }
        payload.__deferred_retry = true;
        payload.__inbox_id = row.id;
        payload.action = "LEAD";

        const replayUrl = `${supabaseUrl}/functions/v1/conversions?name=${encodeURIComponent(clientName)}`;
        try {
          const replayRes = await fetch(replayUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (replayRes.status >= 200 && replayRes.status < 400) {
            deferredLeadsProcessed++;
          } else {
            deferredLeadsFailed++;
          }
        } catch {
          deferredLeadsFailed++;
        }
      }
    }

    // Lead backfill reconciliation for rows previously created as `match_source:created_new`.
    let leadBackfillChecked = 0;
    let leadBackfillMerged = 0;
    let leadBackfillAmbiguous = 0;

    const { data: createdNewLeads } = await db
      .from("conversions")
      .select("id, user_id, phone, email, cuit_cuil, fn, ln, ct, st, zip, country, geo_city, geo_region, geo_country, lead_event_id, lead_event_time, lead_payload_raw, observaciones, created_at")
      .eq("estado", "lead")
      .ilike("observaciones", "%match_source:created_new%")
      .or("promo_code.is.null,promo_code.eq.")
      .order("created_at", { ascending: true })
      .limit(200);

    for (const lead of createdNewLeads ?? []) {
      leadBackfillChecked++;
      const payload = parseJsonObject(String(lead.lead_payload_raw ?? ""));
      const botPhone = sanitizePhone(
        typeof payload.bot_phone === "string" ? payload.bot_phone : "",
      );
      const leadTs = toEpochSeconds(payload.timestamp)
        ?? toEpochFromIso(payload.dateTime)
        ?? toEpochFromIso(payload.datetime)
        ?? Math.floor(new Date(String(lead.created_at ?? new Date().toISOString())).getTime() / 1000);
      if (!botPhone || !leadTs) continue;

      const fromIso = new Date((leadTs - BACKFILL_WINDOW_BEFORE_SECONDS) * 1000).toISOString();
      const toIso = new Date((leadTs + BACKFILL_WINDOW_AFTER_SECONDS) * 1000).toISOString();
      const { data: contacts } = await db
        .from("conversions")
        .select("id, phone, email, cuit_cuil, fn, ln, ct, st, zip, country, geo_city, geo_region, geo_country, observaciones")
        .eq("user_id", lead.user_id)
        .eq("estado", "contact")
        .eq("telefono_asignado", botPhone)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .limit(5);

      const candidates = contacts ?? [];
      if (candidates.length !== 1) {
        if (candidates.length > 1) leadBackfillAmbiguous++;
        continue;
      }

      const target = candidates[0];
      const updates: Record<string, unknown> = {
        estado: "lead",
        lead_event_id: lead.lead_event_id ?? "",
        lead_event_time: lead.lead_event_time ?? null,
        lead_payload_raw: lead.lead_payload_raw ?? "",
        observaciones: appendObs(String(target.observaciones ?? ""), "match_source:bot_phone_timestamp_backfill"),
      };
      if (!target.phone && lead.phone) updates.phone = lead.phone;
      if (!target.email && lead.email) updates.email = lead.email;
      if (!target.cuit_cuil && lead.cuit_cuil) updates.cuit_cuil = lead.cuit_cuil;
      if (!target.fn && lead.fn) updates.fn = lead.fn;
      if (!target.ln && lead.ln) updates.ln = lead.ln;
      if (!target.ct && lead.ct) updates.ct = lead.ct;
      if (!target.st && lead.st) updates.st = lead.st;
      if (!target.zip && lead.zip) updates.zip = lead.zip;
      if (!target.country && lead.country) updates.country = lead.country;
      if (!target.geo_city && lead.geo_city) updates.geo_city = lead.geo_city;
      if (!target.geo_region && lead.geo_region) updates.geo_region = lead.geo_region;
      if (!target.geo_country && lead.geo_country) updates.geo_country = lead.geo_country;
      await db.from("conversions").update(updates).eq("id", target.id);

      await db
        .from("conversions")
        .update({
          estado: "lead_backfill_merged",
          observaciones: appendObs(String(lead.observaciones ?? ""), `backfill_merged_into:${target.id}`),
        })
        .eq("id", lead.id);
      leadBackfillMerged++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        retried,
        succeeded,
        deferred_leads_picked: deferredLeadsPicked,
        deferred_leads_processed: deferredLeadsProcessed,
        deferred_leads_failed: deferredLeadsFailed,
        lead_backfill_checked: leadBackfillChecked,
        lead_backfill_merged: leadBackfillMerged,
        lead_backfill_ambiguous: leadBackfillAmbiguous,
      }),
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

type DeferredLeadInboxRow = {
  id: string;
  user_id: string;
  landing_name: string;
  payload_raw: string;
  created_at: string;
};

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}");
    if (value && typeof value === "object") return value as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function sanitizePhone(input: string | null | undefined): string {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("54") ? digits : `54${digits}`;
}

function toEpochSeconds(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n > 1_000_000_000_000 ? n / 1000 : n);
}

function toEpochFromIso(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.floor(ms / 1000);
}
