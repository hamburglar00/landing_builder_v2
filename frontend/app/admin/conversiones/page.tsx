"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversionsConfig,
  upsertConversionsConfig,
  fetchConversionsForAdmin,
  fetchConversionLogsForAdmin,
  type ConversionsConfig,
  type ConversionRow,
  type ConversionLogRow,
} from "@/lib/conversionsDb";

type Tab = "conversiones" | "logs";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function estadoBadge(estado: string) {
  const cls =
    estado === "purchase"
      ? "bg-emerald-950 text-emerald-300"
      : estado === "lead"
        ? "bg-amber-950 text-amber-300"
        : "bg-zinc-800 text-zinc-400";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${cls}`}>
      {estado}
    </span>
  );
}

function statusText(status: string) {
  if (status === "enviado") return <span className="text-emerald-400">enviado</span>;
  if (status === "error") return <span className="text-red-400">error</span>;
  return <span className="text-zinc-600">-</span>;
}

function levelBadge(level: string) {
  const cls =
    level === "ERROR"
      ? "bg-red-950 text-red-300"
      : level === "DEBUG"
        ? "bg-zinc-800 text-zinc-500"
        : "bg-blue-950 text-blue-300";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {level}
    </span>
  );
}

function truncateId(id: string, len = 8) {
  if (!id) return "-";
  return id.length > len ? id.slice(0, len) + "…" : id;
}

export default function AdminConversionesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [logs, setLogs] = useState<ConversionLogRow[]>([]);
  const [landingNames, setLandingNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tab, setTab] = useState<Tab>("conversiones");
  const [configOpen, setConfigOpen] = useState(false);
  const [endpointOpen, setEndpointOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const [cfg, rows, logRows] = await Promise.all([
          fetchConversionsConfig(user.id),
          fetchConversionsForAdmin(200),
          fetchConversionLogsForAdmin(200),
        ]);
        setConfig(cfg);
        setConversions(rows);
        setLogs(logRows);

        const { data: landings } = await supabase
          .from("landings")
          .select("name")
          .order("name", { ascending: true });
        setLandingNames((landings ?? []).map((l: { name: string }) => l.name));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const handleSave = async () => {
    if (!config || !userId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await upsertConversionsConfig({ ...config, user_id: userId });
      setSaveMsg("Configuración guardada.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  const endpointBase =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Conversiones</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configurá tu integración con Meta Conversions API. Todas tus landings
          usan esta configuración.
        </p>
      </div>

      {saveMsg && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            saveMsg.includes("Error")
              ? "bg-red-950/50 text-red-300"
              : "bg-emerald-950/50 text-emerald-300"
          }`}
          role="alert"
        >
          {saveMsg}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-900/80 p-1 w-fit">
        {(["conversiones", "logs"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`cursor-pointer rounded-md px-4 py-1.5 text-xs font-medium transition ${
              tab === t
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t === "conversiones" ? "Conversiones" : "Logs"}
          </button>
        ))}
      </div>

      {tab === "conversiones" && (
        <>
          {/* ── Collapsible: Config Meta CAPI ── */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button
              type="button"
              onClick={() => setConfigOpen((v) => !v)}
              className="flex w-full cursor-pointer items-center gap-2 p-4"
            >
              <ChevronIcon open={configOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">
                Configuración Meta CAPI
              </h3>
            </button>

            {configOpen && (
              <div className="space-y-4 border-t border-zinc-800 p-4">
                {/* Pixel ID */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Pixel ID
                  </label>
                  <input
                    type="text"
                    value={config?.pixel_id ?? ""}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev ? { ...prev, pixel_id: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Ej: 880464554785896"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Se sincronizará automáticamente a todas tus landings al
                    guardar.
                  </p>
                </div>

                {/* Access Token */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Access Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showToken ? "text" : "password"}
                      value={config?.meta_access_token ?? ""}
                      onChange={(e) =>
                        setConfig((prev) =>
                          prev
                            ? { ...prev, meta_access_token: e.target.value }
                            : prev,
                        )
                      }
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                      placeholder="Token de Meta Conversions API"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
                    >
                      {showToken ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </div>

                {/* Currency + API Version (admin dropdown) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Moneda
                    </label>
                    <select
                      value={config?.meta_currency ?? "ARS"}
                      onChange={(e) =>
                        setConfig((prev) =>
                          prev
                            ? { ...prev, meta_currency: e.target.value }
                            : prev,
                        )
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="BRL">BRL</option>
                      <option value="CLP">CLP</option>
                      <option value="MXN">MXN</option>
                      <option value="COP">COP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      API Version
                    </label>
                    <select
                      value={config?.meta_api_version ?? "v25.0"}
                      onChange={(e) =>
                        setConfig((prev) =>
                          prev
                            ? { ...prev, meta_api_version: e.target.value }
                            : prev,
                        )
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                    >
                      <option value="v25.0">v25.0</option>
                    </select>
                  </div>
                </div>

                {/* Test Event Code */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Test Event Code{" "}
                    <span className="font-normal text-zinc-500">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={config?.test_event_code ?? ""}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev
                          ? { ...prev, test_event_code: e.target.value }
                          : prev,
                      )
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    placeholder="TEST12345"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Si tiene valor, los eventos se envían en modo test (visible
                    en Events Manager → Test Events). Dejalo vacío para
                    producción.
                  </p>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 border-t border-zinc-800 pt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config?.send_contact_capi ?? false}
                      onChange={(e) =>
                        setConfig((prev) =>
                          prev
                            ? { ...prev, send_contact_capi: e.target.checked }
                            : prev,
                        )
                      }
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                    />
                    <span className="text-xs text-zinc-300">
                      Enviar evento Contact por CAPI al recibir contacto de la
                      landing
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config?.geo_use_ipapi ?? false}
                      onChange={(e) =>
                        setConfig((prev) =>
                          prev
                            ? { ...prev, geo_use_ipapi: e.target.checked }
                            : prev,
                        )
                      }
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                    />
                    <span className="text-xs text-zinc-300">
                      Enriquecer geo por IP (ipapi.co)
                    </span>
                  </label>

                  {config?.geo_use_ipapi && (
                    <label className="ml-6 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config?.geo_fill_only_when_missing ?? false}
                        onChange={(e) =>
                          setConfig((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  geo_fill_only_when_missing: e.target.checked,
                                }
                              : prev,
                          )
                        }
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                      />
                      <span className="text-xs text-zinc-300">
                        Solo completar geo faltante (no pisar datos del payload)
                      </span>
                    </label>
                  )}
                </div>

                {/* Save */}
                <div className="flex gap-3 border-t border-zinc-800 pt-4">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="cursor-pointer rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 active:scale-95 disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar configuración"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Collapsible: Endpoint ── */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button
              type="button"
              onClick={() => setEndpointOpen((v) => !v)}
              className="flex w-full cursor-pointer items-center gap-2 p-4"
            >
              <ChevronIcon open={endpointOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">
                Endpoint de conversiones
              </h3>
            </button>

            {endpointOpen && (
              <div className="space-y-3 border-t border-zinc-800 p-4">
                <p className="text-xs text-zinc-400">
                  Tus landings y sistemas externos deben enviar POST a esta URL.
                </p>

                {landingNames.length > 0 ? (
                  <div className="space-y-2">
                    {landingNames.map((name) => {
                      const url = `${endpointBase}/functions/v1/conversions?name=${encodeURIComponent(name)}`;
                      return (
                        <div
                          key={name}
                          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2"
                        >
                          <span className="shrink-0 text-[11px] font-medium text-zinc-400">
                            {name}
                          </span>
                          <code className="flex-1 text-[11px] text-emerald-400 break-all">
                            {url}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(url)}
                            className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                            title="Copiar URL"
                          >
                            {copiedUrl === url ? (
                              <span className="text-[10px] text-emerald-400">✓</span>
                            ) : (
                              <CopyIcon />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                    <code className="text-[11px] text-emerald-400 break-all">
                      {endpointBase}/functions/v1/conversions?name=NOMBRE_LANDING
                    </code>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Detailed Conversions Table ── */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-zinc-200">
              Últimas conversiones{" "}
              <span className="font-normal text-zinc-500">
                ({conversions.length})
              </span>
            </h3>
            {conversions.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Aún no hay conversiones registradas.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-700">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-zinc-800/80">
                    <tr>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">phone</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">contact_event_id</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">lead_event_id</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">purchase_event_id</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">timestamp</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">clientIP</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">estado</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">valor</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">contact_status_capi</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">lead_status_capi</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">purchase_status_capi</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {conversions.map((c) => {
                      const rowColor =
                        c.estado === "purchase"
                          ? "bg-emerald-950/20"
                          : c.estado === "lead"
                            ? "bg-amber-950/20"
                            : "bg-zinc-950/40";
                      return (
                        <tr key={c.id} className={rowColor}>
                          <td className="px-2 py-1.5 text-zinc-200 font-mono whitespace-nowrap">
                            {c.phone || "-"}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400 font-mono whitespace-nowrap" title={c.contact_event_id}>
                            {truncateId(c.contact_event_id)}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400 font-mono whitespace-nowrap" title={c.lead_event_id}>
                            {truncateId(c.lead_event_id)}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400 font-mono whitespace-nowrap" title={c.purchase_event_id}>
                            {truncateId(c.purchase_event_id)}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">
                            {new Date(c.created_at).toLocaleString("es-AR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400 font-mono whitespace-nowrap">
                            {c.client_ip || "-"}
                          </td>
                          <td className="px-2 py-1.5">{estadoBadge(c.estado)}</td>
                          <td className="px-2 py-1.5 text-zinc-200 whitespace-nowrap">
                            {c.valor > 0 ? c.valor : "-"}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {statusText(c.contact_status_capi)}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {statusText(c.lead_status_capi)}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {statusText(c.purchase_status_capi)}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-500 max-w-[250px] truncate" title={c.observaciones}>
                            {c.observaciones || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Logs Tab ── */}
      {tab === "logs" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">
            Logs de conversiones{" "}
            <span className="font-normal text-zinc-500">
              ({logs.length})
            </span>
          </h3>
          {logs.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aún no hay logs registrados.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-zinc-800/80">
                  <tr>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Fecha</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Nivel</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Función</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Mensaje</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="bg-zinc-950/40">
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-AR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-2 py-1.5">{levelBadge(log.level)}</td>
                      <td className="px-2 py-1.5 text-zinc-300 font-mono whitespace-nowrap">
                        {log.function_name}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-200">
                        {log.message}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {log.detail ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLog(
                                expandedLog === log.id ? null : log.id,
                              )
                            }
                            className="cursor-pointer text-zinc-400 underline hover:text-zinc-200"
                          >
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : (
                          "-"
                        )}
                        {expandedLog === log.id && log.detail && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => {
                              try {
                                return JSON.stringify(
                                  JSON.parse(log.detail),
                                  null,
                                  2,
                                );
                              } catch {
                                return log.detail;
                              }
                            })()}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
