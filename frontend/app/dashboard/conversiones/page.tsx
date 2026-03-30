"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversionsConfig,
  upsertConversionsConfig,
  fetchConversionsFiltered,
  fetchFunnelContactsFiltered,
  fetchConversionLogs,
  updateConversionEmail,
  hideConversions,
  hideContacts,
  type ConversionsConfig,
  type ConversionRow,
  type ConversionLogRow,
  type FunnelContact,
} from "@/lib/conversionsDb";
import FunnelBoard from "@/components/conversiones/FunnelBoard";
import TrackingBoard from "@/components/conversiones/TrackingBoard";
import StatsPanel from "@/components/conversiones/StatsPanel";
import DateRangeFilter, {
  type DateRange,
  filterByDateRange,
  filterFunnelByDateRange,
} from "@/components/conversiones/DateRangeFilter";

type Tab = "funnel" | "seguimiento" | "tabla" | "estadisticas" | "configuracion" | "logs";

const TAB_ORDER_BASE: Tab[] = ["funnel", "tabla", "estadisticas", "configuracion"];

const TAB_LABELS: Record<Tab, string> = {
  funnel: "Funnel",
  seguimiento: "Seguimiento",
  tabla: "Tabla",
  estadisticas: "Estadisticas",
  configuracion: "Configuracion",
  logs: "Logs",
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
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

function FunnelTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
    </svg>
  );
}

function TrackingTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 15l3-3 3 2 4-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 10h2v2" />
    </svg>
  );
}

function TableTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M9 5v14M15 5v14" />
    </svg>
  );
}

function StatsTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
      <rect x="6" y="11" width="3" height="6" rx="1" />
      <rect x="11" y="8" width="3" height="9" rx="1" />
      <rect x="16" y="5" width="3" height="12" rx="1" />
    </svg>
  );
}

function GearTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .37 2l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-2-.37 1.8 1.8 0 0 0-1 1.62V21a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1-1.62 1.8 1.8 0 0 0-2 .37l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.8 1.8 0 0 0 .37-2 1.8 1.8 0 0 0-1.62-1H3a2 2 0 0 1 0-4h.09a1.8 1.8 0 0 0 1.62-1 1.8 1.8 0 0 0-.37-2l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.8 1.8 0 0 0 2 .37H9A1.8 1.8 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1 1.62 1.8 1.8 0 0 0 2-.37l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.37 2V11c0 .74.42 1.4 1.1 1.73" />
    </svg>
  );
}

function LogsTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6M9 13h6M9 9h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h8l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  );
}

function estadoBadge(estado: string, isRepeat = false) {
  const cls =
    estado === "purchase" && isRepeat
      ? "bg-violet-950 text-violet-300"
      : estado === "purchase"
        ? "bg-rose-950 text-rose-300"
        : estado === "lead"
          ? "bg-amber-950 text-amber-300"
          : "bg-zinc-800 text-zinc-400";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${cls}`}>{estado === "purchase" && isRepeat ? "purchase repeat" : estado}</span>;
}

function statusText(status: string) {
  if (status === "enviado") return <span className="text-emerald-400">enviado</span>;
  if (status === "error") return <span className="text-red-400">error</span>;
  return <span className="text-zinc-600">-</span>;
}

function levelBadge(level: string, message?: string) {
  const cls =
    level === "ERROR"
      ? "bg-red-950 text-red-300"
      : level === "DEBUG"
        ? "bg-zinc-800 text-zinc-500"
        : "bg-blue-950 text-blue-300";
  const msg = String(message ?? "").toLowerCase();
  const event =
    msg.includes("contact") ? "CONTACT" :
    msg.includes("lead") ? "LEAD" :
    msg.includes("purchase") || msg.includes("compra") || msg.includes("recarga") ? "PURCHASE" :
    null;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{event ? `${level} / ${event}` : level}</span>;
}

function truncateId(id: string, len = 8) {
  if (!id) return "-";
  return id.length > len ? id.slice(0, len) + "..." : id;
}

function truncateText(value: string, len = 35) {
  if (!value) return "-";
  return value.length > len ? value.slice(0, len) + "..." : value;
}

function formatIntegerWithThousands(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.trunc(value || 0)),
  );
}

const ALL_COLUMNS = [
  "phone","email","fn","ln","ct","st","zip","country","fbp","fbc",
  "contact_event_id","contact_event_time","lead_event_id","lead_event_time","lead_payload_raw",
  "purchase_event_id","purchase_event_time","purchase_payload_raw","timestamp","clientIP","agentuser",
  "estado","valor","purchase_type","contact_status_capi","lead_status_capi","purchase_status_capi",
  "observaciones","external_id","test_event_code","utm_campaign","telefono_asignado","promo_code",
  "device_type","geo_city","geo_region","geo_country",
] as const;

type ColKey = (typeof ALL_COLUMNS)[number];

function EditableEmailCell({ row, onSaved }: { row: ConversionRow; onSaved: (id: string, email: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.email);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed === row.email) { setEditing(false); return; }
    setSaving(true);
    try { await updateConversionEmail(row.id, trimmed); onSaved(row.id, trimmed); }
    catch { setValue(row.email); }
    finally { setSaving(false); setEditing(false); }
  };

  if (editing) {
    return (
      <td className="px-1 py-0.5">
        <input autoFocus type="email" value={value}
          onChange={(e) => setValue(e.target.value)} onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setValue(row.email); setEditing(false); } }}
          disabled={saving}
          className="w-full min-w-[140px] rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100 outline-none focus:border-zinc-400" />
      </td>
    );
  }

  return (
    <td className="px-2 py-1.5 whitespace-nowrap text-zinc-400 cursor-pointer hover:text-zinc-200 group"
      onClick={() => { setValue(row.email); setEditing(true); }} title="Click para editar email">
      {row.email || <span className="text-zinc-600 group-hover:text-zinc-400">+ email</span>}
    </td>
  );
}

function cellValue(c: ConversionRow, col: ColKey): React.ReactNode {
  const cell = "px-2 py-1.5 whitespace-nowrap";
  const mono = `${cell} font-mono`;
  const dim = `${cell} text-zinc-400`;
  const dimMono = `${dim} font-mono`;
  const tip = (v: unknown) => String(v ?? "-") || "-";
  const tipRawJson = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (!s) return "-";
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
  };
  const timestampText = new Date(c.created_at).toLocaleString("es-AR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });

  switch (col) {
    case "phone": return <td key={col} className={`${mono} text-zinc-200`} title={tip(c.phone)}>{c.phone || "-"}</td>;
    case "email": return <td key={col} className={dim} title={tip(c.email)}>{c.email || "-"}</td>;
    case "fn": return <td key={col} className={dim} title={tip(c.fn)}>{c.fn || "-"}</td>;
    case "ln": return <td key={col} className={dim} title={tip(c.ln)}>{c.ln || "-"}</td>;
    case "ct": return <td key={col} className={dim} title={tip(c.ct)}>{c.ct || "-"}</td>;
    case "st": return <td key={col} className={dim} title={tip(c.st)}>{c.st || "-"}</td>;
    case "zip": return <td key={col} className={dim} title={tip(c.zip)}>{c.zip || "-"}</td>;
    case "country": return <td key={col} className={dim} title={tip(c.country)}>{c.country || "-"}</td>;
    case "fbp": return <td key={col} className={dimMono} title={tip(c.fbp)}>{c.fbp ? truncateId(c.fbp, 12) : "-"}</td>;
    case "fbc": return <td key={col} className={dimMono} title={tip(c.fbc)}>{c.fbc ? truncateId(c.fbc, 12) : "-"}</td>;
    case "contact_event_id": return <td key={col} className={dimMono} title={c.contact_event_id}>{truncateId(c.contact_event_id)}</td>;
    case "contact_event_time": return <td key={col} className={dim} title={tip(c.contact_event_time)}>{c.contact_event_time ?? "-"}</td>;
    case "lead_event_id": return <td key={col} className={dimMono} title={c.lead_event_id}>{truncateId(c.lead_event_id)}</td>;
    case "lead_event_time": return <td key={col} className={dim} title={tip(c.lead_event_time)}>{c.lead_event_time ?? "-"}</td>;
    case "lead_payload_raw": return <td key={col} className={`${dim} max-w-[220px] truncate`} title={tipRawJson(c.lead_payload_raw)}>{truncateText(c.lead_payload_raw || "-", 35)}</td>;
    case "purchase_event_id": return <td key={col} className={dimMono} title={c.purchase_event_id}>{truncateId(c.purchase_event_id)}</td>;
    case "purchase_event_time": return <td key={col} className={dim} title={tip(c.purchase_event_time)}>{c.purchase_event_time ?? "-"}</td>;
    case "purchase_payload_raw": return <td key={col} className={`${dim} max-w-[220px] truncate`} title={tipRawJson(c.purchase_payload_raw)}>{truncateText(c.purchase_payload_raw || "-", 35)}</td>;
    case "test_event_code": return <td key={col} className={dimMono} title={tip(c.test_event_code)}>{c.test_event_code || "-"}</td>;
    case "timestamp": return <td key={col} className={dim} title={timestampText}>{timestampText}</td>;
    case "clientIP": return <td key={col} className={dimMono} title={tip(c.client_ip)}>{c.client_ip || "-"}</td>;
    case "agentuser": return <td key={col} className={dim} title={c.agent_user || "-"}>{truncateText(c.agent_user || "-", 35)}</td>;
    case "estado": {
      const isRepeat = c.estado === "purchase" && c.observaciones?.includes("REPEAT");
      return <td key={col} className={cell}>{estadoBadge(c.estado, isRepeat)}</td>;
    }
    case "valor": return <td key={col} className={`${cell} text-zinc-200`} title={tip(c.valor)}>{c.valor > 0 ? c.valor : "-"}</td>;
    case "purchase_type": return <td key={col} className={dim} title={tip(c.purchase_type)}>{c.purchase_type || "-"}</td>;
    case "contact_status_capi": return <td key={col} className={cell} title={tip(c.contact_status_capi)}>{statusText(c.contact_status_capi)}</td>;
    case "lead_status_capi": return <td key={col} className={cell} title={tip(c.lead_status_capi)}>{statusText(c.lead_status_capi)}</td>;
    case "purchase_status_capi": return <td key={col} className={cell} title={tip(c.purchase_status_capi)}>{statusText(c.purchase_status_capi)}</td>;
    case "observaciones": return <td key={col} className={`${cell} text-zinc-500 max-w-[200px] truncate`} title={c.observaciones}>{c.observaciones || "-"}</td>;
    case "external_id": return <td key={col} className={dimMono} title={tip(c.external_id)}>{c.external_id ? truncateId(c.external_id) : "-"}</td>;
    case "utm_campaign": return <td key={col} className={dim} title={tip(c.utm_campaign)}>{c.utm_campaign || "-"}</td>;
    case "telefono_asignado": return <td key={col} className={dim} title={tip(c.telefono_asignado)}>{c.telefono_asignado || "-"}</td>;
    case "promo_code": return <td key={col} className={dim} title={tip(c.promo_code)}>{c.promo_code || "-"}</td>;
    case "device_type": return <td key={col} className={dim} title={tip(c.device_type)}>{c.device_type || "-"}</td>;
    case "geo_city": return <td key={col} className={dim} title={tip(c.geo_city)}>{c.geo_city || "-"}</td>;
    case "geo_region": return <td key={col} className={dim} title={tip(c.geo_region)}>{c.geo_region || "-"}</td>;
    case "geo_country": return <td key={col} className={dim} title={tip(c.geo_country)}>{c.geo_country || "-"}</td>;
    default: return <td key={col} className={dim} title="-">-</td>;
  }
}

export default function DashboardConversionesPage() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [funnelContacts, setFunnelContacts] = useState<FunnelContact[]>([]);
  const [logs, setLogs] = useState<ConversionLogRow[]>([]);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("funnel");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [statsLandingFilter, setStatsLandingFilter] = useState<string>("__all__");

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [refreshingTable, setRefreshingTable] = useState(false);
  const [hidingTable, setHidingTable] = useState(false);
  const [hidingFunnel, setHidingFunnel] = useState(false);
  const [hidingStats, setHidingStats] = useState(false);
  const [hidingLogs, setHidingLogs] = useState(false);

  useEffect(() => {
    const view = (searchParams.get("view") || "").toLowerCase();
    if (view === "seguimiento") {
      setTab("seguimiento");
    }
  }, [searchParams]);

  const [configOpen, setConfigOpen] = useState(false);
  const [endpointOpen, setEndpointOpen] = useState(false);
  const [funnelConfigOpen, setFunnelConfigOpen] = useState(false);
  const [editPixelId, setEditPixelId] = useState(false);
  const [editAccessToken, setEditAccessToken] = useState(false);

  const activeConversions = useMemo(() => filterByDateRange(conversions, dateRange), [conversions, dateRange]);
  const activeFunnel = useMemo(() => filterFunnelByDateRange(funnelContacts, dateRange), [funnelContacts, dateRange]);
  const statsConversions = useMemo(
    () => activeConversions.filter((r) => !String(r.test_event_code ?? "").trim()),
    [activeConversions],
  );
  const statsAllConversions = useMemo(
    () => conversions.filter((r) => !String(r.test_event_code ?? "").trim()),
    [conversions],
  );
  const statsLandingOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const name = String(r.landing_name ?? "").trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  useEffect(() => {
    if (statsLandingFilter !== "__all__" && !statsLandingOptions.includes(statsLandingFilter)) {
      setStatsLandingFilter("__all__");
    }
  }, [statsLandingFilter, statsLandingOptions]);
  const statsConversionsFilteredByLanding = useMemo(() => {
    if (statsLandingFilter === "__all__") return statsConversions;
    return statsConversions.filter((r) => String(r.landing_name ?? "").trim() === statsLandingFilter);
  }, [statsConversions, statsLandingFilter]);
  const statsAllConversionsFilteredByLanding = useMemo(() => {
    if (statsLandingFilter === "__all__") return statsAllConversions;
    return statsAllConversions.filter((r) => String(r.landing_name ?? "").trim() === statsLandingFilter);
  }, [statsAllConversions, statsLandingFilter]);
  const activeFunnelFilteredByLanding = useMemo(() => {
    if (statsLandingFilter === "__all__") return activeFunnel;
    return activeFunnel.filter((r) => String(r.landing_name ?? "").trim() === statsLandingFilter);
  }, [activeFunnel, statsLandingFilter]);
  const filteredConversions = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return activeConversions;
    return activeConversions.filter((c) => {
      const hay = [
        c.phone,
        c.email,
        c.promo_code,
        c.external_id,
        c.utm_campaign,
        c.telefono_asignado,
        c.landing_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeConversions, tableSearch]);

  const visibleCols = useMemo(() => {
    const cols = config?.visible_columns ?? [];
    const valid = cols.filter((c): c is ColKey =>
      (ALL_COLUMNS as readonly string[]).includes(c),
    );
    return new Set<ColKey>(valid);
  }, [config]);
  const displayedCols = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleCols.has(c)),
    [visibleCols],
  );
  const displayedColsWithoutTimestamp = useMemo(
    () => displayedCols.filter((c) => c !== "timestamp"),
    [displayedCols],
  );
  const internalIdByConversionId = useMemo(
    () => new Map(conversions.map((c) => [c.id, c.internal_id])),
    [conversions],
  );
  const tabOrder = useMemo<Tab[]>(
    () => (config?.show_logs === false ? TAB_ORDER_BASE : [...TAB_ORDER_BASE, "logs"]),
    [config?.show_logs],
  );

  useEffect(() => {
    if (config?.show_logs === false && tab === "logs") {
      setTab("funnel");
    }
  }, [config?.show_logs, tab]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const [cfg, rows, funnel, logRows] = await Promise.all([
          fetchConversionsConfig(user.id),
          fetchConversionsFiltered(user.id, user.id),
          fetchFunnelContactsFiltered(user.id, user.id),
          fetchConversionLogs(user.id, 200),
        ]);
        setConfig(cfg);
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
      await upsertConversionsConfig({ ...config, user_id: userId });
      setSaveMsg("Configuracion guardada.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  };

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  }, []);

  const refreshTable = useCallback(async () => {
    if (!userId) return;
    setRefreshingTable(true);
    try {
      const [rows, funnel, logRows] = await Promise.all([
        fetchConversionsFiltered(userId, userId),
        fetchFunnelContactsFiltered(userId, userId),
        fetchConversionLogs(userId, 200),
      ]);
      setConversions(rows);
      setFunnelContacts(funnel);
      setLogs(logRows);
    } catch (e) { console.error(e); }
    finally { setRefreshingTable(false); }
  }, [userId]);

  const clearTableDisplay = useCallback(async () => {
    if (!userId || activeConversions.length === 0) return;
    const ok = window.confirm(
      "Seguro que queres limpiar la vista?\n\nSi limpias la vista, perderas los registros visibles y las estadsticas volveran a cero.",
    );
    if (!ok) return;
    setHidingTable(true);
    setClearMsg(null);
    try {
      await hideConversions(activeConversions.map((c) => c.id), userId);
      await refreshTable();
      setClearMsg("Vista limpiada.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally { setHidingTable(false); }
  }, [userId, activeConversions, refreshTable]);

  const clearFunnelDisplay = useCallback(async () => {
    if (!userId || activeFunnel.length === 0) return;
    const ok = window.confirm(
      "Seguro que queres limpiar la vista?\n\nSi limpias la vista, perderas los registros visibles y las estadsticas volveran a cero.",
    );
    if (!ok) return;
    setHidingFunnel(true);
    setClearMsg(null);
    try {
      await hideContacts(
        activeFunnel.map((c) => ({ user_id: c.user_id, phone: c.phone })),
        userId,
      );
      await refreshTable();
      setClearMsg("Vista limpiada.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally { setHidingFunnel(false); }
  }, [userId, activeFunnel, refreshTable]);

  const clearStatsDisplay = useCallback(async () => {
    if (!userId || (activeFunnel.length === 0 && activeConversions.length === 0)) return;
    const ok = window.confirm(
      "Seguro que queres limpiar la vista?\n\nSi limpias la vista, perderas los registros visibles y las estadsticas volveran a cero.",
    );
    if (!ok) return;
    setHidingStats(true);
    setClearMsg(null);
    try {
      await hideContacts(
        activeFunnel.map((c) => ({ user_id: c.user_id, phone: c.phone })),
        userId,
      );
      await hideConversions(activeConversions.map((c) => c.id), userId);
      await refreshTable();
      setClearMsg("Vista limpiada.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally { setHidingStats(false); }
  }, [userId, activeFunnel, activeConversions, refreshTable]);

  const clearLogsDisplay = useCallback(async () => {
    if (!userId || logs.length === 0) return;
    const ok = window.confirm(
      "Seguro que queres limpiar la vista?\n\nSi limpias la vista, perderas los registros visibles y las estadsticas volveran a cero.",
    );
    if (!ok) return;
    setHidingLogs(true);
    setClearMsg(null);
    try {
      setLogs([]);
      setClearMsg("Vista limpiada. Los registros siguen en la base de datos.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally { setHidingLogs(false); }
  }, [userId, logs.length]);

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
        <h1 className="text-xl font-semibold text-zinc-100">CONVERSIONES</h1>
        <p className="mt-1 text-sm text-zinc-400">Tu pipeline de leads, cargas y estadsticas.</p>
      </div>

      {saveMsg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${saveMsg.includes("Error") ? "bg-red-950/50 text-red-300" : "bg-emerald-950/50 text-emerald-300"}`} role="alert">
          {saveMsg}
        </p>
      )}
      {clearMsg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${clearMsg.includes("Error") ? "bg-red-950/50 text-red-300" : "bg-emerald-950/50 text-emerald-300"}`} role="alert">
          {clearMsg}
        </p>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-zinc-800/60 pb-1">
        <div className="flex gap-4">
          {tabOrder.filter((t) => t !== "configuracion" && t !== "logs").map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative cursor-pointer pb-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t === "funnel" ? <FunnelTabIcon /> : t === "seguimiento" ? <TrackingTabIcon /> : t === "tabla" ? <TableTabIcon /> : t === "estadisticas" ? <StatsTabIcon /> : null}
                  {TAB_LABELS[t]}
                </span>
                <span
                  className={`pointer-events-none absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full transition-opacity ${
                    active ? "bg-zinc-100 opacity-100" : "bg-zinc-600 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-4">
          {tabOrder.filter((t) => t === "configuracion" || t === "logs").map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative cursor-pointer pb-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t === "configuracion" ? <GearTabIcon /> : <LogsTabIcon />}
                  {TAB_LABELS[t]}
                </span>
                <span
                  className={`pointer-events-none absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full transition-opacity ${
                    active ? "bg-zinc-100 opacity-100" : "bg-zinc-600 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Date filter  visible on funnel, seguimiento, tabla, estadisticas */}
      {(tab === "funnel" || tab === "seguimiento" || tab === "tabla" || tab === "estadisticas") && (
        <div className="flex items-center justify-end gap-2 pt-1">
          {tab === "estadisticas" && (
            <select
              value={statsLandingFilter}
              onChange={(e) => setStatsLandingFilter(e.target.value)}
              className="mr-auto h-7 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-100"
              title="Filtrar estadisticas por landing"
            >
              <option value="__all__">Todas las landings</option>
              {statsLandingOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          <DateRangeFilter onChange={setDateRange} />
        </div>
      )}

      {/* TAB: CONFIGURACIN */}
      {tab === "configuracion" && (
        <div className="space-y-4">
          {/* Meta CAPI */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button type="button" onClick={() => setConfigOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 p-4">
              <ChevronIcon open={configOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">Configuracion Meta CAPI</h3>
            </button>
            {configOpen && (
              <div className="space-y-4 border-t border-zinc-800 p-4">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-zinc-400">Pixel ID</label>
                    <button
                      type="button"
                      onClick={() => setEditPixelId((v) => !v)}
                      className="cursor-pointer rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-800"
                    >
                      {editPixelId ? "Bloquear" : "Editar"}
                    </button>
                  </div>
                  <input
                    type="text"
                    disabled={!editPixelId}
                    value={config?.pixel_id ?? ""}
                    onChange={(e) => setConfig((p) => p ? { ...p, pixel_id: e.target.value.replace(/\D/g, "") } : p)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Ej: 880464554785896"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">Se sincronizara automaticamente a todas tus landings al guardar.</p>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-zinc-400">Access Token</label>
                    <button
                      type="button"
                      onClick={() => setEditAccessToken((v) => !v)}
                      className="cursor-pointer rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-800"
                    >
                      {editAccessToken ? "Bloquear" : "Editar"}
                    </button>
                  </div>
                  <input
                    type="text"
                    disabled={!editAccessToken}
                    value={config?.meta_access_token ?? ""}
                    onChange={(e) => setConfig((p) => p ? { ...p, meta_access_token: e.target.value } : p)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Token de Meta Conversions API"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Moneda</label>
                  <select value={config?.meta_currency ?? "ARS"} onChange={(e) => setConfig((p) => p ? { ...p, meta_currency: e.target.value } : p)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100">
                    {["ARS","USD","EUR","BRL","CLP","MXN","COP"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-3 border-t border-zinc-800 pt-4">
                  <label className="group flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 transition hover:border-zinc-700">
                    <input
                      type="checkbox"
                      checked={config?.send_contact_capi ?? false}
                      onChange={(e) => setConfig((p) => p ? { ...p, send_contact_capi: e.target.checked } : p)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                    />
                    <span className="text-xs text-zinc-300">Enviar evento Contact por CAPI</span>
                  </label>
                  <label className="group flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 transition hover:border-zinc-700">
                    <input
                      type="checkbox"
                      checked={config?.geo_use_ipapi ?? false}
                      onChange={(e) => setConfig((p) => p ? { ...p, geo_use_ipapi: e.target.checked } : p)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                    />
                    <span className="text-xs text-zinc-300">Enviar geo</span>
                  </label>
                  {config?.geo_use_ipapi && (
                    <label className="ml-6 flex items-center gap-2">
                      <input type="checkbox" checked={config?.geo_fill_only_when_missing ?? false} onChange={(e) => setConfig((p) => p ? { ...p, geo_fill_only_when_missing: e.target.checked } : p)} className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-500" />
                      <span className="text-xs text-zinc-300">Solo completar geo faltante (no pisar datos del payload)</span>
                    </label>
                  )}
                  <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/30 p-3 text-[11px] text-amber-200">
                    <p className="font-semibold">Confirma que tus eventos estan llegando a Meta!</p>
                    <p className="mt-1">
                      Ingresa al Administrador de eventos, selecciona tu pixel y dirigite a la seccion &quot;Probar eventos&quot;.
                    </p>
                    <p className="mt-1">
                      Copi tu <code className="rounded bg-zinc-900 px-1 py-0.5 text-[10px]">test_event_code</code> y luego prob tu URL con este formato:
                    </p>
                    <code className="mt-2 block break-all rounded bg-zinc-950 px-2 py-1 text-[10px] text-emerald-300">
                      https://landing.panelbotadmin.com/TU_NOMBRE/?test_event_code=TU_CODIGO_TEST
                    </code>
                    <p className="mt-2">
                      Asi vas a poder verificar en tiempo real si los eventos se estan enviando correctamente a Meta.
                    </p>
                  </div>
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
                        {copiedUrl === url ? <span className="text-[10px] text-emerald-400">OK</span> : <CopyIcon />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-400">Tu URL an no fue configurada. Contact al administrador.</p>
                  );
                })()}
              </div>
            )}
          </section>

          {/* Funnel Configuration */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button type="button" onClick={() => setFunnelConfigOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 p-4">
              <ChevronIcon open={funnelConfigOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">Personalizacin del funnel</h3>
            </button>
            {funnelConfigOpen && (
              <div className="space-y-4 border-t border-zinc-800 p-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Monto mnimo para Jugador Premium</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatIntegerWithThousands(config?.funnel_premium_threshold ?? 50000)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      const parsed = raw ? Number.parseInt(raw, 10) : 0;
                      setConfig((p) => (p ? { ...p, funnel_premium_threshold: parsed } : p));
                    }}
                    className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    placeholder="50.000"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">Contactos cuya sumatoria total de cargas sea igual o mayor a este monto se clasifican como Jugador Premium.</p>
                </div>
              </div>
            )}
          </section>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 active:scale-95 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar configuracin"}
            </button>
          </div>
        </div>
      )}

      {/* TAB: TABLA */}
      {tab === "tabla" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="sticky top-0 z-30 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg py-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Tabla de conversiones <span className="font-normal text-zinc-500">({filteredConversions.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Buscar por phone, email, promo, utm..."
                className="h-8 w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder:text-zinc-500"
              />
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
                {refreshingTable ? "Actualizando..." : "Actualizar"}
              </button>
              <button
                type="button"
                onClick={clearTableDisplay}
                disabled={hidingTable || refreshingTable || filteredConversions.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ocultar registros de la vista (persistente, no borra de la base)"
              >
                {hidingTable ? "Ocultando..." : "Limpiar vista"}
              </button>
            </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-700">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 z-20 bg-zinc-800/95">
                <tr>
                  <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">ID</th>
                  <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">timestamp</th>
                  {displayedColsWithoutTimestamp.map((col) => (
                    <th key={col} className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {displayedColsWithoutTimestamp.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-6 text-center text-zinc-500">
                      Tu administrador todavia no definio columnas visibles para esta tabla.
                    </td>
                  </tr>
                ) : filteredConversions.length === 0 ? (
                  <tr>
                    <td colSpan={displayedColsWithoutTimestamp.length + 2} className="px-2 py-6 text-center text-zinc-500">
                      Aun no hay conversiones registradas.
                    </td>
                  </tr>
                ) : filteredConversions.map((c, idx) => {
                  const isRepeat = c.estado === "purchase" && c.observaciones?.includes("REPEAT");
                  const rowColor =
                    c.estado === "lead"
                      ? "bg-amber-950/18"
                      : c.estado === "purchase" && isRepeat
                        ? "bg-violet-950/20"
                        : c.estado === "purchase"
                          ? "bg-rose-950/18"
                          : "bg-zinc-950/40";
                  return (
                    <tr key={c.id} className={rowColor}>
                      <td className="px-2 py-1.5 whitespace-nowrap text-zinc-500 font-mono">{c.internal_id ?? idx + 1}</td>
                      {cellValue(c, "timestamp")}
                      {displayedColsWithoutTimestamp.map((col) =>
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
        </section>
      )}

      {/* TAB: FUNNEL */}
      {tab === "funnel" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {activeFunnel.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">An no hay contactos en el funnel.</p>
          ) : (
            <FunnelBoard
              contacts={activeFunnel}
              premiumThreshold={config?.funnel_premium_threshold ?? 50000}
              headerSlot={
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="mr-2 text-sm font-semibold text-zinc-200">Funnel</h3>
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
                    {refreshingTable ? "Actualizando..." : "Actualizar"}
                  </button>
                  <button
                    type="button"
                    onClick={clearFunnelDisplay}
                    disabled={hidingFunnel || refreshingTable || activeFunnel.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Ocultar registros de la vista (persistente, no borra de la base)"
                  >
                    {hidingFunnel ? "Ocultando..." : "Limpiar vista"}
                  </button>
                </div>
              }
            />
          )}
        </section>
      )}

      {/* TAB: SEGUIMIENTO */}
      {tab === "seguimiento" && (
        <TrackingBoard
          conversions={activeConversions.filter((r) => !String(r.test_event_code ?? "").trim())}
          onRefresh={refreshTable}
          refreshing={refreshingTable}
        />
      )}

      {/* TAB: ESTADSTICAS */}
      {tab === "estadisticas" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">Estadisticas</h3>
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
                {refreshingTable ? "Actualizando..." : "Actualizar"}
              </button>
              <button
                type="button"
                onClick={clearStatsDisplay}
                disabled={hidingStats || refreshingTable || (activeFunnel.length === 0 && statsConversions.length === 0)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ocultar registros de la vista (persistente, no borra de la base)"
              >
                {hidingStats ? "Ocultando..." : "Limpiar vista"}
              </button>
            </div>
          </div>
          {activeFunnelFilteredByLanding.length === 0 && statsConversionsFilteredByLanding.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">An no hay datos para estadsticas.</p>
          ) : (
            <StatsPanel
              funnelContacts={activeFunnelFilteredByLanding}
              conversions={statsConversionsFilteredByLanding}
              allConversions={statsAllConversionsFilteredByLanding}
              premiumThreshold={config?.funnel_premium_threshold ?? 50000}
              dateRange={dateRange}
              compactTooltips
            />
          )}
        </section>
      )}

            {/* TAB: LOGS */}
      {tab === "logs" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Logs de conversiones{" "}
              <span className="font-normal text-zinc-500">({logs.length})</span>
            </h3>
            <button
              type="button"
              onClick={clearLogsDisplay}
              disabled={hidingLogs || logs.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ocultar logs de la vista (no borra de la base)"
            >
              {hidingLogs ? "Ocultando..." : "Limpiar vista"}
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-zinc-500">Aun no hay logs registrados.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-zinc-800/80">
                  <tr>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">ID</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Fecha</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Nivel</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Funcion</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Mensaje</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Detalle</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Payload Meta</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Respuesta Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className={(() => {
                        const isMetaResponse = log.function_name === "sendToMetaCAPI" && log.message === "Meta CAPI respuesta";
                        if (!isMetaResponse || !log.response_meta) return "bg-zinc-950/40";
                        try {
                          const parsed = JSON.parse(log.response_meta) as { error?: unknown; events_received?: number | string };
                          const eventsReceived = typeof parsed.events_received === "number"
                            ? parsed.events_received
                            : Number(parsed.events_received ?? 0);
                          const ok = !parsed.error && Number.isFinite(eventsReceived) && eventsReceived > 0;
                          return ok ? "bg-emerald-950/25 border-l-2 border-emerald-400/60" : "bg-zinc-950/40";
                        } catch {
                          return "bg-zinc-950/40";
                        }
                      })()}
                    >
                      <td className="px-2 py-1.5 text-zinc-500 font-mono whitespace-nowrap">
                        {log.conversion_id ? (internalIdByConversionId.get(log.conversion_id) ?? "-") : "-"}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-AR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                      </td>
                      <td className="px-2 py-1.5">{levelBadge(log.level, log.message)}</td>
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
                      <td className="px-2 py-1.5 text-zinc-500">
                        {log.payload_meta ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && log.payload_meta && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => { try { return JSON.stringify(JSON.parse(log.payload_meta), null, 2); } catch { return log.payload_meta; } })()}
                          </pre>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {log.response_meta ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && log.response_meta && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => { try { return JSON.stringify(JSON.parse(log.response_meta), null, 2); } catch { return log.response_meta; } })()}
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
