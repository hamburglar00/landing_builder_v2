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
  hideConversions,
  hideContacts,
  hideConversionLogs,
  type FetchDateRange,
  type ConversionsConfig,
  type PixelConfig,
  type ConversionRow,
  type ConversionLogRow,
} from "@/lib/conversionsDb";
import { adminConversionPageDataSource } from "@/lib/conversionPageDataSource";
import { saveConversionPageConfig } from "@/lib/conversionPageConfig";
import { generateDemoConversions } from "@/lib/demoData";
import { DashboardSkeleton, PanelSkeleton } from "@/components/ui/DashboardSkeleton";
import { PageHeader } from "@/components/ui/PanelPrimitives";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import type { LandingPerformanceFilterOption } from "@/components/conversiones/GerenciasPerformancePanel";
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
const GerenciasPerformancePanel = dynamic(
  () => import("@/components/conversiones/GerenciasPerformancePanel"),
  { loading: () => <PanelSkeleton title="Cargando desempeño..." /> },
);

type Tab = "configuracion" | "tabla" | "funnel" | "seguimiento" | "estadisticas" | "desempeno" | "logs";

const TAB_ORDER: Tab[] = ["funnel", "tabla", "estadisticas", "desempeno", "configuracion", "logs"];

const TAB_LABELS: Record<Tab, string> = {
  funnel: "Funnel",
  seguimiento: "Seguimiento",
  tabla: "Tabla",
  estadisticas: "Estadísticas",
  desempeno: "Desempeño",
  configuracion: "Configuracion",
  logs: "Logs",
};

const CLEAR_VIEW_CONFIRM_MESSAGE =
  "Vas a limpiar la vista de Conversiones.\n\nSe ocultaran los registros que ves ahora en esta seccion.\n\nEsta accion NO borra datos de la base.\nSolo deja de mostrarlos en la vista.\n\nQueres continuar?";
const TABLE_VIEW_STORAGE_KEY = "conversion-table-view:admin";

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
    case "contact_payload_raw": return <td key={col} className={`${dim} max-w-[220px] truncate`} title={tipRawJson(c.contact_payload_raw)}>{truncateText(c.contact_payload_raw || "-", 35)}</td>;
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


export default function AdminConversionesPage() {
  const confirmAction = useAppConfirm();
  const searchParams = useSearchParams();
  const { currencyScope, isAllCurrencies } = useCurrencyScope();
  const reportingCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [logs, setLogs] = useState<ConversionLogRow[]>([]);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("funnel");
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [tableView, setTableView] =
    useState<ConversionTableView>("technical");
  const [tablePage, setTablePage] = useState(1);
  const [logDirectionFilter, setLogDirectionFilter] =
    useState<ConversionLogDirectionFilter>("all");
  const [logEventFilter, setLogEventFilter] =
    useState<ConversionLogEventFilter>("all");
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
  const [activePhonesByGerenciaLabel, setActivePhonesByGerenciaLabel] = useState<Record<string, string[]>>({});
  const [performanceLandingOptions, setPerformanceLandingOptions] = useState<LandingPerformanceFilterOption[]>([]);

  const [demoMode, setDemoMode] = useState(false);
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
  const logDirectionFilterRef = useRef(logDirectionFilter);
  const logEventFilterRef = useRef(logEventFilter);

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
    logDirectionFilterRef.current = logDirectionFilter;
  }, [logDirectionFilter]);

  useEffect(() => {
    logEventFilterRef.current = logEventFilter;
  }, [logEventFilter]);

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

  const demoConversions = useMemo(() => generateDemoConversions(80), []);
  const rawConversions = demoMode ? demoConversions : conversions;
  const scopedConversions = useMemo(
    () => filterConversionsByCurrency(rawConversions, currencyScope),
    [rawConversions, currencyScope],
  );
  const scopedFunnel = useMemo(
    () => buildFunnelContactsFromConversions(scopedConversions),
    [scopedConversions],
  );
  const activeConversions = useMemo(() => filterByDateRange(scopedConversions, dateRange), [scopedConversions, dateRange]);
  const activeFunnel = useMemo(() => filterFunnelByDateRange(scopedFunnel, dateRange), [scopedFunnel, dateRange]);
  const premiumThreshold = getPremiumThreshold(config, reportingCurrency);
  const statsConversions = useMemo(
    () => activeConversions.filter((r) => !String(r.test_event_code ?? "").trim()),
    [activeConversions],
  );
  const statsAllConversions = useMemo(
    () => rawConversions.filter((r) => !String(r.test_event_code ?? "").trim()),
    [rawConversions],
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
  const statsGerenciaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const labels = getConversionGerenciaLabels(r, gerenciaByPhone);
      for (const label of labels) set.add(label);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions, gerenciaByPhone]);
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
    if (statsGerenciaFilter !== "__all__" && !statsGerenciaOptions.includes(statsGerenciaFilter)) {
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
      const byGerencia = statsGerenciaFilter === "__all__" || labels.includes(statsGerenciaFilter);
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
        (labels) => labels.includes(statsGerenciaFilter),
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
      const byGerencia = statsGerenciaFilter === "__all__" || labels.includes(statsGerenciaFilter);
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
        (labels) => labels.includes(statsGerenciaFilter),
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
  const tableConversionsFiltered = useMemo(() => {
    return activeConversions.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPixel = statsPixelFilter === "__all__" || String(r.meta_pixel_id ?? r.pixel_id ?? "").trim() === statsPixelFilter;
      const assignedPhone = normalizePhone(r.telefono_asignado);
      const byTelefono = statsTelefonoFilter === "__all__" || assignedPhone === statsTelefonoFilter;
      const labels = getConversionGerenciaLabels(r, gerenciaByPhone);
      const byGerencia = statsGerenciaFilter === "__all__" || labels.includes(statsGerenciaFilter);
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
  const tablePageSize = 50;
  const totalTablePages = Math.max(1, Math.ceil(filteredConversions.length / tablePageSize));
  const pagedConversions = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredConversions.slice(start, start + tablePageSize);
  }, [filteredConversions, tablePage]);
  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, dateRange, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter, demoMode, currencyScope]);
  useEffect(() => {
    if (tablePage > totalTablePages) setTablePage(totalTablePages);
  }, [tablePage, totalTablePages]);
  const internalIdByConversionId = useMemo(
    () => new Map(conversions.map((c) => [c.id, c.internal_id])),
    [conversions],
  );
  const logGroupMetaByIndex = useMemo(() => {
    const keys = logs.map((log) =>
      log.conversion_id
        ? String(internalIdByConversionId.get(log.conversion_id) ?? "-")
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
  const [pixelConfigs, setPixelConfigs] = useState<PixelConfig[]>([]);

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
          adminConversionPageDataSource.fetchVisibleConversions({
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
          .select("id,nombre,gerencia_id");
        const gerenciasList = gerencias ?? [];
        const gerenciasById = new Map<number, string>();
        for (const g of gerenciasList) {
          const id = Number(g.id);
          if (!Number.isFinite(id)) continue;
          const extId = Number(g.gerencia_id);
          gerenciasById.set(id, `${String(g.nombre ?? "").trim()} (ID ${Number.isFinite(extId) ? extId : id})`);
        }
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
              userId: String(landing.user_id ?? ""),
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
    const loadDeferredLogs = async () => {
      if (!userId || tab !== "logs") return;
      const requestSeq = ++dataRequestSeqRef.current;
      setRefreshingTable(true);
      try {
        const logRows = await adminConversionPageDataSource.fetchVisibleLogs({
          viewerId: userId,
          limit: 200,
          direction: logDirectionFilter,
          eventType: logEventFilter,
        });
        if (requestSeq !== dataRequestSeqRef.current) return;
        setLogs(logRows);
      } catch (e) {
        console.error(e);
      } finally {
        if (requestSeq === dataRequestSeqRef.current) {
          setRefreshingTable(false);
        }
      }
    };
    void loadDeferredLogs();
  }, [tab, userId, logDirectionFilter, logEventFilter]);

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
      // Mostrar ms contexto del error para poder diagnosticar problemas de RLS o esquema en produccin
      // y loguearlo en consola del navegador.

      console.error("Error al guardar configuracin de conversiones:", e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);
      setSaveMsg(msg || "Error al guardar");
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
        const logRows = await adminConversionPageDataSource.fetchVisibleLogs({
          viewerId: currentUserId,
          limit: 200,
          direction: logDirectionFilterRef.current,
          eventType: logEventFilterRef.current,
        });
        if (requestSeq !== dataRequestSeqRef.current) return;
        setLogs(logRows);
      } else {
        const rows = await adminConversionPageDataSource.fetchVisibleConversions({
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
    const rows = await adminConversionPageDataSource.fetchReportingConversions({
      viewerId: userIdRef.current ?? "",
      range,
    });
    return filterConversionsByCurrency(rows, currencyScope);
  }, [currencyScope]);

  const fetchPerformanceAvailability = useCallback(async (range: FetchDateRange) => {
    return adminConversionPageDataSource.fetchAvailability({
      viewerId: userIdRef.current ?? "",
      range,
    });
  }, []);

  const clearTableDisplay = useCallback(async () => {
    if (!userId || activeConversions.length === 0 || demoMode) return;
    const ok = await confirmAction({
      title: "Limpiar vista",
      description: CLEAR_VIEW_CONFIRM_MESSAGE,
      confirmLabel: "Limpiar vista",
      danger: true,
    });
    if (!ok) return;
    setHidingTable(true);
    setClearMsg(null);
    try {
      await hideConversions(activeConversions.map((c) => c.id), userId);
      await refreshTable();
      setClearMsg("Vista limpiada. Los registros siguen en la base de datos.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally { setHidingTable(false); }
  }, [userId, activeConversions, refreshTable, demoMode, confirmAction]);

  const clearFunnelDisplay = useCallback(async () => {
    if (!userId || activeFunnel.length === 0 || demoMode) return;
    const ok = await confirmAction({
      title: "Limpiar vista",
      description: CLEAR_VIEW_CONFIRM_MESSAGE,
      confirmLabel: "Limpiar vista",
      danger: true,
    });
    if (!ok) return;
    setHidingFunnel(true);
    setClearMsg(null);
    try {
      await hideContacts(
        activeFunnel.map((c) => ({ user_id: c.user_id, phone: c.phone })),
        userId,
      );
      await refreshTable();
      setClearMsg("Vista limpiada. Los registros siguen en la base de datos.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally { setHidingFunnel(false); }
  }, [userId, activeFunnel, refreshTable, demoMode, confirmAction]);

  const clearStatsDisplay = useCallback(async () => {
    if (!userId || (activeFunnel.length === 0 && activeConversions.length === 0) || demoMode) return;
    const ok = await confirmAction({
      title: "Limpiar vista",
      description: CLEAR_VIEW_CONFIRM_MESSAGE,
      confirmLabel: "Limpiar vista",
      danger: true,
    });
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
      setClearMsg("Vista limpiada. Los registros siguen en la base de datos.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally { setHidingStats(false); }
  }, [userId, activeFunnel, activeConversions, refreshTable, demoMode, confirmAction]);

  const clearLogsDisplay = useCallback(async () => {
    if (!userId || logs.length === 0 || demoMode) return;
    const ok = await confirmAction({
      title: "Limpiar vista",
      description: CLEAR_VIEW_CONFIRM_MESSAGE,
      confirmLabel: "Limpiar vista",
      danger: true,
    });
    if (!ok) return;
    setHidingLogs(true);
    setClearMsg(null);
    try {
      await hideConversionLogs(logs.map((l) => Number(l.id)), userId);
      await refreshTable();
      setClearMsg("Vista limpiada.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally { setHidingLogs(false); }
  }, [userId, logs, demoMode, refreshTable, confirmAction]);

  if (loading) {
    return <DashboardSkeleton title="Cargando conversiones..." />;
  }

  const endpointBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Performance global"
        title="Conversiones"
        description="Pipeline consolidado de contactos, leads, compras y métricas comerciales."
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

      {/* Tabs + Demo toggle */}
      <ConversionTabs
        tabs={TAB_ORDER}
        utilityTabs={["configuracion", "logs"]}
        labels={TAB_LABELS}
        activeTab={tab}
        onTabChange={setTab}
        trailing={(
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
        )}
      />

      {/* Date filter + global actions (funnel, tabla, estadisticas) */}
      {(tab === "funnel" || tab === "seguimiento" || tab === "tabla" || tab === "estadisticas") && (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {(tab === "funnel" || tab === "tabla" || tab === "estadisticas") && (
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
                  onClick={
                    tab === "funnel"
                      ? clearFunnelDisplay
                      : tab === "tabla"
                        ? clearTableDisplay
                        : clearStatsDisplay
                  }
                  disabled={
                    tab === "funnel"
                      ? (hidingFunnel || refreshingTable || activeFunnel.length === 0 || demoMode)
                      : tab === "tabla"
                        ? (hidingTable || refreshingTable || filteredConversions.length === 0 || demoMode)
                        : (hidingStats || refreshingTable || (activeFunnelFiltered.length === 0 && statsConversionsFiltered.length === 0) || demoMode)
                  }
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/30 px-2 text-[11px] font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed sm:h-7"
                  title="Ocultar registros de la vista (persistente, no borra de la base)"
                >
                  {tab === "funnel" ? (hidingFunnel ? "Ocultando..." : "Limpiar vista")
                    : tab === "tabla" ? (hidingTable ? "Ocultando..." : "Limpiar vista")
                      : (hidingStats ? "Ocultando..." : "Limpiar vista")}
                </button>
              </>
            )}
            {(tab === "funnel" || tab === "tabla" || tab === "estadisticas") && (
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
          </div>
          <DateRangeFilter onChange={handleDateRangeChange} initialPreset="hoy" />
        </div>
      )}
      {statsFilterModalOpen && (
        <ConversionFiltersModal
          title="Filtros de estadisticas"
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
            gerencias: statsGerenciaOptions.map((value) => ({ value, label: value })),
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
      {demoMode && (
        <p className="rounded-lg bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 text-[11px] text-amber-300">
          Visualizando datos de demostracin. Desactiv el toggle para ver datos reales.
        </p>
      )}

      {/* TAB: CONFIGURACIN */}
      {tab === "configuracion" && (
        <ConversionConfigurationPanel
          endpointBase={endpointBase}
          clientName={clientName}
          endpointMissingMessage="El cliente no tiene nombre configurado en su perfil."
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
          showLogs={config?.show_logs !== false}
          onToggleShowLogs={() =>
            setConfig((current) =>
              current
                ? { ...current, show_logs: !(current.show_logs !== false) }
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
              Tabla de conversiones{" "}
              <span className="font-normal text-zinc-500">({filteredConversions.length})</span>
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
          {(() => {
            const cols = columnsForTableView(ALL_COLUMNS, tableView);
            const displayRows = pagedConversions;
            const displayedColsWithoutTimestamp = cols.filter((c) => c !== "timestamp");
            return (
              <>
                <div className="overflow-x-auto rounded-lg border border-zinc-700">
                  <table className="min-w-[920px] text-left text-[11px] md:min-w-full">
                    <ConversionTableHeader
                      columns={displayedColsWithoutTimestamp}
                      view={tableView}
                    />
                    <tbody className="divide-y divide-zinc-800">
                      {displayRows.length === 0 ? (
                        <tr>
                          <td colSpan={(displayedColsWithoutTimestamp.length || 1) + 2} className="px-2 py-6 text-center text-zinc-500">
                            Aun no hay conversiones registradas.
                          </td>
                        </tr>
                      ) : displayRows.map((c, idx) => {
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
              </>
            );
          })()}
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
            storageKey="admin"
            currency={reportingCurrency}
          />
        )
      )}

      {/* TAB: LOGS */}
      {tab === "logs" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Logs de conversiones{" "}
              <span className="font-normal text-zinc-500">({logs.length})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <ConversionLogFilters
                direction={logDirectionFilter}
                eventType={logEventFilter}
                onApply={(direction, eventType) => {
                  setLogDirectionFilter(direction);
                  setLogEventFilter(eventType);
                }}
              />
              <button
                type="button"
                onClick={clearLogsDisplay}
                disabled={hidingLogs || logs.length === 0 || demoMode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/30 px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ocultar logs de la vista (no borra de la base)"
              >
                {hidingLogs ? "Ocultando..." : "Limpiar vista"}
              </button>
            </div>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {logDirectionFilter !== "all" || logEventFilter !== "all"
                ? "No hay logs que coincidan con los filtros aplicados."
                : "Aun no hay logs registrados."}
            </p>
          ) : (
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
                  {logs.map((log, idx) => (
                    <tr
                      key={log.id}
                      className={(() => {
                        const meta = logGroupMetaByIndex[idx] ?? { base: "bg-zinc-950/40", isStart: false, isEnd: false };
                        const blockBorders = `${meta.isStart ? " border-t-4 border-t-black/90" : ""}${meta.isEnd ? " border-b-4 border-b-black/90" : ""}`;
                        return `${meta.base}${blockBorders}`;
                      })()}
                    >
                      <td className="px-2 py-1.5 text-zinc-500 font-mono whitespace-nowrap">
                        {log.conversion_id ? (internalIdByConversionId.get(log.conversion_id) ?? "-") : "-"}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-AR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
          )}
        </section>
      )}
    </div>
  );
}
