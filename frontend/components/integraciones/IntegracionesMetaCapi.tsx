"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  deletePixelConfig,
  fetchConversionsConfig,
  fetchPixelConfigs,
  type ConversionsConfig,
  type PixelConfig,
  upsertConversionsConfig,
  upsertPixelConfig,
} from "@/lib/conversionsDb";
import {
  fetchKommoClientConfig,
  type KommoClientConfig,
  upsertKommoClientConfig,
} from "@/lib/kommoDb";
import {
  fetchChatraceClientConfig,
  type ChatraceClientConfig,
  upsertChatraceClientConfig,
} from "@/lib/chatraceDb";
import {
  fetchGerencias,
  fetchGerenciasForAdmin,
  type LandingGerenciaAssignment,
} from "@/lib/gerencias/gerenciasDb";
import type { Gerencia } from "@/lib/gerencias/types";

type PixelEditDraft = {
  id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  is_default: boolean;
};

export default function IntegracionesMetaCapi() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientName, setClientName] = useState("");
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [pixelConfigs, setPixelConfigs] = useState<PixelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPixelId, setQuickPixelId] = useState("");
  const [quickToken, setQuickToken] = useState("");
  const [quickCurrency, setQuickCurrency] = useState("ARS");
  const [quickErr, setQuickErr] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<PixelEditDraft | null>(null);
  const [activeIntegration, setActiveIntegration] = useState<"menu" | "meta" | "kommo" | "chatrace">("menu");
  const [kommoConfig, setKommoConfig] = useState<KommoClientConfig | null>(null);
  const [kommoBaseUrl, setKommoBaseUrl] = useState("");
  const [kommoToken, setKommoToken] = useState("");
  const [kommoActive, setKommoActive] = useState(true);
  const [kommoSaving, setKommoSaving] = useState(false);
  const [kommoMsg, setKommoMsg] = useState<string | null>(null);
  const [editKommoUrl, setEditKommoUrl] = useState(false);
  const [editKommoToken, setEditKommoToken] = useState(false);
  const [chatraceConfig, setChatraceConfig] = useState<ChatraceClientConfig | null>(null);
  const [chatracePixelId, setChatracePixelId] = useState("");
  const [chatraceActive, setChatraceActive] = useState(true);
  const [chatraceSaving, setChatraceSaving] = useState(false);
  const [chatraceMsg, setChatraceMsg] = useState<string | null>(null);
  const [chatraceGerencias, setChatraceGerencias] = useState<Gerencia[]>([]);
  const [chatraceAssignments, setChatraceAssignments] = useState<LandingGerenciaAssignment[]>([]);
  const [chatraceGerenciaSelectionMode, setChatraceGerenciaSelectionMode] = useState<"weighted_random" | "fair">("weighted_random");
  const [chatraceGerenciaFairCriterion, setChatraceGerenciaFairCriterion] = useState<"usage_count" | "messages_received">("usage_count");
  const [chatraceIdOpen, setChatraceIdOpen] = useState(true);
  const [chatraceTrackingOpen, setChatraceTrackingOpen] = useState(true);
  const [chatraceRedirectOpen, setChatraceRedirectOpen] = useState(true);

  const endpointBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const endpointUrl = useMemo(
    () =>
      clientName
        ? `${endpointBase}/functions/v1/conversions?name=${encodeURIComponent(clientName)}`
        : "",
    [clientName, endpointBase],
  );
  const kommoWebhookUrl = useMemo(
    () =>
      clientName
        ? `https://intermediario-kommo.vercel.app/api/kommo/webhook?name=${encodeURIComponent(clientName)}`
        : "",
    [clientName],
  );
  const landingPhoneUrl = useMemo(
    () =>
      clientName
        ? `${endpointBase}/functions/v1/landing-phone?name=${encodeURIComponent(clientName)}`
        : "",
    [clientName, endpointBase],
  );
  const chatraceLandingPhoneUrl = useMemo(
    () =>
      clientName
        ? `${endpointBase}/functions/v1/landing-phone?name=${encodeURIComponent(clientName)}&source=chatrace`
        : "",
    [clientName, endpointBase],
  );

  const loadAll = useCallback(async (uid: string) => {
    const { data: p } = await supabase
      .from("profiles")
      .select("nombre, role")
      .eq("id", uid)
      .maybeSingle();
    const adminView = String(p?.role ?? "") === "admin";
    const [cfg, pixels, kommo, gers] = await Promise.all([
      fetchConversionsConfig(uid),
      fetchPixelConfigs(uid),
      fetchKommoClientConfig(uid),
      adminView ? fetchGerenciasForAdmin(uid) : fetchGerencias(uid),
    ]);
    setConfig(cfg);
    setPixelConfigs(pixels);
    setKommoConfig(kommo);
    setKommoBaseUrl(kommo?.kommo_api_base_url ?? "");
    setKommoToken(kommo?.kommo_access_token ?? "");
    setKommoActive(kommo?.active ?? true);
    setEditKommoUrl(!kommo);
    setEditKommoToken(!kommo);
    const chatrace = await fetchChatraceClientConfig(uid);
    setChatraceConfig(chatrace);
    setChatracePixelId(chatrace?.meta_pixel_id ?? "");
    setChatraceActive(chatrace?.active ?? true);
    setChatraceGerenciaSelectionMode(chatrace?.gerencia_selection_mode ?? "weighted_random");
    setChatraceGerenciaFairCriterion(chatrace?.gerencia_fair_criterion ?? "usage_count");
    setChatraceGerencias(gers);
    const { data: chatraceAsg } = await supabase
      .from("chatrace_gerencias")
      .select("gerencia_id, weight, phone_mode, phone_kind, interval_start_hour, interval_end_hour")
      .eq("user_id", uid);
    setChatraceAssignments(
      (chatraceAsg ?? []).map((r) => ({
        gerencia_id: r.gerencia_id,
        weight: Number(r.weight) || 0,
        phoneMode: (r.phone_mode as "random" | "fair") ?? "random",
        phoneKind: (r.phone_kind as "carga" | "ads" | "mkt") ?? "carga",
        intervalStartHour: r.interval_start_hour ?? null,
        intervalEndHour: r.interval_end_hour ?? null,
      })),
    );
    setClientName(String(p?.nombre ?? ""));
    setIsAdmin(adminView);
  }, []);

  const maskToken = useCallback((value: string) => {
    const v = String(value ?? "");
    if (!v) return "-";
    if (v.length <= 12) return `${v.slice(0, 4)}...`;
    return `${v.slice(0, 6)}...${v.slice(-6)}`;
  }, []);

  const validateKommoInput = useCallback((): string | null => {
    const name = clientName.trim();
    if (!name || !/^[a-z0-9-]+$/.test(name)) {
      return "Name de cliente inválido.";
    }
    if (!/^https:\/\/[a-zA-Z0-9.-]+(?:\/.*)?$/.test(kommoBaseUrl.trim())) {
      return "URL base de Kommo inválida (debe iniciar con https://).";
    }
    if (!kommoToken.trim()) {
      return "Token de Kommo requerido.";
    }
    return null;
  }, [clientName, kommoBaseUrl, kommoToken]);

  const syncKommoRemote = useCallback(async (payload: {
    name: string;
    kommo_api_base_url: string;
    kommo_access_token: string;
    active: boolean;
  }): Promise<{ ok: boolean; detail?: string }> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? "";
    if (!accessToken) return { ok: false, detail: "Sesión inválida para sincronizar." };

    const res = await fetch("/api/integrations/kommo/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, detail: text || `HTTP ${res.status}` };
    return { ok: true };
  }, []);

  const handleKommoSave = useCallback(async () => {
    if (!userId) return;
    setKommoMsg(null);
    const validationErr = validateKommoInput();
    if (validationErr) {
      setKommoMsg(validationErr);
      return;
    }
    const payload = {
      name: clientName.trim(),
      kommo_api_base_url: kommoBaseUrl.trim(),
      kommo_access_token: kommoToken.trim(),
      active: kommoActive,
    };

    setKommoSaving(true);
    try {
      await upsertKommoClientConfig({
        user_id: userId,
        ...payload,
        sync_status: "pending",
        sync_error: null,
      });

      const sync = await syncKommoRemote(payload);
      if (sync.ok) {
        await upsertKommoClientConfig({
          user_id: userId,
          ...payload,
          sync_status: "synced",
          sync_error: null,
          last_synced_at: new Date().toISOString(),
        });
        setKommoMsg("Configuración de Kommo guardada y sincronizada.");
        setEditKommoUrl(false);
        setEditKommoToken(false);
      } else {
        await upsertKommoClientConfig({
          user_id: userId,
          ...payload,
          sync_status: "error",
          sync_error: (sync.detail ?? "").slice(0, 500),
        });
        setKommoMsg("Guardado local OK. Falló sincronización con Intermediario. Reintenta manualmente.");
        setEditKommoUrl(false);
        setEditKommoToken(false);
      }

      await loadAll(userId);
    } catch (e) {
      setKommoMsg(e instanceof Error ? e.message : "Error al guardar Kommo.");
    } finally {
      setKommoSaving(false);
    }
  }, [userId, clientName, kommoBaseUrl, kommoToken, kommoActive, validateKommoInput, syncKommoRemote, loadAll]);

  const handleChatraceSave = useCallback(async () => {
    if (!userId) return;
    setChatraceMsg(null);
    if (!clientName.trim() || !/^[a-z0-9-]+$/.test(clientName.trim())) {
      setChatraceMsg("Name de cliente inválido.");
      return;
    }
    if (!chatracePixelId.trim()) {
      setChatraceMsg("Pixel ID requerido.");
      return;
    }
    if (!endpointUrl) {
      setChatraceMsg("No se pudo resolver URL Post.");
      return;
    }

    setChatraceSaving(true);
    try {
      await upsertChatraceClientConfig({
        user_id: userId,
        name: clientName.trim(),
        meta_pixel_id: chatracePixelId.trim(),
        post_url: endpointUrl,
        landing_tag: "",
        send_contact_pixel: false,
        gerencia_selection_mode: chatraceGerenciaSelectionMode,
        gerencia_fair_criterion: chatraceGerenciaFairCriterion,
        active: chatraceActive,
      });
      await supabase.from("chatrace_gerencias").delete().eq("user_id", userId);
      if (chatraceAssignments.length > 0) {
        const rows = chatraceAssignments.map((a) => ({
          user_id: userId,
          gerencia_id: a.gerencia_id,
          weight: a.weight,
          phone_mode: a.phoneMode,
          phone_kind: a.phoneKind,
          interval_start_hour: a.intervalStartHour,
          interval_end_hour: a.intervalEndHour,
        }));
        const { error: asgErr } = await supabase.from("chatrace_gerencias").insert(rows);
        if (asgErr) throw asgErr;
      }
      setChatraceMsg("Configuración de Chatrace guardada.");
      await loadAll(userId);
    } catch (e) {
      setChatraceMsg(e instanceof Error ? e.message : "Error al guardar Chatrace.");
    } finally {
      setChatraceSaving(false);
    }
  }, [
    userId,
    clientName,
    chatracePixelId,
    endpointUrl,
    chatraceConfig,
    chatraceActive,
    chatraceGerenciaSelectionMode,
    chatraceGerenciaFairCriterion,
    chatraceAssignments,
    loadAll,
  ]);

  const handleKommoRetrySync = useCallback(async () => {
    if (!userId) return;
    const validationErr = validateKommoInput();
    if (validationErr) {
      setKommoMsg(validationErr);
      return;
    }
    setKommoSaving(true);
    setKommoMsg(null);
    try {
      const payload = {
        name: clientName.trim(),
        kommo_api_base_url: kommoBaseUrl.trim(),
        kommo_access_token: kommoToken.trim(),
        active: kommoActive,
      };
      const sync = await syncKommoRemote(payload);
      if (sync.ok) {
        await upsertKommoClientConfig({
          user_id: userId,
          ...payload,
          sync_status: "synced",
          sync_error: null,
          last_synced_at: new Date().toISOString(),
        });
        setKommoMsg("Sincronización Kommo OK.");
      } else {
        await upsertKommoClientConfig({
          user_id: userId,
          ...payload,
          sync_status: "error",
          sync_error: (sync.detail ?? "").slice(0, 500),
        });
        setKommoMsg("Sigue fallando la sincronización con Intermediario.");
      }
      await loadAll(userId);
    } catch (e) {
      setKommoMsg(e instanceof Error ? e.message : "Error al reintentar.");
    } finally {
      setKommoSaving(false);
    }
  }, [userId, clientName, kommoBaseUrl, kommoToken, kommoActive, validateKommoInput, syncKommoRemote, loadAll]);

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id ?? null;
        setUserId(uid);
        if (!uid) return;
        await loadAll(uid);
      } catch (e) {
        setSaveMsg(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadAll]);

  const openQuickModal = useCallback(() => {
    setQuickPixelId("");
    setQuickToken("");
    setQuickCurrency(config?.meta_currency ?? "ARS");
    setQuickErr(null);
    setQuickOpen(true);
  }, [config]);

  const handleQuickSave = useCallback(async () => {
    if (!userId || !config) return;
    const pixel = quickPixelId.replace(/\D/g, "").trim();
    const token = quickToken.trim();
    if (!pixel) return setQuickErr("Pixel ID es obligatorio.");
    if (!token) return setQuickErr("Token es obligatorio.");
    setSaving(true);
    setSaveMsg(null);
    setQuickErr(null);
    try {
      const hasAny = pixelConfigs.length > 0;
      const apiVersionToSave = (config.meta_api_version || "v25.0").trim() || "v25.0";
      await upsertPixelConfig({
        user_id: userId,
        pixel_id: pixel,
        meta_access_token: token,
        meta_currency: quickCurrency || "ARS",
        meta_api_version: apiVersionToSave,
        send_contact_capi: false,
        geo_use_ipapi: false,
        geo_fill_only_when_missing: false,
        is_default: !hasAny,
      });

      if (!hasAny) {
        const next = {
          ...config,
          user_id: userId,
          pixel_id: pixel,
          meta_access_token: token,
          meta_currency: quickCurrency || "ARS",
        };
        await upsertConversionsConfig(next);
        setConfig(next);
      }

      await loadAll(userId);
      setQuickOpen(false);
      setSaveMsg("Pixel guardado.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      setQuickErr(msg);
      setSaveMsg(msg);
    } finally {
      setSaving(false);
    }
  }, [userId, config, quickPixelId, quickToken, quickCurrency, pixelConfigs.length, loadAll]);

  const handleEdit = useCallback((px: PixelConfig) => {
    setDraft({
      id: px.id,
      pixel_id: px.pixel_id,
      meta_access_token: px.meta_access_token,
      meta_currency: px.meta_currency || "ARS",
      meta_api_version: px.meta_api_version || "v25.0",
      send_contact_capi: !!px.send_contact_capi,
      geo_use_ipapi: !!px.geo_use_ipapi,
      geo_fill_only_when_missing: !!px.geo_fill_only_when_missing,
      is_default: !!px.is_default,
    });
    setEditOpen(true);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!userId || !draft || !config) return;
    const pixel = draft.pixel_id.replace(/\D/g, "").trim();
    const token = draft.meta_access_token.trim();
    if (!pixel || !token) return setSaveMsg("Pixel y token son obligatorios.");
    setSaving(true);
    setSaveMsg(null);
    try {
      const persistedCurrent = pixelConfigs.find((px) => px.id === draft.id);
      const apiVersionToSave = isAdmin
        ? ((draft.meta_api_version || "v25.0").trim() || "v25.0")
        : (persistedCurrent?.meta_api_version || "v25.0");

      await upsertPixelConfig({
        user_id: userId,
        pixel_id: pixel,
        meta_access_token: token,
        meta_currency: draft.meta_currency || "ARS",
        meta_api_version: apiVersionToSave,
        send_contact_capi: !!draft.send_contact_capi,
        geo_use_ipapi: !!draft.geo_use_ipapi,
        geo_fill_only_when_missing: !!draft.geo_fill_only_when_missing,
        is_default: !!draft.is_default,
      });

      if (draft.is_default) {
        const next = {
          ...config,
          user_id: userId,
          pixel_id: pixel,
          meta_access_token: token,
          meta_currency: draft.meta_currency || "ARS",
          meta_api_version: apiVersionToSave,
          send_contact_capi: !!draft.send_contact_capi,
          geo_use_ipapi: !!draft.geo_use_ipapi,
          geo_fill_only_when_missing: !!draft.geo_fill_only_when_missing,
        };
        await upsertConversionsConfig(next);
        setConfig(next);
      }

      await loadAll(userId);
      setEditOpen(false);
      setDraft(null);
      setSaveMsg("Pixel actualizado.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }, [userId, draft, config, loadAll, isAdmin, pixelConfigs]);

  const handleSetDefault = useCallback(async (px: PixelConfig) => {
    if (!userId || !config) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await upsertPixelConfig({
        user_id: userId,
        pixel_id: px.pixel_id,
        meta_access_token: px.meta_access_token,
        meta_currency: px.meta_currency || "ARS",
        meta_api_version: px.meta_api_version || "v25.0",
        send_contact_capi: !!px.send_contact_capi,
        geo_use_ipapi: !!px.geo_use_ipapi,
        geo_fill_only_when_missing: !!px.geo_fill_only_when_missing,
        is_default: true,
      });
      const next = {
        ...config,
        user_id: userId,
        pixel_id: px.pixel_id,
        meta_access_token: px.meta_access_token,
        meta_currency: px.meta_currency || "ARS",
        meta_api_version: px.meta_api_version || "v25.0",
        send_contact_capi: !!px.send_contact_capi,
        geo_use_ipapi: !!px.geo_use_ipapi,
        geo_fill_only_when_missing: !!px.geo_fill_only_when_missing,
      };
      await upsertConversionsConfig(next);
      setConfig(next);
      await loadAll(userId);
      setSaveMsg("Pixel por defecto actualizado.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al actualizar default");
    } finally {
      setSaving(false);
    }
  }, [userId, config, loadAll]);

  const handleDelete = useCallback(async (px: PixelConfig) => {
    if (!userId || !config) return;
    const ok = window.confirm(`Eliminar pixel ${px.pixel_id}?`);
    if (!ok) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await deletePixelConfig(userId, px.pixel_id);
      await loadAll(userId);
      setSaveMsg("Pixel eliminado.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setSaving(false);
    }
  }, [userId, config, loadAll]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {activeIntegration === "meta"
              ? "INTEGRACIONES > Integración con Meta CAPI"
              : activeIntegration === "kommo"
              ? "INTEGRACIONES > Integración con CRM Kommo"
              : activeIntegration === "chatrace"
              ? "INTEGRACIONES > Integración con Chatrace"
              : "INTEGRACIONES"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {activeIntegration === "meta"
              ? "Administra la configuración de Meta CAPI."
              : activeIntegration === "kommo"
              ? "Guía rápida para conectar Kommo con tu endpoint."
              : activeIntegration === "chatrace"
              ? "Configura identificación, tracking y redirección para Chatrace."
              : "Conecta y administra integraciones de eventos."}
          </p>
        </div>
      </div>

      {saveMsg && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${saveMsg.toLowerCase().includes("error") ? "border-red-800 bg-red-950/40 text-red-300" : "border-emerald-800 bg-emerald-950/40 text-emerald-300"}`}>
          {saveMsg}
        </div>
      )}

      {activeIntegration === "menu" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setActiveIntegration("meta")}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-left transition active:scale-[0.99] hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-200">
                <img
                  src="/meta-logo.png"
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 shrink-0 rounded-sm object-contain"
                />
                Integración con Meta CAPI
              </span>
              <span className="text-xs text-zinc-400">Entrar</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveIntegration("kommo")}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-left transition active:scale-[0.99] hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-200">
                <img
                  src="/kommo-logo.jpeg"
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 shrink-0 rounded-sm object-contain"
                />
                Integración con CRM Kommo
              </span>
              <span className="text-xs text-zinc-400">Entrar</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveIntegration("chatrace")}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-left transition active:scale-[0.99] hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-200">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-zinc-100 text-xs font-bold text-zinc-900">
                  CT
                </span>
                Integración con Chatrace
              </span>
              <span className="text-xs text-zinc-400">Entrar</span>
            </span>
          </button>
        </div>
      ) : (
      activeIntegration === "kommo" ? (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">Instructivo de integración con Kommo</h3>
          <button
            type="button"
            onClick={() => setActiveIntegration("menu")}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Volver
          </button>
        </div>

        <div className="space-y-4 text-sm text-zinc-300">
          {kommoMsg && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                kommoMsg.toLowerCase().includes("error") || kommoMsg.toLowerCase().includes("fall")
                  ? "border-amber-800 bg-amber-950/40 text-amber-300"
                  : "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              }`}
            >
              {kommoMsg}
            </div>
          )}

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <p className="font-semibold text-zinc-100">Configuración guardada en Constructor</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] text-zinc-400">Name del cliente</label>
                <input
                  value={clientName}
                  disabled
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-300"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-[11px] text-zinc-400">Kommo API Base URL</label>
                  <button
                    type="button"
                    onClick={() => setEditKommoUrl(true)}
                    className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                  >
                    Editar
                  </button>
                </div>
                <input
                  value={kommoBaseUrl}
                  onChange={(e) => setKommoBaseUrl(e.target.value)}
                  placeholder="https://TU_USUARIO.kommo.com"
                  disabled={!editKommoUrl}
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-[11px] text-zinc-400">Token de larga duración</label>
                  <button
                    type="button"
                    onClick={() => setEditKommoToken(true)}
                    className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                  >
                    Editar
                  </button>
                </div>
                <input
                  value={kommoToken}
                  onChange={(e) => setKommoToken(e.target.value)}
                  placeholder="Pegar token de Kommo"
                  disabled={!editKommoToken}
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={kommoActive}
                  onChange={(e) => setKommoActive(e.target.checked)}
                />
                Activa
              </label>
              <div className="text-xs text-zinc-400">
                Estado sync:{" "}
                <span
                  className={`font-semibold ${
                    kommoConfig?.sync_status === "synced"
                      ? "text-emerald-400"
                      : kommoConfig?.sync_status === "error"
                      ? "text-red-400"
                      : "text-amber-300"
                  }`}
                >
                  {kommoConfig?.sync_status ?? "pending"}
                </span>
                {kommoConfig?.last_synced_at ? (
                  <span className="ml-2 text-zinc-500">
                    ({new Date(kommoConfig.last_synced_at).toLocaleString("es-AR")})
                  </span>
                ) : null}
              </div>
            </div>
            {kommoConfig?.sync_error ? (
              <p className="mt-2 break-all text-[11px] text-red-400">{kommoConfig.sync_error}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={kommoSaving}
                onClick={() => void handleKommoRetrySync()}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-60"
              >
                Reintentar sincronización
              </button>
              <button
                type="button"
                disabled={kommoSaving}
                onClick={() => void handleKommoSave()}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-60"
              >
                {kommoSaving ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <p className="font-semibold text-zinc-100">A) Alta de webhook (envío de eventos)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-300">
              <li>Ingresar a Kommo.</li>
              <li>Ir a <span className="font-medium">Ajustes → Centro de integraciones</span>.</li>
              <li>Abrir <span className="font-medium">Webhooks</span>.</li>
              <li>En URL, ingresar:</li>
            </ol>
            <code className="mt-2 block break-all rounded bg-zinc-900 px-2 py-1 text-xs text-emerald-300">
              {kommoWebhookUrl || "https://intermediario-kommo.vercel.app/api/kommo/webhook?name=<nombre_cliente>"}
            </code>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-300" start={5}>
              <li>En tipo de evento, dejar solo: <span className="font-medium">Mensaje entrante recibido</span>.</li>
              <li>Guardar.</li>
            </ol>
            <p className="mt-2 text-xs text-zinc-400">
              Con esto, Kommo empieza a enviar eventos de mensajes entrantes al constructor.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <p className="font-semibold text-zinc-100">B) Crear integración para obtener token Kommo</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-300">
              <li>En Kommo ir a <span className="font-medium">Ajustes → Centro de integraciones</span>.</li>
              <li>Crear una nueva integración (custom/private).</li>
              <li>Completar datos básicos (nombre/descripcion) y guardar.</li>
              <li>Abrir la integración creada e ir a <span className="font-medium">Llaves y alcances</span>.</li>
              <li>Generar <span className="font-medium">Token de larga duración (seleccionar fecha máxima)</span>.</li>
              <li>Copiar el token de larga duración.</li>
            </ol>
          </div>
        </div>
      </section>
      ) : (
      activeIntegration === "chatrace" ? (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">Integración con Chatrace</h3>
          <button
            type="button"
            onClick={() => setActiveIntegration("menu")}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Volver
          </button>
        </div>

        <div className="space-y-4 text-sm text-zinc-300">
          {chatraceMsg && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                chatraceMsg.toLowerCase().includes("error")
                  ? "border-red-800 bg-red-950/40 text-red-300"
                  : "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              }`}
            >
              {chatraceMsg}
            </div>
          )}

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <button
              type="button"
              onClick={() => setChatraceIdOpen((v) => !v)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-200">Identificación</h3>
              <span className="text-xs text-zinc-400">{chatraceIdOpen ? "ocultar" : "ver"}</span>
            </button>
            {chatraceIdOpen ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-400">Name del cliente</label>
                <input
                  value={clientName}
                  disabled
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={chatraceActive}
                  onChange={(e) => setChatraceActive(e.target.checked)}
                />
                Integración activa
              </label>
            </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <button
              type="button"
              onClick={() => setChatraceTrackingOpen((v) => !v)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-200">Tracking</h3>
              <span className="text-xs text-zinc-400">{chatraceTrackingOpen ? "ocultar" : "ver"}</span>
            </button>
            {chatraceTrackingOpen ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Meta Pixel ID</label>
                <select
                  value={chatracePixelId}
                  onChange={(e) => setChatracePixelId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">Seleccionar pixel</option>
                  {pixelConfigs.map((px) => (
                    <option key={px.id} value={px.pixel_id}>
                      {px.pixel_id} {px.is_default ? "(default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-400">URL Post (constructor)</label>
                <input
                  value={endpointUrl}
                  disabled
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
                />
              </div>
            </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <button
              type="button"
              onClick={() => setChatraceRedirectOpen((v) => !v)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-200">Redirección</h3>
              <span className="text-xs text-zinc-400">{chatraceRedirectOpen ? "ocultar" : "ver"}</span>
            </button>
            {chatraceRedirectOpen ? (
            <div className="space-y-3">
              {isAdmin ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Endpoint para obtener teléfono</label>
                <input
                  value={chatraceLandingPhoneUrl}
                  disabled
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-300"
                />
              </div>
              ) : null}
              <p className="text-xs text-zinc-400">
                El intermediario de Chatrace debe consultar este endpoint para obtener el teléfono dinámico antes de redirigir a WhatsApp.
              </p>
              <p className="text-xs text-zinc-500">
                Asigna gerencias para habilitar selección de teléfono (misma lógica que editor de landing).
              </p>
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-300">Selección de gerencias</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setChatraceGerenciaSelectionMode("weighted_random")}
                      className={`cursor-pointer px-2 py-1 rounded-l-lg border-r border-zinc-700 ${
                        chatraceGerenciaSelectionMode === "weighted_random"
                          ? "bg-zinc-100 text-zinc-900"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      Aleatoria (peso)
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatraceGerenciaSelectionMode("fair")}
                      className={`cursor-pointer px-2 py-1 rounded-r-lg ${
                        chatraceGerenciaSelectionMode === "fair"
                          ? "bg-zinc-100 text-zinc-900"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      Equitativa
                    </button>
                  </div>
                  {chatraceGerenciaSelectionMode === "fair" ? (
                    <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setChatraceGerenciaFairCriterion("usage_count")}
                        className={`cursor-pointer px-2 py-1 rounded-l-lg border-r border-zinc-700 ${
                          chatraceGerenciaFairCriterion === "usage_count"
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-300 hover:bg-zinc-800"
                        }`}
                      >
                        Por contador
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatraceGerenciaFairCriterion("messages_received")}
                        className={`cursor-pointer px-2 py-1 rounded-r-lg ${
                          chatraceGerenciaFairCriterion === "messages_received"
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-300 hover:bg-zinc-800"
                        }`}
                      >
                        Mensajes recibidos
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              {chatraceGerencias.length === 0 ? (
                <p className="text-xs text-zinc-500">No hay gerencias disponibles para asignar.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-700">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-800/80">
                      <tr>
                        <th className="px-3 py-2 font-medium text-zinc-300">Gerencia</th>
                        <th className="px-3 py-2 font-medium text-zinc-300">Nombre</th>
                        <th className="px-3 py-2 font-medium text-zinc-300 text-center">Asignar</th>
                        {chatraceGerenciaSelectionMode === "weighted_random" ? (
                          <th className="px-3 py-2 font-medium text-zinc-300">Peso</th>
                        ) : null}
                        <th className="px-3 py-2 font-medium text-zinc-300">Modo</th>
                        <th className="px-3 py-2 font-medium text-zinc-300">Tipo</th>
                        <th className="px-3 py-2 font-medium text-zinc-300">Intervalo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {chatraceGerencias.map((g) => {
                        const assignment = chatraceAssignments.find((a) => a.gerencia_id === g.id);
                        const isAssigned = !!assignment;
                        const weight = assignment?.weight ?? 0;
                        const phoneMode = assignment?.phoneMode ?? "random";
                        const phoneKind = assignment?.phoneKind ?? "carga";
                        const intervalStartHour = assignment?.intervalStartHour ?? null;
                        const intervalEndHour = assignment?.intervalEndHour ?? null;
                        return (
                          <tr key={g.id} className="bg-zinc-950/40">
                            <td className="px-3 py-2 text-zinc-300">{g.gerencia_id ?? "MANUAL"}</td>
                            <td className="px-3 py-2 text-zinc-200">{g.nombre}</td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => {
                                  if (isAssigned) {
                                    setChatraceAssignments((prev) => prev.filter((a) => a.gerencia_id !== g.id));
                                  } else {
                                    setChatraceAssignments((prev) => [
                                      ...prev,
                                      {
                                        gerencia_id: g.id,
                                        weight: 1,
                                        phoneMode: "random",
                                        phoneKind: "carga",
                                        intervalStartHour: null,
                                        intervalEndHour: null,
                                      },
                                    ]);
                                  }
                                }}
                                className="rounded border-zinc-600"
                              />
                            </td>
                            {chatraceGerenciaSelectionMode === "weighted_random" ? (
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={weight}
                                  onChange={(e) => {
                                    if (!isAssigned) return;
                                    const v = parseInt(e.target.value, 10);
                                    const next = Number.isNaN(v) ? 0 : Math.max(0, v);
                                    setChatraceAssignments((prev) =>
                                      prev.map((a) => (a.gerencia_id === g.id ? { ...a, weight: next } : a)),
                                    );
                                  }}
                                  disabled={!isAssigned}
                                  className="w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </td>
                            ) : null}
                            <td className="px-3 py-2">
                              <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isAssigned) return;
                                    setChatraceAssignments((prev) =>
                                      prev.map((a) => (a.gerencia_id === g.id ? { ...a, phoneMode: "random" } : a)),
                                    );
                                  }}
                                  className={`cursor-pointer px-2 py-1 rounded-l-lg border-r border-zinc-700 ${phoneMode === "random" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}
                                >
                                  Aleatorio
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isAssigned) return;
                                    setChatraceAssignments((prev) =>
                                      prev.map((a) => (a.gerencia_id === g.id ? { ...a, phoneMode: "fair" } : a)),
                                    );
                                  }}
                                  className={`cursor-pointer px-2 py-1 rounded-r-lg ${phoneMode === "fair" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}
                                >
                                  Equitativo
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                                {(["carga", "ads", "mkt"] as const).map((kind) => (
                                  <button
                                    key={kind}
                                    type="button"
                                    onClick={() => {
                                      if (!isAssigned) return;
                                      setChatraceAssignments((prev) =>
                                        prev.map((a) => (a.gerencia_id === g.id ? { ...a, phoneKind: kind } : a)),
                                      );
                                    }}
                                    className={`cursor-pointer px-2 py-1 ${kind !== "mkt" ? "border-r border-zinc-700" : ""} ${phoneKind === kind ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}
                                  >
                                    {kind === "carga" ? "Carga" : kind === "ads" ? "Ads" : "Mkt"}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                                <label className="flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={intervalStartHour !== null && intervalEndHour !== null}
                                    onChange={(e) => {
                                      if (!isAssigned) return;
                                      setChatraceAssignments((prev) =>
                                        prev.map((a) => {
                                          if (a.gerencia_id !== g.id) return a;
                                          if (!e.target.checked) {
                                            return { ...a, intervalStartHour: null, intervalEndHour: null };
                                          }
                                          return {
                                            ...a,
                                            intervalStartHour: a.intervalStartHour ?? 9,
                                            intervalEndHour: a.intervalEndHour ?? 21,
                                          };
                                        }),
                                      );
                                    }}
                                    className="rounded border-zinc-600"
                                  />
                                  <span>Aplicar</span>
                                </label>
                                {intervalStartHour !== null && intervalEndHour !== null ? (
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span>Dentro de</span>
                                    <select
                                      value={intervalStartHour}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        const n = Number.isNaN(v) ? 0 : Math.max(0, Math.min(23, v));
                                        setChatraceAssignments((prev) =>
                                          prev.map((a) =>
                                            a.gerencia_id === g.id ? { ...a, intervalStartHour: n } : a
                                          ),
                                        );
                                      }}
                                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                                    >
                                      {Array.from({ length: 24 }).map((_, h) => (
                                        <option key={`start-${g.id}-${h}`} value={h}>
                                          {h.toString().padStart(2, "0")}:00
                                        </option>
                                      ))}
                                    </select>
                                    <span>a</span>
                                    <select
                                      value={intervalEndHour}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        const n = Number.isNaN(v) ? 0 : Math.max(0, Math.min(23, v));
                                        setChatraceAssignments((prev) =>
                                          prev.map((a) =>
                                            a.gerencia_id === g.id ? { ...a, intervalEndHour: n } : a
                                          ),
                                        );
                                      }}
                                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                                    >
                                      {Array.from({ length: 24 }).map((_, h) => (
                                        <option key={`end-${g.id}-${h}`} value={h}>
                                          {h.toString().padStart(2, "0")}:00
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            ) : null}
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={chatraceSaving}
              onClick={() => void handleChatraceSave()}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-60"
            >
              {chatraceSaving ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </div>
      </section>
      ) : (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">Configuración Meta CAPI</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openQuickModal}
              className="rounded-xl bg-lime-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-900 transition hover:bg-lime-300"
            >
              AÑADIR PIXEL
            </button>
            <button
              type="button"
              onClick={() => setActiveIntegration("menu")}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Volver
            </button>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-zinc-300">Pixeles configurados</h4>
            <span className="text-[11px] text-zinc-500">{pixelConfigs.length}</span>
          </div>
          {pixelConfigs.length === 0 ? (
            <p className="text-[11px] text-zinc-500">No hay pixeles cargados.</p>
          ) : (
            <div className="space-y-1.5">
              {pixelConfigs.map((px) => {
                const token = px.meta_access_token || "";
                const tokenMasked = token.length > 14 ? `${token.slice(0, 8)}...${token.slice(-6)}` : token || "-";
                return (
                  <div key={px.id} className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-zinc-200">{px.pixel_id}</p>
                      <p className="truncate text-[11px] text-zinc-500">{tokenMasked}</p>
                    </div>
                    <div className="ml-3 flex items-center justify-end gap-2">
                      {px.is_default ? (
                        <span className="rounded border border-emerald-700/70 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] text-emerald-300">Default</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleSetDefault(px)}
                          className="cursor-pointer rounded-lg border border-emerald-700/70 px-2 py-1 text-[10px] text-emerald-300 transition hover:bg-emerald-950/30"
                        >
                          Default
                        </button>
                      )}
                      <button type="button" onClick={() => handleEdit(px)} className="cursor-pointer rounded-lg border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 transition hover:bg-zinc-800">
                        Editar
                      </button>
                      <button type="button" onClick={() => void handleDelete(px)} className="cursor-pointer rounded-lg border border-red-700/80 px-2 py-1 text-[10px] text-red-300 transition hover:bg-red-950/30">
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-500">
          Endpoint de conversiones:{" "}
          {endpointUrl ? (
            <code className="break-all text-emerald-400">{endpointUrl}</code>
          ) : (
            <span className="text-amber-400">cliente sin nombre configurado</span>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/30 p-3 text-[11px] text-amber-200">
          <p className="font-semibold">Confirma que tus eventos estan llegando a Meta!</p>
          <p className="mt-1">Ingresa al Administrador de eventos, selecciona tu pixel y dirigite a la seccion "Probar eventos".</p>
          <p className="mt-1">
            Copi tu <code className="rounded bg-zinc-900 px-1 py-0.5 text-[10px]">test_event_code</code> y luego prob tu URL con este formato:
          </p>
          <code className="mt-2 block break-all rounded bg-zinc-950 px-2 py-1 text-[10px] text-emerald-300">
            https://landing.panelbotadmin.com/TU_NOMBRE/?test_event_code=TU_CODIGO_TEST
          </code>
        </div>
      </section>
      )
      )
      )}

      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3">
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Añadir pixel</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input value={quickPixelId} onChange={(e) => setQuickPixelId(e.target.value.replace(/\D/g, ""))} placeholder="Pixel ID" className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100" />
              <select value={quickCurrency} onChange={(e) => setQuickCurrency(e.target.value)} className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100">
                {["ARS","USD","EUR","BRL","CLP","MXN","COP"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={quickToken} onChange={(e) => setQuickToken(e.target.value)} placeholder="Access token" className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 sm:col-span-2" />
            </div>
            {quickErr && <p className="mt-2 text-xs text-red-400">{quickErr}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setQuickOpen(false)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">Cancelar</button>
              <button disabled={saving} type="button" onClick={() => void handleQuickSave()} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-60">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {editOpen && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Editar pixel</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input value={draft.pixel_id} onChange={(e) => setDraft((p) => (p ? { ...p, pixel_id: e.target.value.replace(/\D/g, "") } : p))} placeholder="Pixel ID" className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100" />
              <input value={draft.meta_currency} onChange={(e) => setDraft((p) => (p ? { ...p, meta_currency: e.target.value.toUpperCase() } : p))} placeholder="Moneda" className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100" />
              {isAdmin ? (
                <input
                  value={draft.meta_api_version}
                  onChange={(e) => setDraft((p) => (p ? { ...p, meta_api_version: e.target.value } : p))}
                  placeholder="API Version"
                  className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                />
              ) : (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                  API Version: <span className="font-mono text-zinc-300">{draft.meta_api_version || "v25.0"}</span>
                </div>
              )}
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft((p) => (p ? { ...p, is_default: e.target.checked } : p))} /> Default</label>
              <input value={draft.meta_access_token} onChange={(e) => setDraft((p) => (p ? { ...p, meta_access_token: e.target.value } : p))} placeholder="Access token" className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 sm:col-span-2" />
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.send_contact_capi} onChange={(e) => setDraft((p) => (p ? { ...p, send_contact_capi: e.target.checked } : p))} /> Enviar Contact por CAPI</label>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.geo_use_ipapi} onChange={(e) => setDraft((p) => (p ? { ...p, geo_use_ipapi: e.target.checked } : p))} /> Enviar geo</label>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300 sm:col-span-2"><input type="checkbox" checked={draft.geo_fill_only_when_missing} onChange={(e) => setDraft((p) => (p ? { ...p, geo_fill_only_when_missing: e.target.checked } : p))} /> Solo completar geo faltante</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setEditOpen(false); setDraft(null); }} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">Cancelar</button>
              <button disabled={saving} type="button" onClick={() => void handleEditSave()} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-60">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
