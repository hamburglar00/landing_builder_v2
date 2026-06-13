import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildMetaRequest, type ConversionRow, type ConversionsConfig } from "../conversions/shared.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const BACKFILL_WINDOW_BEFORE_SECONDS = 90;
const BACKFILL_WINDOW_AFTER_SECONDS = 30;
const DUPLICATE_LEAD_LOG_BACKFILL_LIMIT = 75;
const META_CAPI_MAX_EVENT_AGE_SECONDS = 7 * 24 * 60 * 60;
const MAX_CONTACT_LEAD_CAPI_RETRIES = 6;
const MIN_CONTACT_LEAD_RETRY_INTERVAL_MS = 5 * 60 * 1000;
const CONTACT_LEAD_CAPI_RETRY_SELECT = `
  id, landing_id, user_id, landing_name,
  phone, email, fn, ln, ct, st, zip, country,
  fbp, fbc, pixel_id,
  contact_event_id, contact_event_time, contact_payload_raw,
  lead_event_id, lead_event_time, lead_payload_raw,
  purchase_event_id, purchase_event_time, purchase_payload_raw,
  client_ip, agent_user, device_type, event_source_url,
  estado, valor,
  contact_status_capi, lead_status_capi, purchase_status_capi,
  observaciones,
  external_id, utm_campaign, telefono_asignado, promo_code,
  geo_city, geo_region, geo_country,
  contact_capi_retry_count, lead_capi_retry_count,
  contact_capi_last_retry_at, lead_capi_last_retry_at
`.replace(/\s+/g, " ").trim();

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

    const { data: contactRetryRowsData, error: contactRetryError } = await db
      .from("conversions")
      .select(CONTACT_LEAD_CAPI_RETRY_SELECT)
      .eq("contact_capi_retryable", true)
      .eq("contact_status_capi", "error")
      .lt("contact_capi_retry_count", MAX_CONTACT_LEAD_CAPI_RETRIES)
      .order("created_at", { ascending: true })
      .limit(100);

    if (contactRetryError) {
      return new Response(JSON.stringify({ error: "Error al buscar Contact CAPI retry" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: leadRetryRowsData, error: leadRetryError } = await db
      .from("conversions")
      .select(CONTACT_LEAD_CAPI_RETRY_SELECT)
      .eq("lead_capi_retryable", true)
      .eq("lead_status_capi", "error")
      .lt("lead_capi_retry_count", MAX_CONTACT_LEAD_CAPI_RETRIES)
      .order("created_at", { ascending: true })
      .limit(100);

    if (leadRetryError) {
      return new Response(JSON.stringify({ error: "Error al buscar Lead CAPI retry" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contactRetryRows = (contactRetryRowsData ?? []) as unknown as CapiRetryRow[];
    const leadRetryRows = (leadRetryRowsData ?? []) as unknown as CapiRetryRow[];

    // Find purchases that need retry
    const { data: rows, error } = await db
      .from("conversions")
      .select("id, user_id, phone, pixel_id, purchase_event_id, purchase_event_time, valor, event_source_url, email, fn, ln, ct, st, zip, country, fbp, fbc, client_ip, agent_user, external_id, observaciones")
      .eq("estado", "purchase")
      .not("purchase_status_capi", "in", "(enviado,skipped_old_event_time)")
      .gt("valor", 0)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      return new Response(JSON.stringify({ error: "Error al buscar conversiones" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const purchaseRows = rows ?? [];

    // Group by user to get their legacy and per-pixel configs
    const userIds = [...new Set([
      ...purchaseRows.map((r) => String(r.user_id)),
      ...contactRetryRows.map((r) => String(r.user_id)),
      ...leadRetryRows.map((r) => String(r.user_id)),
    ].filter(Boolean))];
    const { data: configs } = userIds.length > 0
      ? await db
        .from("conversions_config")
        .select("*")
        .in("user_id", userIds)
      : { data: [] };
    const { data: pixelConfigs } = userIds.length > 0
      ? await db
        .from("conversions_pixel_configs")
        .select("user_id, pixel_id, meta_access_token, meta_currency, meta_api_version, is_default")
        .in("user_id", userIds)
      : { data: [] };

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

    const contactLeadRetryStats = await retryContactLeadCapiEvents(
      db,
      contactRetryRows,
      leadRetryRows,
      configMap,
      pixelConfigMap,
    );

    let retried = 0;
    let succeeded = 0;

    for (const row of purchaseRows) {
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
      if (isEventTimeTooOldForMetaCapi(Number(eventTime))) {
        const obs = appendObs(row.observaciones ?? "", "PURCHASE CAPI OMITIDO EVENT_TIME ANTIGUO");
        await db.from("conversions").update({
          purchase_status_capi: "skipped_old_event_time",
          purchase_event_id: eventId,
          purchase_event_time: eventTime,
          observaciones: obs,
        }).eq("id", row.id);
        continue;
      }

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
          await writeConversionLog(
            db,
            row.user_id,
            row.id,
            "INFO",
            "Meta CAPI retry Purchase OK",
            "HTTP 200",
            JSON.stringify(metaReq.body),
            await res.clone().text().catch(() => ""),
          );
          succeeded++;
        } else {
          const resText = await res.clone().text().catch(() => "");
          const obs = appendObs(row.observaciones ?? "", "ERROR PURCHASE");
          await db.from("conversions").update({
            purchase_status_capi: "error",
            purchase_event_id: eventId,
            purchase_event_time: eventTime,
            observaciones: obs,
          }).eq("id", row.id);
          await writeConversionLog(
            db,
            row.user_id,
            row.id,
            "ERROR",
            "Meta CAPI retry Purchase fallo",
            `HTTP ${res.status}: ${resText}`,
            JSON.stringify(metaReq.body),
            resText,
          );
        }
      } catch (err) {
        const obs = appendObs(row.observaciones ?? "", "ERROR PURCHASE");
        await db.from("conversions").update({
          purchase_status_capi: "error",
          observaciones: obs,
        }).eq("id", row.id);
        await writeConversionLog(
          db,
          row.user_id,
          row.id,
          "ERROR",
          "Meta CAPI retry Purchase excepcion",
          String(err),
          JSON.stringify(metaReq.body),
          "",
        );
      }
    }

    // Deferred LEAD replay (without promo_code): process after 1h.
    let deferredLeadsPicked = 0;
    let deferredLeadsProcessed = 0;
    let deferredLeadsFailed = 0;

    const cutoffIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    for (let pass = 0; pass < 20; pass++) {
      const { data: deferredRows } = await db
        .from("conversion_inbox")
        .select("id, user_id, landing_name, payload_raw, created_at")
        .eq("status", "deferred")
        .eq("action", "LEAD")
        .lte("created_at", cutoffIso)
        .order("created_at", { ascending: true })
        .limit(100);
      const deferred = (deferredRows ?? []) as DeferredInboxRow[];
      if (deferred.length === 0) break;
      deferredLeadsPicked += deferred.length;
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
        if (!hasPositiveEpoch(payload.event_time)) {
          const createdAtEpoch = Math.floor(Date.parse(row.created_at) / 1000);
          if (Number.isFinite(createdAtEpoch) && createdAtEpoch > 0) {
            payload.event_time = createdAtEpoch;
          }
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

    // Deferred PURCHASE replay: after LEADs, so chronological pairing can settle first.
    let deferredPurchasesPicked = 0;
    let deferredPurchasesProcessed = 0;
    let deferredPurchasesFailed = 0;

    for (let pass = 0; pass < 20; pass++) {
      const { data: deferredRows } = await db
        .from("conversion_inbox")
        .select("id, user_id, landing_name, payload_raw, created_at")
        .eq("status", "deferred")
        .eq("action", "PURCHASE")
        .lte("created_at", cutoffIso)
        .order("created_at", { ascending: true })
        .limit(100);
      const deferred = (deferredRows ?? []) as DeferredInboxRow[];
      if (deferred.length === 0) break;
      deferredPurchasesPicked += deferred.length;
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
              response_body: "Deferred PURCHASE retry error: client name not found",
              processed_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          deferredPurchasesFailed++;
          continue;
        }

        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(row.payload_raw || "{}") as Record<string, unknown>;
        } catch {
          payload = {};
        }
        if (!hasPositiveEpoch(payload.event_time)) {
          const createdAtEpoch = Math.floor(Date.parse(row.created_at) / 1000);
          if (Number.isFinite(createdAtEpoch) && createdAtEpoch > 0) {
            payload.event_time = createdAtEpoch;
          }
        }
        payload.__deferred_retry = true;
        payload.__inbox_id = row.id;
        payload.action = "PURCHASE";

        const replayUrl = `${supabaseUrl}/functions/v1/conversions?name=${encodeURIComponent(clientName)}`;
        try {
          const replayRes = await fetch(replayUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (replayRes.status >= 200 && replayRes.status < 400) {
            deferredPurchasesProcessed++;
          } else {
            deferredPurchasesFailed++;
          }
        } catch {
          deferredPurchasesFailed++;
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
      const leadTs = toEpochFromIso(payload.dateTime)
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
        .delete()
        .eq("id", lead.id);
      leadBackfillMerged++;
    }

    // Historical LEAD replay: before 2026-06-09, some LEADs were ignored when
    // the bot reused action_event_id even if promo_code was different. Those
    // payloads were not inserted in conversion_inbox, but they were kept in
    // conversion_logs.payload_received. Replay them through the current
    // conversions endpoint so the normal matching + CAPI logic remains the
    // single source of business behavior.
    let duplicateLeadLogsChecked = 0;
    let duplicateLeadLogsReplayed = 0;
    let duplicateLeadLogsSkipped = 0;
    let duplicateLeadLogsFailed = 0;

    const { data: replayCheckpoint } = await db
      .from("conversion_log_lead_backfill_replays")
      .select("log_id")
      .order("log_id", { ascending: false })
      .limit(1);
    const lastReplayedLogId = Number(replayCheckpoint?.[0]?.log_id ?? 0);
    const { data: duplicateActionLogs } = await db
      .from("conversion_logs")
      .select("id, user_id, payload_received, created_at")
      .gt("id", lastReplayedLogId)
      .eq("function_name", "main")
      .eq("message", "Duplicado ignorado por action_event_id")
      .order("id", { ascending: true })
      .limit(DUPLICATE_LEAD_LOG_BACKFILL_LIMIT);

    const duplicateLogs = (duplicateActionLogs ?? []) as DuplicateLeadLogRow[];
    if (duplicateLogs.length > 0) {
      const userIdsForLogs = [...new Set(duplicateLogs.map((r) => String(r.user_id)))];
      const { data: profiles } = await db
        .from("profiles")
        .select("id, nombre")
        .in("id", userIdsForLogs);
      const profileNameByUserId = new Map<string, string>();
      for (const p of profiles ?? []) {
        profileNameByUserId.set(String(p.id), String(p.nombre ?? "").trim());
      }

      for (const log of duplicateLogs) {
        duplicateLeadLogsChecked++;
        const payload = parseJsonObject(String(log.payload_received ?? ""));
        const action = String(payload.action ?? "").trim().toUpperCase();
        const actionEventId = normalizeText(payload.action_event_id);
        const promoCode = normalizePromoCode(payload.promo_code ?? payload.promoCode);
        const phone = sanitizePhone(typeof payload.phone === "string" ? payload.phone : "");
        const clientName = profileNameByUserId.get(String(log.user_id)) ?? "";

        const mark = async (
          status: "replayed" | "skipped" | "error",
          notes: string,
          httpStatus?: number,
          responseBody?: string,
        ) => {
          await db
            .from("conversion_log_lead_backfill_replays")
            .upsert({
              log_id: log.id,
              user_id: log.user_id,
              action: action || "LEAD",
              action_event_id: actionEventId,
              promo_code: promoCode,
              status,
              http_status: httpStatus ?? null,
              response_body: String(responseBody ?? "").slice(0, 4000),
              notes,
              processed_at: new Date().toISOString(),
            }, { onConflict: "log_id" });
        };

        if (action !== "LEAD") {
          duplicateLeadLogsSkipped++;
          await mark("skipped", `payload action no es LEAD: ${action || "-"}`);
          continue;
        }
        if (!clientName) {
          duplicateLeadLogsFailed++;
          await mark("error", "client name not found");
          continue;
        }
        if (!actionEventId || !isFullPromoCodeForBackfill(promoCode) || !phone) {
          duplicateLeadLogsSkipped++;
          await mark("skipped", "payload incompleto: action_event_id, promo_code valido o phone faltante");
          continue;
        }

        const { data: alreadyInInbox } = await db
          .from("conversion_inbox")
          .select("id")
          .eq("user_id", log.user_id)
          .eq("action", "LEAD")
          .eq("action_event_id", actionEventId)
          .eq("promo_code", promoCode)
          .limit(1)
          .maybeSingle();
        if (alreadyInInbox?.id) {
          duplicateLeadLogsSkipped++;
          await mark("skipped", `inbox existente: ${alreadyInInbox.id}`);
          continue;
        }

        const { data: existingConversion } = await db
          .from("conversions")
          .select("id, lead_event_id")
          .eq("user_id", log.user_id)
          .eq("promo_code", promoCode)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (String(existingConversion?.lead_event_id ?? "").trim()) {
          duplicateLeadLogsSkipped++;
          await mark("skipped", `conversion ya tiene lead_event_id: ${existingConversion?.id ?? "-"}`);
          continue;
        }

        if (!hasPositiveEpoch(payload.event_time)) {
          const createdAtEpoch = Math.floor(Date.parse(String(log.created_at)) / 1000);
          if (Number.isFinite(createdAtEpoch) && createdAtEpoch > 0) {
            payload.event_time = createdAtEpoch;
          }
        }
        payload.action = "LEAD";
        payload.__backfill_duplicate_action_event_id = true;
        payload.__source_log_id = log.id;

        const replayUrl = `${supabaseUrl}/functions/v1/conversions?name=${encodeURIComponent(clientName)}`;
        try {
          const replayRes = await fetch(replayUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const responseBody = await replayRes.text().catch(() => "");
          if (replayRes.status >= 200 && replayRes.status < 400) {
            duplicateLeadLogsReplayed++;
            await mark("replayed", "replayed through conversions endpoint", replayRes.status, responseBody);
          } else {
            duplicateLeadLogsFailed++;
            await mark("error", "conversions endpoint returned error", replayRes.status, responseBody);
          }
        } catch (err) {
          duplicateLeadLogsFailed++;
          await mark("error", `fetch error: ${String(err)}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        retried,
        succeeded,
        contact_capi_retried: contactLeadRetryStats.contactRetried,
        contact_capi_succeeded: contactLeadRetryStats.contactSucceeded,
        contact_capi_failed: contactLeadRetryStats.contactFailed,
        contact_capi_skipped: contactLeadRetryStats.contactSkipped,
        lead_capi_retried: contactLeadRetryStats.leadRetried,
        lead_capi_succeeded: contactLeadRetryStats.leadSucceeded,
        lead_capi_failed: contactLeadRetryStats.leadFailed,
        lead_capi_skipped: contactLeadRetryStats.leadSkipped,
        deferred_leads_picked: deferredLeadsPicked,
        deferred_leads_processed: deferredLeadsProcessed,
        deferred_leads_failed: deferredLeadsFailed,
        deferred_purchases_picked: deferredPurchasesPicked,
        deferred_purchases_processed: deferredPurchasesProcessed,
        deferred_purchases_failed: deferredPurchasesFailed,
        lead_backfill_checked: leadBackfillChecked,
        lead_backfill_merged: leadBackfillMerged,
        lead_backfill_ambiguous: leadBackfillAmbiguous,
        duplicate_lead_logs_checked: duplicateLeadLogsChecked,
        duplicate_lead_logs_replayed: duplicateLeadLogsReplayed,
        duplicate_lead_logs_skipped: duplicateLeadLogsSkipped,
        duplicate_lead_logs_failed: duplicateLeadLogsFailed,
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

type CapiRetryEventName = "Contact" | "Lead";

type CapiRetryRow = ConversionRow & {
  id: string;
  contact_capi_retry_count?: number | string | null;
  lead_capi_retry_count?: number | string | null;
  contact_capi_last_retry_at?: string | null;
  lead_capi_last_retry_at?: string | null;
};

type CapiRetryStats = {
  contactRetried: number;
  contactSucceeded: number;
  contactFailed: number;
  contactSkipped: number;
  leadRetried: number;
  leadSucceeded: number;
  leadFailed: number;
  leadSkipped: number;
};

async function retryContactLeadCapiEvents(
  db: SupabaseClient,
  contactRows: CapiRetryRow[],
  leadRows: CapiRetryRow[],
  configMap: Map<string, Record<string, unknown>>,
  pixelConfigMap: Map<string, Array<Record<string, unknown>>>,
): Promise<CapiRetryStats> {
  const stats: CapiRetryStats = {
    contactRetried: 0,
    contactSucceeded: 0,
    contactFailed: 0,
    contactSkipped: 0,
    leadRetried: 0,
    leadSucceeded: 0,
    leadFailed: 0,
    leadSkipped: 0,
  };

  for (const row of contactRows) {
    await retrySingleContactLeadCapiEvent(db, row, "Contact", configMap, pixelConfigMap, stats);
  }
  for (const row of leadRows) {
    await retrySingleContactLeadCapiEvent(db, row, "Lead", configMap, pixelConfigMap, stats);
  }

  return stats;
}

async function retrySingleContactLeadCapiEvent(
  db: SupabaseClient,
  row: CapiRetryRow,
  eventName: CapiRetryEventName,
  configMap: Map<string, Record<string, unknown>>,
  pixelConfigMap: Map<string, Array<Record<string, unknown>>>,
  stats: CapiRetryStats,
): Promise<void> {
  const isContact = eventName === "Contact";
  const retriedKey = isContact ? "contactRetried" : "leadRetried";
  const succeededKey = isContact ? "contactSucceeded" : "leadSucceeded";
  const failedKey = isContact ? "contactFailed" : "leadFailed";
  const skippedKey = isContact ? "contactSkipped" : "leadSkipped";
  const statusField = isContact ? "contact_status_capi" : "lead_status_capi";
  const retryableField = isContact ? "contact_capi_retryable" : "lead_capi_retryable";
  const retryCountField = isContact ? "contact_capi_retry_count" : "lead_capi_retry_count";
  const lastRetryField = isContact ? "contact_capi_last_retry_at" : "lead_capi_last_retry_at";
  const eventId = normalizeText(isContact ? row.contact_event_id : row.lead_event_id);
  const eventTime = Number(isContact ? row.contact_event_time : row.lead_event_time);
  const retryCount = Number(row[retryCountField] ?? 0);
  const lastRetryAt = normalizeText(row[lastRetryField]);
  const nowIso = new Date().toISOString();

  const skip = async (reason: string, updates: Record<string, unknown> = {}) => {
    stats[skippedKey]++;
    await db.from("conversions").update({
      [retryableField]: false,
      ...updates,
    }).eq("id", row.id);
    await writeConversionLog(
      db,
      row.user_id,
      row.id,
      "WARN",
      `Meta CAPI retry ${eventName} omitido`,
      reason,
      "",
      "",
    );
  };

  if (!eventId || !Number.isFinite(eventTime) || eventTime <= 0) {
    await skip(JSON.stringify({ event_name: eventName, reason: "event_id/event_time invalido", event_id: eventId, event_time: eventTime }));
    return;
  }

  if (lastRetryAt) {
    const lastRetryMs = Date.parse(lastRetryAt);
    if (Number.isFinite(lastRetryMs) && Date.now() - lastRetryMs < MIN_CONTACT_LEAD_RETRY_INTERVAL_MS) {
      stats[skippedKey]++;
      return;
    }
  }

  if (retryCount >= MAX_CONTACT_LEAD_CAPI_RETRIES) {
    await skip(JSON.stringify({ event_name: eventName, reason: "max retries alcanzado", retry_count: retryCount }));
    return;
  }

  if (isEventTimeTooOldForMetaCapi(eventTime)) {
    const oldMsg = `${eventName.toUpperCase()} CAPI OMITIDO EVENT_TIME ANTIGUO`;
    await skip(
      JSON.stringify({ event_name: eventName, reason: "event_time mayor a 7 dias", event_time: eventTime }),
      {
        [statusField]: "skipped_old_event_time",
        observaciones: appendObs(row.observaciones ?? "", oldMsg),
      },
    );
    return;
  }

  const config = resolveRetryConfig(row, configMap, pixelConfigMap);
  if (!config) {
    stats[failedKey]++;
    await db.from("conversions").update({
      [retryableField]: false,
      [lastRetryField]: nowIso,
    }).eq("id", row.id);
    await writeConversionLog(
      db,
      row.user_id,
      row.id,
      "ERROR",
      `Meta CAPI retry ${eventName} sin config`,
      JSON.stringify({ event_name: eventName, pixel_id: row.pixel_id ?? "" }),
      "",
      "",
    );
    return;
  }

  const metaReq = await buildMetaRequest(
    config,
    row as ConversionRow,
    eventName,
    eventId,
    eventTime,
  );
  const metaPayloadRaw = JSON.stringify(metaReq.body);
  stats[retriedKey]++;

  const fail = async (detail: string, responseRaw = "", retryableNext = false) => {
    stats[failedKey]++;
    const nextRetryCount = retryCount + 1;
    const shouldKeepRetrying = retryableNext && nextRetryCount < MAX_CONTACT_LEAD_CAPI_RETRIES;
    await db.from("conversions").update({
      [statusField]: "error",
      [retryableField]: shouldKeepRetrying,
      [retryCountField]: nextRetryCount,
      [lastRetryField]: nowIso,
      observaciones: appendObs(row.observaciones ?? "", isContact ? "ERROR CONTACT" : "ERROR LEAD"),
    }).eq("id", row.id);
    await writeConversionLog(
      db,
      row.user_id,
      row.id,
      "ERROR",
      `Meta CAPI retry ${eventName} fallo`,
      detail,
      metaPayloadRaw,
      responseRaw,
    );
  };

  try {
    const res = await fetch(metaReq.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaReq.body),
    });
    const resText = await res.text();
    const isTransientHttp = res.status === 429 || res.status === 408 || res.status >= 500;

    if (res.status === 200 && isMetaResponseOk(resText)) {
      stats[succeededKey]++;
      await db.from("conversions").update({
        [statusField]: "enviado",
        [retryableField]: false,
        [retryCountField]: retryCount + 1,
        [lastRetryField]: nowIso,
        observaciones: appendObs(row.observaciones ?? "", isContact ? "CONTACT OK" : "LEAD OK"),
      }).eq("id", row.id);
      await writeConversionLog(
        db,
        row.user_id,
        row.id,
        "INFO",
        `Meta CAPI retry ${eventName} OK`,
        `HTTP 200 retry ${retryCount + 1}/${MAX_CONTACT_LEAD_CAPI_RETRIES}`,
        metaPayloadRaw,
        resText,
      );
      return;
    }

    await fail(`HTTP ${res.status} retry ${retryCount + 1}/${MAX_CONTACT_LEAD_CAPI_RETRIES}: ${resText}`, resText, isTransientHttp);
  } catch (err) {
    await fail(`Excepcion retry ${retryCount + 1}/${MAX_CONTACT_LEAD_CAPI_RETRIES}: ${String(err)}`, "", true);
  }
}

function resolveRetryConfig(
  row: CapiRetryRow,
  configMap: Map<string, Record<string, unknown>>,
  pixelConfigMap: Map<string, Array<Record<string, unknown>>>,
): ConversionsConfig | null {
  const cfg = configMap.get(String(row.user_id));
  if (!cfg) return null;

  const rowPixel = normalizeText(row.pixel_id);
  const userPixelConfigs = pixelConfigMap.get(String(row.user_id)) ?? [];
  const matchedPixelCfg = rowPixel
    ? userPixelConfigs.find((pc) => normalizeText(pc.pixel_id) === rowPixel)
    : null;
  const defaultPixelCfg = userPixelConfigs.find((pc) => Boolean(pc.is_default));
  const selected = matchedPixelCfg ?? defaultPixelCfg ?? null;
  const accessToken = selected
    ? normalizeText(selected.meta_access_token)
    : normalizeText(cfg.meta_access_token);
  const pixelId = selected
    ? normalizeText(selected.pixel_id)
    : normalizeText(cfg.pixel_id);
  if (!accessToken || !pixelId) return null;

  return {
    user_id: String(row.user_id),
    pixel_id: pixelId,
    meta_access_token: accessToken,
    meta_currency: selected
      ? normalizeText(selected.meta_currency || "ARS")
      : normalizeText(cfg.meta_currency || "ARS"),
    meta_api_version: selected
      ? normalizeText(selected.meta_api_version || "v25.0")
      : normalizeText(cfg.meta_api_version || "v25.0"),
    send_contact_capi: false,
    geo_use_ipapi: false,
    geo_fill_only_when_missing: false,
  };
}

function isMetaResponseOk(raw: string): boolean {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch {
    parsed = null;
  }
  if (!parsed) return true;
  if ("error" in parsed) return false;
  const eventsReceivedRaw = parsed.events_received;
  const eventsReceived = typeof eventsReceivedRaw === "number"
    ? eventsReceivedRaw
    : Number(eventsReceivedRaw);
  return !Number.isFinite(eventsReceived) || eventsReceived > 0;
}

async function writeConversionLog(
  db: SupabaseClient,
  userId: string,
  conversionId: string,
  level: string,
  message: string,
  detail: string,
  payloadMeta: string,
  responseMeta: string,
): Promise<void> {
  try {
    await db.from("conversion_logs").insert({
      user_id: userId,
      conversion_id: conversionId,
      function_name: "retry-failed-conversions",
      level,
      message,
      detail: detail.slice(0, 4000),
      result: detail.slice(0, 4000),
      payload_meta: payloadMeta.slice(0, 20000),
      response_meta: responseMeta.slice(0, 20000),
    });
  } catch (err) {
    console.error("[retry-failed-conversions] writeConversionLog failed", String(err));
  }
}

function isEventTimeTooOldForMetaCapi(eventTime: number): boolean {
  if (!Number.isFinite(eventTime) || eventTime <= 0) return false;
  const now = Math.floor(Date.now() / 1000);
  return now - eventTime > META_CAPI_MAX_EVENT_AGE_SECONDS;
}

type DeferredInboxRow = {
  id: string;
  user_id: string;
  landing_name: string;
  payload_raw: string;
  created_at: string;
};

type DuplicateLeadLogRow = {
  id: number;
  user_id: string;
  payload_received: string | null;
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

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePromoCode(value: unknown): string {
  return normalizeText(value);
}

function isFullPromoCodeForBackfill(value: unknown): boolean {
  return /^[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(normalizePromoCode(value));
}

function sanitizePhone(input: string | null | undefined): string {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("54") ? digits : `54${digits}`;
}

function toEpochFromIso(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.floor(ms / 1000);
}

function hasPositiveEpoch(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}
