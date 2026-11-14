"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ConversionJourneyStartRow,
  type FunnelContact,
  type ConversionRow,
} from "@/lib/conversionsDb";
import { adJourneyKey, computeCoreStats, computeJourneyStartStats, computeStatsTruthMetrics } from "@/lib/conversionStats";
import { buildFunnelContactsFromConversions } from "@/lib/conversionsDb";
import { computeChannelFunnel, computeStatisticsPurchasePlayers, countStatisticsVisitConversions, scopeStatisticsChannel, scopeStatisticsStages, stageDate, statisticsTemporalRows, statisticsRate, statisticsPlayerKey, type StatisticsChannel } from "@/lib/conversionJourneyStats";
import { formatCompactCurrency, formatCurrencyAmount, type ReportingCurrency } from "@/lib/currency";
import ArgentinaMap from "./ArgentinaMap";
import { supabase } from "@/lib/supabaseClient";
import CustomSelect from "@/components/ui/CustomSelect";
import {
  ComposedChart, Area, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.39-1.585l-.386-.234-2.647.887.887-2.647-.234-.386A9.94 9.94 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
  );
}

function TrendArrow({ trend, className = "w-3 h-3" }: { trend: "up" | "down"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {trend === "up" ? (
        <path d="M4 20L10 14H14L20 8" />
      ) : (
        <path d="M4 4L10 10H14L20 16" />
      )}
    </svg>
  );
}

function RevenueTrendBadge({
  trend,
  pctChange,
  revenueToday,
  revenueYesterday,
  currency,
}: {
  trend: "up" | "down";
  pctChange: number;
  revenueToday: number;
  revenueYesterday: number;
  currency: ReportingCurrency;
}) {
  const isUp = trend === "up";
  const color = isUp ? "text-emerald-400" : "text-red-400";
  const pctStr =
    pctChange === Infinity
      ? isUp ? "+" : ""
      : isUp
        ? `+${pctChange.toFixed(1)}%`
        : `-${Math.abs(pctChange).toFixed(1)}%`;
  const tooltip =
    pctChange === Infinity
      ? `Ayer no hubo ingresos. Hoy: ${formatCurrencyAmount(revenueToday, currency)}.`
      : isUp
        ? `Ingresos de hoy (${formatCurrencyAmount(revenueToday, currency)}) son ${pctStr} mayores que ayer (${formatCurrencyAmount(revenueYesterday, currency)}).`
        : `Ingresos de hoy (${formatCurrencyAmount(revenueToday, currency)}) son ${pctStr} menores que ayer (${formatCurrencyAmount(revenueYesterday, currency)}).`;

  return (
    <span
      className={`inline-flex items-center ml-1 font-semibold self-start -mt-1 ${color}`}
      style={{ fontSize: "0.6em" }}
      title={tooltip}
    >
      <TrendArrow trend={trend} className="w-3 h-3 shrink-0" />
      <span className="ml-0.5">{pctStr}</span>
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tooltip,
  color = "text-zinc-100",
  trendInfo,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tooltip?: string;
  color?: string;
  trendInfo?: { trend: "up" | "down"; pctChange: number; revenueToday: number; revenueYesterday: number; currency: ReportingCurrency };
}) {
  return (
    <div data-stat-label={label} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 group relative">
      <p className="break-words text-[11px] font-semibold text-zinc-400 mb-1 min-h-[2.5rem] leading-snug">{label}</p>
      <p className={`break-words ${value === "Sin medición" ? "text-[10px]" : "text-xl"} font-bold ${color} flex min-h-[2rem] items-baseline flex-wrap [overflow-wrap:anywhere]`}>
        {value}
        {trendInfo && (
          <RevenueTrendBadge
            trend={trendInfo.trend}
            pctChange={trendInfo.pctChange}
            revenueToday={trendInfo.revenueToday}
            revenueYesterday={trendInfo.revenueYesterday}
            currency={trendInfo.currency}
          />
        )}
      </p>
      {sub && <p className="break-words text-[10px] font-semibold text-zinc-400 mt-1">{sub}</p>}
      {tooltip && (
        <div className="pointer-events-none absolute left-0 bottom-full mb-2 w-full break-words rounded-lg border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 [transition-delay:0ms] group-hover:[transition-delay:1000ms] z-50">
          <p className="text-[10px] text-zinc-400 leading-relaxed">{tooltip}</p>
        </div>
      )}
    </div>
  );
}

type JourneyPathStep = {
  label: string;
  value: number | string;
  color: string;
};

function JourneyPathCard({
  steps,
  rates,
}: {
  steps: JourneyPathStep[];
  rates: string[];
}) {
  return (
    <div data-testid="statistics-journey" className="mt-3 min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:items-start">
        {steps.map((step, index) => (
          <div key={`${step.label}-${index}`} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1 text-center">
              <p className="mx-auto min-h-[2rem] break-words text-[11px] font-semibold leading-snug text-zinc-400">
                {step.label}
              </p>
              <p className={`mt-1 break-words ${step.value === "Sin medición" ? "text-[9px]" : "text-lg"} font-bold tabular-nums ${step.color}`}>
                {step.value}
              </p>
            </div>
            {index < rates.length && (
              <div className="w-12 shrink-0">
                <p className="mb-1 text-center text-[11px] font-bold tabular-nums text-zinc-200">
                  {rates[index]}
                </p>
                <div className="flex items-center">
                  <div className="h-px flex-1 bg-zinc-700" />
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4 shrink-0 text-zinc-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 3l5 5-5 5" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
      {children}
    </h3>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h4 className="text-xs font-semibold text-zinc-200 mb-3">{title}</h4>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

type AssistantMsg = {
  role: "user" | "assistant";
  text: string;
};

type AssistantQuota = {
  used: number;
  remaining: number;
  limit: number;
};

type LoadMetric = "first" | "repeat" | "total";
type TableSortKey = "name" | "mensajes" | "cargas" | "pct" | "revenue" | "roas1" | "roasTotal";
type SortDirection = "asc" | "desc";
type TopContactsLimit = 10 | 25 | 50 | 100;

type LeadFrequencyBucket = {
  bucket: number;
  label: string;
  phones: number;
  leads: number;
  repeatLeads: number;
};

type LeadLandingTagSummary = {
  landingTag: string;
  totalLeads: number;
  uniquePhones: number;
  firstLeads: number;
  repeatLeads: number;
  repeatPct: number;
  golondrinaPhones: number;
  golondrinaPct: number;
};

type LeadRepeatStats = {
  totalLeads: number;
  uniquePhones: number;
  firstLeads: number;
  repeatLeads: number;
  repeatPct: number;
  golondrinaPhones: number;
  golondrinaPct: number;
  buckets: LeadFrequencyBucket[];
  byLandingTag: LeadLandingTagSummary[];
};

const LOAD_METRIC_LABELS: Record<LoadMetric, string> = {
  first: "Primeras cargas",
  repeat: "Recargas",
  total: "Cargas totales",
};

const TOP_CONTACT_LIMIT_OPTIONS: TopContactsLimit[] = [10, 25, 50, 100];
const LEAD_FREQUENCY_BUCKET_CAP = 6;



function normalizeLeadPhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function leadTimestamp(row: ConversionRow): number {
  const eventTime = Number(row.lead_event_time ?? 0);
  if (Number.isFinite(eventTime) && eventTime > 0) return eventTime * 1000;
  const created = new Date(row.created_at ?? "").getTime();
  return Number.isFinite(created) ? created : 0;
}

function promoCodePrefix(value: unknown): string {
  const promo = String(value ?? "").trim();
  const match = promo.match(/^([A-Za-z0-9]+)-[A-Za-z0-9]+$/);
  return match?.[1] ?? "";
}

function landingTagForLead(row: ConversionRow): string {
  return (
    promoCodePrefix(row.promo_code) ||
    promoCodePrefix(row.lead_incoming_promo_code) ||
    "Sin tag"
  );
}

function bucketLabel(bucket: number): string {
  return bucket >= LEAD_FREQUENCY_BUCKET_CAP
    ? `${LEAD_FREQUENCY_BUCKET_CAP}+ veces`
    : `${bucket} ${bucket === 1 ? "vez" : "veces"}`;
}

function summarizeLeadGroups(
  groups: Map<string, Array<{ tag: string; ts: number }>>,
) {
  let totalLeads = 0;
  let repeatLeads = 0;
  let golondrinaPhones = 0;
  const bucketCounts = new Map<number, LeadFrequencyBucket>();

  for (const leads of groups.values()) {
    const leadCount = leads.length;
    if (leadCount <= 0) continue;
    totalLeads += leadCount;
    repeatLeads += Math.max(0, leadCount - 1);
    if (leadCount > 1) golondrinaPhones += 1;

    const bucket = Math.min(leadCount, LEAD_FREQUENCY_BUCKET_CAP);
    const entry = bucketCounts.get(bucket) ?? {
      bucket,
      label: bucketLabel(bucket),
      phones: 0,
      leads: 0,
      repeatLeads: 0,
    };
    entry.phones += 1;
    entry.leads += leadCount;
    entry.repeatLeads += Math.max(0, leadCount - 1);
    bucketCounts.set(bucket, entry);
  }

  const uniquePhones = groups.size;
  const firstLeads = uniquePhones;
  return {
    totalLeads,
    uniquePhones,
    firstLeads,
    repeatLeads,
    repeatPct: totalLeads > 0 ? (repeatLeads / totalLeads) * 100 : 0,
    golondrinaPhones,
    golondrinaPct: uniquePhones > 0 ? (golondrinaPhones / uniquePhones) * 100 : 0,
    buckets: Array.from(bucketCounts.values()).sort((a, b) => a.bucket - b.bucket),
  };
}

export function computeLeadRepeatStats(rows: ConversionRow[]): LeadRepeatStats {
  const byPhone = new Map<string, Array<{ tag: string; ts: number }>>();
  const byTagPhone = new Map<string, Array<{ tag: string; ts: number }>>();
  const contactJourneyKeys = new Set<string>();
  const leadJourneys = new Map<string, { phoneKey: string; tagPhoneKey: string; lead: { tag: string; ts: number } }>();

  for (const row of rows) {
    if (!String(row.contact_event_id ?? "").trim()) continue;
    contactJourneyKeys.add(adJourneyKey(row, "contact"));
  }

  for (const row of rows) {
    if (!String(row.lead_event_id ?? "").trim()) continue;
    const journeyKey = adJourneyKey(row, "lead");
    if (!contactJourneyKeys.has(journeyKey)) continue;
    const phone = normalizeLeadPhone(row.phone);
    if (!phone) continue;
    const tag = landingTagForLead(row);
    const lead = { tag, ts: leadTimestamp(row) };
    const phoneKey = `${row.user_id}::${phone}`;
    const tagPhoneKey = `${tag}::${row.user_id}::${phone}`;
    const existing = leadJourneys.get(journeyKey);
    if (!existing || lead.ts < existing.lead.ts) {
      leadJourneys.set(journeyKey, { phoneKey, tagPhoneKey, lead });
    }
  }

  for (const { phoneKey, tagPhoneKey, lead } of leadJourneys.values()) {
    byPhone.set(phoneKey, [...(byPhone.get(phoneKey) ?? []), lead]);
    byTagPhone.set(tagPhoneKey, [...(byTagPhone.get(tagPhoneKey) ?? []), lead]);
  }

  for (const leads of byPhone.values()) {
    leads.sort((a, b) => a.ts - b.ts);
  }
  for (const leads of byTagPhone.values()) {
    leads.sort((a, b) => a.ts - b.ts);
  }

  const globalSummary = summarizeLeadGroups(byPhone);
  const tagGroups = new Map<string, Map<string, Array<{ tag: string; ts: number }>>>();
  for (const [tagPhoneKey, leads] of byTagPhone.entries()) {
    const tag = leads[0]?.tag || tagPhoneKey.split("::")[0] || "Sin tag";
    const tagMap = tagGroups.get(tag) ?? new Map<string, Array<{ tag: string; ts: number }>>();
    tagMap.set(tagPhoneKey, leads);
    tagGroups.set(tag, tagMap);
  }

  const byLandingTag = Array.from(tagGroups.entries())
    .map(([landingTag, groups]) => {
      const summary = summarizeLeadGroups(groups);
      return {
        landingTag,
        totalLeads: summary.totalLeads,
        uniquePhones: summary.uniquePhones,
        firstLeads: summary.firstLeads,
        repeatLeads: summary.repeatLeads,
        repeatPct: summary.repeatPct,
        golondrinaPhones: summary.golondrinaPhones,
        golondrinaPct: summary.golondrinaPct,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads || a.landingTag.localeCompare(b.landingTag, "es"));

  return {
    ...globalSummary,
    byLandingTag,
  };
}

function SortButton({
  active,
  direction,
  children,
  onClick,
  align = "center",
}: {
  active: boolean;
  direction: SortDirection;
  children: React.ReactNode;
  onClick: () => void;
  align?: "left" | "center";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-medium transition hover:text-zinc-300 ${
        align === "left" ? "justify-start text-left" : "justify-center text-center"
      } ${active ? "text-zinc-300" : "text-zinc-500"}`}
    >
      <span>{children}</span>
      <span className="text-[9px] leading-none">{active ? (direction === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
  );
}

type StatsPanelProps = {
  channelLabels?: Partial<Record<StatisticsChannel, string>>;
  availableChannels?: StatisticsChannel[];
  canViewAtrio?: boolean;
  channel?: StatisticsChannel;
  onChannelChange?: (channel: StatisticsChannel) => void;
  funnelContacts: FunnelContact[];
  conversions: ConversionRow[];
  allConversions: ConversionRow[];
  journeyStarts: ConversionJourneyStartRow[];
  premiumThreshold: number;
  dateRange?: { start: Date; end: Date } | null;
  sourcePlatformFilter?: string;
  compactTooltips?: boolean;
  showAssistant?: boolean;
  currency: ReportingCurrency;
};

export default function StatsPanel(props: StatsPanelProps) {
  const [selectedChannel, setChannel] = useState<StatisticsChannel>("whatsapp");
  const channel = props.canViewAtrio === true ? props.channel ?? selectedChannel : "whatsapp";
  const [spend, setSpend] = useState<Record<string, string>>({});
  const spendKey = `${channel}:${props.currency}`;
  const scoped = useMemo(() => scopeStatisticsChannel(props.allConversions, props.journeyStarts, channel, props.dateRange),
    [props.allConversions, props.journeyStarts, props.dateRange, channel]);
  const contacts = useMemo(() => buildFunnelContactsFromConversions(scoped.conversions), [scoped.conversions]);
  return <div className="min-w-0 space-y-4" data-testid="channel-statistics" data-channel={channel}>
    {props.canViewAtrio === true && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Canal de las estadísticas">
      {(props.availableChannels ?? ["whatsapp", "atrio"] as StatisticsChannel[]).map(value => <button key={value} type="button" aria-pressed={channel === value}
        onClick={() => { setChannel(value); props.onChannelChange?.(value); }}
        className={`rounded-full border px-4 py-2 text-xs font-bold transition ${channel === value ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100"}`}>
        {props.channelLabels?.[value] ?? (value === "whatsapp" ? "WhatsApp" : "Atrio")}
      </button>)}
    </div>}
    <p className="text-xs text-zinc-400">Todas las estadísticas corresponden a {props.channelLabels?.[channel] ? `${props.channelLabels[channel]}, con los filtros globales seleccionados` : channel === "whatsapp" ? "WhatsApp y a los filtros globales seleccionados" : "Atrio, con origen Landing y los filtros globales seleccionados"}.</p>
    {(scoped.unknownConversions > 0 || scoped.unknownStarts > 0) && <p className="break-words text-xs text-zinc-500" role="status">
      Sin canal histórico confirmado: {scoped.unknownConversions} registros y {scoped.unknownStarts} visitas. No se incluyen en los cálculos por canal.
    </p>}
    {scoped.conversions.length === 0 && scoped.journeyStarts.length === 0 && <p className="text-sm text-zinc-400">No hay datos de {props.channelLabels?.[channel] ?? (channel === "whatsapp" ? "WhatsApp" : "Atrio")} para esta selección.</p>}
    <ChannelStatsPanel key={`${channel}-${props.currency}`} {...props} funnelContacts={contacts} conversions={scoped.conversions}
      allConversions={scoped.allConversions} journeyStarts={scoped.journeyStarts} channel={channel} funnel={scoped.funnel}
      adSpend={spend[spendKey] ?? ""} setAdSpend={value => setSpend(current => ({ ...current, [spendKey]: value }))} />
  </div>;
}

function ChannelStatsPanel({
  channelLabels,
  funnelContacts,
  conversions,
  allConversions,
  journeyStarts,
  premiumThreshold,
  dateRange,
  sourcePlatformFilter = "__all__",
  compactTooltips = false,
  showAssistant = true,
  currency,
  channel,
  funnel,
  adSpend,
  setAdSpend,
}: StatsPanelProps & { channel: StatisticsChannel; funnel: ReturnType<typeof computeChannelFunnel>; adSpend: string; setAdSpend: (value: string) => void }) {
  const activityLabel = channel === "atrio" ? "Solicitudes de usuario" : "Mensajes recibidos";
  const activityStage = channel === "atrio" ? "contact" : "lead";
  const purchasePlayers = useMemo(() => computeStatisticsPurchasePlayers(conversions), [conversions]);
  const [hourlyLoadMetric, setHourlyLoadMetric] = useState<LoadMetric>("total");
  const [dailyLoadMetric, setDailyLoadMetric] = useState<LoadMetric>("total");
  const [hourlyMessagesSmaEnabled, setHourlyMessagesSmaEnabled] = useState(false);
  const [dailyMessagesSmaEnabled, setDailyMessagesSmaEnabled] = useState(false);
  const [hourlySmaEnabled, setHourlySmaEnabled] = useState(false);
  const [dailySmaEnabled, setDailySmaEnabled] = useState(false);
  const [weekdayMessagesSmaEnabled, setWeekdayMessagesSmaEnabled] = useState(false);
  const [weekdayLoadsSmaEnabled, setWeekdayLoadsSmaEnabled] = useState(false);
  const [revenueSmaEnabled, setRevenueSmaEnabled] = useState(false);
  const [topContactsLimit, setTopContactsLimit] = useState<TopContactsLimit>(10);
  const [campaignSort, setCampaignSort] = useState<{ key: TableSortKey; direction: SortDirection }>({ key: "revenue", direction: "desc" });
  const [landingSort, setLandingSort] = useState<{ key: TableSortKey; direction: SortDirection }>({ key: "revenue", direction: "desc" });
  const [funnelPctMenuOpen, setFunnelPctMenuOpen] = useState(false);
  const [funnelPctEnabled, setFunnelPctEnabled] = useState<{ inicio: boolean; carga: boolean; recarga: boolean }>({
    inicio: true,
    carga: true,
    recarga: false,
  });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantQuota, setAssistantQuota] = useState<AssistantQuota | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMsg[]>([]);

  const temporalConversions = useMemo(() => statisticsTemporalRows(conversions, channel), [conversions, channel]);

  const stats = useMemo(() => {
    const truth = computeStatsTruthMetrics({
      conversions,
      funnelContacts,
      allConversions,
      premiumThreshold,
    });
    const core = truth.core;
    const journeyStartStats = computeJourneyStartStats(journeyStarts, conversions);
    const isRepeatPurchase = (c: ConversionRow): boolean => {
      if ((c.purchase_event_id ?? "") === "") return false;
      if (c.purchase_type === "repeat") return true;
      if (c.purchase_type === "first") return false;
      return (c.observaciones ?? "").includes("REPEAT");
    };
    const isFirstPurchase = (c: ConversionRow): boolean => {
      if ((c.purchase_event_id ?? "") === "") return false;
      if (c.purchase_type === "first") return true;
      if (c.purchase_type === "repeat") return false;
      return !(c.observaciones ?? "").includes("REPEAT");
    };
    const uniqueContacts = truth.uniqueContacts;
    const uniqueLeads = channel === "atrio" ? funnel.contacts : truth.uniqueLeads;
    const realLeadsLinkedToContact = truth.realLeadsLinkedToContact;
    const inferredLeadsFromContactPurchase = truth.inferredLeadsFromContactPurchase;
    const uniqueLeadsLinkedToContact = channel === "atrio" ? funnel.contacts : funnel.messages;
    const firstLoadPurchasers = truth.firstLoadPurchasers;
    const firstLoadPurchasersLinkedToLead = funnel.firstPurchases;
    const firstLoadPlayersAttributed = new Set(conversions.filter(isFirstPurchase).map(statisticsPlayerKey)).size;
    const totalPurchases = truth.totalPurchases;
    const primera = truth.primera;
    const recurrente = truth.recurrente;
    const premium = truth.premium;
    const totalRevenue = truth.totalRevenue;
    const totalPurchaseCount = truth.totalPurchaseCount;
    const firstPurchaseRevenue = truth.firstPurchaseRevenue;
    const reachedRepeat = truth.reachedRepeat;
    const repeatPlayersReached = new Set(conversions.filter(isRepeatPurchase).map(statisticsPlayerKey)).size;
    const purchaseFirstCount = truth.purchaseFirstCount;
    const purchaseRepeatCount = truth.purchaseRepeatCount;
    const leads = uniqueLeads;

    const purchasers = truth.purchasers;
    const avgTicket = truth.avgTicket;
    const purchasePlayers = new Set(conversions.filter(row => row.purchase_event_id).map(statisticsPlayerKey)).size;
    const avgLoadsPerPlayer = purchasePlayers ? totalPurchaseCount / purchasePlayers : 0;
    type SliceStats = {
      mensajes: number;
      cargas: number;
      revenue: number;
      firstRevenue: number;
      baseCargas: number | null;
    };
    const getSliceStats = (
      convSlice: ConversionRow[],
      contactsSlice: FunnelContact[],
      allConvSlice: ConversionRow[],
    ): SliceStats => {
      const slicedCore = computeCoreStats(convSlice, contactsSlice, allConvSlice, premiumThreshold);
      const milestones = computeChannelFunnel(convSlice, channel);
      return {
        mensajes: channel === "atrio" ? milestones.contacts : convSlice.filter(row => row.lead_event_id).length,
        cargas: milestones.firstPurchases,
        revenue: slicedCore.totalRevenue,
        firstRevenue: slicedCore.firstPurchaseEventRevenue,
        baseCargas: channel === "atrio" ? milestones.contacts : milestones.messages,
      };
    };

    // Keep the original input order within each slice.
    const groupBy = <T,>(rows: T[], keyFor: (row: T) => string): Map<string, T[]> => {
      const groups = new Map<string, T[]>();
      for (const row of rows) {
        const key = keyFor(row);
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
      }
      return groups;
    };
    const campaignKey = (row: { utm_campaign?: string | null }) => row.utm_campaign || "Sin campaña";
    const deviceKey = (row: { device_type?: string | null }) => row.device_type || "Desconocido";
    const landingKey = (row: { landing_name?: string | null }) => row.landing_name || "Sin landing";
    const campaignConversions = groupBy(conversions, campaignKey);
    const campaignContacts = groupBy(funnelContacts, campaignKey);
    const campaignAllConversions = groupBy(allConversions, campaignKey);
    const deviceConversions = groupBy(conversions, deviceKey);
    const deviceContacts = groupBy(funnelContacts, deviceKey);
    const deviceAllConversions = groupBy(allConversions, deviceKey);
    const landingConversions = groupBy(conversions, landingKey);
    const landingContacts = groupBy(funnelContacts, landingKey);
    const landingAllConversions = groupBy(allConversions, landingKey);

    // By campaign (same formulas, filtered universe)
    const campaignKeys = new Set<string>([
      ...campaignContacts.keys(),
      ...campaignConversions.keys(),
      ...campaignAllConversions.keys(),
    ]);
    const byCampaign = [...campaignKeys]
      .map((campaign) => {
        const convSlice = campaignConversions.get(campaign) ?? [];
        const contactsSlice = campaignContacts.get(campaign) ?? [];
        const allConvSlice = campaignAllConversions.get(campaign) ?? [];
        return { campaign, ...getSliceStats(convSlice, contactsSlice, allConvSlice) };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // By device (same formulas, filtered universe)
    const deviceKeys = new Set<string>([
      ...deviceContacts.keys(),
      ...deviceConversions.keys(),
      ...deviceAllConversions.keys(),
    ]);
    const byDevice = [...deviceKeys]
      .map((device) => {
        const convSlice = deviceConversions.get(device) ?? [];
        const contactsSlice = deviceContacts.get(device) ?? [];
        const allConvSlice = deviceAllConversions.get(device) ?? [];
        return { device, ...getSliceStats(convSlice, contactsSlice, allConvSlice) };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // By landing (same formulas, filtered universe)
    const landingKeys = new Set<string>([
      ...landingContacts.keys(),
      ...landingConversions.keys(),
      ...landingAllConversions.keys(),
    ]);
    const byLanding = [...landingKeys]
      .map((landing) => {
        const convSlice = landingConversions.get(landing) ?? [];
        const contactsSlice = landingContacts.get(landing) ?? [];
        const allConvSlice = landingAllConversions.get(landing) ?? [];
        return { landing, ...getSliceStats(convSlice, contactsSlice, allConvSlice) };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    // Top contacts
    const topContacts = [...funnelContacts]
      .filter((c) => c.total_valor > 0)
      .sort((a, b) => b.total_valor - a.total_valor);

    // Hourly distribution of purchases
    const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h}`,
      cargas: 0,
      cargas_first: 0,
      cargas_repeat: 0,
      ingresos: 0,
    }));
    for (const c of temporalConversions) {
      if ((c.purchase_event_id ?? "") !== "" && c.created_at) {
        const h = new Date(c.created_at).getHours();
        hourlyBuckets[h].cargas++;
        if (isFirstPurchase(c)) hourlyBuckets[h].cargas_first++;
        if (isRepeatPurchase(c)) hourlyBuckets[h].cargas_repeat++;
        hourlyBuckets[h].ingresos += Number(c.valor) || 0;
      }
    }

    // Daily leads vs purchases  refleja el rango seleccionado, mínimo 7 días
    const MS_PER_DAY = 86400000;
    const MIN_DAYS = 7;

    let chartStart: Date;
    let chartEnd: Date;
    if (dateRange) {
      chartStart = new Date(dateRange.start);
      chartEnd = new Date(dateRange.end);
    } else {
      const dates = temporalConversions
        .filter((c) => c.created_at)
        .map((c) => new Date(c.created_at).setHours(0, 0, 0, 0));
      if (dates.length === 0) {
        chartEnd = new Date();
        chartStart = new Date(chartEnd);
        chartStart.setDate(chartStart.getDate() - MIN_DAYS + 1);
      } else {
        const minT = Math.min(...dates);
        const maxT = Math.max(...dates);
        chartStart = new Date(minT);
        chartEnd = new Date(maxT);
        const spanDays = Math.ceil((maxT - minT) / MS_PER_DAY) + 1;
        if (spanDays < MIN_DAYS) {
          chartStart = new Date(chartEnd);
          chartStart.setDate(chartStart.getDate() - MIN_DAYS + 1);
        }
      }
    }

    const dailyMap = new Map<string, { day: string; leads: number; cargas: number; cargas_first: number; cargas_repeat: number; ingresos: number }>();
    for (const c of temporalConversions) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const dayKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      const entry = dailyMap.get(dayKey) ?? {
        day: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        leads: 0,
        cargas: 0,
        cargas_first: 0,
        cargas_repeat: 0,
        ingresos: 0,
      };
      if (c[`${activityStage}_event_id`]) entry.leads++;
      if ((c.purchase_event_id ?? "") !== "") {
        entry.cargas++;
        if (isFirstPurchase(c)) entry.cargas_first++;
        if (isRepeatPurchase(c)) entry.cargas_repeat++;
        entry.ingresos += Number(c.valor) || 0;
      }
      dailyMap.set(dayKey, entry);
    }

    const dailyData: { key: string; day: string; leads: number; cargas: number; cargas_first: number; cargas_repeat: number; ingresos: number }[] = [];
    const iter = new Date(chartStart);
    while (iter <= chartEnd) {
      const dayKey = `${iter.getFullYear()}-${(iter.getMonth() + 1).toString().padStart(2, "0")}-${iter.getDate().toString().padStart(2, "0")}`;
      const label = `${iter.getDate().toString().padStart(2, "0")}/${(iter.getMonth() + 1).toString().padStart(2, "0")}`;
      const entry = dailyMap.get(dayKey) ?? { day: label, leads: 0, cargas: 0, cargas_first: 0, cargas_repeat: 0, ingresos: 0 };
      dailyData.push({ ...entry, key: dayKey, day: label });
      iter.setDate(iter.getDate() + 1);
    }

    // Ingresos hoy vs ayer (para flecha de tendencia)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    let revenueToday = 0;
    let revenueYesterday = 0;
    for (const c of allConversions) {
      if ((c.purchase_event_id ?? "") === "" || !c.created_at) continue;
      const d = stageDate(c, "purchase")?.getTime() ?? NaN;
      if (d >= today.getTime() && d <= todayEnd.getTime()) revenueToday += c.valor;
      if (d >= yesterday.getTime() && d <= yesterdayEnd.getTime()) revenueYesterday += c.valor;
    }
    const revenueTrend: "up" | "down" | undefined =
      revenueYesterday > 0 || revenueToday > 0
        ? revenueToday > revenueYesterday
          ? "up"
          : revenueToday < revenueYesterday
            ? "down"
            : undefined
        : undefined;

    const revenuePctChange =
      revenueTrend && revenueYesterday > 0
        ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100
        : revenueTrend && revenueToday > 0 && revenueYesterday === 0
          ? Infinity
          : undefined;

    return {
      journeyStarts: journeyStartStats.starts,
      journeyStartContacts: journeyStartStats.contacts,
      uniqueContacts,
      uniqueLeads,
      realLeadsLinkedToContact,
      inferredLeadsFromContactPurchase,
      uniqueLeadsLinkedToContact,
      firstLoadPurchasers,
      firstLoadPurchasersLinkedToLead,
      firstLoadPlayersAttributed,
      totalPurchases,
      leads,
      primera,
      recurrente,
      premium,
      purchasers,
      reachedRepeat,
      repeatPlayersReached,
      purchaseFirstCount,
      purchaseRepeatCount,
      repeatFromFirstInRange: core.adRepeatJourneysFromAttributedFirstInRange,
      repeatEventsFromFirstInRange: core.adRepeatEventsFromAttributedFirstInRange,
      repeatPlayersFromFirstInRange: core.repeatFromAttributedFirstInRange,
      totalRevenue,
      firstPurchaseRevenue,
      totalPurchaseCount,
      avgTicket,
      avgLoadsPerPlayer,
      byCampaign,
      byDevice,
      byLanding,
      topContacts,
      hourlyBuckets,
      dailyData,
      retencionActiva30d: core.activeRetention30d,
      revenueTrend,
      revenuePctChange,
      revenueToday,
      revenueYesterday,
    };
  }, [funnelContacts, conversions, allConversions, journeyStarts, premiumThreshold, dateRange, activityStage, temporalConversions, channel, funnel]);

  const parsedAdSpend = parseFloat(adSpend.replace(/\D/g, "")) || 0;
  const roasFirstPurchase = parsedAdSpend > 0 ? stats.firstPurchaseRevenue / parsedAdSpend : 0;
  const roasTotal = parsedAdSpend > 0 ? stats.totalRevenue / parsedAdSpend : 0;
  const visibleTopContacts = useMemo(
    () => stats.topContacts.slice(0, topContactsLimit),
    [stats.topContacts, topContactsLimit],
  );
  const todayEndTime = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  }, []);
  const isTodayRange = useMemo(() => {
    if (!dateRange) return false;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    return dateRange.start.getTime() === startToday && dateRange.end.getTime() === endToday;
  }, [dateRange]);
  const isYesterdayRange = useMemo(() => {
    if (!dateRange) return false;
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0).getTime();
    const endYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999).getTime();
    return dateRange.start.getTime() === startYesterday && dateRange.end.getTime() === endYesterday;
  }, [dateRange]);
  const isCurrentWeekRange = useMemo(() => {
    if (!dateRange) return false;
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const startWeek = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0).getTime();
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    return dateRange.start.getTime() === startWeek && dateRange.end.getTime() === endToday;
  }, [dateRange]);
  const showWeekdayDistribution = useMemo(() => {
    if (!dateRange) return true;
    if (isTodayRange || isYesterdayRange) return false;
    if (isCurrentWeekRange) return true;
    const inclusiveDays = Math.floor(
      (dateRange.end.getTime() - dateRange.start.getTime()) / 86400000,
    ) + 1;
    return inclusiveDays >= 7;
  }, [dateRange, isCurrentWeekRange, isTodayRange, isYesterdayRange]);
  const currentHour = useMemo(() => new Date().getHours(), []);
  const revenueChartData = useMemo(() => {
    const source = isTodayRange
      ? stats.hourlyBuckets.map((row, idx) => ({
          label: row.hour,
          ingresos: idx > currentHour ? null : row.ingresos,
        }))
      : stats.dailyData.map((row) => ({
          label: row.day,
          ingresos: new Date(`${row.key}T00:00:00`).getTime() > todayEndTime ? null : row.ingresos,
        }));

    const getSma = (idx: number, window: 3) => {
      const start = Math.max(0, idx - window + 1);
      let sum = 0;
      let count = 0;
      for (let i = start; i <= idx; i++) {
        const value = source[i]?.ingresos;
        if (typeof value === "number") {
          sum += value;
          count += 1;
        }
      }
      return count > 0 ? Number((sum / count).toFixed(2)) : null;
    };

    return source.map((row, idx) => ({
      ...row,
      sma3: row.ingresos === null ? null : getSma(idx, 3),
    }));
  }, [currentHour, isTodayRange, stats.dailyData, stats.hourlyBuckets, todayEndTime]);
  const hourlyChartData = useMemo(() => {
    const valueForMetric = (row: { cargas: number; cargas_first: number; cargas_repeat: number }) => {
      if (hourlyLoadMetric === "first") return row.cargas_first;
      if (hourlyLoadMetric === "repeat") return row.cargas_repeat;
      return row.cargas;
    };
    const getSma = (idx: number, window: 1 | 3 | 5) => {
      const start = Math.max(0, idx - window + 1);
      let sum = 0;
      let count = 0;
      for (let i = start; i <= idx; i++) {
        const row = stats.hourlyBuckets[i];
        sum += row ? valueForMetric(row) : 0;
        count += 1;
      }
      return count > 0 ? Number((sum / count).toFixed(2)) : 0;
    };
    return stats.hourlyBuckets.map((row, idx) => {
      const isFutureHour = isTodayRange && idx > currentHour;
      const cargas = valueForMetric(row);
      return {
        ...row,
        cargas: isFutureHour ? null : cargas,
        sma1: isFutureHour ? null : getSma(idx, 1),
        sma3: isFutureHour ? null : getSma(idx, 3),
        sma5: isFutureHour ? null : getSma(idx, 5),
      };
    });
  }, [stats.hourlyBuckets, isTodayRange, currentHour, hourlyLoadMetric]);
  const dailyTotalLoadsData = useMemo(() => {
    const valueForMetric = (row: { cargas: number; cargas_first: number; cargas_repeat: number }) => {
      if (dailyLoadMetric === "first") return row.cargas_first;
      if (dailyLoadMetric === "repeat") return row.cargas_repeat;
      return row.cargas;
    };
    const getSma = (idx: number, window: 1) => {
      const start = Math.max(0, idx - window + 1);
      let sum = 0;
      let count = 0;
      for (let i = start; i <= idx; i++) {
        const row = stats.dailyData[i];
        sum += row ? valueForMetric(row) : 0;
        count += 1;
      }
      return count > 0 ? Number((sum / count).toFixed(2)) : 0;
    };
    return stats.dailyData.map((row, idx) => {
      const isFutureDay = new Date(`${row.key}T00:00:00`).getTime() > todayEndTime;
      return {
        ...row,
        cargas: isFutureDay ? null : valueForMetric(row),
        sma1: isFutureDay ? null : getSma(idx, 1),
      };
    });
  }, [stats.dailyData, dailyLoadMetric, todayEndTime]);
  const hourlyMessagesLoadsData = useMemo(() => {
    const isFirstPurchase = (c: ConversionRow): boolean => {
      if ((c.purchase_event_id ?? "") === "") return false;
      if (c.purchase_type === "first") return true;
      if (c.purchase_type === "repeat") return false;
      return !(c.observaciones ?? "").includes("REPEAT");
    };
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}`, leads: 0, cargas: 0, cargas_first: 0 }));
    for (const c of temporalConversions) {
      if (!c.created_at) continue;
      const h = new Date(c.created_at).getHours();
      if (c[`${activityStage}_event_id`]) byHour[h].leads += 1;
      if ((c.purchase_event_id ?? "") !== "") {
        byHour[h].cargas += 1;
        if (isFirstPurchase(c)) byHour[h].cargas_first += 1;
      }
    }
    return byHour.map((row, idx) => {
      const isFutureHour = isTodayRange && idx > currentHour;
      return {
        ...row,
        leads: isFutureHour ? null : row.leads,
        cargas: isFutureHour ? null : row.cargas,
        cargas_first: isFutureHour ? null : row.cargas_first,
      };
    });
  }, [temporalConversions, activityStage, isTodayRange, currentHour]);
  const dailyMessagesLoadsData = useMemo(() => {
    const isFirstPurchase = (c: ConversionRow): boolean => {
      if ((c.purchase_event_id ?? "") === "") return false;
      if (c.purchase_type === "first") return true;
      if (c.purchase_type === "repeat") return false;
      return !(c.observaciones ?? "").includes("REPEAT");
    };
    if (isTodayRange) {
      const byHour = Array.from({ length: 24 }, (_, h) => ({ day: `${h}`, leads: 0, cargas: 0, cargas_first: 0 }));
      for (const c of temporalConversions) {
        if (!c.created_at) continue;
        const h = new Date(c.created_at).getHours();
        if (c[`${activityStage}_event_id`]) byHour[h].leads += 1;
        if ((c.purchase_event_id ?? "") !== "") {
          byHour[h].cargas += 1;
          if (isFirstPurchase(c)) byHour[h].cargas_first += 1;
        }
      }
      return byHour.map((row, idx) => {
        const isFutureHour = idx > currentHour;
        return {
          ...row,
          leads: isFutureHour ? null : row.leads,
          cargas: isFutureHour ? null : row.cargas,
          cargas_first: isFutureHour ? null : row.cargas_first,
        };
      });
    }

    const byDay = new Map<string, { day: string; leads: number; cargas: number; cargas_first: number }>();
    for (const c of temporalConversions) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      const label = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      const row = byDay.get(key) ?? { day: label, leads: 0, cargas: 0, cargas_first: 0 };
      if (c[`${activityStage}_event_id`]) row.leads += 1;
      if ((c.purchase_event_id ?? "") !== "") {
        row.cargas += 1;
        if (isFirstPurchase(c)) row.cargas_first += 1;
      }
      byDay.set(key, row);
    }
    return stats.dailyData.map((d) => {
      const [dayPart, monthPart] = d.day.split("/");
      const match = Array.from(byDay.values()).find((r) => {
        const [rd, rm] = r.day.split("/");
        return rd === dayPart && rm === monthPart;
      });
      return match ?? { day: d.day, leads: 0, cargas: 0, cargas_first: 0 };
    });
  }, [isTodayRange, stats.dailyData, temporalConversions, activityStage, currentHour]);
  const hourlyMessagesChartData = useMemo(() => (
    hourlyMessagesLoadsData.map((row) => ({
      ...row,
      mensajes: row.leads,
      sma1: row.leads,
    }))
  ), [hourlyMessagesLoadsData]);
  const dailyMessagesChartData = useMemo(() => (
    stats.dailyData.map((row) => ({
      ...row,
      mensajes: new Date(`${row.key}T00:00:00`).getTime() > todayEndTime ? null : row.leads,
      sma1: new Date(`${row.key}T00:00:00`).getTime() > todayEndTime ? null : row.leads,
    }))
  ), [stats.dailyData, todayEndTime]);
  const weekdayDistributionBaseData = useMemo(() => {
    const labels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const rows = labels.map((day) => ({ day, mensajes: 0, cargas: 0 }));
    for (const c of temporalConversions) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const idx = (d.getDay() + 6) % 7;
      if (c[`${activityStage}_event_id`]) rows[idx].mensajes += 1;
      if ((c.purchase_event_id ?? "") !== "") rows[idx].cargas += 1;
    }
    return rows;
  }, [temporalConversions, activityStage]);
  const weekdayMessagesChartData = useMemo(() => (
    weekdayDistributionBaseData.map((row) => ({
      ...row,
      sma1: row.mensajes,
    }))
  ), [weekdayDistributionBaseData]);
  const weekdayLoadsChartData = useMemo(() => (
    weekdayDistributionBaseData.map((row) => ({
      ...row,
      sma1: row.cargas,
    }))
  ), [weekdayDistributionBaseData]);
  const dailyFunnelPctData = useMemo(() => {
    const buckets = isTodayRange ? Array.from({ length: 24 }, (_, hour) => {
      const date = new Date(dateRange!.start);
      date.setHours(hour, 0, 0, 0);
      return { label: String(hour), start: date, end: new Date(date.getTime() + 3599999), future: hour > currentHour };
    }) : stats.dailyData.map(row => ({ label: row.day, start: new Date(`${row.key}T00:00:00`), end: new Date(`${row.key}T23:59:59.999`), future: new Date(`${row.key}T00:00:00`).getTime() > todayEndTime }));
    return buckets.map(bucket => {
      const bucketRows = scopeStatisticsStages(conversions, { start: bucket.start, end: bucket.end });
      const milestones = computeChannelFunnel(bucketRows, channel);
      const players = computeStatisticsPurchasePlayers(bucketRows);
      const base = channel === "atrio" ? milestones.contacts : milestones.messages;
      return { day: bucket.label,
        pct_inicio: bucket.future || channel === "atrio" || !milestones.contacts ? null : 100 * milestones.messages / milestones.contacts,
        pct_carga: bucket.future || !base ? null : 100 * players.firstPlayers / base,
        pct_recarga: bucket.future || !players.firstPlayers ? null : 100 * players.repeatPlayersFromFirst / players.firstPlayers,
      };
    });
  }, [isTodayRange, dateRange, stats.dailyData, currentHour, todayEndTime, conversions, channel]);

  const toggleCampaignSort = (key: TableSortKey) => {
    setCampaignSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };
  const toggleLandingSort = (key: TableSortKey) => {
    setLandingSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };
  const getSortValue = (
    row: {
      campaign?: string;
      landing?: string;
      mensajes: number;
      cargas: number;
      revenue: number;
      firstRevenue: number;
    },
    key: TableSortKey,
  ) => {
    if (key === "name") return row.campaign ?? row.landing ?? "";
    if (key === "pct") return row.mensajes > 0 ? row.cargas / row.mensajes : 0;
    if (key === "roas1") return parsedAdSpend > 0 ? row.firstRevenue / parsedAdSpend : 0;
    if (key === "roasTotal") return parsedAdSpend > 0 ? row.revenue / parsedAdSpend : 0;
    return row[key];
  };
  const sortRows = <T extends { mensajes: number; cargas: number; revenue: number; firstRevenue: number; campaign?: string; landing?: string }>(
    rows: T[],
    sort: { key: TableSortKey; direction: SortDirection },
  ) => {
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getSortValue(a, sort.key);
      const bv = getSortValue(b, sort.key);
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv), "es") * multiplier;
      }
      return ((av as number) - (bv as number)) * multiplier;
    });
  };
  const sortedCampaignRows = sortRows(stats.byCampaign, campaignSort);
  const sortedLandingRows = sortRows(stats.byLanding, landingSort);
  const sourceContext = sourcePlatformFilter === "landing"
    ? "landing"
    : sourcePlatformFilter === "whatsapp_cloud_api"
      ? "whatsapp_cloud_api"
      : "all";
  const showJourneyStartMetrics = true;
  const startSummaryLabel = sourceContext === "all" ? "Inicios del recorrido" : sourceContext === "landing"
    ? "Visitas unicas"
    : "Chats iniciados";
  const startSummaryTooltip = sourceContext === "all" ? "Inicios medidos en los orígenes seleccionados: visitas de landing y chats iniciados en WhatsApp Cloud API, con canal capturado."
    : sourceContext === "landing"
    ? "Page views internos deduplicados por recorrido de landing. No se envian a Meta via CAPI."
    : "Primeros mensajes entrantes recibidos por WhatsApp Cloud API, antes del click al asesor.";
  const contactSummaryLabel = sourceContext === "whatsapp_cloud_api"
    ? "Clicks en el CTA"
    : sourceContext === "landing"
      ? "Clicks en el boton"
      : "Clicks de contacto";
  const contactSummaryTooltip = sourceContext === "whatsapp_cloud_api"
    ? "Eventos Contact registrados cuando el cliente toca el link o el boton CTA hacia el asesor."
    : sourceContext === "landing"
      ? "Eventos Contact registrados al tocar el boton de la landing."
      : "Eventos Contact registrados al tocar un CTA de contacto.";
  const measuredVisits = journeyStarts.length > 0;
  const contactsWithMeasuredVisit = countStatisticsVisitConversions(journeyStarts, conversions);
  const journeyPathSteps: JourneyPathStep[] = [
    { label: startSummaryLabel, value: measuredVisits ? stats.journeyStarts : "Sin medición", color: "text-emerald-300" },
    { label: channel === "atrio" ? "Solicitaron usuario" : "Clicks en el CTA", value: funnel.contacts, color: "text-zinc-100" },
    ...(channel === "whatsapp" ? [
      { label: "Mensajes recibidos", value: funnel.messages, color: "text-amber-300" },
    ] : []),
    { label: "Primeras cargas", value: purchasePlayers.firstPlayers, color: "text-sky-300" },
    { label: "Cargas -> recargas del periodo", value: purchasePlayers.repeatPlayersFromFirst, color: "text-fuchsia-300" },
  ];
  const journeyPathRates = [
    statisticsRate(measuredVisits ? contactsWithMeasuredVisit : null, measuredVisits ? stats.journeyStarts : null),
    ...(channel === "whatsapp" ? [statisticsRate(funnel.messages, funnel.contacts)] : []),
    statisticsRate(purchasePlayers.firstPlayers, channel === "atrio" ? funnel.contacts : funnel.messages),
    statisticsRate(purchasePlayers.repeatPlayersFromFirst, purchasePlayers.firstPlayers),
  ];

  const assistantContext = {
    isTodayRange,
    currency,
    summary: {
      clicks_cta: stats.uniqueContacts,
      canal: channel,
      tipo_actividad: activityLabel,
      actividad_del_canal: channel === "atrio" ? funnel.contacts : funnel.messages,
      ...(channel === "atrio" ? { crearon_usuario: funnel.registrations } : {}),
      recorridos_cargaron: stats.firstLoadPurchasersLinkedToLead,
      recorridos_recargaron: stats.reachedRepeat,
      recorridos_first_y_repeat_periodo: stats.repeatFromFirstInRange,
      jugadores_cargaron: stats.firstLoadPlayersAttributed,
      jugadores_recargaron: stats.repeatPlayersReached,
      jugadores_first_y_repeat_periodo: stats.repeatPlayersFromFirstInRange,
      recargas_totales: stats.purchaseRepeatCount,
      total_cargas: stats.totalPurchases,
      total_cargado: stats.totalRevenue,
      ticket_promedio: Number(stats.avgTicket.toFixed(2)),
    },
    funnel: { channel, steps: journeyPathSteps, rates: journeyPathRates },
    charts: {
      hourly_total_cargas_last24: stats.hourlyBuckets.map((r) => ({ hour: r.hour, cargas: r.cargas })),
      hourly_mensajes_vs_cargas_last24: hourlyMessagesLoadsData.map((r) => ({
        hour: r.hour,
        mensajes: r.leads,
        cargas_first: r.cargas_first,
        cargas_total: r.cargas,
      })),
      daily_mensajes_vs_cargas_last14: dailyMessagesLoadsData.slice(-14),
      daily_funnel_pct_last14: dailyFunnelPctData.slice(-14),
    },
    breakdowns: {
      by_campaign_top5: stats.byCampaign.slice(0, 5).map((r) => ({
        campaign: r.campaign,
        mensajes: r.mensajes,
        cargas: r.cargas,
        revenue: r.revenue,
      })),
      by_device_top5: stats.byDevice.slice(0, 5).map((r) => ({
        device: r.device,
        mensajes: r.mensajes,
        cargas: r.cargas,
        revenue: r.revenue,
      })),
      by_landing_top5: stats.byLanding.slice(0, 5).map((r) => ({
        landing: r.landing,
        mensajes: r.mensajes,
        cargas: r.cargas,
        revenue: r.revenue,
      })),
    },
  };

  const sendAssistantQuestion = async () => {
    const question = assistantInput.trim();
    if (!question || assistantLoading) return;
    setAssistantError(null);
    setAssistantLoading(true);
    setAssistantMessages((prev) => [...prev, { role: "user", text: question }]);
    setAssistantInput("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      if (!token) throw new Error("Sesion no valida para usar el asistente.");

      const res = await fetch("/api/stats-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, context: assistantContext }),
      });
      const json = (await res.json()) as { answer?: string; error?: string; quota?: AssistantQuota };
      if (!res.ok) {
        throw new Error(json.error || "No se pudo obtener respuesta.");
      }
      const answer = String(json.answer ?? "").trim() || "No pude generar una respuesta con los datos actuales.";
      if (json.quota) setAssistantQuota(json.quota);
      setAssistantMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      setAssistantError(msg);
      setAssistantMessages((prev) => [...prev, { role: "assistant", text: "No pude responder en este momento. Proba de nuevo en unos segundos." }]);
    } finally {
      setAssistantLoading(false);
    }
  };

  useEffect(() => {
    if (!assistantOpen) return;
    const loadQuota = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token ?? "";
        if (!token) return;
        const res = await fetch("/api/stats-assistant", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as { quota?: AssistantQuota };
        if (res.ok && json.quota) setAssistantQuota(json.quota);
      } catch {
        // silent: quota is informational only
      }
    };
    void loadQuota();
  }, [assistantOpen]);

  return (
    <div className="space-y-8">

      {/*  RESUMEN GENERAL  */}
      <div>
        <SectionTitle>Resumen general</SectionTitle>
        <div data-testid="statistics-summary" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {showJourneyStartMetrics && (
            <KpiCard
              label={startSummaryLabel}
              value={measuredVisits ? stats.journeyStarts : "Sin medición"}
              color="text-emerald-300"
              tooltip={startSummaryTooltip}
            />
          )}
          <KpiCard
            label={channel === "atrio" ? "Solicitaron usuario" : contactSummaryLabel}
            value={funnel.contacts}
            tooltip={contactSummaryTooltip}
          />
          {channel === "whatsapp" && <KpiCard
            label="Mensajes recibidos" value={conversions.filter(row => row.lead_event_id).length} color="text-amber-300"
            tooltip="Eventos Lead reales recibidos en el período, aunque el CTA haya ocurrido antes. El recorrido calcula por separado las etapas vinculadas del período. No se infieren mensajes por una carga."
          />}
          {channel === "atrio" && <KpiCard label="Crearon usuario" value={funnel.registrations ?? "Sin medición"} color="text-teal-300"
            tooltip={`Altas confirmadas, deduplicadas por evento. El CompleteRegistration del CTA de ${channelLabels?.atrio ?? "Atrio"} es una solicitud y no se cuenta como alta. Los períodos sin eventos de alta confirmada no permiten reconstruir esta métrica.`} />}
          <KpiCard
            label="Primeras cargas"
            value={stats.purchaseFirstCount}
            sub={`${stats.firstLoadPlayersAttributed} ${stats.firstLoadPlayersAttributed === 1 ? "jugador" : "jugadores"}`}
            color="text-sky-300"
            tooltip="Eventos Purchase clasificados como first dentro del periodo y filtros seleccionados."
          />
          <KpiCard
            label="Recargas"
            value={stats.purchaseRepeatCount}
            sub={`${stats.repeatPlayersReached} ${stats.repeatPlayersReached === 1 ? "jugador" : "jugadores"}`}
            color="text-violet-300"
            tooltip="Eventos Purchase clasificados como repeat dentro del periodo y filtros seleccionados."
          />
          <KpiCard
            label="Total de cargas"
            value={stats.totalPurchases}
            color="text-sky-400"
            tooltip="Cantidad de primeras cargas (first) y de recargas (repeat) registradas para el rango de fecha seleccionado."
          />
          <KpiCard
            label="Cargas -> recargas del periodo"
            value={purchasePlayers.repeatEventsFromFirst}
            sub={`${purchasePlayers.repeatPlayersFromFirst} ${purchasePlayers.repeatPlayersFromFirst === 1 ? "jugador" : "jugadores"}`}
            color="text-fuchsia-300"
            tooltip="Recargas de jugadores que tuvieron una primera carga y después recargaron en el período seleccionado. El recorrido muestra esos jugadores una sola vez."
          />
        </div>
      </div>

      {showJourneyStartMetrics && (
        <div>
          <SectionTitle>Recorrido</SectionTitle>
          <JourneyPathCard
            steps={journeyPathSteps}
            rates={journeyPathRates}
          />
        </div>
      )}

      <div>
        <SectionTitle>Embudo de conversión</SectionTitle>
        <p className="mt-2 text-xs text-zinc-500">Relación entre etapas del período; primeras cargas y paso a recarga se cuentan por jugador. «—» indica que falta medición o una base comparable.</p>
        <div data-testid="statistics-funnel" className={`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 ${channel === "whatsapp" ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {journeyPathRates.map((rate, index) => <KpiCard key={index}
            label={`${journeyPathSteps[index].label} → ${journeyPathSteps[index + 1].label}`}
            value={rate} color="text-emerald-300" />)}
        </div>
      </div>

      {/*  INGRESOS  */}
      <div>
        <SectionTitle>Ingresos</SectionTitle>
        <div className={`mt-3 grid grid-cols-2 gap-3 ${parsedAdSpend > 0 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-3"}`}>
          <KpiCard
            label="Total cargado"
            value={formatCurrencyAmount(stats.totalRevenue, currency)}
            color="text-emerald-400"
            trendInfo={
              !dateRange && stats.revenueTrend && stats.revenuePctChange !== undefined
                ? {
                    trend: stats.revenueTrend,
                    pctChange: stats.revenuePctChange,
                    revenueToday: stats.revenueToday,
                    revenueYesterday: stats.revenueYesterday,
                    currency,
                  }
                : undefined
            }
            tooltip={compactTooltips ? "Suma total del valor de todas las cargas." : "Suma total del valor de todas las cargas realizadas por todos los contactos."}
          />
          <KpiCard
            label="Carga promedio"
            value={formatCurrencyAmount(stats.avgTicket, currency)}
            sub={`${stats.totalPurchaseCount} cargas totales`}
            tooltip={compactTooltips ? "Monto promedio por carga individual." : "Monto promedio por carga individual. Se calcula dividiendo el total cargado por la cantidad de cargas realizadas."}
          />
          <KpiCard
            label="Promedio de cargas por jugador"
            value={stats.avgLoadsPerPlayer.toFixed(1)}
            tooltip={compactTooltips ? "Cantidad promedio de cargas por jugador." : "Cantidad promedio de cargas que realiza cada jugador que cargó al menos una vez. Se calcula dividiendo el total de cargas por la cantidad de jugadores."}
          />
          {parsedAdSpend > 0 && (
            <>
              <KpiCard
                label="ROAS primera carga"
                value={`${roasFirstPurchase.toFixed(2)}x`}
                sub={formatCurrencyAmount(stats.firstPurchaseRevenue, currency)}
                color="text-sky-400"
                tooltip={compactTooltips ? "Retorno sobre la inversión publicitaria (solo primeras cargas)." : "Retorno sobre la inversión publicitaria considerando sólo ingresos de primeras cargas (sin recargas). Se calcula: ingresos primera carga / importe gastado."}
              />
              <KpiCard
                label="ROAS total"
                value={`${roasTotal.toFixed(2)}x`}
                sub={formatCurrencyAmount(stats.totalRevenue, currency)}
                color="text-amber-400"
                tooltip={compactTooltips ? "Retorno sobre la inversión publicitaria total." : "Retorno sobre la inversión publicitaria total. Se calcula: ingresos totales (incluyendo recargas) / importe gastado."}
              />
            </>
          )}
        </div>

        {/* Ad spend input */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <label htmlFor="statistics-ad-spend" className="text-[11px] font-bold text-zinc-300">Importe gastado ({currency})</label>
          <div className="relative max-w-[200px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">{currency}</span>
            <input
              type="text"
              id="statistics-ad-spend"
              inputMode="numeric"
              value={adSpend}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                if (raw === "") {
                  setAdSpend("");
                  return;
                }
                const n = parseInt(raw, 10);
                setAdSpend(n.toLocaleString("es-AR"));
              }}
              placeholder="0"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-11 pr-3 py-1.5 text-[12px] font-bold text-zinc-200 outline-none focus:border-zinc-500"
            />
          </div>
          <p className="text-[10px] text-zinc-600">Ingresá el gasto publicitario para calcular ROAS.</p>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-xs font-semibold text-zinc-200">
              Ingresos [{isTodayRange ? "distribucion por hora" : "distribucion por dia"}]
            </h4>
            <label className="inline-flex h-7 w-fit items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300">
              <span>SMA</span>
              <button
                type="button"
                aria-pressed={revenueSmaEnabled}
                onClick={() => setRevenueSmaEnabled((v) => !v)}
                className={`flex h-4 w-7 shrink-0 items-center overflow-hidden rounded-full border-0 p-0.5 transition-colors ${revenueSmaEnabled ? "justify-end bg-emerald-500" : "justify-start bg-zinc-700"}`}
              >
                <span className="h-3 w-3 rounded-full bg-white" />
              </button>
            </label>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={revenueChartData} margin={{ top: 8, right: 18, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="revenueAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
                interval={isTodayRange ? 1 : 0}
                angle={isTodayRange ? 0 : -35}
                textAnchor={isTodayRange ? "middle" : "end"}
                height={isTodayRange ? 30 : 48}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatCompactCurrency(Number(value) || 0, currency)}
                width={64}
              />
              <Tooltip
                cursor={{ stroke: "#52525b", strokeDasharray: "4 4" }}
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11, boxShadow: "0 18px 36px rgba(0,0,0,0.35)" }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value, name) => [formatCurrencyAmount(Number(value) || 0, currency), name === "sma3" ? "SMA 3" : name]}
                labelFormatter={(value) => isTodayRange ? `${value}:00 hs` : value}
              />
              <Area
                type="monotone"
                dataKey="ingresos"
                name="Ingresos"
                stroke="#34d399"
                strokeWidth={2.5}
                fill="url(#revenueAreaGradient)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#a7f3d0" }}
                connectNulls={false}
              />
              {revenueSmaEnabled && (
                <Line
                  type="monotone"
                  dataKey="sma3"
                  name="SMA 3"
                  stroke="#f59e0b"
                  strokeWidth={1.8}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                />
              )}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* El mapa actual modela provincias argentinas; no se muestra para PYG. */}
      {currency === "ARS" && (
      <div>
        <SectionTitle>Distribución geográfica</SectionTitle>
        <div className="mt-3">
          <ArgentinaMap
            contacts={funnelContacts}
            conversions={conversions}
            allConversions={allConversions}
            premiumThreshold={premiumThreshold}
            channel={channel}
            adSpend={parsedAdSpend}
          />
        </div>
      </div>
      )}

      {/*  GRÁFICOS TEMPORALES  */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mensajes por hora */}
        <div className={`order-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ${isTodayRange ? "lg:col-span-2" : ""}`}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-xs font-semibold text-zinc-200">{activityLabel} [distribucion por hora]</h4>
            <label className="inline-flex h-7 w-fit items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300">
              <span>SMA</span>
              <button
                type="button"
                aria-pressed={hourlyMessagesSmaEnabled}
                onClick={() => setHourlyMessagesSmaEnabled((v) => !v)}
                className={`flex h-4 w-7 shrink-0 items-center overflow-hidden rounded-full border-0 p-0.5 transition-colors ${hourlyMessagesSmaEnabled ? "justify-end bg-cyan-500" : "justify-start bg-zinc-700"}`}
              >
                <span className="h-3 w-3 rounded-full bg-white" />
              </button>
            </label>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={hourlyMessagesChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: "#facc15" }}
                labelFormatter={(v) => `${v}:00 hs`}
              />
              <Bar dataKey="mensajes" name={activityLabel} fill="#facc15" radius={[3, 3, 0, 0]} maxBarSize={20} />
              {hourlyMessagesSmaEnabled && <Line type="monotone" dataKey="sma1" name="SMA 1" stroke="#22d3ee" strokeWidth={2} dot={false} />}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {!isTodayRange && (
          <>
        {/* Mensajes por dia */}
        <div className="order-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-xs font-semibold text-zinc-200">{activityLabel} [distribucion por dia]</h4>
            <label className="inline-flex h-7 w-fit items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300">
              <span>SMA</span>
              <button
                type="button"
                aria-pressed={dailyMessagesSmaEnabled}
                onClick={() => setDailyMessagesSmaEnabled((v) => !v)}
                className={`flex h-4 w-7 shrink-0 items-center overflow-hidden rounded-full border-0 p-0.5 transition-colors ${dailyMessagesSmaEnabled ? "justify-end bg-cyan-500" : "justify-start bg-zinc-700"}`}
              >
                <span className="h-3 w-3 rounded-full bg-white" />
              </button>
            </label>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={dailyMessagesChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="day"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
                angle={-35}
                textAnchor="end"
                height={48}
                interval={0}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: "#facc15" }}
              />
              <Bar dataKey="mensajes" name={activityLabel} fill="#facc15" radius={[3, 3, 0, 0]} maxBarSize={20} />
              {dailyMessagesSmaEnabled && <Line type="monotone" dataKey="sma1" name="SMA 1" stroke="#22d3ee" strokeWidth={2} dot={false} />}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
          </>
        )}

        {/* Cargas por hora */}
        <div className={`order-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ${isTodayRange ? "lg:col-span-2" : ""}`}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-xs font-semibold text-zinc-200">{LOAD_METRIC_LABELS[hourlyLoadMetric]} [distribucion por hora]</h4>
            <div className="flex items-center gap-2">
              <CustomSelect
                value={hourlyLoadMetric}
                options={(Object.keys(LOAD_METRIC_LABELS) as LoadMetric[]).map((metric) => ({
                  value: metric,
                  label: LOAD_METRIC_LABELS[metric],
                }))}
                onChange={(nextValue) => setHourlyLoadMetric(nextValue as LoadMetric)}
                className="w-36"
                buttonClassName="h-7 px-2 text-[11px] text-zinc-200"
              />
              <label className="inline-flex h-7 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300">
                <span>SMA</span>
                <button
                  type="button"
                  aria-pressed={hourlySmaEnabled}
                  onClick={() => setHourlySmaEnabled((v) => !v)}
                  className={`flex h-4 w-7 shrink-0 items-center overflow-hidden rounded-full border-0 p-0.5 transition-colors ${hourlySmaEnabled ? "justify-end bg-amber-500" : "justify-start bg-zinc-700"}`}
                >
                  <span className="h-3 w-3 rounded-full bg-white" />
                </button>
              </label>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={hourlyChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: "#34d399" }}
                labelFormatter={(v) => `${v}:00 hs`}
              />
              <Bar dataKey="cargas" name={LOAD_METRIC_LABELS[hourlyLoadMetric]} fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={20} />
              {hourlySmaEnabled && <Line type="monotone" dataKey="sma1" name="SMA 1" stroke="#f59e0b" strokeWidth={2} dot={false} />}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {!isTodayRange && (
          <>
        {/* Cargas por dia */}
        <div className="order-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-xs font-semibold text-zinc-200">{LOAD_METRIC_LABELS[dailyLoadMetric]} [distribucion por dia]</h4>
            <div className="flex items-center gap-2">
              <CustomSelect
                value={dailyLoadMetric}
                options={(Object.keys(LOAD_METRIC_LABELS) as LoadMetric[]).map((metric) => ({
                  value: metric,
                  label: LOAD_METRIC_LABELS[metric],
                }))}
                onChange={(nextValue) => setDailyLoadMetric(nextValue as LoadMetric)}
                className="w-36"
                buttonClassName="h-7 px-2 text-[11px] text-zinc-200"
              />
              <label className="inline-flex h-7 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300">
                <span>SMA</span>
                <button
                  type="button"
                  aria-pressed={dailySmaEnabled}
                  onClick={() => setDailySmaEnabled((v) => !v)}
                  className={`flex h-4 w-7 shrink-0 items-center overflow-hidden rounded-full border-0 p-0.5 transition-colors ${dailySmaEnabled ? "justify-end bg-amber-500" : "justify-start bg-zinc-700"}`}
                >
                  <span className="h-3 w-3 rounded-full bg-white" />
                </button>
              </label>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={dailyTotalLoadsData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="day"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
                angle={-35}
                textAnchor="end"
                height={48}
                interval={0}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: "#34d399" }}
              />
              <Bar dataKey="cargas" name={LOAD_METRIC_LABELS[dailyLoadMetric]} fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={20} />
              {dailySmaEnabled && <Line type="monotone" dataKey="sma1" name="SMA 1" stroke="#f59e0b" strokeWidth={2} dot={false} />}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
          </>
        )}

        {/* Variación del embudo por día */}
        {showWeekdayDistribution && (
          <>
            <div className="order-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-xs font-semibold text-zinc-200">{activityLabel} [distribucion por dia de la semana]</h4>
                <label className="inline-flex h-7 w-fit items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300">
                  <span>SMA</span>
                  <button
                    type="button"
                    aria-pressed={weekdayMessagesSmaEnabled}
                    onClick={() => setWeekdayMessagesSmaEnabled((v) => !v)}
                    className={`flex h-4 w-7 shrink-0 items-center overflow-hidden rounded-full border-0 p-0.5 transition-colors ${weekdayMessagesSmaEnabled ? "justify-end bg-cyan-500" : "justify-start bg-zinc-700"}`}
                  >
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </button>
                </label>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={weekdayMessagesChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={{ stroke: "#3f3f46" }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#facc15" }}
                  />
                  <Bar dataKey="mensajes" name={activityLabel} fill="#facc15" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  {weekdayMessagesSmaEnabled && <Line type="monotone" dataKey="sma1" name="SMA 1" stroke="#22d3ee" strokeWidth={2} dot={false} />}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="order-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-xs font-semibold text-zinc-200">Cargas totales [distribucion por dia de la semana]</h4>
                <label className="inline-flex h-7 w-fit items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300">
                  <span>SMA</span>
                  <button
                    type="button"
                    aria-pressed={weekdayLoadsSmaEnabled}
                    onClick={() => setWeekdayLoadsSmaEnabled((v) => !v)}
                    className={`flex h-4 w-7 shrink-0 items-center overflow-hidden rounded-full border-0 p-0.5 transition-colors ${weekdayLoadsSmaEnabled ? "justify-end bg-amber-500" : "justify-start bg-zinc-700"}`}
                  >
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </button>
                </label>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={weekdayLoadsChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={{ stroke: "#3f3f46" }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#34d399" }}
                  />
                  <Bar dataKey="cargas" name="Cargas totales" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  {weekdayLoadsSmaEnabled && <Line type="monotone" dataKey="sma1" name="SMA 1" stroke="#f59e0b" strokeWidth={2} dot={false} />}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        <div className="order-7 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-zinc-200">
            {isTodayRange ? "Variación horaria de porcentajes del embudo" : "Variación diaria de porcentajes del embudo"}
          </h4>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFunnelPctMenuOpen((v) => !v)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300 hover:bg-zinc-800"
            >
              Curvas %
              <svg className={`h-3 w-3 transition-transform ${funnelPctMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
            {funnelPctMenuOpen && (
              <div className="absolute right-0 top-8 z-20 w-52 rounded-lg border border-zinc-700 bg-zinc-900/95 p-2 shadow-xl">
                {channel === "whatsapp" && <button
                  type="button"
                  aria-pressed={funnelPctEnabled.inicio}
                  onClick={() => setFunnelPctEnabled((prev) => ({ ...prev, inicio: !prev.inicio }))}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-zinc-800/80 ${
                    funnelPctEnabled.inicio ? "text-emerald-300" : "text-zinc-300"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-3.5 w-3.5 shrink-0 rounded border ${
                      funnelPctEnabled.inicio
                        ? "border-emerald-400 bg-emerald-400"
                        : "border-zinc-600 bg-zinc-950"
                    }`}
                  />
                  % inicio de conversación
                </button>}
                <button
                  type="button"
                  aria-pressed={funnelPctEnabled.carga}
                  onClick={() => setFunnelPctEnabled((prev) => ({ ...prev, carga: !prev.carga }))}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-zinc-800/80 ${
                    funnelPctEnabled.carga ? "text-emerald-300" : "text-zinc-300"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-3.5 w-3.5 shrink-0 rounded border ${
                      funnelPctEnabled.carga
                        ? "border-emerald-400 bg-emerald-400"
                        : "border-zinc-600 bg-zinc-950"
                    }`}
                  />
                  % de carga
                </button>
                <button
                  type="button"
                  aria-pressed={funnelPctEnabled.recarga}
                  onClick={() => setFunnelPctEnabled((prev) => ({ ...prev, recarga: !prev.recarga }))}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-zinc-800/80 ${
                    funnelPctEnabled.recarga ? "text-emerald-300" : "text-zinc-300"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-3.5 w-3.5 shrink-0 rounded border ${
                      funnelPctEnabled.recarga
                        ? "border-emerald-400 bg-emerald-400"
                        : "border-zinc-600 bg-zinc-950"
                    }`}
                  />
                  % de recarga
                </button>
              </div>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dailyFunnelPctData} margin={{ top: 8, right: 18, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="funnelInicioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.26} />
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="funnelCargaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="funnelRecargaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e879f9" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#e879f9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="day"
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
              angle={isTodayRange ? 0 : -35}
              textAnchor={isTodayRange ? "middle" : "end"}
              height={isTodayRange ? 28 : 48}
              interval={isTodayRange ? 1 : 0}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              cursor={{ stroke: "#52525b", strokeDasharray: "4 4" }}
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11, boxShadow: "0 18px 36px rgba(0,0,0,0.35)" }}
              labelStyle={{ color: "#a1a1aa" }}
              labelFormatter={(v) => isTodayRange ? `${v}:00 hs` : `${v}`}
              formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: "#a1a1aa" }} />
            {channel === "whatsapp" && funnelPctEnabled.inicio && (
              <Area type="monotone" dataKey="pct_inicio" name="% inicio de conversación" stroke="#fbbf24" strokeWidth={2.4} fill="url(#funnelInicioGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#fde68a" }} connectNulls={false} />
            )}
            {funnelPctEnabled.carga && (
              <Line type="monotone" dataKey="pct_carga" name="% de carga" stroke="#38bdf8" strokeWidth={2.2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#bae6fd" }} connectNulls={false} />
            )}
            {funnelPctEnabled.recarga && (
              <Line type="monotone" dataKey="pct_recarga" name="% de recarga" stroke="#e879f9" strokeWidth={2.2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#f5d0fe" }} connectNulls={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/*  POR CAMPAA  */}
      {stats.byCampaign.length > 0 && (
        <div>
          <SectionTitle>Por campana</SectionTitle>
          <div className="mt-3">
            <TableCard title={`${activityLabel}, cargas e ingresos por campaña`}>
              <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ minWidth: 760 }}>
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">
                    <SortButton active={campaignSort.key === "name"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("name")} align="left">Campana</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-24">
                    <SortButton active={campaignSort.key === "mensajes"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("mensajes")}>{activityLabel}</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-14">
                    <SortButton active={campaignSort.key === "cargas"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("cargas")}>Cargas</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-24">
                    <SortButton active={campaignSort.key === "pct"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("pct")}>% de carga</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-28">
                    <SortButton active={campaignSort.key === "revenue"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("revenue")}>Ingresos</SortButton>
                  </th>
                  {parsedAdSpend > 0 && (
                    <>
                      <th className="text-center pb-2 font-medium w-20">
                        <SortButton active={campaignSort.key === "roas1"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("roas1")}>ROAS 1ra</SortButton>
                      </th>
                      <th className="text-center pb-2 font-medium w-20">
                        <SortButton active={campaignSort.key === "roasTotal"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("roasTotal")}>ROAS total</SortButton>
                      </th>
                    </>
                  )}
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {sortedCampaignRows.map((r) => {
                    const roas1 = parsedAdSpend > 0 ? r.firstRevenue / parsedAdSpend : 0;
                    const roasT = parsedAdSpend > 0 ? r.revenue / parsedAdSpend : 0;
                    return (
                      <tr key={r.campaign}>
                        <td className="py-1.5 text-zinc-300 truncate">{r.campaign}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.mensajes}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.cargas}</td>
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{statisticsRate(r.cargas, r.baseCargas)}</td>
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{formatCurrencyAmount(r.revenue, currency)}</td>
                        {parsedAdSpend > 0 && (
                          <>
                            <td className="py-1.5 text-center text-zinc-300 tabular-nums">{roas1.toFixed(2)}x</td>
                            <td className="py-1.5 text-center text-zinc-300 tabular-nums">{roasT.toFixed(2)}x</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </TableCard>
          </div>
        </div>
      )}

      {/*  POR LANDING  */}
      {stats.byLanding.length > 0 && (
        <div>
          <SectionTitle>Por landing</SectionTitle>
          <div className="mt-3">
            <TableCard title={`${activityLabel}, cargas e ingresos por landing`}>
              <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ minWidth: 760 }}>
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">
                    <SortButton active={landingSort.key === "name"} direction={landingSort.direction} onClick={() => toggleLandingSort("name")} align="left">Landing</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-24">
                    <SortButton active={landingSort.key === "mensajes"} direction={landingSort.direction} onClick={() => toggleLandingSort("mensajes")}>{activityLabel}</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-14">
                    <SortButton active={landingSort.key === "cargas"} direction={landingSort.direction} onClick={() => toggleLandingSort("cargas")}>Cargas</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-24">
                    <SortButton active={landingSort.key === "pct"} direction={landingSort.direction} onClick={() => toggleLandingSort("pct")}>% de carga</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-28">
                    <SortButton active={landingSort.key === "revenue"} direction={landingSort.direction} onClick={() => toggleLandingSort("revenue")}>Ingresos</SortButton>
                  </th>
                  {parsedAdSpend > 0 && (
                    <>
                      <th className="text-center pb-2 font-medium w-20">
                        <SortButton active={landingSort.key === "roas1"} direction={landingSort.direction} onClick={() => toggleLandingSort("roas1")}>ROAS 1ra</SortButton>
                      </th>
                      <th className="text-center pb-2 font-medium w-20">
                        <SortButton active={landingSort.key === "roasTotal"} direction={landingSort.direction} onClick={() => toggleLandingSort("roasTotal")}>ROAS total</SortButton>
                      </th>
                    </>
                  )}
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {sortedLandingRows.map((r) => {
                    const roas1 = parsedAdSpend > 0 ? r.firstRevenue / parsedAdSpend : 0;
                    const roasT = parsedAdSpend > 0 ? r.revenue / parsedAdSpend : 0;
                    return (
                      <tr key={r.landing}>
                        <td className="py-1.5 text-zinc-300 truncate">{r.landing}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.mensajes}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.cargas}</td>
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{statisticsRate(r.cargas, r.baseCargas)}</td>
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{formatCurrencyAmount(r.revenue, currency)}</td>
                        {parsedAdSpend > 0 && (
                          <>
                            <td className="py-1.5 text-center text-zinc-300 tabular-nums">{roas1.toFixed(2)}x</td>
                            <td className="py-1.5 text-center text-zinc-300 tabular-nums">{roasT.toFixed(2)}x</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </TableCard>
          </div>
        </div>
      )}

      {/*  TOP CONTACTOS  */}
      {visibleTopContacts.length > 0 && (
        <div>
          <SectionTitle>Top contactos por monto</SectionTitle>
          <div className="mt-3">
            <TableCard title={`Top ${topContactsLimit} jugadores`}>
              <div className="mb-3 flex items-center justify-end">
                <div className="inline-flex items-center gap-2 text-[11px] text-zinc-400">
                  <span>Mostrar</span>
                  <CustomSelect
                    value={String(topContactsLimit)}
                    options={TOP_CONTACT_LIMIT_OPTIONS.map((limit) => ({
                      value: String(limit),
                      label: `Top ${limit}`,
                    }))}
                    onChange={(nextValue) => setTopContactsLimit(Number(nextValue) as TopContactsLimit)}
                    className="w-24"
                    buttonClassName="h-7 px-2 text-[11px] text-zinc-200"
                    menuClassName="right-0"
                  />
                </div>
              </div>
              <table className="w-full text-[11px]">
                <thead><tr className="text-zinc-500">
                  <th className="text-center pb-2 font-medium w-6">#</th>
                  <th className="text-left pb-2 font-medium">Teléfono</th>
                  <th className="text-left pb-2 font-medium">Nombre</th>
                  <th className="text-left pb-2 font-medium">Gerencia</th>
                  <th className="text-center pb-2 font-medium w-16">Cargas</th>
                  <th className="text-center pb-2 font-medium w-28">Total</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {visibleTopContacts.map((c, i) => (
                    <tr key={`${c.phone}-${c.assigned_gerencia_label ?? i}`}>
                      <td className="py-1.5 text-center text-zinc-600">{i + 1}</td>
                      <td className="py-1.5 text-zinc-200 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span>{c.phone}</span>
                          <a
                            href={waLink(c.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md p-0.5 text-zinc-600 hover:text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                            title="WhatsApp"
                          >
                            <WaIcon className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="py-1.5 text-zinc-400">{[c.fn, c.ln].filter(Boolean).join(" ") || "-"}</td>
                      <td className="py-1.5 text-zinc-400">{c.assigned_gerencia_label || "-"}</td>
                      <td className="py-1.5 text-center text-zinc-400">{c.purchase_count}</td>
                      <td className="py-1.5 text-center text-emerald-400 font-mono font-semibold">{formatCurrencyAmount(c.total_valor, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
        </div>
      )}

      {showAssistant && (
      <button
        type="button"
        onClick={() => setAssistantOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-700/70 bg-emerald-900/90 text-emerald-200 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-800"
        title="Asistente IA de estadísticas"
        aria-label="Abrir asistente IA de estadísticas"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M5 20l1.5-3H19a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2z" />
        </svg>
      </button>
      )}
      {showAssistant && assistantOpen && (
        <div className="fixed bottom-20 right-6 z-40 w-[360px] max-w-[92vw] rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-zinc-100">Asistente IA de Estadísticas</p>
              <p className="text-[10px] text-zinc-500">Analiza tus métricas y sugiere optimizaciones en Meta Ads</p>
              <p className="mt-1 text-[10px] text-zinc-400">
                {assistantQuota
                  ? `Consultas este mes: ${assistantQuota.used}/${assistantQuota.limit}`
                  : "Consultas este mes: -/150"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
            >
              Cerrar
            </button>
          </div>
          <div className="max-h-[340px] space-y-2 overflow-y-auto px-3 py-3">
            {assistantMessages.length === 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2 text-[11px] text-zinc-400">
                Escribí una pregunta para analizar tus métricas.
              </div>
            )}
            {assistantMessages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[86%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
                    m.role === "user"
                      ? "border border-cyan-700/70 bg-cyan-900/35 text-cyan-100 rounded-br-md"
                      : "border border-emerald-800/70 bg-emerald-950/25 text-zinc-200 rounded-bl-md"
                  }`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    {m.role === "user" ? "Cliente" : "IA"}
                  </p>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
            {assistantLoading && (
              <div className="flex justify-start">
                <div className="max-w-[86%] rounded-2xl rounded-bl-md border border-emerald-800/70 bg-emerald-950/25 px-3 py-2 text-[11px] text-zinc-200">
                  Analizando métricas...
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2 border-t border-zinc-800 px-3 py-3">
            {assistantError && <p className="text-[10px] text-red-400">{assistantError}</p>}
            <textarea
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendAssistantQuestion();
                }
              }}
              placeholder="Ej: ¿Qué horario conviene priorizar y qué probar en Meta Ads esta semana?"
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setAssistantInput("Decime las 3 optimizaciones más importantes para mejorar % de carga en Meta Ads.")}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800"
              >
                Sugerir pregunta
              </button>
              <button
                type="button"
                onClick={() => { void sendAssistantQuestion(); }}
                disabled={assistantLoading || !assistantInput.trim()}
                className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-emerald-500 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
