"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversionsConfig,
  upsertConversionsConfig,
  fetchConversionsForAdmin,
  fetchConversionLogsForAdmin,
  fetchFunnelContactsForAdmin,
  updateConversionEmail,
  type ConversionsConfig,
  type ConversionRow,
  type ConversionLogRow,
  type FunnelContact,
  updateAllVisibleColumns,
} from "@/lib/conversionsDb";
import { generateDemoConversions, generateDemoFunnelContacts } from "@/lib/demoData";
import FunnelBoard from "@/components/conversiones/FunnelBoard";
import StatsPanel from "@/components/conversiones/StatsPanel";
import DateRangeFilter, {
  type DateRange,
  filterByDateRange,
  filterFunnelByDateRange,
} from "@/components/conversiones/DateRangeFilter";

type Tab = "configuracion" | "tabla" | "funnel" | "estadisticas" | "logs";

const TAB_ORDER: Tab[] = ["funnel", "tabla", "estadisticas", "configuracion", "logs"];

const TAB_LABELS: Record<Tab, string> = {
  funnel: "Funnel",
  tabla: "Tabla",
  estadisticas: "Estadísticas",
  configuracion: "Configuración",
  logs: "Logs",
};

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

const ALL_COLUMNS = [
  "phone","email","fn","ln","ct","st","zip","country","fbp","fbc",
  "contact_event_id","contact_event_time","lead_event_id","lead_event_time",
  "purchase_event_id","purchase_event_time","timestamp","clientIP","agentuser",
  "estado","valor","contact_status_capi","lead_status_capi","purchase_status_capi",
  "observaciones","external_id","utm_campaign","telefono_asignado","promo_code",
  "device_type","geo_city","geo_region","geo_country",
] as const;

type ColKey = (typeof ALL_COLUMNS)[number];

function EditableEmailCell({
  row,
  onSaved,
}: {
  row: ConversionRow;
  onSaved: (id: string, email: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.email);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed === row.email) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateConversionEmail(row.id, trimmed);
      onSaved(row.id, trimmed);
    } catch { setValue(row.email); }
    finally { setSaving(false); setEditing(false); }
  };

  if (editing) {
    return (
      <td className="px-1 py-0.5">
        <input
          autoFocus type="email" value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setValue(row.email); setEditing(false); }
          }}
          disabled={saving}
          className="w-full min-w-[140px] rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100 outline-none focus:border-zinc-400"
        />
      </td>
    );
  }

  return (
    <td
      className="px-2 py-1.5 whitespace-nowrap text-zinc-400 cursor-pointer hover:text-zinc-200 group"
      onClick={() => { setValue(row.email); setEditing(true); }}
      title="Click para editar email"
    >
      {row.email || <span className="text-zinc-600 group-hover:text-zinc-400">+ email</span>}
    </td>
  );
}

function cellValue(c: ConversionRow, col: ColKey): React.ReactNode {
  const cell = "px-2 py-1.5 whitespace-nowrap";
  const mono = `${cell} font-mono`;
  const dim = `${cell} text-zinc-400`;
  const dimMono = `${dim} font-mono`;

  switch (col) {
    case "phone": return <td key={col} className={`${mono} text-zinc-200`}>{c.phone || "-"}</td>;
    case "email": return <td key={col} className={dim}>{c.email || "-"}</td>;
    case "fn": return <td key={col} className={dim}>{c.fn || "-"}</td>;
    case "ln": return <td key={col} className={dim}>{c.ln || "-"}</td>;
    case "ct": return <td key={col} className={dim}>{c.ct || "-"}</td>;
    case "st": return <td key={col} className={dim}>{c.st || "-"}</td>;
    case "zip": return <td key={col} className={dim}>{c.zip || "-"}</td>;
    case "country": return <td key={col} className={dim}>{c.country || "-"}</td>;
    case "fbp": return <td key={col} className={dimMono}>{c.fbp ? truncateId(c.fbp, 12) : "-"}</td>;
    case "fbc": return <td key={col} className={dimMono}>{c.fbc ? truncateId(c.fbc, 12) : "-"}</td>;
    case "contact_event_id": return <td key={col} className={dimMono} title={c.contact_event_id}>{truncateId(c.contact_event_id)}</td>;
    case "contact_event_time": return <td key={col} className={dim}>{c.contact_event_time ?? "-"}</td>;
    case "lead_event_id": return <td key={col} className={dimMono} title={c.lead_event_id}>{truncateId(c.lead_event_id)}</td>;
    case "lead_event_time": return <td key={col} className={dim}>{c.lead_event_time ?? "-"}</td>;
    case "purchase_event_id": return <td key={col} className={dimMono} title={c.purchase_event_id}>{truncateId(c.purchase_event_id)}</td>;
    case "purchase_event_time": return <td key={col} className={dim}>{c.purchase_event_time ?? "-"}</td>;
    case "timestamp": return (
      <td key={col} className={dim}>
        {new Date(c.created_at).toLocaleString("es-AR", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        })}
      </td>
    );
    case "clientIP": return <td key={col} className={dimMono}>{c.client_ip || "-"}</td>;
    case "agentuser": return <td key={col} className={dim}>{c.agent_user || "-"}</td>;
    case "estado": return <td key={col} className={cell}>{estadoBadge(c.estado)}</td>;
    case "valor": return <td key={col} className={`${cell} text-zinc-200`}>{c.valor > 0 ? c.valor : "-"}</td>;
    case "contact_status_capi": return <td key={col} className={cell}>{statusText(c.contact_status_capi)}</td>;
    case "lead_status_capi": return <td key={col} className={cell}>{statusText(c.lead_status_capi)}</td>;
    case "purchase_status_capi": return <td key={col} className={cell}>{statusText(c.purchase_status_capi)}</td>;
    case "observaciones": return <td key={col} className={`${cell} text-zinc-500 max-w-[200px] truncate`} title={c.observaciones}>{c.observaciones || "-"}</td>;
    case "external_id": return <td key={col} className={dimMono}>{c.external_id ? truncateId(c.external_id) : "-"}</td>;
    case "utm_campaign": return <td key={col} className={dim}>{c.utm_campaign || "-"}</td>;
    case "telefono_asignado": return <td key={col} className={dim}>{c.telefono_asignado || "-"}</td>;
    case "promo_code": return <td key={col} className={dim}>{c.promo_code || "-"}</td>;
    case "device_type": return <td key={col} className={dim}>{c.device_type || "-"}</td>;
    case "geo_city": return <td key={col} className={dim}>{c.geo_city || "-"}</td>;
    case "geo_region": return <td key={col} className={dim}>{c.geo_region || "-"}</td>;
    case "geo_country": return <td key={col} className={dim}>{c.geo_country || "-"}</td>;
    default: return <td key={col} className={dim}>-</td>;
  }
}

const DEFAULT_VISIBLE = new Set<ColKey>(ALL_COLUMNS);

export default function AdminConversionesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [funnelContacts, setFunnelContacts] = useState<FunnelContact[]>([]);
  const [logs, setLogs] = useState<ConversionLogRow[]>([]);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tab, setTab] = useState<Tab>("funnel");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => new Set(DEFAULT_VISIBLE));

  const [demoMode, setDemoMode] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [tableCleared, setTableCleared] = useState(false);
  const [funnelCleared, setFunnelCleared] = useState(false);
  const [statsCleared, setStatsCleared] = useState(false);
  const [refreshingTable, setRefreshingTable] = useState(false);

  const demoConversions = useMemo(() => generateDemoConversions(80), []);
  const demoFunnel = useMemo(() => generateDemoFunnelContacts(demoConversions), [demoConversions]);

  const rawConversions = demoMode ? demoConversions : conversions;
  const rawFunnel = demoMode ? demoFunnel : funnelContacts;
  const activeConversions = useMemo(() => filterByDateRange(rawConversions, dateRange), [rawConversions, dateRange]);
  const activeFunnel = useMemo(() => filterFunnelByDateRange(rawFunnel, dateRange), [rawFunnel, dateRange]);

  // Collapsible states for config tab
  const [configOpen, setConfigOpen] = useState(false);
  const [endpointOpen, setEndpointOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [funnelConfigOpen, setFunnelConfigOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const [cfg, rows, funnel, logRows] = await Promise.all([
          fetchConversionsConfig(user.id),
          fetchConversionsForAdmin(500),
          fetchFunnelContactsForAdmin(),
          fetchConversionLogsForAdmin(200),
        ]);
        setConfig(cfg);
        if (cfg.visible_columns && cfg.visible_columns.length) {
          const valid = cfg.visible_columns.filter((c) => (ALL_COLUMNS as readonly string[]).includes(c)) as ColKey[];
          setVisibleCols(new Set(valid.length ? valid : DEFAULT_VISIBLE));
        } else {
          setVisibleCols(new Set(DEFAULT_VISIBLE));
        }
        setConversions(rows);
        setFunnelContacts(funnel);
        setLogs(logRows);

        const { data: profile } = await supabase
          .from("profiles").select("nombre").eq("id", user.id).maybeSingle();
        setClientName(profile?.nombre ?? "");
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    void init();
  }, []);

  const handleSave = async () => {
    if (!config || !userId) return;
    setSaving(true); setSaveMsg(null);
    try {
      const cols = config.visible_columns ?? null;
      await upsertConversionsConfig({ ...config, user_id: userId });
      // Propagar columnas visibles a todos los clientes
      await updateAllVisibleColumns(cols);
      setSaveMsg("Configuración guardada.");
    } catch (e) {
      // Mostrar más contexto del error para poder diagnosticar problemas de RLS o esquema en producción
      // y loguearlo en consola del navegador.
      // deno-lint-ignore no-explicit-any
      console.error("Error al guardar configuración de conversiones:", e as any);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);
      setSaveMsg(msg || "Error al guardar");
    } finally { setSaving(false); }
  };

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  }, []);

  const refreshTable = useCallback(async () => {
    setRefreshingTable(true);
    setTableCleared(false);
    setFunnelCleared(false);
    setStatsCleared(false);
    try {
      const [rows, funnel, logRows] = await Promise.all([
        fetchConversionsForAdmin(500),
        fetchFunnelContactsForAdmin(),
        fetchConversionLogsForAdmin(200),
      ]);
      setConversions(rows);
      setFunnelContacts(funnel);
      setLogs(logRows);
    } catch (e) { console.error(e); }
    finally { setRefreshingTable(false); }
  }, []);

  const clearTableDisplay = useCallback(() => {
    setTableCleared(true);
  }, []);

  const clearFunnelDisplay = useCallback(() => {
    setFunnelCleared(true);
  }, []);

  const clearStatsDisplay = useCallback(() => {
    setStatsCleared(true);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  const endpointBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Conversiones</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Tu pipeline de leads, cargas y estadísticas.
        </p>
      </div>

      {saveMsg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${saveMsg.includes("Error") ? "bg-red-950/50 text-red-300" : "bg-emerald-950/50 text-emerald-300"}`} role="alert">
          {saveMsg}
        </p>
      )}

      {/* Tabs + Demo toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-zinc-800/60 pb-1">
        <div className="flex gap-4">
          {TAB_ORDER.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative cursor-pointer pb-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {TAB_LABELS[t]}
                <span
                  className={`pointer-events-none absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full transition-opacity ${
                    active ? "bg-zinc-100 opacity-100" : "bg-zinc-600 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-amber-500"
          />
          <span className={`text-[11px] font-medium ${demoMode ? "text-amber-400" : "text-zinc-500"}`}>
            Datos demo
          </span>
        </label>
      </div>

      {/* Date filter — visible on funnel, tabla, estadisticas */}
      {(tab === "funnel" || tab === "tabla" || tab === "estadisticas") && (
        <div className="flex justify-end pt-1">
          <DateRangeFilter onChange={setDateRange} />
        </div>
      )}
      {demoMode && (
        <p className="rounded-lg bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 text-[11px] text-amber-300">
          Visualizando datos de demostración. Desactivá el toggle para ver datos reales.
        </p>
      )}

      {/* ═══════════ TAB: CONFIGURACIÓN ═══════════ */}
      {tab === "configuracion" && (
        <div className="space-y-4">
          {/* Meta CAPI */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button type="button" onClick={() => setConfigOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 p-4">
              <ChevronIcon open={configOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">Configuración Meta CAPI</h3>
            </button>
            {configOpen && (
              <div className="space-y-4 border-t border-zinc-800 p-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Pixel ID</label>
                  <input type="text" value={config?.pixel_id ?? ""} onChange={(e) => setConfig((p) => p ? { ...p, pixel_id: e.target.value } : p)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" placeholder="Ej: 880464554785896" />
                  <p className="mt-1 text-[11px] text-zinc-500">Se sincronizará automáticamente a todas tus landings al guardar.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Access Token</label>
                  <div className="flex gap-2">
                    <input type={showToken ? "text" : "password"} value={config?.meta_access_token ?? ""} onChange={(e) => setConfig((p) => p ? { ...p, meta_access_token: e.target.value } : p)} className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" placeholder="Token de Meta Conversions API" />
                    <button type="button" onClick={() => setShowToken((v) => !v)} className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800">{showToken ? "Ocultar" : "Ver"}</button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Moneda</label>
                    <select value={config?.meta_currency ?? "ARS"} onChange={(e) => setConfig((p) => p ? { ...p, meta_currency: e.target.value } : p)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100">
                      {["ARS","USD","EUR","BRL","CLP","MXN","COP"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">API Version</label>
                    <select value={config?.meta_api_version ?? "v25.0"} onChange={(e) => setConfig((p) => p ? { ...p, meta_api_version: e.target.value } : p)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100">
                      <option value="v25.0">v25.0</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Test Event Code <span className="font-normal text-zinc-500">(opcional)</span></label>
                  <input type="text" value={config?.test_event_code ?? ""} onChange={(e) => setConfig((p) => p ? { ...p, test_event_code: e.target.value } : p)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" placeholder="TEST12345" />
                  <p className="mt-1 text-[11px] text-zinc-500">Si tiene valor, los eventos se envían en modo test. Dejalo vacío para producción.</p>
                </div>
                <div className="space-y-3 border-t border-zinc-800 pt-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={config?.send_contact_capi ?? false} onChange={(e) => setConfig((p) => p ? { ...p, send_contact_capi: e.target.checked } : p)} className="h-4 w-4 rounded border-zinc-600 bg-zinc-900" />
                    <span className="text-xs text-zinc-300">Enviar evento Contact por CAPI al recibir contacto de la landing</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={config?.geo_use_ipapi ?? false} onChange={(e) => setConfig((p) => p ? { ...p, geo_use_ipapi: e.target.checked } : p)} className="h-4 w-4 rounded border-zinc-600 bg-zinc-900" />
                    <span className="text-xs text-zinc-300">Enriquecer geo por IP (ipapi.co)</span>
                  </label>
                  {config?.geo_use_ipapi && (
                    <label className="ml-6 flex items-center gap-2">
                      <input type="checkbox" checked={config?.geo_fill_only_when_missing ?? false} onChange={(e) => setConfig((p) => p ? { ...p, geo_fill_only_when_missing: e.target.checked } : p)} className="h-4 w-4 rounded border-zinc-600 bg-zinc-900" />
                      <span className="text-xs text-zinc-300">Solo completar geo faltante (no pisar datos del payload)</span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Endpoint */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button type="button" onClick={() => setEndpointOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 p-4">
              <ChevronIcon open={endpointOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">Endpoint de conversiones</h3>
            </button>
            {endpointOpen && (
              <div className="space-y-3 border-t border-zinc-800 p-4">
                <p className="text-xs text-zinc-400">Tus landings y sistemas externos deben enviar POST a esta URL.</p>
                {(() => {
                  const url = clientName ? `${endpointBase}/functions/v1/conversions?name=${encodeURIComponent(clientName)}` : "";
                  return clientName ? (
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                      <code className="flex-1 text-[11px] text-emerald-400 break-all">{url}</code>
                      <button type="button" onClick={() => copyToClipboard(url)} className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300" title="Copiar URL">
                        {copiedUrl === url ? <span className="text-[10px] text-emerald-400">✓</span> : <CopyIcon />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-400">El cliente no tiene nombre configurado en su perfil.</p>
                  );
                })()}
              </div>
            )}
          </section>

          {/* Column Visibility (admin only) */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button type="button" onClick={() => setColumnsOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 p-4">
              <ChevronIcon open={columnsOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">Columnas visibles</h3>
              <span className="ml-auto text-[11px] text-zinc-500">{visibleCols.size}/{ALL_COLUMNS.length}</span>
            </button>
            {columnsOpen && (
              <div className="border-t border-zinc-800 p-4">
                <div className="mb-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(ALL_COLUMNS);
                      setVisibleCols(next);
                      setConfig((prev) => prev ? { ...prev, visible_columns: [...ALL_COLUMNS] } : prev);
                    }}
                    className="cursor-pointer text-[11px] text-zinc-400 underline hover:text-zinc-200"
                  >
                    Seleccionar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set<ColKey>();
                      setVisibleCols(next);
                      setConfig((prev) => prev ? { ...prev, visible_columns: [] } : prev);
                    }}
                    className="cursor-pointer text-[11px] text-zinc-400 underline hover:text-zinc-200"
                  >
                    Deseleccionar todas
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 sm:grid-cols-4 md:grid-cols-6">
                  {ALL_COLUMNS.map((col) => (
                    <label key={col} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col)}
                        onChange={(e) => {
                          setVisibleCols((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(col);
                            else next.delete(col);
                            const arr = [...next] as ColKey[];
                            setConfig((prev) => prev ? { ...prev, visible_columns: arr } : prev);
                            return next;
                          });
                        }}
                        className="h-3 w-3 rounded border-zinc-600 bg-zinc-900"
                      />
                      <span className="text-[10px] text-zinc-400">{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Funnel Configuration */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button type="button" onClick={() => setFunnelConfigOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 p-4">
              <ChevronIcon open={funnelConfigOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">Personalización del funnel</h3>
            </button>
            {funnelConfigOpen && (
              <div className="space-y-4 border-t border-zinc-800 p-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Monto mínimo para Jugador Premium</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={config?.funnel_premium_threshold ?? 50000}
                    onChange={(e) => setConfig((p) => p ? { ...p, funnel_premium_threshold: parseFloat(e.target.value) || 0 } : p)}
                    className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    placeholder="50000"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Contactos cuya sumatoria total de cargas sea igual o mayor a este monto se clasifican como Jugador Premium.
                  </p>
                </div>
              </div>
            )}
          </section>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer rounded-lg bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 active:scale-95 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ TAB: TABLA ═══════════ */}
      {tab === "tabla" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Tabla de conversiones{" "}
              <span className="font-normal text-zinc-500">({tableCleared ? 0 : activeConversions.length})</span>
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={refreshTable}
                disabled={refreshingTable}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-60"
                title="Actualizar datos"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshingTable ? "Actualizando…" : "Actualizar"}
              </button>
              <button
                type="button"
                onClick={clearTableDisplay}
                disabled={tableCleared || activeConversions.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ocultar registros de la vista (no borra de la base)"
              >
                Limpiar vista
              </button>
            </div>
          </div>
          {(() => {
            const cols = ALL_COLUMNS.filter((c) => visibleCols.has(c));
            const displayRows = tableCleared ? [] : activeConversions;
            return (
              <div className="overflow-x-auto rounded-lg border border-zinc-700">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-zinc-800/80 sticky top-0">
                    <tr>
                      {cols.map((col) => (
                        <th key={col} className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={cols.length || 1} className="px-2 py-6 text-center text-zinc-500">
                          {tableCleared ? "Vista limpiada. Usá Actualizar para volver a cargar." : "Aún no hay conversiones registradas."}
                        </td>
                      </tr>
                    ) : displayRows.map((c) => {
                      const isRepeat = c.estado === "purchase" && c.observaciones?.includes("REPEAT");
                      const rowColor =
                        c.estado === "lead"
                          ? "bg-emerald-950/20"
                          : c.estado === "purchase" && isRepeat
                            ? "bg-violet-950/20"
                            : c.estado === "purchase"
                              ? "bg-sky-950/20"
                              : "bg-zinc-950/40";
                      return (
                        <tr key={c.id} className={rowColor}>
                          {cols.map((col) =>
                            col === "email" ? (
                              <EditableEmailCell key={col} row={c} onSaved={(id, email) => setConversions((prev) => prev.map((r) => (r.id === id ? { ...r, email } : r)))} />
                            ) : cellValue(c, col)
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>
      )}

      {/* ═══════════ TAB: FUNNEL ═══════════ */}
      {tab === "funnel" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">Funnel</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={refreshTable}
                disabled={refreshingTable}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-60"
                title="Actualizar datos"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshingTable ? "Actualizando…" : "Actualizar"}
              </button>
              <button
                type="button"
                onClick={clearFunnelDisplay}
                disabled={funnelCleared || activeFunnel.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ocultar registros de la vista (no borra de la base)"
              >
                Limpiar vista
              </button>
            </div>
          </div>
          {funnelCleared ? (
            <p className="py-12 text-center text-sm text-zinc-500">Vista limpiada. Usá Actualizar para volver a cargar.</p>
          ) : (
            <FunnelBoard
              contacts={activeFunnel}
              premiumThreshold={config?.funnel_premium_threshold ?? 50000}
            />
          )}
        </section>
      )}

      {/* ═══════════ TAB: ESTADÍSTICAS ═══════════ */}
      {tab === "estadisticas" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">Estadísticas</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={refreshTable}
                disabled={refreshingTable}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-60"
                title="Actualizar datos"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshingTable ? "Actualizando…" : "Actualizar"}
              </button>
              <button
                type="button"
                onClick={clearStatsDisplay}
                disabled={statsCleared || (activeFunnel.length === 0 && activeConversions.length === 0)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ocultar registros de la vista (no borra de la base)"
              >
                Limpiar vista
              </button>
            </div>
          </div>
          {statsCleared ? (
            <p className="py-12 text-center text-sm text-zinc-500">Vista limpiada. Usá Actualizar para volver a cargar.</p>
          ) : (
            <StatsPanel
              funnelContacts={activeFunnel}
              conversions={activeConversions}
              allConversions={rawConversions}
              premiumThreshold={config?.funnel_premium_threshold ?? 50000}
              dateRange={dateRange}
            />
          )}
        </section>
      )}

      {/* ═══════════ TAB: LOGS ═══════════ */}
      {tab === "logs" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">
            Logs de conversiones{" "}
            <span className="font-normal text-zinc-500">({logs.length})</span>
          </h3>
          {logs.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no hay logs registrados.</p>
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
                        {new Date(log.created_at).toLocaleString("es-AR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-2 py-1.5">{levelBadge(log.level)}</td>
                      <td className="px-2 py-1.5 text-zinc-300 font-mono whitespace-nowrap">{log.function_name}</td>
                      <td className="px-2 py-1.5 text-zinc-200">{log.message}</td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {log.detail ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && log.detail && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => { try { return JSON.stringify(JSON.parse(log.detail), null, 2); } catch { return log.detail; } })()}
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
