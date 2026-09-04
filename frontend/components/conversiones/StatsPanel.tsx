"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ConversionJourneyStartRow,
  type FunnelContact,
  type ConversionRow,
} from "@/lib/conversionsDb";
import { adJourneyKey, computeCoreStats, computeJourneyStartStats, computeStatsTruthMetrics } from "@/lib/conversionStats";
import { formatCompactCurrency, formatCurrencyAmount, type ReportingCurrency } from "@/lib/currency";
import ArgentinaMap from "./ArgentinaMap";
import { supabase } from "@/lib/supabaseClient";
import CustomSelect from "@/components/ui/CustomSelect";
import {
  ComposedChart, BarChart, Area, Bar, Line,
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

function pct(num: number, den: number) {
  if (den === 0) return "0%";
  return `${((num / den) * 100).toFixed(1)}%`;
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 group relative">
      <p className="text-[11px] font-semibold text-zinc-400 mb-1 min-h-[2.5rem] leading-snug">{label}</p>
      <p className={`text-xl font-bold ${color} flex min-h-[2rem] items-baseline flex-wrap`}>
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
      {sub && <p className="text-[10px] font-semibold text-zinc-400 mt-1">{sub}</p>}
      {tooltip && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-lg border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 [transition-delay:0ms] group-hover:[transition-delay:1000ms] z-50">
          <p className="text-[10px] text-zinc-400 leading-relaxed">{tooltip}</p>
        </div>
      )}
    </div>
  );
}

type JourneyPathStep = {
  label: string;
  value: number;
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
    <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex min-w-[860px] items-center">
        {steps.map((step, index) => (
          <div key={`${step.label}-${index}`} className="flex flex-1 items-center">
            <div className="w-32 shrink-0 text-center">
              <p className="mx-auto min-h-[2rem] max-w-32 text-[11px] font-semibold leading-snug text-zinc-400">
                {step.label}
              </p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${step.color}`}>
                {step.value}
              </p>
            </div>
            {index < rates.length && (
              <div className="min-w-24 flex-1 px-2">
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

function fmtInt(value: number): string {
  return Math.round(value).toLocaleString("es-AR");
}

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

export default function StatsPanel({
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
}: {
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
}) {
  const [adSpend, setAdSpend] = useState<string>("");
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

  useEffect(() => {
    setAdSpend("");
  }, [currency]);

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
    const uniqueLeads = truth.uniqueLeads;
    const realLeadsLinkedToContact = truth.realLeadsLinkedToContact;
    const inferredLeadsFromContactPurchase = truth.inferredLeadsFromContactPurchase;
    const uniqueLeadsLinkedToContact = truth.uniqueLeadsLinkedToContact;
    const firstLoadPurchasers = truth.firstLoadPurchasers;
    const firstLoadPurchasersLinkedToLead = truth.firstLoadPurchasersLinkedToLead;
    const firstLoadPlayersAttributed = truth.firstLoadPlayersAttributed;
    const totalPurchases = truth.totalPurchases;
    const primera = truth.primera;
    const recurrente = truth.recurrente;
    const premium = truth.premium;
    const totalRevenue = truth.totalRevenue;
    const totalPurchaseCount = truth.totalPurchaseCount;
    const firstPurchaseRevenue = truth.firstPurchaseRevenue;
    const reachedRepeat = truth.reachedRepeat;
    const repeatPlayersReached = truth.repeatPlayersReached;
    const purchaseFirstCount = truth.purchaseFirstCount;
    const purchaseRepeatCount = truth.purchaseRepeatCount;
    const leads = uniqueLeads;

    const purchasers = truth.purchasers;
    const avgTicket = truth.avgTicket;
    const avgLoadsPerPlayer = truth.avgLoadsPerPlayer;
    const leadRepeatStats = computeLeadRepeatStats(conversions);
    const dominantLeadFrequencyBucket = leadRepeatStats.buckets.reduce<LeadFrequencyBucket | null>(
      (best, bucket) => !best || bucket.leads > best.leads ? bucket : best,
      null,
    );
    type SliceStats = {
      mensajes: number;
      cargas: number;
      revenue: number;
      firstRevenue: number;
    };
    const getSliceStats = (
      convSlice: ConversionRow[],
      contactsSlice: FunnelContact[],
      allConvSlice: ConversionRow[],
    ): SliceStats => {
      const slicedCore = computeCoreStats(convSlice, contactsSlice, allConvSlice, premiumThreshold);
      return {
        mensajes: slicedCore.adLeadJourneysLinkedToContact,
        cargas: slicedCore.adFirstPurchaseEventsAttributed,
        revenue: slicedCore.totalRevenue,
        firstRevenue: slicedCore.firstPurchaseEventRevenue,
      };
    };

    // By campaign (same formulas, filtered universe)
    const campaignKeys = new Set<string>([
      ...funnelContacts.map((c) => c.utm_campaign || "Sin campaña"),
      ...conversions.map((c) => c.utm_campaign || "Sin campaña"),
      ...allConversions.map((c) => c.utm_campaign || "Sin campaña"),
    ]);
    const byCampaign = [...campaignKeys]
      .map((campaign) => {
        const convSlice = conversions.filter((c) => (c.utm_campaign || "Sin campaña") === campaign);
        const contactsSlice = funnelContacts.filter((c) => (c.utm_campaign || "Sin campaña") === campaign);
        const allConvSlice = allConversions.filter((c) => (c.utm_campaign || "Sin campaña") === campaign);
        return { campaign, ...getSliceStats(convSlice, contactsSlice, allConvSlice) };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // By device (same formulas, filtered universe)
    const deviceKeys = new Set<string>([
      ...funnelContacts.map((c) => c.device_type || "Desconocido"),
      ...conversions.map((c) => c.device_type || "Desconocido"),
      ...allConversions.map((c) => c.device_type || "Desconocido"),
    ]);
    const byDevice = [...deviceKeys]
      .map((device) => {
        const convSlice = conversions.filter((c) => (c.device_type || "Desconocido") === device);
        const contactsSlice = funnelContacts.filter((c) => (c.device_type || "Desconocido") === device);
        const allConvSlice = allConversions.filter((c) => (c.device_type || "Desconocido") === device);
        return { device, ...getSliceStats(convSlice, contactsSlice, allConvSlice) };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // By landing (same formulas, filtered universe)
    const landingKeys = new Set<string>([
      ...funnelContacts.map((c) => c.landing_name || "Sin landing"),
      ...conversions.map((c) => c.landing_name || "Sin landing"),
      ...allConversions.map((c) => c.landing_name || "Sin landing"),
    ]);
    const byLanding = [...landingKeys]
      .map((landing) => {
        const convSlice = conversions.filter((c) => (c.landing_name || "Sin landing") === landing);
        const contactsSlice = funnelContacts.filter((c) => (c.landing_name || "Sin landing") === landing);
        const allConvSlice = allConversions.filter((c) => (c.landing_name || "Sin landing") === landing);
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
    for (const c of conversions) {
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
      const dates = conversions
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
    for (const c of conversions) {
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
      if (c.estado === "lead" || c.lead_event_id) entry.leads++;
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
      const d = new Date(c.created_at).getTime();
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
      leadRepeatStats,
      dominantLeadFrequencyBucket,
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
  }, [funnelContacts, conversions, allConversions, journeyStarts, premiumThreshold, dateRange]);

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
    for (const c of conversions) {
      if (!c.created_at) continue;
      const h = new Date(c.created_at).getHours();
      if (c.estado === "lead" || c.lead_event_id) byHour[h].leads += 1;
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
  }, [conversions, isTodayRange, currentHour]);
  const dailyMessagesLoadsData = useMemo(() => {
    const isFirstPurchase = (c: ConversionRow): boolean => {
      if ((c.purchase_event_id ?? "") === "") return false;
      if (c.purchase_type === "first") return true;
      if (c.purchase_type === "repeat") return false;
      return !(c.observaciones ?? "").includes("REPEAT");
    };
    if (isTodayRange) {
      const byHour = Array.from({ length: 24 }, (_, h) => ({ day: `${h}`, leads: 0, cargas: 0, cargas_first: 0 }));
      for (const c of conversions) {
        if (!c.created_at) continue;
        const h = new Date(c.created_at).getHours();
        if (c.estado === "lead" || c.lead_event_id) byHour[h].leads += 1;
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
    for (const c of conversions) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      const label = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      const row = byDay.get(key) ?? { day: label, leads: 0, cargas: 0, cargas_first: 0 };
      if (c.estado === "lead" || c.lead_event_id) row.leads += 1;
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
  }, [isTodayRange, stats.dailyData, conversions, currentHour]);
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
    for (const c of conversions) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const idx = (d.getDay() + 6) % 7;
      if (c.estado === "lead" || c.lead_event_id) rows[idx].mensajes += 1;
      if ((c.purchase_event_id ?? "") !== "") rows[idx].cargas += 1;
    }
    return rows;
  }, [conversions]);
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
    if (isTodayRange) {
      const result: { day: string; pct_inicio: number | null; pct_carga: number | null; pct_recarga: number | null }[] = [];
      for (let h = 0; h < 24; h++) {
        const isFutureHour = h > currentHour;
        const convSlice = conversions.filter((c) => {
          if (!c.created_at) return false;
          return new Date(c.created_at).getHours() === h;
        });
        const contactsSlice = funnelContacts.filter((c) => {
          if (!c.first_contact) return false;
          return new Date(c.first_contact).getHours() === h;
        });
        const allConvSlice = allConversions.filter((c) => {
          if (!c.created_at) return false;
          return new Date(c.created_at).getHours() === h;
        });
        const core = computeCoreStats(convSlice, contactsSlice, allConvSlice, premiumThreshold);
        const pctInicio = core.adContactJourneys > 0 ? (core.adLeadJourneysLinkedToContact / core.adContactJourneys) * 100 : 0;
        const pctCarga = core.adLeadJourneysLinkedToContact > 0 ? (core.adFirstPurchaseJourneysAttributed / core.adLeadJourneysLinkedToContact) * 100 : 0;
        const pctRecarga = core.adFirstPurchaseJourneysAttributed > 0 ? (core.adRepeatJourneysFromAttributedFirstInRange / core.adFirstPurchaseJourneysAttributed) * 100 : 0;
        result.push({
          day: `${h}`,
          pct_inicio: isFutureHour ? null : Number(pctInicio.toFixed(1)),
          pct_carga: isFutureHour ? null : Number(pctCarga.toFixed(1)),
          pct_recarga: isFutureHour ? null : Number(pctRecarga.toFixed(1)),
        });
      }
      return result;
    }

    return stats.dailyData.map((row) => {
      const dayStart = new Date(`${row.key}T00:00:00`);
      const dayEnd = new Date(`${row.key}T23:59:59.999`);
      const isFutureDay = dayStart.getTime() > todayEndTime;
      const convSlice = conversions.filter((c) => {
        const t = new Date(c.created_at).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      });
      const contactsSlice = funnelContacts.filter((c) => {
        const t = new Date(c.first_contact).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      });
      const allConvSlice = allConversions.filter((c) => {
        const t = new Date(c.created_at).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      });
      const core = computeCoreStats(convSlice, contactsSlice, allConvSlice, premiumThreshold);
      const pctInicio = core.adContactJourneys > 0 ? (core.adLeadJourneysLinkedToContact / core.adContactJourneys) * 100 : 0;
      const pctCarga = core.adLeadJourneysLinkedToContact > 0 ? (core.adFirstPurchaseJourneysAttributed / core.adLeadJourneysLinkedToContact) * 100 : 0;
      const pctRecarga = core.adFirstPurchaseJourneysAttributed > 0 ? (core.adRepeatJourneysFromAttributedFirstInRange / core.adFirstPurchaseJourneysAttributed) * 100 : 0;

      return {
        day: row.day,
        pct_inicio: isFutureDay ? null : Number(pctInicio.toFixed(1)),
        pct_carga: isFutureDay ? null : Number(pctCarga.toFixed(1)),
        pct_recarga: isFutureDay ? null : Number(pctRecarga.toFixed(1)),
      };
    });
  }, [conversions, funnelContacts, allConversions, premiumThreshold, isTodayRange, currentHour, stats.dailyData, todayEndTime]);

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
  const sortedCampaignRows = useMemo(() => sortRows(stats.byCampaign, campaignSort), [stats.byCampaign, campaignSort, parsedAdSpend]);
  const sortedLandingRows = useMemo(() => sortRows(stats.byLanding, landingSort), [stats.byLanding, landingSort, parsedAdSpend]);
  const sourceContext = sourcePlatformFilter === "landing"
    ? "landing"
    : sourcePlatformFilter === "whatsapp_cloud_api"
      ? "whatsapp_cloud_api"
      : "all";
  const showJourneyStartMetrics = sourceContext !== "all";
  const startSummaryLabel = sourceContext === "landing"
    ? "Visitas unicas"
    : "Chats iniciados";
  const startSummaryTooltip = sourceContext === "landing"
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
  const startToContactLabel = sourceContext === "landing"
    ? "Porcentaje de conversion de la landing"
    : "Porcentaje de conversion de WhatsApp API";
  const startToContactTooltip = sourceContext === "landing"
    ? "Porcentaje de clientes que luego de abrir la landing page tocan el CTA. Se calcula como Contactos / visitas unicas."
    : "Porcentaje de clientes que luego de iniciar un chat en WhatsApp Cloud API tocan el CTA del mensaje de bienvenida. Se calcula como Contactos / chats iniciados.";
  const journeyPathSteps = useMemo<JourneyPathStep[]>(() => [
    {
      label: startSummaryLabel,
      value: stats.journeyStarts,
      color: "text-emerald-300",
    },
    {
      label: "Clicks en el CTA",
      value: stats.uniqueContacts,
      color: "text-zinc-100",
    },
    {
      label: "Mensajes recibidos",
      value: stats.uniqueLeadsLinkedToContact,
      color: "text-amber-300",
    },
    {
      label: "Primeras cargas",
      value: stats.purchaseFirstCount,
      color: "text-sky-300",
    },
    {
      label: "Cargas -> recargas del periodo",
      value: stats.repeatEventsFromFirstInRange,
      color: "text-fuchsia-300",
    },
  ], [
    startSummaryLabel,
    stats.journeyStarts,
    stats.purchaseFirstCount,
    stats.repeatEventsFromFirstInRange,
    stats.uniqueContacts,
    stats.uniqueLeadsLinkedToContact,
  ]);
  const journeyPathRates = useMemo(() => [
    pct(stats.uniqueContacts, stats.journeyStarts),
    pct(stats.uniqueLeadsLinkedToContact, stats.uniqueContacts),
    pct(stats.purchaseFirstCount, stats.uniqueLeadsLinkedToContact),
    pct(stats.repeatEventsFromFirstInRange, stats.purchaseFirstCount),
  ], [
    stats.journeyStarts,
    stats.purchaseFirstCount,
    stats.repeatEventsFromFirstInRange,
    stats.uniqueContacts,
    stats.uniqueLeadsLinkedToContact,
  ]);

  const assistantContext = useMemo(() => ({
    isTodayRange,
    currency,
    summary: {
      clicks_cta: stats.uniqueContacts,
      mensajes_recibidos: stats.uniqueLeadsLinkedToContact,
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
    funnel_pct: {
      inicio_conversacion: stats.uniqueContacts > 0 ? Number(((stats.uniqueLeadsLinkedToContact / stats.uniqueContacts) * 100).toFixed(1)) : 0,
      carga: stats.uniqueLeadsLinkedToContact > 0 ? Number(((stats.firstLoadPurchasersLinkedToLead / stats.uniqueLeadsLinkedToContact) * 100).toFixed(1)) : 0,
      recarga: stats.firstLoadPurchasersLinkedToLead > 0 ? Number(((stats.repeatFromFirstInRange / stats.firstLoadPurchasersLinkedToLead) * 100).toFixed(1)) : 0,
    },
    lead_frequency: {
      total_leads: stats.leadRepeatStats.totalLeads,
      unique_phones: stats.leadRepeatStats.uniquePhones,
      first_leads: stats.leadRepeatStats.firstLeads,
      repeat_leads: stats.leadRepeatStats.repeatLeads,
      repeat_pct: Number(stats.leadRepeatStats.repeatPct.toFixed(1)),
      golondrina_phones: stats.leadRepeatStats.golondrinaPhones,
      golondrina_pct: Number(stats.leadRepeatStats.golondrinaPct.toFixed(1)),
      buckets: stats.leadRepeatStats.buckets.map((bucket) => ({
        bucket: bucket.label,
        phones: bucket.phones,
        leads: bucket.leads,
        repeat_leads: bucket.repeatLeads,
      })),
    },
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
      by_landing_tag_lead_frequency_top5: stats.leadRepeatStats.byLandingTag.slice(0, 5),
    },
  }), [isTodayRange, currency, stats, hourlyMessagesLoadsData, dailyMessagesLoadsData, dailyFunnelPctData]);

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
        <div className={`mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 ${showJourneyStartMetrics ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}>
          {showJourneyStartMetrics && (
            <KpiCard
              label={startSummaryLabel}
              value={stats.journeyStarts}
              color="text-emerald-300"
              tooltip={startSummaryTooltip}
            />
          )}
          <KpiCard
            label={contactSummaryLabel}
            value={stats.uniqueContacts}
            tooltip={contactSummaryTooltip}
          />
          <KpiCard
            label="Mensajes recibidos"
            value={stats.uniqueLeadsLinkedToContact}
            color="text-amber-300"
            tooltip={
              stats.inferredLeadsFromContactPurchase > 0
                ? `Eventos Lead vinculados al recorrido publicitario. Hay ${stats.inferredLeadsFromContactPurchase} recorridos inferidos por carga sin Lead.`
                : "Eventos Lead vinculados al recorrido de la landing."
            }
          />
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
            value={stats.repeatEventsFromFirstInRange}
            sub={`${stats.repeatPlayersFromFirstInRange} ${stats.repeatPlayersFromFirstInRange === 1 ? "jugador" : "jugadores"}`}
            color="text-fuchsia-300"
            tooltip="Eventos repeat de jugadores que tambien tuvieron un evento first en el mismo periodo y filtros."
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

      {/*  EMBUDO DE CONVERSIN  */}
      <div>
        <SectionTitle>Embudo de conversión</SectionTitle>
        <div className={`mt-3 grid grid-cols-1 gap-3 ${showJourneyStartMetrics ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`}>
          {showJourneyStartMetrics && (
            <KpiCard
              label={startToContactLabel}
              value={pct(stats.uniqueContacts, stats.journeyStarts)}
              sub={`${stats.uniqueContacts} de ${stats.journeyStarts} recorridos`}
              color="text-emerald-400"
              tooltip={startToContactTooltip}
            />
          )}
          <KpiCard
            label="Porcentaje de inicio de conversación"
            value={pct(stats.uniqueLeadsLinkedToContact, stats.uniqueContacts)}
            sub={`${stats.uniqueLeadsLinkedToContact} de ${stats.uniqueContacts} recorridos`}
            color="text-amber-400"
            tooltip="Porcentaje de recorridos con Contact que tambien tuvieron Lead."
          />
          <KpiCard
            label="Porcentaje de carga"
            value={pct(stats.firstLoadPurchasersLinkedToLead, stats.uniqueLeadsLinkedToContact)}
            sub={`${stats.firstLoadPurchasersLinkedToLead} de ${stats.uniqueLeadsLinkedToContact} recorridos`}
            color="text-sky-400"
            tooltip="Porcentaje de recorridos con Lead que tambien tuvieron Purchase first."
          />
          <KpiCard
            label="Porcentaje de recarga"
            value={pct(stats.repeatFromFirstInRange, stats.firstLoadPurchasersLinkedToLead)}
            sub={`${stats.repeatFromFirstInRange} de ${stats.firstLoadPurchasersLinkedToLead} recorridos`}
            color="text-violet-400"
            tooltip="Porcentaje de recorridos con first que tambien tuvieron repeat dentro del mismo periodo y filtros."
          />
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
              stats.revenueTrend && stats.revenuePctChange !== undefined
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
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <label className="text-[11px] text-zinc-500 whitespace-nowrap">Importe gastado ({currency})</label>
          <div className="relative max-w-[200px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">{currency}</span>
            <input
              type="text"
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-11 pr-3 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-zinc-500"
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

      {stats.leadRepeatStats.totalLeads > 0 && (
        <div>
          <SectionTitle>Frecuencia de leads por cliente</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Leads totales"
              value={stats.leadRepeatStats.totalLeads}
              color="text-amber-300"
              tooltip="Mensajes recibidos que entran en los filtros actuales."
            />
            <KpiCard
              label="Leads nuevos"
              value={stats.leadRepeatStats.firstLeads}
              color="text-emerald-300"
              tooltip="Primer mensaje recibido de cada cliente dentro del periodo y filtros seleccionados."
            />
            <KpiCard
              label="Leads repetidos"
              value={stats.leadRepeatStats.repeatLeads}
              sub={`${stats.leadRepeatStats.repeatPct.toFixed(1)}%`}
              color="text-fuchsia-300"
              tooltip="Mensajes de clientes que ya habian escrito antes dentro del periodo y filtros seleccionados."
            />
            <KpiCard
              label="Clientes repetidos"
              value={stats.leadRepeatStats.golondrinaPhones}
              sub={`${stats.leadRepeatStats.golondrinaPct.toFixed(1)}%`}
              color="text-sky-300"
              tooltip="Clientes que escribieron dos o mas veces dentro del periodo y filtros seleccionados."
            />
            <KpiCard
              label="Frecuencia principal"
              value={stats.dominantLeadFrequencyBucket?.label ?? "-"}
              sub={`${fmtInt(stats.dominantLeadFrequencyBucket?.leads ?? 0)} leads`}
              tooltip="El grupo que concentra mayor cantidad de leads."
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(460px,0.75fr)]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h4 className="text-xs font-semibold text-zinc-200">
                  Veces que escribio el mismo cliente
                </h4>
                <p className="text-[10px] text-zinc-500">
                  Horizontal: leads recibidos · Vertical: frecuencia por cliente
                </p>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(220, stats.leadRepeatStats.buckets.length * 42)}>
                <BarChart layout="vertical" data={stats.leadRepeatStats.buckets} margin={{ top: 8, right: 28, bottom: 24, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={{ stroke: "#3f3f46" }}
                    tickLine={false}
                    allowDecimals={false}
                    label={{ value: "Leads recibidos", position: "insideBottom", offset: -12, fill: "#71717a", fontSize: 10 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(82,82,91,0.18)" }}
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11, boxShadow: "0 18px 36px rgba(0,0,0,0.35)" }}
                    labelStyle={{ color: "#a1a1aa" }}
                    formatter={(value) => [`${fmtInt(Number(value) || 0)} leads`, "Total"]}
                    labelFormatter={(label) => `Clientes que escribieron ${label}`}
                  />
                  <Bar dataKey="leads" name="Leads recibidos" fill="#f59e0b" radius={[0, 5, 5, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {stats.leadRepeatStats.byLandingTag.length > 0 && (
              <TableCard title="Resumen por landing tag">
                <table className="w-full text-[11px]" style={{ minWidth: 620 }}>
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="pb-2 text-left font-medium">Tag</th>
                      <th className="pb-2 text-center font-medium">Leads</th>
                      <th className="pb-2 text-center font-medium">Clientes</th>
                      <th className="pb-2 text-center font-medium">Nuevos</th>
                      <th className="pb-2 text-center font-medium">Repetidos</th>
                      <th className="pb-2 text-center font-medium">% repetidos</th>
                      <th className="pb-2 text-center font-medium">Clientes repetidos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {stats.leadRepeatStats.byLandingTag.slice(0, 12).map((row) => (
                      <tr key={row.landingTag}>
                        <td className="py-1.5 font-mono text-zinc-300">{row.landingTag}</td>
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{fmtInt(row.totalLeads)}</td>
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{fmtInt(row.uniquePhones)}</td>
                        <td className="py-1.5 text-center text-emerald-300 tabular-nums">{fmtInt(row.firstLeads)}</td>
                        <td className="py-1.5 text-center text-fuchsia-300 tabular-nums">{fmtInt(row.repeatLeads)}</td>
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{row.repeatPct.toFixed(1)}%</td>
                        <td className="py-1.5 text-center text-sky-300 tabular-nums">
                          {fmtInt(row.golondrinaPhones)}
                          <span className="ml-1 text-zinc-500">({row.golondrinaPct.toFixed(1)}%)</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableCard>
            )}
          </div>
        </div>
      )}

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
            <h4 className="text-xs font-semibold text-zinc-200">Mensajes recibidos [distribucion por hora]</h4>
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
              <Bar dataKey="mensajes" name="Mensajes recibidos" fill="#facc15" radius={[3, 3, 0, 0]} maxBarSize={20} />
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
            <h4 className="text-xs font-semibold text-zinc-200">Mensajes recibidos [distribucion por dia]</h4>
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
              <Bar dataKey="mensajes" name="Mensajes recibidos" fill="#facc15" radius={[3, 3, 0, 0]} maxBarSize={20} />
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
                <h4 className="text-xs font-semibold text-zinc-200">Mensajes recibidos [distribucion por dia de la semana]</h4>
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
                  <Bar dataKey="mensajes" name="Mensajes recibidos" fill="#facc15" radius={[3, 3, 0, 0]} maxBarSize={24} />
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
                <button
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
                </button>
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
            {funnelPctEnabled.inicio && (
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
            <TableCard title="Mensajes recibidos, cargas e ingresos por campana">
              <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ minWidth: 760 }}>
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">
                    <SortButton active={campaignSort.key === "name"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("name")} align="left">Campana</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-24">
                    <SortButton active={campaignSort.key === "mensajes"} direction={campaignSort.direction} onClick={() => toggleCampaignSort("mensajes")}>Mensajes recibidos</SortButton>
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
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{pct(r.cargas, r.mensajes || 1)}</td>
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
            <TableCard title="Mensajes recibidos, cargas e ingresos por landing">
              <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ minWidth: 760 }}>
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">
                    <SortButton active={landingSort.key === "name"} direction={landingSort.direction} onClick={() => toggleLandingSort("name")} align="left">Landing</SortButton>
                  </th>
                  <th className="text-center pb-2 font-medium w-24">
                    <SortButton active={landingSort.key === "mensajes"} direction={landingSort.direction} onClick={() => toggleLandingSort("mensajes")}>Mensajes recibidos</SortButton>
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
                        <td className="py-1.5 text-center text-zinc-400 tabular-nums">{pct(r.cargas, r.mensajes || 1)}</td>
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
