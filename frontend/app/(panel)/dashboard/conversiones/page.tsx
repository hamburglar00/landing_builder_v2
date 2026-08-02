"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversionsConfig,
  fetchPixelConfigs,
  getConversionGerenciaLabels,
  scopeConversionStagesToGerencia,
  buildFunnelContactsFromConversions,
  getPremiumThreshold,
  setPremiumThreshold,
  getTrackingRankingConfig,
  type FetchDateRange,
  type ConversionsConfig,
  type PixelConfig,
  type ConversionRow,
  type ConversionLogRow,
  type ConversionInboxRow,
} from "@/lib/conversionsDb";
import { dashboardConversionPageDataSource } from "@/lib/conversionPageDataSource";
import { saveConversionPageConfig } from "@/lib/conversionPageConfig";
import ClearConversionsViewModal, {
  type ClearConversionsViewMode,
} from "@/components/conversiones/ClearConversionsViewModal";
import { DashboardSkeleton, PanelSkeleton } from "@/components/ui/DashboardSkeleton";
import { PageHeader } from "@/components/ui/PanelPrimitives";
import DateRangeFilter, {
  type DateRange,
  filterByDateRange,
  filterFunnelByDateRange,
} from "@/components/conversiones/DateRangeFilter";
import {
  ALL_COLUMNS,
  columnsForTableView,
  formatIntegerWithThousands,
  friendlyPixelAttributionSource,
  friendlyPurchaseType,
  friendlySourcePlatform,
  isSameDateRange,
  normalizePhone,
  normalizeSexValue,
  todayRange,
  truncateId,
  truncateText,
  type ConversionColumnKey as ColKey,
  type ConversionTableView,
} from "@/components/conversiones/conversionPageShared";
import EditableConversionEmailCell from "@/components/conversiones/EditableConversionEmailCell";
import ConversionFiltersModal from "@/components/conversiones/ConversionFiltersModal";
import ConversionLogFilters from "@/components/conversiones/ConversionLogFilters";
import ConversionConfigurationPanel from "@/components/conversiones/ConversionConfigurationPanel";
import { useConversionStatsFilters } from "@/components/conversiones/useConversionStatsFilters";
import {
  ConversionPagination,
  ConversionTableHeader,
  ConversionTableViewToggle,
  ConversionTabs,
  estadoBadge,
  isSuccessfulMetaResponse,
  levelBadge,
  statusText,
} from "@/components/conversiones/ConversionPageUi";
import type { LandingPerformanceFilterOption } from "@/components/conversiones/GerenciasPerformancePanel";
import {
  SingleCurrencyRequired,
  useCurrencyScope,
} from "@/components/currency/CurrencyScope";
import {
  CURRENCY_ALL,
  filterConversionsByCurrency,
} from "@/lib/currency";
import type {
  ConversionLogDirectionFilter,
  ConversionLogEventFilter,
} from "@/lib/conversionLogFilters";

const FunnelBoard = dynamic(() => import("@/components/conversiones/FunnelBoard"), {
  loading: () => <PanelSkeleton title="Cargando funnel..." />,
});
const TrackingBoard = dynamic(() => import("@/components/conversiones/TrackingBoard"), {
  loading: () => <PanelSkeleton title="Cargando seguimiento..." />,
});
const StatsPanel = dynamic(() => import("@/components/conversiones/StatsPanel"), {
  loading: () => <PanelSkeleton title="Cargando estadísticas..." />,
});
const GerenciasPerformancePanel = dynamic(() => import("@/components/conversiones/GerenciasPerformancePanel"), {
  loading: () => <PanelSkeleton title="Cargando desempeño..." />,
});

type Tab = "funnel" | "seguimiento" | "tabla" | "estadisticas" | "desempeno" | "configuracion" | "inbox" | "logs";
type GerenciaFilterOption = {
  value: string;
  label: string;
};

const TAB_ORDER_BASE: Tab[] = ["funnel", "tabla", "estadisticas", "desempeno", "configuracion"];

const TAB_LABELS: Record<Tab, string> = {
  funnel: "Funnel",
  seguimiento: "Seguimiento",
  tabla: "Tabla",
  estadisticas: "Estadísticas",
  desempeno: "Desempeño",
  configuracion: "Configuracion",
  inbox: "Inbox",
  logs: "Logs",
};

const ACTIVITY_PAGE_SIZE = 200;
const TABLE_VIEW_STORAGE_KEY = "conversion-table-view:dashboard";

function formatRawPayload(value: unknown) {
  const s = String(value ?? "").trim();
  if (!s) return "-";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function extractGerenciaIdFromLabel(label: string | null | undefined): string {
  const match = String(label ?? "").match(/\(ID\s*(\d+)\)/i);
  return match?.[1] ?? "";
}

function gerenciaFilterMatchesLabels(filter: string, labels: string[]): boolean {
  if (filter === "__all__") return true;
  const filterId = /^\d+$/.test(filter) ? filter : extractGerenciaIdFromLabel(filter);
  if (filterId) return labels.some((label) => extractGerenciaIdFromLabel(label) === filterId);
  return labels.includes(filter);
}

function parseInboxPayload(raw: string | null | undefined): Record<string, unknown> {
  const value = String(raw ?? "").trim();
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function getPayloadString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function normalizeVisibleColumnName(col: string): string {
  switch (col) {
    case "send_contact_pixel":
      return "sendContactPixel";
    case "client_ip":
      return "clientIP";
    case "agent_user":
      return "agentuser";
    default:
      return col;
  }
}

function RawPayloadCell({ col, value, className }: { col: ColKey; value: unknown; className: string }) {
  const [tooltip, setTooltip] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMouseRef = useRef<React.MouseEvent | null>(null);
  const formatted = formatRawPayload(value);
  const preview = truncateText(String(value ?? "") || "-", 35);

  const updateTooltipPosition = (event: React.MouseEvent) => {
    const margin = 12;
    const gap = 14;
    const width = Math.min(780, window.innerWidth - margin * 2);
    const maxHeight = Math.min(720, window.innerHeight - margin * 2);
    let left = event.clientX + gap;
    let top = event.clientY + gap;

    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (top + maxHeight > window.innerHeight - margin) {
      top = window.innerHeight - maxHeight - margin;
    }

    setTooltip({ left: Math.max(margin, left), top: Math.max(margin, top), width, maxHeight });
  };

  const handleMouseEnter = (event: React.MouseEvent) => {
    latestMouseRef.current = event;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (latestMouseRef.current) updateTooltipPosition(latestMouseRef.current);
      hoverTimerRef.current = null;
    }, 1500);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    latestMouseRef.current = event;
    if (tooltip) updateTooltipPosition(event);
  };

  const handleMouseLeave = () => {
    latestMouseRef.current = null;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setTooltip(null);
  };

  return (
    <td
      key={col}
      className={`${className} max-w-[220px] truncate cursor-help`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {preview}
      {tooltip && (
        <div
          className="fixed z-[9999] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/95 p-3 text-left shadow-2xl shadow-black/60 backdrop-blur"
          style={{
            left: tooltip.left,
            top: tooltip.top,
            width: tooltip.width,
            maxHeight: tooltip.maxHeight,
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-zinc-800 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Payload completo
            </span>
            <span className="text-[10px] text-zinc-500">Contact / Lead / Purchase</span>
          </div>
          <pre
            className="overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-zinc-200"
            style={{ maxHeight: tooltip.maxHeight - 48 }}
          >
            {formatted}
          </pre>
        </div>
      )}
    </td>
  );
}

function cellValue(
  c: ConversionRow,
  col: ColKey,
  view: ConversionTableView = "technical",
): React.ReactNode {
  const cell = "px-2 py-1.5 whitespace-nowrap";
  const mono = `${cell} font-mono`;
  const dim = `${cell} text-zinc-400`;
  const dimMono = `${dim} font-mono`;
  const tip = (v: unknown) => String(v ?? "-") || "-";
  const timestampText = new Date(c.created_at).toLocaleString("es-AR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });

  switch (col) {
    case "phone": return <td key={col} className={`${mono} text-zinc-200`} title={tip(c.phone)}>{c.phone || "-"}</td>;
    case "email": return <td key={col} className={dim} title={tip(c.email)}>{c.email || "-"}</td>;
    case "form_fn": return <td key={col} className={dim} title={tip(c.form_fn)}>{c.form_fn || "-"}</td>;
    case "form_ln": return <td key={col} className={dim} title={tip(c.form_ln)}>{c.form_ln || "-"}</td>;
    case "form_email": return <td key={col} className={dim} title={tip(c.form_email)}>{c.form_email || "-"}</td>;
    case "form_phone": return <td key={col} className={dimMono} title={tip(c.form_phone)}>{c.form_phone || "-"}</td>;
    case "cuit_cuil": return <td key={col} className={dimMono} title={tip(c.cuit_cuil)}>{c.cuit_cuil || "-"}</td>;
    case "inferred_sex": return <td key={col} className={dim} title={tip(c.inferred_sex)}>{c.inferred_sex || "-"}</td>;
    case "sex_source": return <td key={col} className={dim} title={tip(c.sex_source)}>{c.sex_source || "-"}</td>;
    case "fn": return <td key={col} className={dim} title={tip(c.fn)}>{c.fn || "-"}</td>;
    case "ln": return <td key={col} className={dim} title={tip(c.ln)}>{c.ln || "-"}</td>;
    case "ct": return <td key={col} className={dim} title={tip(c.ct)}>{c.ct || "-"}</td>;
    case "st": return <td key={col} className={dim} title={tip(c.st)}>{c.st || "-"}</td>;
    case "zip": return <td key={col} className={dim} title={tip(c.zip)}>{c.zip || "-"}</td>;
    case "country": return <td key={col} className={dim} title={tip(c.country)}>{c.country || "-"}</td>;
    case "fbp": return <td key={col} className={dimMono} title={tip(c.fbp)}>{c.fbp ? truncateId(c.fbp, 12) : "-"}</td>;
    case "fbc": return <td key={col} className={dimMono} title={tip(c.fbc)}>{c.fbc ? truncateId(c.fbc, 12) : "-"}</td>;
    case "from_meta_ads":
      return <td key={col} className={dim} title={tip(c.from_meta_ads)}>{view === "friendly" ? (c.from_meta_ads ? "Sí" : "No") : (c.from_meta_ads ? "true" : "false")}</td>;
    case "geo_source": return <td key={col} className={dim} title={tip(c.geo_source)}>{c.geo_source || "-"}</td>;
    case "meta_pixel_id": {
      const px = c.meta_pixel_id || c.pixel_id;
      return <td key={col} className={dimMono} title={tip(px)}>{px || "-"}</td>;
    }
    case "pixel_id": return <td key={col} className={dimMono} title={tip(c.pixel_id)}>{c.pixel_id || "-"}</td>;
    case "pixel_attribution_source": return <td key={col} className={dim} title={tip(c.pixel_attribution_source)}>{view === "friendly" ? friendlyPixelAttributionSource(c.pixel_attribution_source) : (c.pixel_attribution_source || "-")}</td>;
    case "pixel_attribution_conversion_id": return <td key={col} className={dimMono} title={tip(c.pixel_attribution_conversion_id)}>{c.pixel_attribution_conversion_id ? truncateId(c.pixel_attribution_conversion_id) : "-"}</td>;
    case "source_platform": return <td key={col} className={dim} title={tip(c.source_platform)}>{view === "friendly" ? friendlySourcePlatform(c.source_platform) : (c.source_platform || "-")}</td>;
    case "ctwa_clid": return <td key={col} className={dim} title={tip(c.ctwa_clid)}>{c.ctwa_clid || "-"}</td>;
    case "contact_event_id": return <td key={col} className={dimMono} title={c.contact_event_id}>{truncateId(c.contact_event_id)}</td>;
    case "contact_event_time": return <td key={col} className={dim} title={tip(c.contact_event_time)}>{c.contact_event_time ?? "-"}</td>;
    case "sendContactPixel": return <td key={col} className={dim} title={tip(c.sendContactPixel)}>{view === "friendly" ? (c.sendContactPixel ? "Sí" : "No") : (c.sendContactPixel ? "true" : "false")}</td>;
    case "contact_payload_raw": return <RawPayloadCell key={col} col={col} value={c.contact_payload_raw} className={dim} />;
    case "lead_event_id": return <td key={col} className={dimMono} title={c.lead_event_id}>{truncateId(c.lead_event_id)}</td>;
    case "lead_event_time": return <td key={col} className={dim} title={tip(c.lead_event_time)}>{c.lead_event_time ?? "-"}</td>;
    case "lead_payload_raw": return <RawPayloadCell key={col} col={col} value={c.lead_payload_raw} className={dim} />;
    case "purchase_event_id": return <td key={col} className={dimMono} title={c.purchase_event_id}>{truncateId(c.purchase_event_id)}</td>;
    case "purchase_event_time": return <td key={col} className={dim} title={tip(c.purchase_event_time)}>{c.purchase_event_time ?? "-"}</td>;
    case "purchase_payload_raw": return <RawPayloadCell key={col} col={col} value={c.purchase_payload_raw} className={dim} />;
    case "test_event_code": return <td key={col} className={dimMono} title={tip(c.test_event_code)}>{c.test_event_code || "-"}</td>;
    case "timestamp": return <td key={col} className={dim} title={timestampText}>{timestampText}</td>;
    case "clientIP": return <td key={col} className={dimMono} title={tip(c.client_ip)}>{c.client_ip || "-"}</td>;
    case "agentuser": return <td key={col} className={dim} title={c.agent_user || "-"}>{truncateText(c.agent_user || "-", 35)}</td>;
    case "estado": {
      const isRepeat = c.estado === "purchase" && c.observaciones?.includes("REPEAT");
      return <td key={col} className={cell}>{estadoBadge(c.estado, isRepeat)}</td>;
    }
    case "valor": return <td key={col} className={`${cell} text-zinc-200`} title={tip(c.valor)}>{c.valor > 0 ? formatIntegerWithThousands(c.valor) : "-"}</td>;
    case "currency": return <td key={col} className={dimMono} title={tip(c.currency)}>{c.currency || "ARS"}</td>;
    case "purchase_type": return <td key={col} className={dim} title={tip(c.purchase_type)}>{view === "friendly" ? friendlyPurchaseType(c.purchase_type) : (c.purchase_type || "-")}</td>;
    case "purchase_capi_route": return <td key={col} className={dim} title={tip(c.purchase_capi_route)}>{c.purchase_capi_route || "-"}</td>;
    case "purchase_capi_route_reason": return <td key={col} className={dim} title={tip(c.purchase_capi_route_reason)}>{c.purchase_capi_route_reason || "-"}</td>;
    case "contact_status_capi": return <td key={col} className={cell} title={tip(c.contact_status_capi)}>{statusText(c.contact_status_capi)}</td>;
    case "lead_status_capi": return <td key={col} className={cell} title={tip(c.lead_status_capi)}>{statusText(c.lead_status_capi)}</td>;
    case "registration_status_capi": return <td key={col} className={cell} title={tip(c.registration_status_capi ?? "")}>{statusText(c.registration_status_capi ?? "")}</td>;
    case "purchase_status_capi": return <td key={col} className={cell} title={tip(c.purchase_status_capi)}>{statusText(c.purchase_status_capi)}</td>;
    case "observaciones": return <td key={col} className={`${cell} text-zinc-500 max-w-[200px] truncate`} title={c.observaciones}>{c.observaciones || "-"}</td>;
    case "external_id": return <td key={col} className={dimMono} title={tip(c.external_id)}>{c.external_id ? truncateId(c.external_id) : "-"}</td>;
    case "utm_campaign": return <td key={col} className={dim} title={tip(c.utm_campaign)}>{c.utm_campaign || "-"}</td>;
    case "telefono_asignado": return <td key={col} className={dim} title={tip(c.telefono_asignado)}>{c.telefono_asignado || "-"}</td>;
    case "assigned_gerencia_label": return <td key={col} className={dim} title={tip(c.assigned_gerencia_label)}>{c.assigned_gerencia_label || "-"}</td>;
    case "lead_bot_phone": return <td key={col} className={dimMono} title={tip(c.lead_bot_phone)}>{c.lead_bot_phone || "-"}</td>;
    case "lead_agency_id": return <td key={col} className={dimMono} title={tip(c.lead_agency_id)}>{c.lead_agency_id || "-"}</td>;
    case "lead_gerencia_label": return <td key={col} className={dim} title={tip(c.lead_gerencia_label)}>{c.lead_gerencia_label || "-"}</td>;
    case "lead_incoming_promo_code": return <td key={col} className={dimMono} title={tip(c.lead_incoming_promo_code)}>{c.lead_incoming_promo_code || "-"}</td>;
    case "lead_attribution_status": return <td key={col} className={dim} title={tip(c.lead_attribution_status)}>{c.lead_attribution_status || "-"}</td>;
    case "lead_attribution_conversion_id": return <td key={col} className={dimMono} title={tip(c.lead_attribution_conversion_id)}>{c.lead_attribution_conversion_id ? truncateId(c.lead_attribution_conversion_id) : "-"}</td>;
    case "purchase_bot_phone": return <td key={col} className={dimMono} title={tip(c.purchase_bot_phone)}>{c.purchase_bot_phone || "-"}</td>;
    case "purchase_agency_id": return <td key={col} className={dimMono} title={tip(c.purchase_agency_id)}>{c.purchase_agency_id || "-"}</td>;
    case "purchase_gerencia_label": return <td key={col} className={dim} title={tip(c.purchase_gerencia_label)}>{c.purchase_gerencia_label || "-"}</td>;
    case "purchase_incoming_promo_code": return <td key={col} className={dimMono} title={tip(c.purchase_incoming_promo_code)}>{c.purchase_incoming_promo_code || "-"}</td>;
    case "purchase_attribution_status": return <td key={col} className={dim} title={tip(c.purchase_attribution_status)}>{c.purchase_attribution_status || "-"}</td>;
    case "purchase_attribution_conversion_id": return <td key={col} className={dimMono} title={tip(c.purchase_attribution_conversion_id)}>{c.purchase_attribution_conversion_id ? truncateId(c.purchase_attribution_conversion_id) : "-"}</td>;
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
  const { currencyScope, isAllCurrencies } = useCurrencyScope();
  const reportingCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [logs, setLogs] = useState<ConversionLogRow[]>([]);
  const [inboxRows, setInboxRows] = useState<ConversionInboxRow[]>([]);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [clearViewOpen, setClearViewOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("funnel");
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxActionFilter, setInboxActionFilter] = useState<"all" | "CONTACT" | "LEAD" | "COMPLETEREGISTRATION" | "PURCHASE">("LEAD");
  const [tableSearch, setTableSearch] = useState("");
  const [tableView, setTableView] =
    useState<ConversionTableView>("friendly");
  const [tablePage, setTablePage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const [logsHasNextPage, setLogsHasNextPage] = useState(false);
  const [logDirectionFilter, setLogDirectionFilter] =
    useState<ConversionLogDirectionFilter>("all");
  const [logEventFilter, setLogEventFilter] =
    useState<ConversionLogEventFilter>("all");
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxHasNextPage, setInboxHasNextPage] = useState(false);
  const {
    statsLandingFilter,
    setStatsLandingFilter,
    statsPixelFilter,
    setStatsPixelFilter,
    statsGerenciaFilter,
    setStatsGerenciaFilter,
    statsTelefonoFilter,
    setStatsTelefonoFilter,
    statsFromMetaAdsFilter,
    statsSourcePlatformFilter,
    setStatsSourcePlatformFilter,
    statsSexoFilter,
    setStatsSexoFilter,
    statsCampaignFilter,
    setStatsCampaignFilter,
    statsDeviceFilter,
    setStatsDeviceFilter,
    statsFilterModalOpen,
    setStatsFilterModalOpen,
    draftLandingFilter,
    setDraftLandingFilter,
    draftPixelFilter,
    setDraftPixelFilter,
    draftGerenciaFilter,
    setDraftGerenciaFilter,
    draftTelefonoFilter,
    setDraftTelefonoFilter,
    draftFromMetaAdsFilter,
    setDraftFromMetaAdsFilter,
    draftSourcePlatformFilter,
    setDraftSourcePlatformFilter,
    draftSexoFilter,
    setDraftSexoFilter,
    draftCampaignFilter,
    setDraftCampaignFilter,
    openStatsFilterModal,
    applyStatsFilters,
    clearAllStatsFilters,
    hasStatsFiltersApplied,
    statsFiltersCount,
  } = useConversionStatsFilters();
  const [gerenciaByPhone, setGerenciaByPhone] = useState<Record<string, string[]>>({});
  const [currentGerenciaLabelById, setCurrentGerenciaLabelById] = useState<Record<string, string>>({});
  const [activePhonesByGerenciaLabel, setActivePhonesByGerenciaLabel] = useState<Record<string, string[]>>({});
  const [performanceLandingOptions, setPerformanceLandingOptions] = useState<LandingPerformanceFilterOption[]>([]);

  const [dateRange, setDateRange] = useState<DateRange | null>(todayRange());
  const [refreshingTable, setRefreshingTable] = useState(false);
  const [hidingTable, setHidingTable] = useState(false);
  const [hidingFunnel, setHidingFunnel] = useState(false);
  const [hidingStats, setHidingStats] = useState(false);
  const [hidingLogs, setHidingLogs] = useState(false);
  const initialDateRangeRef = useRef<DateRange | null>(dateRange);
  const dateRangeRef = useRef<DateRange | null>(dateRange);
  const dataRequestSeqRef = useRef(0);
  const userIdRef = useRef<string | null>(null);
  const tabRef = useRef<Tab>(tab);
  const inboxSearchRef = useRef(inboxSearch);
  const inboxActionFilterRef = useRef(inboxActionFilter);
  const logsPageRef = useRef(logsPage);
  const logDirectionFilterRef = useRef(logDirectionFilter);
  const logEventFilterRef = useRef(logEventFilter);
  const inboxPageRef = useRef(inboxPage);

  useEffect(() => {
    const stored = window.localStorage.getItem(TABLE_VIEW_STORAGE_KEY);
    if (stored === "technical" || stored === "friendly") {
      setTableView(stored);
    }
  }, []);

  const toggleTableView = useCallback(() => {
    setTableView((current) => {
      const next = current === "friendly" ? "technical" : "friendly";
      window.localStorage.setItem(TABLE_VIEW_STORAGE_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    inboxSearchRef.current = inboxSearch;
  }, [inboxSearch]);

  useEffect(() => {
    inboxActionFilterRef.current = inboxActionFilter;
  }, [inboxActionFilter]);

  useEffect(() => {
    logsPageRef.current = logsPage;
  }, [logsPage]);

  useEffect(() => {
    logDirectionFilterRef.current = logDirectionFilter;
  }, [logDirectionFilter]);

  useEffect(() => {
    logEventFilterRef.current = logEventFilter;
  }, [logEventFilter]);

  useEffect(() => {
    inboxPageRef.current = inboxPage;
  }, [inboxPage]);

  useEffect(() => {
    const view = (searchParams.get("view") || "").toLowerCase();
    const tabParam = (searchParams.get("tab") || "").toLowerCase();
    if (tabParam === "configuracion") {
      setTab("configuracion");
      return;
    }
    if (view === "seguimiento") {
      setTab("seguimiento");
    }
  }, [searchParams]);

  const [pixelConfigs, setPixelConfigs] = useState<PixelConfig[]>([]);

  const scopedConversions = useMemo(
    () => filterConversionsByCurrency(conversions, currencyScope),
    [conversions, currencyScope],
  );
  const scopedFunnel = useMemo(
    () => buildFunnelContactsFromConversions(scopedConversions),
    [scopedConversions],
  );
  const activeConversions = useMemo(() => filterByDateRange(scopedConversions, dateRange), [scopedConversions, dateRange]);
  const activeFunnel = useMemo(() => filterFunnelByDateRange(scopedFunnel, dateRange), [scopedFunnel, dateRange]);
  const premiumThreshold = getPremiumThreshold(config, reportingCurrency);
  const activeLogs = useMemo(() => filterByDateRange(logs, dateRange), [logs, dateRange]);
  const activeInbox = useMemo(() => filterByDateRange(inboxRows, dateRange), [inboxRows, dateRange]);
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
  const statsPixelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const px = String(r.meta_pixel_id ?? r.pixel_id ?? "").trim();
      if (px) set.add(px);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [statsAllConversions]);
  const statsTelefonoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const phone = normalizePhone(r.telefono_asignado);
      if (phone) set.add(phone);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [statsAllConversions]);
  const statsGerenciaOptions = useMemo<GerenciaFilterOption[]>(() => {
    const byId = new Map<string, string>();
    for (const [id, label] of Object.entries(currentGerenciaLabelById)) {
      if (id && label) byId.set(id, label);
    }
    const loose = new Set<string>();
    for (const r of statsAllConversions) {
      const labels = getConversionGerenciaLabels(r, gerenciaByPhone);
      for (const label of labels) {
        const id = extractGerenciaIdFromLabel(label);
        if (id) {
          if (!byId.has(id)) byId.set(id, label);
        } else if (label) {
          loose.add(label);
        }
      }
    }
    return [
      ...Array.from(byId.entries()).map(([value, label]) => ({ value, label })),
      ...Array.from(loose).map((label) => ({ value: label, label })),
    ].sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true, sensitivity: "base" }));
  }, [statsAllConversions, gerenciaByPhone, currentGerenciaLabelById]);
  const statsSourcePlatformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const src = String(r.source_platform ?? "").trim().toLowerCase();
      if (src) set.add(src);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  const statsSexoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const sex = normalizeSexValue((r as { inferred_sex?: string | null }).inferred_sex);
      if (sex) set.add(sex);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  const statsCampaignOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const campaign = String(r.utm_campaign ?? "").trim();
      if (campaign) set.add(campaign);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  const statsDeviceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const device = String(r.device_type ?? "").trim().toLowerCase();
      if (device) set.add(device);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  useEffect(() => {
    if (statsLandingFilter !== "__all__" && !statsLandingOptions.includes(statsLandingFilter)) {
      setStatsLandingFilter("__all__");
    }
  }, [statsLandingFilter, statsLandingOptions, setStatsLandingFilter]);
  useEffect(() => {
    if (statsPixelFilter !== "__all__" && !statsPixelOptions.includes(statsPixelFilter)) {
      setStatsPixelFilter("__all__");
    }
  }, [statsPixelFilter, statsPixelOptions, setStatsPixelFilter]);
  useEffect(() => {
    if (statsGerenciaFilter === "__all__") return;
    const canonical = extractGerenciaIdFromLabel(statsGerenciaFilter) || statsGerenciaFilter;
    if (canonical !== statsGerenciaFilter && statsGerenciaOptions.some((g) => g.value === canonical)) {
      setStatsGerenciaFilter(canonical);
      return;
    }
    if (!statsGerenciaOptions.some((g) => g.value === statsGerenciaFilter)) {
      setStatsGerenciaFilter("__all__");
    }
  }, [statsGerenciaFilter, statsGerenciaOptions, setStatsGerenciaFilter]);
  useEffect(() => {
    if (statsTelefonoFilter !== "__all__" && !statsTelefonoOptions.includes(statsTelefonoFilter)) {
      setStatsTelefonoFilter("__all__");
    }
  }, [statsTelefonoFilter, statsTelefonoOptions, setStatsTelefonoFilter]);
  useEffect(() => {
    if (statsSourcePlatformFilter !== "__all__" && !statsSourcePlatformOptions.includes(statsSourcePlatformFilter)) {
      setStatsSourcePlatformFilter("__all__");
    }
  }, [statsSourcePlatformFilter, statsSourcePlatformOptions, setStatsSourcePlatformFilter]);
  useEffect(() => {
    if (statsSexoFilter !== "__all__" && !statsSexoOptions.includes(statsSexoFilter)) {
      setStatsSexoFilter("__all__");
    }
  }, [statsSexoFilter, statsSexoOptions, setStatsSexoFilter]);
  useEffect(() => {
    const validCampaigns = statsCampaignFilter.filter((campaign) => statsCampaignOptions.includes(campaign));
    if (validCampaigns.length !== statsCampaignFilter.length) {
      setStatsCampaignFilter(validCampaigns);
    }
  }, [statsCampaignFilter, statsCampaignOptions, setStatsCampaignFilter]);
  useEffect(() => {
    if (statsDeviceFilter !== "__all__" && !statsDeviceOptions.includes(statsDeviceFilter)) {
      setStatsDeviceFilter("__all__");
    }
  }, [statsDeviceFilter, statsDeviceOptions, setStatsDeviceFilter]);
  const statsConversionsFiltered = useMemo(() => {
    const filtered = statsConversions.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPixel = statsPixelFilter === "__all__" || String(r.meta_pixel_id ?? r.pixel_id ?? "").trim() === statsPixelFilter;
      const assignedPhone = normalizePhone(r.telefono_asignado);
      const byTelefono = statsTelefonoFilter === "__all__" || assignedPhone === statsTelefonoFilter;
      const labels = getConversionGerenciaLabels(r, gerenciaByPhone);
      const byGerencia = gerenciaFilterMatchesLabels(statsGerenciaFilter, labels);
      const byFromMetaAds =
        statsFromMetaAdsFilter === "__all__" ||
        (statsFromMetaAdsFilter === "true" ? !!r.from_meta_ads : !r.from_meta_ads);
      const bySourcePlatform =
        statsSourcePlatformFilter === "__all__" ||
        String(r.source_platform ?? "").trim().toLowerCase() === statsSourcePlatformFilter;
      const bySexo =
        statsSexoFilter === "__all__" ||
        normalizeSexValue((r as { inferred_sex?: string | null }).inferred_sex) === statsSexoFilter;
      const byCampaign = statsCampaignFilter.length === 0 || statsCampaignFilter.includes(String(r.utm_campaign ?? "").trim());
      const byDevice = statsDeviceFilter === "__all__" || String(r.device_type ?? "").trim().toLowerCase() === statsDeviceFilter;
      return byLanding && byPixel && byGerencia && byTelefono && byFromMetaAds && bySourcePlatform && bySexo && byCampaign && byDevice;
    });
    if (statsGerenciaFilter === "__all__") return filtered;
    return filtered
      .map((row) => scopeConversionStagesToGerencia(
        row,
        gerenciaByPhone,
        (labels) => gerenciaFilterMatchesLabels(statsGerenciaFilter, labels),
      ))
      .filter((row): row is ConversionRow => row !== null);
  }, [statsConversions, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter, gerenciaByPhone]);
  const statsAllConversionsFiltered = useMemo(() => {
    const filtered = statsAllConversions.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPixel = statsPixelFilter === "__all__" || String(r.meta_pixel_id ?? r.pixel_id ?? "").trim() === statsPixelFilter;
      const assignedPhone = normalizePhone(r.telefono_asignado);
      const byTelefono = statsTelefonoFilter === "__all__" || assignedPhone === statsTelefonoFilter;
      const labels = getConversionGerenciaLabels(r, gerenciaByPhone);
      const byGerencia = gerenciaFilterMatchesLabels(statsGerenciaFilter, labels);
      const byFromMetaAds =
        statsFromMetaAdsFilter === "__all__" ||
        (statsFromMetaAdsFilter === "true" ? !!r.from_meta_ads : !r.from_meta_ads);
      const bySourcePlatform =
        statsSourcePlatformFilter === "__all__" ||
        String(r.source_platform ?? "").trim().toLowerCase() === statsSourcePlatformFilter;
      const bySexo =
        statsSexoFilter === "__all__" ||
        normalizeSexValue((r as { inferred_sex?: string | null }).inferred_sex) === statsSexoFilter;
      const byCampaign = statsCampaignFilter.length === 0 || statsCampaignFilter.includes(String(r.utm_campaign ?? "").trim());
      const byDevice = statsDeviceFilter === "__all__" || String(r.device_type ?? "").trim().toLowerCase() === statsDeviceFilter;
      return byLanding && byPixel && byGerencia && byTelefono && byFromMetaAds && bySourcePlatform && bySexo && byCampaign && byDevice;
    });
    if (statsGerenciaFilter === "__all__") return filtered;
    return filtered
      .map((row) => scopeConversionStagesToGerencia(
        row,
        gerenciaByPhone,
        (labels) => gerenciaFilterMatchesLabels(statsGerenciaFilter, labels),
      ))
      .filter((row): row is ConversionRow => row !== null);
  }, [statsAllConversions, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter, gerenciaByPhone]);
  const filteredPhoneSet = useMemo(
    () => new Set(
      statsConversionsFiltered
        .map((r) => String(r.phone ?? "").trim())
        .filter(Boolean),
    ),
    [statsConversionsFiltered],
  );
  const activeFunnelFiltered = useMemo(() => {
    if (statsGerenciaFilter !== "__all__") {
      return buildFunnelContactsFromConversions(statsConversionsFiltered);
    }
    return activeFunnel.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPhone = filteredPhoneSet.has(String(r.phone ?? "").trim());
      return byLanding && byPhone;
    });
  }, [activeFunnel, statsLandingFilter, filteredPhoneSet, statsGerenciaFilter, statsConversionsFiltered]);
  const gerenciaLabelsByContactPhone = useMemo(() => {
    const byContactPhone: Record<string, string[]> = {};
    for (const row of statsAllConversionsFiltered) {
      const contactPhone = normalizePhone(row.phone);
      if (!contactPhone) continue;
      const labels = getConversionGerenciaLabels(row, gerenciaByPhone);
      if (labels.length === 0) continue;
      byContactPhone[contactPhone] = byContactPhone[contactPhone] ?? [];
      for (const label of labels) {
        if (!byContactPhone[contactPhone].includes(label)) {
          byContactPhone[contactPhone].push(label);
        }
      }
    }
    return byContactPhone;
  }, [statsAllConversionsFiltered, gerenciaByPhone]);
  const tableConversionsFiltered = useMemo(() => {
    return activeConversions.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPixel = statsPixelFilter === "__all__" || String(r.meta_pixel_id ?? r.pixel_id ?? "").trim() === statsPixelFilter;
      const assignedPhone = normalizePhone(r.telefono_asignado);
      const byTelefono = statsTelefonoFilter === "__all__" || assignedPhone === statsTelefonoFilter;
      const labels = getConversionGerenciaLabels(r, gerenciaByPhone);
      const byGerencia = gerenciaFilterMatchesLabels(statsGerenciaFilter, labels);
      const byFromMetaAds =
        statsFromMetaAdsFilter === "__all__" ||
        (statsFromMetaAdsFilter === "true" ? !!r.from_meta_ads : !r.from_meta_ads);
      const bySourcePlatform =
        statsSourcePlatformFilter === "__all__" ||
        String(r.source_platform ?? "").trim().toLowerCase() === statsSourcePlatformFilter;
      const bySexo =
        statsSexoFilter === "__all__" ||
        normalizeSexValue((r as { inferred_sex?: string | null }).inferred_sex) === statsSexoFilter;
      const byCampaign = statsCampaignFilter.length === 0 || statsCampaignFilter.includes(String(r.utm_campaign ?? "").trim());
      const byDevice = statsDeviceFilter === "__all__" || String(r.device_type ?? "").trim().toLowerCase() === statsDeviceFilter;
      return byLanding && byPixel && byGerencia && byTelefono && byFromMetaAds && bySourcePlatform && bySexo && byCampaign && byDevice;
    });
  }, [activeConversions, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter, gerenciaByPhone]);
  const filteredConversions = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return tableConversionsFiltered;
    const conditionalMatch = q.match(/^valor\s*(>=|<=|>|<|==|=)\s*([-+]?[\d.,\s]+)$/i);
    if (conditionalMatch) {
      const op = conditionalMatch[1];
      const raw = conditionalMatch[2] ?? "";
      const normalizedDigits = raw.replace(/[^\d-]/g, "");
      const target = Number(normalizedDigits);
      if (Number.isFinite(target)) {
        return tableConversionsFiltered.filter((c) => {
          const value = Number(c.valor ?? 0);
          if (!Number.isFinite(value)) return false;
          if (op === ">") return value > target;
          if (op === ">=") return value >= target;
          if (op === "<") return value < target;
          if (op === "<=") return value <= target;
          return value === target;
        });
      }
    }
    return tableConversionsFiltered.filter((c) => {
      const hay = [
        c.phone,
        c.email,
        c.promo_code,
        c.external_id,
        c.utm_campaign,
        c.telefono_asignado,
        c.assigned_gerencia_label,
        c.landing_name,
        c.estado,
        c.purchase_type,
        c.meta_pixel_id,
        c.pixel_id,
        c.source_platform,
        c.device_type,
        c.fn,
        c.ln,
        c.ct,
        c.st,
        c.country,
        c.geo_city,
        c.geo_region,
        c.geo_country,
        c.contact_event_id,
        c.lead_event_id,
        c.purchase_event_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tableConversionsFiltered, tableSearch]);
  const conversionById = useMemo(
    () => new Map(conversions.map((c) => [c.id, c])),
    [conversions],
  );
  const inboxFilteredByGlobalFilters = useMemo(() => {
    return activeInbox.filter((row) => {
      const payload = parseInboxPayload(row.payload_raw);
      const related = row.conversion_id ? conversionById.get(row.conversion_id) : undefined;
      const landingName = String(
        row.landing_name ||
        related?.landing_name ||
        getPayloadString(payload, ["landing_name", "landingName", "landing"])
      ).trim();
      const pixelId = String(
        related?.meta_pixel_id ||
        related?.pixel_id ||
        getPayloadString(payload, ["meta_pixel_id", "pixel_id"])
      ).trim();
      const assignedPhone = normalizePhone(
        related?.telefono_asignado ||
        getPayloadString(payload, ["telefono_asignado", "bot_phone", "assigned_phone"])
      );
      const payloadGerenciaLabel = getPayloadString(payload, ["assigned_gerencia_label", "gerencia_label", "gerencia"]);
      const gerenciaLabels = related
        ? getConversionGerenciaLabels(related, gerenciaByPhone)
        : [
            ...(payloadGerenciaLabel ? [payloadGerenciaLabel] : []),
            ...(assignedPhone ? (gerenciaByPhone[assignedPhone] ?? []) : []),
          ];
      const sourcePlatform = String(
        related?.source_platform ||
        getPayloadString(payload, ["source_platform"])
      ).trim().toLowerCase();
      const sex = related
        ? normalizeSexValue((related as { inferred_sex?: string | null }).inferred_sex)
        : normalizeSexValue(getPayloadString(payload, ["inferred_sex", "sex"]));
      const campaign = String(
        related?.utm_campaign ||
        getPayloadString(payload, ["utm_campaign"])
      ).trim();
      const device = String(
        related?.device_type ||
        getPayloadString(payload, ["device_type"])
      ).trim().toLowerCase();
      const promo = String(row.promo_code || getPayloadString(payload, ["promo_code"])).trim();
      const hasMetaSignal =
        related != null
          ? !!related.from_meta_ads
          : Boolean(
              getPayloadString(payload, ["fbc"]) ||
              campaign ||
              /^[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(promo)
            );

      const byLanding = statsLandingFilter === "__all__" || landingName === statsLandingFilter;
      const byPixel = statsPixelFilter === "__all__" || pixelId === statsPixelFilter;
      const byTelefono = statsTelefonoFilter === "__all__" || assignedPhone === statsTelefonoFilter;
      const byGerencia = gerenciaFilterMatchesLabels(statsGerenciaFilter, gerenciaLabels);
      const byFromMetaAds =
        statsFromMetaAdsFilter === "__all__" ||
        (statsFromMetaAdsFilter === "true" ? hasMetaSignal : !hasMetaSignal);
      const bySourcePlatform = statsSourcePlatformFilter === "__all__" || sourcePlatform === statsSourcePlatformFilter;
      const bySexo = statsSexoFilter === "__all__" || sex === statsSexoFilter;
      const byCampaign = statsCampaignFilter.length === 0 || statsCampaignFilter.includes(campaign);
      const byDevice = statsDeviceFilter === "__all__" || device === statsDeviceFilter;

      return byLanding && byPixel && byTelefono && byGerencia && byFromMetaAds && bySourcePlatform && bySexo && byCampaign && byDevice;
    });
  }, [activeInbox, conversionById, gerenciaByPhone, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter]);
  const filteredInbox = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    const byAction = inboxFilteredByGlobalFilters.filter((r) =>
      inboxActionFilter === "all" ? true : String(r.action ?? "").toUpperCase() === inboxActionFilter,
    );
    if (!q) return byAction;
    return byAction.filter((r) => {
      const hay = [
        r.action,
        r.status,
        r.promo_code,
        r.coelsa_id ?? "",
        r.transaction_id ?? "",
        r.phone,
        r.action_event_id ?? "",
        r.response_body,
        r.landing_name,
        r.payload_raw,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [inboxFilteredByGlobalFilters, inboxSearch, inboxActionFilter]);
  const tablePageSize = 50;
  const totalTablePages = Math.max(1, Math.ceil(filteredConversions.length / tablePageSize));
  const pagedConversions = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredConversions.slice(start, start + tablePageSize);
  }, [filteredConversions, tablePage]);
  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, dateRange, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter, currencyScope]);
  useEffect(() => {
    if (tablePage > totalTablePages) setTablePage(totalTablePages);
  }, [tablePage, totalTablePages]);

  const visibleCols = useMemo(() => {
    const cols = (config?.visible_columns ?? []).map((c) =>
      normalizeVisibleColumnName(String(c)),
    );
    const valid = cols.filter((c): c is ColKey =>
      (ALL_COLUMNS as readonly string[]).includes(c),
    );
    // Fallback defensivo: si por algun motivo quedaron columnas legacy/invalidas,
    // mostramos el set completo para no dejar la tabla "vacia".
    return new Set<ColKey>(valid.length > 0 ? valid : [...ALL_COLUMNS]);
  }, [config]);
  const displayedCols = useMemo(
    () => {
      const cols = ALL_COLUMNS.filter((c) => visibleCols.has(c));
      if (cols.includes("telefono_asignado") && !cols.includes("assigned_gerencia_label")) {
        const phoneIndex = cols.indexOf("telefono_asignado");
        cols.splice(phoneIndex + 1, 0, "assigned_gerencia_label");
      }
      return cols;
    },
    [visibleCols],
  );
  const displayedColsWithoutTimestamp = useMemo(
    () =>
      columnsForTableView(displayedCols, tableView).filter(
        (column) => column !== "timestamp",
      ),
    [displayedCols, tableView],
  );
  const internalIdByConversionId = useMemo(
    () => new Map(conversions.map((c) => [c.id, c.internal_id])),
    [conversions],
  );
  const logGroupMetaByIndex = useMemo(() => {
    const keys = logs.map((log) =>
      log.conversion_id
        ? String(log.conversion_internal_id ?? internalIdByConversionId.get(log.conversion_id) ?? "-")
        : "-"
    );
    const toneByKey = new Map<string, 0 | 1>();
    let nextTone: 0 | 1 = 0;
    const toneByIndex: (0 | 1)[] = [];
    keys.forEach((key) => {
      if (!toneByKey.has(key)) {
        toneByKey.set(key, nextTone);
        nextTone = nextTone === 0 ? 1 : 0;
      }
      toneByIndex.push(toneByKey.get(key)!);
    });
    return toneByIndex.map((tone, idx) => {
      const isStart = idx === 0 || keys[idx - 1] !== keys[idx];
      const isEnd = idx === keys.length - 1 || keys[idx + 1] !== keys[idx];
      return { base: tone === 0 ? "bg-zinc-800/30" : "bg-zinc-950/70", isStart, isEnd };
    });
  }, [logs, internalIdByConversionId]);
  const tabOrder = useMemo<Tab[]>(
    () => {
      const base = [...TAB_ORDER_BASE];
      if (config?.show_inbox === true) base.push("inbox");
      if (config?.show_logs !== false) base.push("logs");
      return base;
    },
    [config?.show_logs, config?.show_inbox],
  );
  useEffect(() => {
    if (config?.show_logs === false && tab === "logs") {
      setTab("funnel");
    }
    if (config?.show_inbox !== true && tab === "inbox") {
      setTab("funnel");
    }
  }, [config?.show_logs, config?.show_inbox, tab]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;
      setUserId(user.id);
      const requestSeq = ++dataRequestSeqRef.current;
      try {
        const [cfg, rows, pixels] = await Promise.all([
          fetchConversionsConfig(user.id),
          dashboardConversionPageDataSource.fetchVisibleConversions({
            viewerId: user.id,
            range: initialDateRangeRef.current,
          }),
          fetchPixelConfigs(user.id),
        ]);
        setConfig(cfg);
        if (requestSeq === dataRequestSeqRef.current) {
          setConversions(rows);
        }
        setPixelConfigs(pixels);

        const { data: profile } = await supabase
          .from("profiles").select("nombre").eq("id", user.id).maybeSingle();
        setClientName(profile?.nombre ?? "");

        const { data: gerencias } = await supabase
          .from("gerencias")
          .select("id,nombre,gerencia_id")
          .eq("user_id", user.id);
        const gerenciasList = gerencias ?? [];
        const gerenciasById = new Map<number, string>();
        const currentLabelsById: Record<string, string> = {};
        for (const g of gerenciasList) {
          const id = Number(g.id);
          if (!Number.isFinite(id)) continue;
          const extId = Number(g.gerencia_id);
          const label = `${String(g.nombre ?? "").trim()} (ID ${Number.isFinite(extId) ? extId : id})`;
          gerenciasById.set(id, label);
          currentLabelsById[String(Number.isFinite(extId) ? extId : id)] = label;
        }
        setCurrentGerenciaLabelById(currentLabelsById);
        if (gerenciasById.size > 0) {
          const ids = Array.from(gerenciasById.keys());
          const { data: phones } = await supabase
            .from("gerencia_phones")
            .select("gerencia_id,phone,status")
            .in("gerencia_id", ids);
          const byPhone: Record<string, string[]> = {};
          const activeByLabel: Record<string, string[]> = {};
          for (const row of phones ?? []) {
            const phone = normalizePhone(String(row.phone ?? ""));
            if (!phone) continue;
            const label = gerenciasById.get(Number(row.gerencia_id));
            if (!label) continue;
            byPhone[phone] = byPhone[phone] ?? [];
            if (!byPhone[phone].includes(label)) byPhone[phone].push(label);
            if (String(row.status ?? "") === "active") {
              activeByLabel[label] = activeByLabel[label] ?? [];
              if (!activeByLabel[label].includes(phone)) activeByLabel[label].push(phone);
            }
          }
          setGerenciaByPhone(byPhone);
          setActivePhonesByGerenciaLabel(activeByLabel);
        } else {
          setGerenciaByPhone({});
          setActivePhonesByGerenciaLabel({});
        }

        const { data: landings } = await supabase
          .from("landings")
          .select("id,user_id,name")
          .eq("user_id", user.id)
          .order("name", { ascending: true });
        const landingRows = landings ?? [];
        if (landingRows.length > 0 && gerenciasById.size > 0) {
          const landingIds = landingRows.map((landing) => String(landing.id)).filter(Boolean);
          const { data: assignments } = await supabase
            .from("landings_gerencias")
            .select("landing_id,gerencia_id")
            .in("landing_id", landingIds);
          const labelsByLanding = new Map<string, Set<string>>();
          for (const assignment of assignments ?? []) {
            const landingId = String(assignment.landing_id ?? "");
            const label = gerenciasById.get(Number(assignment.gerencia_id));
            if (!landingId || !label) continue;
            const labels = labelsByLanding.get(landingId) ?? new Set<string>();
            labels.add(label);
            labelsByLanding.set(landingId, labels);
          }
          setPerformanceLandingOptions(
            landingRows.map((landing) => ({
              id: String(landing.id),
              name: String(landing.name ?? "").trim() || "Landing sin nombre",
              userId: String(landing.user_id ?? user.id),
              gerenciaLabels: Array.from(labelsByLanding.get(String(landing.id)) ?? []).sort((a, b) => a.localeCompare(b, "es")),
            })),
          );
        } else {
          setPerformanceLandingOptions([]);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    void init();
  }, []);

  useEffect(() => {
    setLogsPage(1);
  }, [dateRange, logDirectionFilter, logEventFilter]);

  useEffect(() => {
    setInboxPage(1);
  }, [inboxSearch, inboxActionFilter, dateRange]);

  useEffect(() => {
    if (tab !== "logs" || !userId) return;
    const requestSeq = ++dataRequestSeqRef.current;
    setRefreshingTable(true);
    const offset = (logsPage - 1) * ACTIVITY_PAGE_SIZE;
    void (async () => {
      try {
        const logRows = await dashboardConversionPageDataSource.fetchVisibleLogs({
          viewerId: userId,
          limit: ACTIVITY_PAGE_SIZE + 1,
          offset,
          range: dateRange,
          direction: logDirectionFilter,
          eventType: logEventFilter,
        });
        if (requestSeq !== dataRequestSeqRef.current) return;
        setLogs(logRows.slice(0, ACTIVITY_PAGE_SIZE));
        setLogsHasNextPage(logRows.length > ACTIVITY_PAGE_SIZE);
      } catch (e) {
        console.error(e);
      } finally {
        if (requestSeq === dataRequestSeqRef.current) setRefreshingTable(false);
      }
    })();
  }, [
    tab,
    userId,
    logsPage,
    dateRange,
    logDirectionFilter,
    logEventFilter,
  ]);

  useEffect(() => {
    if (tab !== "inbox" || !userId) return;
    const search = inboxSearch.trim();
    const timer = window.setTimeout(async () => {
      const requestSeq = ++dataRequestSeqRef.current;
      setRefreshingTable(true);
      const offset = (inboxPage - 1) * ACTIVITY_PAGE_SIZE;
      try {
        const inbox = await dashboardConversionPageDataSource.fetchInbox({
          viewerId: userId,
          limit: ACTIVITY_PAGE_SIZE + 1,
          offset,
          range: dateRange,
          action: inboxActionFilter,
          search,
        });
        if (requestSeq !== dataRequestSeqRef.current) return;
        setInboxRows(inbox.slice(0, ACTIVITY_PAGE_SIZE));
        setInboxHasNextPage(inbox.length > ACTIVITY_PAGE_SIZE);
      } catch (e) {
        console.error(e);
      } finally {
        if (requestSeq === dataRequestSeqRef.current) setRefreshingTable(false);
      }
    }, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [tab, userId, inboxSearch, inboxActionFilter, inboxPage, dateRange]);

  const handleSave = async () => {
    if (!config || !userId) return;
    setSaving(true); setSaveMsg(null);
    try {
      const pixels = await saveConversionPageConfig({
        userId,
        config,
        pixelConfigs,
      });
      setPixelConfigs(pixels);
      setSaveMsg("Configuracion guardada.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  };

  const refreshTable = useCallback(async (explicitRange?: DateRange | null) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;
    const currentTab = tabRef.current;
    const range = explicitRange === undefined ? dateRangeRef.current : explicitRange;
    const requestSeq = ++dataRequestSeqRef.current;
    setRefreshingTable(true);
    try {
      if (currentTab === "logs") {
        const page = logsPageRef.current;
        const offset = (page - 1) * ACTIVITY_PAGE_SIZE;
        const logRows = await dashboardConversionPageDataSource.fetchVisibleLogs({
          viewerId: currentUserId,
          limit: ACTIVITY_PAGE_SIZE + 1,
          offset,
          range,
          direction: logDirectionFilterRef.current,
          eventType: logEventFilterRef.current,
        });
        if (requestSeq !== dataRequestSeqRef.current) return;
        setLogs(logRows.slice(0, ACTIVITY_PAGE_SIZE));
        setLogsHasNextPage(logRows.length > ACTIVITY_PAGE_SIZE);
      } else if (currentTab === "inbox") {
        const search = inboxSearchRef.current.trim();
        const page = inboxPageRef.current;
        const offset = (page - 1) * ACTIVITY_PAGE_SIZE;
        const inbox = await dashboardConversionPageDataSource.fetchInbox({
          viewerId: currentUserId,
          limit: ACTIVITY_PAGE_SIZE + 1,
          offset,
          range,
          action: inboxActionFilterRef.current,
          search,
        });
        if (requestSeq !== dataRequestSeqRef.current) return;
        setInboxRows(inbox.slice(0, ACTIVITY_PAGE_SIZE));
        setInboxHasNextPage(inbox.length > ACTIVITY_PAGE_SIZE);
      } else {
        const rows = await dashboardConversionPageDataSource.fetchVisibleConversions({
          viewerId: currentUserId,
          range,
        });
        if (requestSeq !== dataRequestSeqRef.current) return;
        setConversions(rows);
      }
    } catch (e) { console.error(e); }
    finally {
      if (requestSeq === dataRequestSeqRef.current) setRefreshingTable(false);
    }
  }, []);

  const handleDateRangeChange = useCallback((nextRange: DateRange | null) => {
    const previousRange = dateRangeRef.current;
    initialDateRangeRef.current = nextRange;
    dateRangeRef.current = nextRange;
    setDateRange(nextRange);
    if (isSameDateRange(previousRange, nextRange)) return;
    void refreshTable(nextRange);
  }, [refreshTable]);

  const fetchPerformanceConversions = useCallback(async (range: FetchDateRange) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return [];
    const rows = await dashboardConversionPageDataSource.fetchReportingConversions({
      viewerId: currentUserId,
      range,
    });
    return filterConversionsByCurrency(rows, currencyScope);
  }, [currencyScope]);

  const fetchPerformanceAvailability = useCallback(async (range: FetchDateRange) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return [];
    return dashboardConversionPageDataSource.fetchAvailability({
      viewerId: currentUserId,
      range,
    });
  }, []);

  const clearGlobalDisplay = useCallback(() => {
    if (!userId) return;
    setClearViewOpen(true);
  }, [userId]);

  const applyGlobalDisplayCleanup = useCallback(async (
    mode: ClearConversionsViewMode,
  ) => {
    if (!userId) return;
    setHidingTable(true);
    setHidingFunnel(true);
    setHidingStats(true);
    setHidingLogs(true);
    setClearMsg(null);
    try {
      const now = new Date();
      const visibleFrom = mode === "keep_current_month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : now;
      const cutoffMs = visibleFrom.getTime();
      await dashboardConversionPageDataSource.setVisibleFrom({
        viewerId: userId,
        visibleFrom,
      });
      setConversions((rows) =>
        rows.filter((row) => new Date(row.created_at).getTime() >= cutoffMs)
      );
      setLogs((rows) =>
        rows.filter((row) => new Date(row.created_at).getTime() >= cutoffMs)
      );
      setInboxRows((rows) =>
        rows.filter((row) => new Date(row.created_at).getTime() >= cutoffMs)
      );
      setTablePage(1);
      setLogsPage(1);
      setInboxPage(1);
      await refreshTable();
      setClearViewOpen(false);
      setClearMsg(
        mode === "keep_current_month"
          ? "Vista limpiada. Se conserva únicamente el mes actual."
          : "Vista limpiada. Las conversiones nuevas seguirán apareciendo.",
      );
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally {
      setHidingTable(false);
      setHidingFunnel(false);
      setHidingStats(false);
      setHidingLogs(false);
    }
  }, [userId, refreshTable]);

  if (loading) {
    return <DashboardSkeleton title="Cargando conversiones..." />;
  }

  const endpointBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Performance"
        title="Conversiones"
        description="Tu pipeline de contactos, leads, compras y métricas comerciales."
      />

      {saveMsg && (
        <p className={`ui-alert text-sm ${saveMsg.includes("Error") ? "border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.07)] text-[var(--color-danger)]" : "border-[rgba(52,211,153,0.22)] bg-[rgba(52,211,153,0.07)] text-[var(--color-success)]"}`} role="alert">
          {saveMsg}
        </p>
      )}
      {clearMsg && (
        <p className={`ui-alert text-sm ${clearMsg.includes("Error") ? "border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.07)] text-[var(--color-danger)]" : "border-[rgba(52,211,153,0.22)] bg-[rgba(52,211,153,0.07)] text-[var(--color-success)]"}`} role="alert">
          {clearMsg}
        </p>
      )}
      <ClearConversionsViewModal
        open={clearViewOpen}
        busy={hidingFunnel || hidingTable || hidingStats || hidingLogs}
        currentMonthLabel={new Intl.DateTimeFormat("es-AR", {
          month: "long",
          year: "numeric",
        }).format(new Date())}
        onClose={() => setClearViewOpen(false)}
        onConfirm={(mode) => void applyGlobalDisplayCleanup(mode)}
      />

      {/* Tabs */}
      <ConversionTabs
        tabs={tabOrder}
        utilityTabs={["configuracion", "inbox", "logs"]}
        labels={TAB_LABELS}
        activeTab={tab}
        onTabChange={setTab}
      />

      {/* Date filter + global actions */}
      {(tab === "funnel" || tab === "seguimiento" || tab === "tabla" || tab === "estadisticas" || tab === "inbox" || tab === "logs") && (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {(tab === "funnel" || tab === "tabla" || tab === "estadisticas" || tab === "inbox" || tab === "logs") && (
              <>
                <button
                  type="button"
                  onClick={() => void refreshTable()}
                  disabled={refreshingTable}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-60 sm:h-7"
                  title="Actualizar datos"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {refreshingTable ? "Actualizando..." : "Actualizar"}
                </button>
                <button
                  type="button"
                  onClick={clearGlobalDisplay}
                  disabled={
                    hidingFunnel ||
                    hidingTable ||
                    hidingStats ||
                    hidingLogs ||
                    refreshingTable
                  }
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/30 px-2 text-[11px] font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed sm:h-7"
                  title="Organizar el historial visible sin borrar datos"
                >
                  {(hidingFunnel || hidingTable || hidingStats || hidingLogs) ? "Ocultando..." : "Limpiar vistas"}
                </button>
              </>
            )}
            {(tab === "funnel" || tab === "tabla" || tab === "estadisticas" || tab === "inbox") && (
              <button
                type="button"
                onClick={openStatsFilterModal}
                className={`col-span-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition sm:col-span-1 sm:h-7 ${
                  hasStatsFiltersApplied
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                    : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                }`}
                title="Abrir multifiltro global"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                Aplicar filtros
                {hasStatsFiltersApplied && (
                  <>
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {statsFiltersCount}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearAllStatsFilters(); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          clearAllStatsFilters();
                        }
                      }}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-500/70 bg-red-950/70 text-[10px] font-bold leading-none text-red-200 hover:bg-red-900/80"
                      title="Quitar todos los filtros"
                      aria-label="Quitar todos los filtros"
                    >
                      ×
                    </span>
                  </>
                )}
              </button>
            )}
            {tab === "logs" && (
              <ConversionLogFilters
                direction={logDirectionFilter}
                eventType={logEventFilter}
                onApply={(direction, eventType) => {
                  setLogDirectionFilter(direction);
                  setLogEventFilter(eventType);
                  setLogsPage(1);
                }}
              />
            )}
          </div>
          <DateRangeFilter onChange={handleDateRangeChange} initialPreset="hoy" />
        </div>
      )}

      {statsFilterModalOpen && (
        <ConversionFiltersModal
          title="Filtros globales"
          draft={{
            landing: draftLandingFilter,
            pixel: draftPixelFilter,
            gerencia: draftGerenciaFilter,
            phone: draftTelefonoFilter,
            fromMetaAds: draftFromMetaAdsFilter,
            sourcePlatform: draftSourcePlatformFilter,
            sex: draftSexoFilter,
            campaigns: draftCampaignFilter,
          }}
          options={{
            landings: statsLandingOptions,
            pixels: statsPixelOptions,
            gerencias: statsGerenciaOptions,
            phones: statsTelefonoOptions,
            sourcePlatforms: statsSourcePlatformOptions,
            sexes: statsSexoOptions,
            campaigns: statsCampaignOptions,
          }}
          phoneGerenciaLabels={gerenciaByPhone}
          onChange={{
            landing: setDraftLandingFilter,
            pixel: setDraftPixelFilter,
            gerencia: setDraftGerenciaFilter,
            phone: setDraftTelefonoFilter,
            fromMetaAds: setDraftFromMetaAdsFilter,
            sourcePlatform: setDraftSourcePlatformFilter,
            sex: setDraftSexoFilter,
            campaigns: setDraftCampaignFilter,
          }}
          onClose={() => setStatsFilterModalOpen(false)}
          onApply={applyStatsFilters}
        />
      )}

      {/* TAB: CONFIGURACIN */}
      {tab === "configuracion" && (
        <ConversionConfigurationPanel
          endpointBase={endpointBase}
          clientName={clientName}
          endpointMissingMessage="Tu URL aún no fue configurada. Contactá al administrador."
          isAllCurrencies={isAllCurrencies}
          reportingCurrency={reportingCurrency}
          premiumThreshold={premiumThreshold}
          onPremiumThresholdChange={(value) =>
            setConfig((current) =>
              current
                ? setPremiumThreshold(current, reportingCurrency, value)
                : current
            )
          }
          saving={saving}
          onSave={() => void handleSave()}
        />
      )}

      {/* TAB: TABLA */}
      {tab === "tabla" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
          <div className="sticky top-0 z-30 mb-4 flex flex-col gap-2 rounded-lg py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">
              Tabla de conversiones <span className="font-normal text-zinc-500">({filteredConversions.length})</span>
              <span
                className={`ml-2 inline-flex rounded-full border px-2 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[0.12em] ${
                  tableView === "friendly"
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    : "border-zinc-700 bg-zinc-800/70 text-zinc-400"
                }`}
              >
                {tableView === "friendly" ? "Vista reducida" : "Vista técnica"}
              </span>
            </h3>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={
                  tableView === "friendly"
                    ? "Buscar por teléfono, correo, promoción o campaña..."
                    : "Buscar por phone, email, promo, utm..."
                }
                className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 sm:w-64"
              />
              <ConversionTableViewToggle
                view={tableView}
                onToggle={toggleTableView}
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-700">
            <table className="min-w-[920px] text-left text-[11px] md:min-w-full">
              <ConversionTableHeader
                columns={displayedColsWithoutTimestamp}
                view={tableView}
              />
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
                ) : pagedConversions.map((c, idx) => {
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
                    <tr
                      key={c.id}
                      className={rowColor}
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap text-zinc-500 font-mono">{c.internal_id ?? ((tablePage - 1) * tablePageSize + idx + 1)}</td>
                      {cellValue(c, "timestamp", tableView)}
                      {displayedColsWithoutTimestamp.map((col) =>
                        col === "email" ? (
                          <EditableConversionEmailCell key={col} row={c} onSaved={(id, email) => setConversions((prev) => prev.map((r) => (r.id === id ? { ...r, email } : r)))} />
                        ) : cellValue(c, col, tableView)
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ConversionPagination
            page={tablePage}
            totalPages={totalTablePages}
            totalItems={filteredConversions.length}
            pageSize={tablePageSize}
            onPageChange={setTablePage}
          />
        </section>
      )}

      {/* TAB: FUNNEL */}
      {tab === "funnel" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {isAllCurrencies ? (
            <SingleCurrencyRequired title="Elegí ARS o PYG para calcular el funnel" />
          ) : activeFunnelFiltered.length === 0 ? (
            refreshingTable ? (
              <div className="flex min-h-[120px] flex-col items-center justify-center gap-3 text-sm text-zinc-500">
                <div className="h-1 w-40 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-400" />
                </div>
                <p>Actualizando funnel...</p>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">Aún no hay contactos en el funnel.</p>
            )
          ) : (
            <FunnelBoard
              contacts={activeFunnelFiltered}
              premiumThreshold={premiumThreshold}
              currency={reportingCurrency}
              rankingConfig={getTrackingRankingConfig(config, reportingCurrency)}
              gerenciaByPhone={gerenciaByPhone}
              gerenciaLabelsByContactPhone={gerenciaLabelsByContactPhone}
              headerSlot={
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="mr-2 text-sm font-semibold text-zinc-200">Funnel</h3>
                </div>
              }
            />
          )}
        </section>
      )}

      {/* TAB: SEGUIMIENTO */}
      {tab === "seguimiento" && (
        isAllCurrencies ? (
          <SingleCurrencyRequired title="Elegí ARS o PYG para ver el seguimiento monetario" />
        ) : (
          <TrackingBoard
            conversions={activeConversions.filter((r) => !String(r.test_event_code ?? "").trim())}
            onRefresh={() => void refreshTable()}
            refreshing={refreshingTable}
            currency={reportingCurrency}
          />
        )
      )}

      {/* TAB: ESTADSTICAS */}
      {tab === "estadisticas" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">Estadísticas</h3>
          </div>
          {isAllCurrencies ? (
            <SingleCurrencyRequired title="Elegí ARS o PYG para calcular estadísticas" />
          ) : activeFunnelFiltered.length === 0 && statsConversionsFiltered.length === 0 ? (
            refreshingTable ? (
              <div className="flex min-h-[120px] flex-col items-center justify-center gap-3 text-sm text-zinc-500">
                <div className="h-1 w-40 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-400" />
                </div>
                <p>Actualizando estadísticas...</p>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">Aún no hay datos para estadísticas.</p>
            )
          ) : (
            <StatsPanel
              funnelContacts={activeFunnelFiltered}
              conversions={statsConversionsFiltered}
              allConversions={statsAllConversionsFiltered}
              premiumThreshold={premiumThreshold}
              currency={reportingCurrency}
              dateRange={dateRange}
              compactTooltips
              showAssistant={config?.show_ai_assistant === true}
            />
          )}
        </section>
      )}

      {/* TAB: DESEMPENO */}
      {tab === "desempeno" && (
        isAllCurrencies ? (
          <SingleCurrencyRequired title="Elegí ARS o PYG para comparar desempeño" />
        ) : (
          <GerenciasPerformancePanel
            fetchConversionsForMonth={fetchPerformanceConversions}
            fetchAvailabilityForMonth={fetchPerformanceAvailability}
            gerenciaByPhone={gerenciaByPhone}
            activePhonesByGerenciaLabel={activePhonesByGerenciaLabel}
            landingOptions={performanceLandingOptions}
            premiumThreshold={premiumThreshold}
            storageKey={`dashboard:${userId ?? "client"}`}
            currency={reportingCurrency}
          />
        )
      )}

      {/* TAB: INBOX */}
      {tab === "inbox" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Inbox de eventos (CONTACT/LEAD/COMPLETEREGISTRATION/PURCHASE){" "}
              <span className="font-normal text-zinc-500">
                ({filteredInbox.length}{inboxHasNextPage ? "+" : ""})
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={inboxActionFilter}
                onChange={(e) => setInboxActionFilter(e.target.value as "all" | "CONTACT" | "LEAD" | "COMPLETEREGISTRATION" | "PURCHASE")}
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
                title="Filtrar por tipo de evento"
              >
                <option value="all">Todos</option>
                <option value="CONTACT">Contact</option>
                <option value="LEAD">Lead</option>
                <option value="COMPLETEREGISTRATION">CompleteRegistration</option>
                <option value="PURCHASE">Purchase</option>
              </select>
              <input
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                placeholder="Buscar por phone, promo, coelsa, transaction, status..."
                className="h-8 w-72 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>
          {filteredInbox.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay eventos en inbox para el filtro actual.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-zinc-700">
                <table className="min-w-[980px] text-left text-[11px] md:min-w-full">
                  <thead className="bg-zinc-800/80">
                    <tr>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Fila</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Fecha</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Action</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Status</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Phone</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Promo code</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Coelsa ID</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Transaction ID</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">HTTP</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Respuesta</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredInbox.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        (() => {
                          const action = String(row.action ?? "").toUpperCase();
                          const isContact = action === "CONTACT";
                          const isLead = action === "LEAD";
                          const isPurchase = action === "PURCHASE";
                          const isProcessed = String(row.status ?? "").toLowerCase() === "processed";
                          const isDeduplicated = String(row.status ?? "").toLowerCase() === "deduplicated";
                          const resp = String(row.response_body ?? "").toLowerCase();
                          const httpStatus = Number(row.http_status ?? 0);
                          const httpOk = !Number.isFinite(httpStatus) || httpStatus === 0 || (httpStatus >= 200 && httpStatus < 300);
                          const promo = String(row.promo_code ?? "").trim();
                          const hasValidPromo = /^[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(promo);
                          if (isDeduplicated) return "bg-sky-950/25";
                          if (isContact && isProcessed && httpOk) {
                            const contactSuccess =
                              resp === "success" ||
                              (resp.includes("success") && !resp.includes("error")) ||
                              (resp.includes("contact") && resp.includes("procesad") && !resp.includes("error"));
                            if (contactSuccess) return "bg-emerald-950/30";
                            return "bg-zinc-950/40";
                          }
                          if (isPurchase && isProcessed) {
                            const purchaseSuccess =
                              (resp.includes("match_mode:") && !resp.includes("error al enviar")) ||
                              (resp.includes("compra enviada") || resp.includes("recompra enviada")) ||
                              (resp.includes("purchase procesada") && !resp.includes("no procesado") && !resp.includes("error al enviar"));
                            if (httpOk && purchaseSuccess) return "bg-emerald-950/30";
                            return "bg-zinc-950/40";
                          }
                          if (!isLead || !isProcessed) return "bg-zinc-950/40";
                          if (resp.includes("match_mode:promo_code")) return "bg-emerald-950/30";
                          if (resp.includes("match_mode:bot_phone+datetime")) {
                            return "bg-cyan-950/30 [background-image:repeating-linear-gradient(135deg,rgba(6,182,212,0.14)_0,rgba(6,182,212,0.14)_6px,transparent_6px,transparent_12px)]";
                          }
                          if (hasValidPromo && !resp.includes("match_mode:created_new") && !resp.includes("sin match por promo_code")) {
                            return "bg-emerald-950/30";
                          }
                          return "bg-zinc-950/40";
                        })()
                      }
                    >
                      <td className="px-2 py-1.5 text-zinc-300 whitespace-nowrap">
                        {row.conversion_internal_id ?? (row.conversion_id ? (internalIdByConversionId.get(row.conversion_id) ?? "-") : "-")}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString("es-AR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-200 whitespace-nowrap">{row.action || "-"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          row.status === "processed"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : row.status === "deduplicated"
                              ? "bg-sky-500/15 text-sky-300"
                            : row.status === "error"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-amber-500/15 text-amber-300"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-zinc-300 font-mono whitespace-nowrap">{row.phone || "-"}</td>
                      <td className="px-2 py-1.5 text-zinc-300 whitespace-nowrap">{row.promo_code || "-"}</td>
                      <td className="px-2 py-1.5 text-zinc-300 font-mono whitespace-nowrap">{row.coelsa_id || "-"}</td>
                      <td className="px-2 py-1.5 text-zinc-300 font-mono whitespace-nowrap">{row.transaction_id || "-"}</td>
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">{row.http_status ?? "-"}</td>
                      <td className="px-2 py-1.5 text-zinc-500 max-w-[280px] truncate" title={row.response_body || "-"}>
                        {truncateText(row.response_body || "-", 80)}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500 max-w-[320px] truncate" title={row.payload_raw || "-"}>
                        {truncateText(row.payload_raw || "-", 90)}
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(inboxPage > 1 || inboxHasNextPage) && (
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    Página {inboxPage} · mostrando {filteredInbox.length} registros{inboxHasNextPage ? "+" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={inboxPage <= 1 || refreshingTable}
                      onClick={() => setInboxPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>Pag {inboxPage}</span>
                    <button
                      type="button"
                      disabled={!inboxHasNextPage || refreshingTable}
                      onClick={() => setInboxPage((p) => p + 1)}
                      className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* TAB: LOGS */}
      {tab === "logs" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Logs de conversiones{" "}
              <span className="font-normal text-zinc-500">
                ({activeLogs.length}{logsHasNextPage ? "+" : ""})
              </span>
            </h3>
          </div>
          {activeLogs.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {logDirectionFilter !== "all" || logEventFilter !== "all"
                ? "No hay logs que coincidan con los filtros aplicados."
                : "Aun no hay logs registrados."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-zinc-700">
                <table className="min-w-[980px] text-left text-[11px] md:min-w-full">
                  <thead className="bg-zinc-800/80">
                    <tr>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">ID</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Fecha</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Nivel</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Mensaje</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Funcion</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Payload Recibido</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Resultado</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Payload Meta</th>
                      <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Respuesta de Meta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {activeLogs.map((log, idx) => (
                    <tr
                      key={log.id}
                      className={(() => {
                        const meta = logGroupMetaByIndex[idx] ?? { base: "bg-zinc-950/40", isStart: false, isEnd: false };
                        const blockBorders = `${meta.isStart ? " border-t-4 border-t-black/90" : ""}${meta.isEnd ? " border-b-4 border-b-black/90" : ""}`;
                        return `${meta.base}${blockBorders}`;
                      })()}
                    >
                      <td className="px-2 py-1.5 text-zinc-500 font-mono whitespace-nowrap">
                        {log.conversion_internal_id ?? (log.conversion_id ? (internalIdByConversionId.get(log.conversion_id) ?? "-") : "-")}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-AR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                      </td>
                      <td className="px-2 py-1.5">{levelBadge(log.level, log.function_name, log.message)}</td>
                      <td className={`px-2 py-1.5 ${
                        (() => {
                          return isSuccessfulMetaResponse(log)
                            ? "text-emerald-300 font-semibold"
                            : "text-zinc-200";
                        })()
                      }`}>{log.message}</td>
                      <td className="px-2 py-1.5 text-zinc-300 font-mono whitespace-nowrap">{log.function_name}</td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {(log.payload_received && log.payload_received.trim()) ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && log.payload_received && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => { try { return JSON.stringify(JSON.parse(log.payload_received), null, 2); } catch { return log.payload_received; } })()}
                          </pre>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {((log.result && log.result.trim()) || (log.detail && log.detail.trim())) ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && ((log.result && log.result.trim()) || (log.detail && log.detail.trim())) && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => {
                              const raw = (log.result && log.result.trim()) ? log.result : (log.detail ?? "");
                              try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
                            })()}
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
              {(logsPage > 1 || logsHasNextPage) && (
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    Página {logsPage} · mostrando {activeLogs.length} registros{logsHasNextPage ? "+" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={logsPage <= 1 || refreshingTable}
                      onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>Pag {logsPage}</span>
                    <button
                      type="button"
                      disabled={!logsHasNextPage || refreshingTable}
                      onClick={() => setLogsPage((p) => p + 1)}
                      className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
