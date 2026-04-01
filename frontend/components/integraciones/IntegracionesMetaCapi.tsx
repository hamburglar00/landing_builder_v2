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
  const [activeIntegration, setActiveIntegration] = useState<"menu" | "meta" | "kommo">("menu");

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

  const loadAll = useCallback(async (uid: string) => {
    const [cfg, pixels] = await Promise.all([
      fetchConversionsConfig(uid),
      fetchPixelConfigs(uid),
    ]);
    setConfig(cfg);
    setPixelConfigs(pixels);
    const { data: p } = await supabase
      .from("profiles")
      .select("nombre, role")
      .eq("id", uid)
      .maybeSingle();
    setClientName(String(p?.nombre ?? ""));
    setIsAdmin(String(p?.role ?? "") === "admin");
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
              : "INTEGRACIONES"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {activeIntegration === "meta"
              ? "Administra la configuración de Meta CAPI."
              : activeIntegration === "kommo"
              ? "Guía rápida para conectar Kommo con tu endpoint."
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
                <svg className="h-8 w-8 shrink-0 rounded-sm" viewBox="0 0 64 64" aria-hidden="true">
                  <rect width="64" height="64" fill="#EAEAEA" />
                  <path
                    d="M8 35c0-11 7-19 14-19 7 0 12 5 18 16 6-11 11-16 18-16 7 0 14 8 14 19s-7 19-14 19c-7 0-12-5-18-16-6 11-11 16-18 16-7 0-14-8-14-19Z"
                    fill="none"
                    stroke="#1877F2"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
                <svg className="h-8 w-8 shrink-0 rounded-sm" viewBox="0 0 64 64" aria-hidden="true">
                  <rect width="64" height="64" fill="#EAEAEA" />
                  <path
                    d="M18 48c-1.7 0-3-1.3-3-3V30.5C15 20.8 22.8 13 32.5 13h3.8l-11.5 16h4.9L42.3 13H47c1.8 0 2.8 2 1.7 3.4L36.3 33.9l13 15.8c1.1 1.4.1 3.3-1.7 3.3h-5.3L29.2 37.5c-.8-1-2.3-.4-2.3.8V45c0 1.7-1.3 3-3 3H18Z"
                    fill="#19164A"
                  />
                </svg>
                Integración con CRM Kommo
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
              <li>Generar <span className="font-medium">Token de larga duración</span>.</li>
              <li>Copiar el token de larga duración.</li>
            </ol>
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

