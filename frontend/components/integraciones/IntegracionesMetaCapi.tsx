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
import type { PhoneKind } from "@/lib/landing/types";
import type { Gerencia } from "@/lib/gerencias/types";

const PHONE_KIND_OPTIONS: Array<{ value: PhoneKind; label: string }> = [
  { value: "carga", label: "Carga" },
  { value: "assistant", label: "Asistente" },
  { value: "ads", label: "Ads" },
  { value: "mkt", label: "Mkt" },
];

const CHATRACE_TEMPLATE_URL = "https://chatrace.com/store/template?id=154796&key=elKSlGmNFCeIZbYwvr7z7z";
const CHATRACE_INTERMEDIARY_URL = "https://chatraceinbox.mkt.panelbotadmin.com/api/intermediario-chatrace";
const KOMMO_INTERMEDIARY_BASE_URL = "https://kommoinbox.mkt.panelbotadmin.com";
const CHATRACE_CUSTOM_FIELDS = [
  "email_detected",
  "event_id",
  "event_time",
  "external_id",
  "phone_detected",
  "promo_code",
  "telefono_asignado",
  "timestamp",
  "whatsapp_link",
];
const CHATRACE_CONSTRUCTOR_BODY = `{
  "event_name": "Contact",
  "meta_pixel_id": "",
  "event_id": "{{event_id}}",
  "external_id": "{{external_id}}",
  "email": "{{email_detected}}",
  "phone": "{{phone_detected}}",
  "test_event_code": "",
  "telefono_asignado": "{{telefono_asignado}}",
  "promo_code": "{{promo_code}}",
  "source_platform": "chatrace",
  "device_type": "mobile",
  "timestamp": "{{timestamp}}",
  "event_time": "{{event_time}}"
}`;

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

type ActiveIntegration = "menu" | "meta" | "constructor" | "kommo" | "chatrace";

function resolveIntegrationSection(section: string | null): ActiveIntegration | null {
  switch ((section ?? "").toLowerCase()) {
    case "meta":
      return "meta";
    case "endpoint":
    case "constructor":
      return "constructor";
    case "kommo":
      return "kommo";
    case "chatrace":
      return "chatrace";
    default:
      return null;
  }
}

function ConstructorEndpointLogo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-sky-50 text-sky-600">
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-6 w-6">
        <path
          d="M7 10.5C7 8.6 8.6 7 10.5 7h11C23.4 7 25 8.6 25 10.5v11c0 1.9-1.6 3.5-3.5 3.5h-11C8.6 25 7 23.4 7 21.5v-11Z"
          fill="currentColor"
          opacity="0.14"
        />
        <path
          d="M10.5 12.25h11M10.5 16h11M10.5 19.75h6.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
        <path
          d="M21.25 18.25 24 21l-2.75 2.75M18.75 18.25 16 21l2.75 2.75"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </span>
  );
}

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
  const [activeIntegration, setActiveIntegration] = useState<ActiveIntegration>("menu");
  const [constructorCopyMsg, setConstructorCopyMsg] = useState<string | null>(null);
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
  const [chatraceDetailsOpen, setChatraceDetailsOpen] = useState(false);
  const [chatraceCopyMsg, setChatraceCopyMsg] = useState<string | null>(null);

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
        ? `${KOMMO_INTERMEDIARY_BASE_URL}/api/kommo/webhook?name=${encodeURIComponent(clientName)}`
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
  const chatraceIntermediaryBody = useMemo(
    () => `{
  "name": "${clientName || "<cliente>"}",
  "email": "{{email}}",
  "phone": "{{phone}}"
}`,
    [clientName],
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
        phoneKind: (r.phone_kind as PhoneKind) ?? "carga",
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

  const handleCopyConstructorEndpoint = useCallback(async () => {
    if (!endpointUrl) return;
    try {
      await navigator.clipboard.writeText(endpointUrl);
      setConstructorCopyMsg("Endpoint copiado.");
    } catch {
      setConstructorCopyMsg("No se pudo copiar. Selecciona y copia el endpoint manualmente.");
    }
  }, [endpointUrl]);

  const handleCopyChatraceText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setChatraceCopyMsg(`${label} copiado.`);
      setTimeout(() => setChatraceCopyMsg(null), 2200);
    } catch {
      setChatraceCopyMsg("No se pudo copiar. Selecciona y copia manualmente.");
    }
  }, []);

  useEffect(() => {
    const section = resolveIntegrationSection(new URLSearchParams(window.location.search).get("section"));
    if (section) setActiveIntegration(section);
  }, []);

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
        geo_use_ipapi: true,
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
              : activeIntegration === "constructor"
              ? "INTEGRACIONES > Endpoint de Conversiones del constructor"
              : activeIntegration === "kommo"
              ? "INTEGRACIONES > Integración con CRM Kommo"
              : activeIntegration === "chatrace"
              ? "INTEGRACIONES > Integración con Chatrace"
              : "INTEGRACIONES"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {activeIntegration === "meta"
              ? "Administra la configuración de Meta CAPI."
              : activeIntegration === "constructor"
              ? "Consulta y copia el endpoint de conversiones del cliente."
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
            onClick={() => setActiveIntegration("chatrace")}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-left transition active:scale-[0.99] hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-200">
                <img
                  src="/chatrace-logo.jpeg"
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 shrink-0 rounded-sm object-contain"
                />
                Integración con Chatrace
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
            onClick={() => {
              setConstructorCopyMsg(null);
              setActiveIntegration("constructor");
            }}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-left transition active:scale-[0.99] hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-200">
                <ConstructorEndpointLogo />
                Endpoint de Conversiones del constructor
              </span>
              <span className="text-xs text-zinc-400">Entrar</span>
            </span>
          </button>
        </div>
      ) : (
      activeIntegration === "constructor" ? (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <ConstructorEndpointLogo />
            <h3 className="text-sm font-semibold text-zinc-200">Endpoint de Conversiones del constructor</h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveIntegration("menu")}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Volver
          </button>
        </div>

        <div className="space-y-4 text-sm text-zinc-300">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <p className="font-semibold text-zinc-100">Endpoint del cliente</p>
            <p className="mt-1 text-xs text-zinc-500">
              Usa esta URL para recibir eventos de conversiones en el constructor.
            </p>

            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2 sm:flex-row sm:items-center">
              {endpointUrl ? (
                <code className="min-w-0 flex-1 break-all px-1 py-1 text-xs text-emerald-300">
                  {endpointUrl}
                </code>
              ) : (
                <span className="min-w-0 flex-1 px-1 py-1 text-xs text-amber-300">
                  No se pudo resolver el endpoint porque el cliente no tiene name configurado.
                </span>
              )}
              <button
                type="button"
                disabled={!endpointUrl}
                onClick={() => void handleCopyConstructorEndpoint()}
                className="shrink-0 rounded-lg border border-emerald-700/70 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copiar
              </button>
            </div>

            {constructorCopyMsg && (
              <p className={`mt-2 text-xs ${constructorCopyMsg.includes("copiado") ? "text-emerald-400" : "text-amber-300"}`}>
                {constructorCopyMsg}
              </p>
            )}
          </div>
        </div>
      </section>
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
              {kommoWebhookUrl || `${KOMMO_INTERMEDIARY_BASE_URL}/api/kommo/webhook?name=<nombre_cliente>`}
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

          <section className="rounded-xl border border-sky-900/70 bg-sky-950/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-sky-100">Plantilla de flujo para Chatrace</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Podés descargar la plantilla recomendada para usar en tu cuenta de Chatrace. Antes de activarla,
                  verificá que estén creados todos los campos personalizados y las etiquetas necesarias para que el
                  flujo pueda guardar datos y disparar las conversiones correctamente.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChatraceDetailsOpen((v) => !v)}
                  className="rounded-lg border border-sky-800 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-900/50"
                >
                  {chatraceDetailsOpen ? "Ocultar detalles de integración" : "Ver detalles de integración"}
                </button>
                <a
                  href={CHATRACE_TEMPLATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                >
                  Descargar plantilla
                </a>
                {chatraceCopyMsg && <span className="basis-full text-xs text-emerald-300">{chatraceCopyMsg}</span>}
              </div>
            </div>
            {chatraceDetailsOpen && (
              <div className="mt-4 space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-xs text-zinc-300">
                <div>
                  <p className="font-semibold text-zinc-100">1. Crear campos personalizados</p>
                  <p className="mt-1 leading-relaxed text-zinc-400">
                    Creá estos campos en Chatrace como tipo <span className="font-medium text-zinc-200">Texto</span> y dejalos disponibles en Bandeja de Entrada.
                  </p>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {CHATRACE_CUSTOM_FIELDS.map((field) => (
                      <div key={field} className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 font-mono text-[11px] text-zinc-200">
                        {field}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-zinc-100">2. Etiqueta necesaria</p>
                  <p className="mt-1 leading-relaxed text-zinc-400">
                    La única etiqueta que usamos en este flujo es <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-100">Contact</span>.
                    Debe agregarse en el botón <span className="font-medium text-zinc-200">Ir al Whatsapp</span> de la tarjeta <span className="font-medium text-zinc-200">No es contacto</span>.
                  </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-100">3. External Request inicial</p>
                      <button
                        type="button"
                        onClick={() => void handleCopyChatraceText(CHATRACE_INTERMEDIARY_URL, "URL del intermediario")}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                      >
                        Copiar URL
                      </button>
                    </div>
                    <p className="mt-1 text-zinc-400">Usala en la acción “Solicitud de API Externa”.</p>
                    <div className="mt-2 rounded bg-zinc-950 p-2 font-mono text-[11px] text-sky-200 break-all">
                      POST {CHATRACE_INTERMEDIARY_URL}
                    </div>
                    <p className="mt-2 text-zinc-400">Header:</p>
                    <div className="mt-1 rounded bg-zinc-950 p-2 font-mono text-[11px] text-zinc-200">Content-Type: application/json</div>
                    <p className="mt-2 text-zinc-400">Body:</p>
                    <pre className="mt-1 overflow-x-auto rounded bg-zinc-950 p-2 text-[11px] text-zinc-200">{chatraceIntermediaryBody}</pre>
                    <p className="mt-2 text-zinc-400">Mapeo de respuesta esperado:</p>
                    <div className="mt-1 space-y-1 font-mono text-[11px] text-zinc-300">
                      <p>promo_code -&gt; promo_code</p>
                      <p>whatsapp_link -&gt; whatsapp_link</p>
                      <p>external_id -&gt; external_id</p>
                      <p>event_id -&gt; event_id</p>
                      <p>timestamp -&gt; timestamp</p>
                      <p>telefono_asignado -&gt; telefono_asignado</p>
                      <p>phone -&gt; phone_detected</p>
                      <p>email -&gt; email_detected</p>
                      <p>event_time -&gt; event_time</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-100">4. Botón “Ir al Whatsapp”</p>
                      <button
                        type="button"
                        onClick={() => void handleCopyChatraceText(CHATRACE_CONSTRUCTOR_BODY, "JSON del constructor")}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                      >
                        Copiar JSON
                      </button>
                    </div>
                    <p className="mt-1 text-zinc-400">Configuración del botón:</p>
                    <div className="mt-2 space-y-1 rounded bg-zinc-950 p-2 font-mono text-[11px] text-zinc-200">
                      <p>Enlace: {"{{whatsapp_link}}"}</p>
                      <p>Etiqueta: Contact</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-100">External Request al constructor</p>
                      <button
                        type="button"
                        disabled={!endpointUrl}
                        onClick={() => void handleCopyChatraceText(endpointUrl, "URL POST del constructor")}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                      >
                        Copiar URL
                      </button>
                    </div>
                    <p className="mt-1 text-zinc-400">
                      En la plantilla viene por defecto con <span className="font-mono text-zinc-200">name=ngp</span>. Cambialo por la URL POST del cliente actual:
                    </p>
                    <div className="mt-2 rounded bg-zinc-950 p-2 font-mono text-[11px] text-sky-200 break-all">
                      POST {endpointUrl || "https://<tu-supabase>/functions/v1/conversions?name=<cliente>"}
                    </div>
                    <p className="mt-2 text-zinc-400">Header:</p>
                    <div className="mt-1 rounded bg-zinc-950 p-2 font-mono text-[11px] text-zinc-200">Content-Type: application/json</div>
                    <p className="mt-2 text-zinc-400">Body:</p>
                    <pre className="mt-1 max-h-72 overflow-auto rounded bg-zinc-950 p-2 text-[11px] text-zinc-200">{CHATRACE_CONSTRUCTOR_BODY}</pre>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <button
              type="button"
              onClick={() => setChatraceIdOpen((v) => !v)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-200">Identificación</h3>
              <span className="text-sm text-zinc-400">{chatraceIdOpen ? "▾" : "▸"}</span>
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
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-3 py-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-300">Integración activa</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Habilita o deshabilita temporalmente la integración de Chatrace.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={chatraceActive}
                    onClick={() => setChatraceActive((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                      chatraceActive
                        ? "border-emerald-500/60 bg-emerald-500/30"
                        : "border-zinc-700 bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        chatraceActive ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
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
              <span className="text-sm text-zinc-400">{chatraceTrackingOpen ? "▾" : "▸"}</span>
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
              <span className="text-sm text-zinc-400">{chatraceRedirectOpen ? "▾" : "▸"}</span>
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
                                {PHONE_KIND_OPTIONS.map(({ value: kind, label }, idx) => (
                                  <button
                                    key={kind}
                                    type="button"
                                    onClick={() => {
                                      if (!isAssigned) return;
                                      setChatraceAssignments((prev) =>
                                        prev.map((a) => (a.gerencia_id === g.id ? { ...a, phoneKind: kind } : a)),
                                      );
                                    }}
                                    className={`cursor-pointer px-2 py-1 ${idx < PHONE_KIND_OPTIONS.length - 1 ? "border-r border-zinc-700" : ""} ${phoneKind === kind ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}
                                  >
                                    {label}
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
              className="rounded-lg border border-emerald-700/70 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-950/50 disabled:opacity-60"
            >
              {chatraceSaving ? "GUARDANDO..." : "GUARDAR"}
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

        <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/30 p-3 text-[11px] text-amber-200">
          <p className="font-semibold">Confirma que tus eventos estan llegando a Meta!</p>
          <p className="mt-1">Ingresa al Administrador de eventos, selecciona tu pixel y dirigite a la seccion &quot;Probar eventos&quot;.</p>
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
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.is_default}
                  onClick={() => setDraft((p) => (p ? { ...p, is_default: !p.is_default } : p))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                    draft.is_default
                      ? "border-emerald-500/60 bg-emerald-500/30"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      draft.is_default ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span>Default</span>
              </label>
              <input value={draft.meta_access_token} onChange={(e) => setDraft((p) => (p ? { ...p, meta_access_token: e.target.value } : p))} placeholder="Access token" className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 sm:col-span-2" />
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.send_contact_capi}
                  onClick={() => setDraft((p) => (p ? { ...p, send_contact_capi: !p.send_contact_capi } : p))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                    draft.send_contact_capi
                      ? "border-emerald-500/60 bg-emerald-500/30"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      draft.send_contact_capi ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span>Enviar Contact por CAPI</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.geo_use_ipapi}
                  onClick={() => setDraft((p) => (p ? { ...p, geo_use_ipapi: !p.geo_use_ipapi } : p))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                    draft.geo_use_ipapi
                      ? "border-emerald-500/60 bg-emerald-500/30"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      draft.geo_use_ipapi ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span>Enviar geo</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300 sm:col-span-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.geo_fill_only_when_missing}
                  onClick={() => setDraft((p) => (p ? { ...p, geo_fill_only_when_missing: !p.geo_fill_only_when_missing } : p))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                    draft.geo_fill_only_when_missing
                      ? "border-emerald-500/60 bg-emerald-500/30"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      draft.geo_fill_only_when_missing ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span>Solo completar geo faltante</span>
              </label>
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
