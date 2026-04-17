"use client";

import { useMemo, useState } from "react";
import {
  type FunnelContact,
  type ConversionRow,
} from "@/lib/conversionsDb";
import { computeCoreStats } from "@/lib/conversionStats";
import ArgentinaMap from "./ArgentinaMap";
import {
  ComposedChart, Bar, LineChart, Line,
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

function formatCurrency(n: number) {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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
}: {
  trend: "up" | "down";
  pctChange: number;
  revenueToday: number;
  revenueYesterday: number;
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
      ? `Ayer no hubo ingresos. Hoy: $${revenueToday.toLocaleString("es-AR")}.`
      : isUp
        ? `Ingresos de hoy ($${revenueToday.toLocaleString("es-AR")}) son ${pctStr} mayores que ayer ($${revenueYesterday.toLocaleString("es-AR")}).`
        : `Ingresos de hoy ($${revenueToday.toLocaleString("es-AR")}) son ${pctStr} menores que ayer ($${revenueYesterday.toLocaleString("es-AR")}).`;

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
  trendInfo?: { trend: "up" | "down"; pctChange: number; revenueToday: number; revenueYesterday: number };
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 group relative">
      <p className="text-[11px] text-zinc-500 mb-1 min-h-[2.5rem] leading-snug">{label}</p>
      <p className={`text-xl font-bold ${color} flex min-h-[2rem] items-baseline flex-wrap`}>
        {value}
        {trendInfo && (
          <RevenueTrendBadge
            trend={trendInfo.trend}
            pctChange={trendInfo.pctChange}
            revenueToday={trendInfo.revenueToday}
            revenueYesterday={trendInfo.revenueYesterday}
          />
        )}
      </p>
      {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
      {tooltip && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-lg border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
          <p className="text-[10px] text-zinc-400 leading-relaxed">{tooltip}</p>
        </div>
      )}
    </div>
  );
}

function BarCell({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${w}%` }} />
      </div>
      <span className="text-[10px] text-zinc-400 w-16 text-right font-mono">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function PctBar({ num, den, color = "bg-sky-500" }: { num: number; den: number; color?: string }) {
  const w = den > 0 ? Math.round((num / den) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-[10px] text-zinc-400 w-10 text-right">{pct(num, den)}</span>
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
      {children}
    </div>
  );
}

export default function StatsPanel({
  funnelContacts,
  conversions,
  allConversions,
  premiumThreshold,
  dateRange,
  compactTooltips = false,
}: {
  funnelContacts: FunnelContact[];
  conversions: ConversionRow[];
  allConversions: ConversionRow[];
  premiumThreshold: number;
  dateRange?: { start: Date; end: Date } | null;
  compactTooltips?: boolean;
}) {
  const [adSpend, setAdSpend] = useState<string>("");
  const [smaMenuOpen, setSmaMenuOpen] = useState(false);
  const [smaEnabled, setSmaEnabled] = useState<{ 1: boolean; 3: boolean; 5: boolean }>({
    1: false,
    3: true,
    5: false,
  });
  const [dailyLoadsMenuOpen, setDailyLoadsMenuOpen] = useState(false);
  const [dailyLoadsEnabled, setDailyLoadsEnabled] = useState<{ first: boolean; total: boolean }>({
    first: false,
    total: true,
  });

  const stats = useMemo(() => {
    const core = computeCoreStats(conversions, funnelContacts, allConversions, premiumThreshold);
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
    const uniqueContacts = core.uniqueContacts;
    const uniqueLeads = core.uniqueLeads;
    const uniqueLeadsLinkedToContact = core.uniqueLeadsLinkedToContact;
    const firstLoadPurchasers = core.firstLoadPurchasers;
    const firstLoadPurchasersLinkedToLead = core.firstLoadPurchasersLinkedToLead;
    const totalPurchases = core.totalPurchases;
    const primera = core.firstLoadPlayers;
    const recurrente = core.repeatPlayers;
    const premium = core.premiumPlayers;
    const totalRevenue = core.totalRevenue;
    const totalPurchaseCount = core.totalPurchaseCount;
    const firstPurchaseRevenue = core.firstPurchaseRevenue;
    const reachedRepeat = core.purchaseRepeat;
    const purchaseFirstCount = conversions.filter(isFirstPurchase).length;
    const purchaseRepeatCount = conversions.filter(isRepeatPurchase).length;
    const leads = uniqueLeads;

    const purchasers = firstLoadPurchasers;
    const avgTicket = totalPurchaseCount > 0 ? totalRevenue / totalPurchaseCount : 0;
    const avgLoadsPerPlayer = purchasers > 0 ? totalPurchaseCount / purchasers : 0;
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
        mensajes: slicedCore.uniqueLeadsLinkedToContact,
        cargas: slicedCore.firstLoadPurchasersLinkedToLead,
        revenue: slicedCore.totalRevenue,
        firstRevenue: slicedCore.firstPurchaseRevenue,
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
      .sort((a, b) => b.total_valor - a.total_valor)
      .slice(0, 10);

    // Hourly distribution of purchases
    const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}`, cargas: 0 }));
    for (const c of conversions) {
      if ((c.purchase_event_id ?? "") !== "" && c.created_at) {
        const h = new Date(c.created_at).getHours();
        hourlyBuckets[h].cargas++;
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
      const spanDays = Math.ceil((chartEnd.getTime() - chartStart.getTime()) / MS_PER_DAY) + 1;
      if (spanDays < MIN_DAYS) {
        chartStart = new Date(chartEnd);
        chartStart.setDate(chartStart.getDate() - MIN_DAYS + 1);
        chartStart.setHours(0, 0, 0, 0);
      }
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

    const dailyMap = new Map<string, { day: string; leads: number; cargas: number }>();
    for (const c of conversions) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const dayKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      const entry = dailyMap.get(dayKey) ?? {
        day: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        leads: 0,
        cargas: 0,
      };
      if (c.estado === "lead" || c.lead_event_id) entry.leads++;
      if ((c.purchase_event_id ?? "") !== "") entry.cargas++;
      dailyMap.set(dayKey, entry);
    }

    const dailyData: { day: string; leads: number; cargas: number }[] = [];
    const iter = new Date(chartStart);
    while (iter <= chartEnd) {
      const dayKey = `${iter.getFullYear()}-${(iter.getMonth() + 1).toString().padStart(2, "0")}-${iter.getDate().toString().padStart(2, "0")}`;
      const label = `${iter.getDate().toString().padStart(2, "0")}/${(iter.getMonth() + 1).toString().padStart(2, "0")}`;
      const entry = dailyMap.get(dayKey) ?? { day: label, leads: 0, cargas: 0 };
      dailyData.push({ ...entry, day: label });
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
      uniqueContacts,
      uniqueLeads,
      uniqueLeadsLinkedToContact,
      firstLoadPurchasers,
      firstLoadPurchasersLinkedToLead,
      totalPurchases,
      leads,
      primera,
      recurrente,
      premium,
      purchasers,
      reachedRepeat,
      purchaseFirstCount,
      purchaseRepeatCount,
      repeatFromFirstInRange: core.repeatFromFirstInRange,
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
  }, [funnelContacts, conversions, allConversions, premiumThreshold, dateRange]);

  const parsedAdSpend = parseFloat(adSpend.replace(/\D/g, "")) || 0;
  const roasFirstPurchase = parsedAdSpend > 0 ? stats.firstPurchaseRevenue / parsedAdSpend : 0;
  const roasTotal = parsedAdSpend > 0 ? stats.totalRevenue / parsedAdSpend : 0;
  const isTodayRange = useMemo(() => {
    if (!dateRange) return false;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    return dateRange.start.getTime() === startToday && dateRange.end.getTime() === endToday;
  }, [dateRange]);
  const hourlyChartData = useMemo(() => {
    const getSma = (idx: number, window: 1 | 3 | 5) => {
      const start = Math.max(0, idx - window + 1);
      let sum = 0;
      let count = 0;
      for (let i = start; i <= idx; i++) {
        sum += stats.hourlyBuckets[i]?.cargas ?? 0;
        count += 1;
      }
      return count > 0 ? Number((sum / count).toFixed(2)) : 0;
    };
    return stats.hourlyBuckets.map((row, idx) => ({
      ...row,
      sma1: getSma(idx, 1),
      sma3: getSma(idx, 3),
      sma5: getSma(idx, 5),
    }));
  }, [stats.hourlyBuckets]);
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
      return byHour;
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
  }, [isTodayRange, stats.dailyData, conversions]);

  const maxCampaignRev = Math.max(...stats.byCampaign.map((r) => r.revenue), 1);
  const maxDeviceRev = Math.max(...stats.byDevice.map((r) => r.revenue), 1);
  const maxLandingRev = Math.max(...stats.byLanding.map((r) => r.revenue), 1);

  return (
    <div className="space-y-8">

      {/*  RESUMEN GENERAL  */}
      <div>
        <SectionTitle>Resumen general</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8">
          <KpiCard
            label="Clicks en el boton de la landing"
            value={stats.uniqueContacts}
            tooltip="Cantidad de jugadores que hicieron clic en el botón de contacto de la landing page (CTA)."
          />
          <KpiCard
            label="Mensajes recibidos"
            value={stats.uniqueLeadsLinkedToContact}
            color="text-amber-300"
            tooltip="Cantidad de jugadores que, después de tocar el botón de la landing, decidieron enviar un mensaje."
          />
          <KpiCard
            label="Jugadores que cargaron"
            value={stats.firstLoadPurchasersLinkedToLead}
            color="text-sky-300"
            tooltip="Catidad de jugadores que, después de enviar un mensaje, decidieron realizar una carga."
          />
          <KpiCard
            label="Jugadores que recargaron"
            value={stats.repeatFromFirstInRange}
            color="text-violet-300"
            tooltip="Cantidad de jugadores que, después de realizar una primera carga, decidieron realizar otra carga más."
          />
          <KpiCard
            label="Cant. de primeras cargas"
            value={stats.purchaseFirstCount}
            color="text-sky-300"
            tooltip="Cantidad de primeras cargas (first) registradas para el rango de fecha seleccionado."
          />
          <KpiCard
            label="Cant. de recargas"
            value={stats.purchaseRepeatCount}
            color="text-violet-300"
            tooltip="Cantidad de recargas (repeat) registradas para el rango de fecha seleccionado."
          />
          <KpiCard
            label="Total de cargas"
            value={stats.totalPurchases}
            color="text-sky-400"
            tooltip="Cantidad de primeras cargas (first) y de recargas (repeat) registradas para el rango de fecha seleccionado."
          />
          <KpiCard
            label="Retención"
            value={stats.retencionActiva30d}
            color="text-emerald-400"
            tooltip={compactTooltips ? "Jugadores que hicieron al menos 4 cargas en los últimos 30 días y cuya primera carga fue hace al menos 7 días." : "Jugadores que hicieron al menos 4 cargas en los últimos 30 días y cuya primera carga fue hace al menos 7 días. Métrica calculada siempre sobre los últimos 30 días, sin aplicar el filtro de fechas."}
          />
        </div>
      </div>

      {/*  EMBUDO DE CONVERSIN  */}
      <div>
        <SectionTitle>Embudo de conversión</SectionTitle>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Porcentaje de inicio de conversación"
            value={pct(stats.uniqueLeadsLinkedToContact, stats.uniqueContacts)}
            sub={`${stats.uniqueLeadsLinkedToContact} de ${stats.uniqueContacts} contactos`}
            color="text-amber-400"
            tooltip="Porcentaje de jugadores que, después de tocar el botón de la landing, decidieron enviar un mensaje."
          />
          <KpiCard
            label="Porcentaje de carga"
            value={pct(stats.firstLoadPurchasersLinkedToLead, stats.uniqueLeadsLinkedToContact)}
            sub={`${stats.firstLoadPurchasersLinkedToLead} de ${stats.uniqueLeadsLinkedToContact} leads`}
            color="text-sky-400"
            tooltip="Porcentaje de jugadores que, después de enviar un mensaje, decidieron realizar una carga."
          />
          <KpiCard
            label="Porcentaje de recarga"
            value={pct(stats.repeatFromFirstInRange, stats.firstLoadPurchasersLinkedToLead)}
            sub={`${stats.repeatFromFirstInRange} de ${stats.firstLoadPurchasersLinkedToLead} jugadores`}
            color="text-violet-400"
            tooltip="Porcentaje de jugadores que, después de realizar una primera carga, decidieron realizar otra carga más."
          />
        </div>
      </div>

      {/*  INGRESOS  */}
      <div>
        <SectionTitle>Ingresos</SectionTitle>
        <div className={`mt-3 grid grid-cols-2 gap-3 ${parsedAdSpend > 0 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-3"}`}>
          <KpiCard
            label="Total cargado"
            value={formatCurrency(stats.totalRevenue)}
            color="text-emerald-400"
            trendInfo={
              stats.revenueTrend && stats.revenuePctChange !== undefined
                ? {
                    trend: stats.revenueTrend,
                    pctChange: stats.revenuePctChange,
                    revenueToday: stats.revenueToday,
                    revenueYesterday: stats.revenueYesterday,
                  }
                : undefined
            }
            tooltip={compactTooltips ? "Suma total del valor de todas las cargas." : "Suma total del valor de todas las cargas realizadas por todos los contactos."}
          />
          <KpiCard
            label="Carga promedio"
            value={formatCurrency(stats.avgTicket)}
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
                sub={formatCurrency(stats.firstPurchaseRevenue)}
                color="text-sky-400"
                tooltip={compactTooltips ? "Retorno sobre la inversión publicitaria (solo primeras cargas)." : "Retorno sobre la inversión publicitaria considerando sólo ingresos de primeras cargas (sin recargas). Se calcula: ingresos primera carga / importe gastado."}
              />
              <KpiCard
                label="ROAS total"
                value={`${roasTotal.toFixed(2)}x`}
                sub={formatCurrency(stats.totalRevenue)}
                color="text-amber-400"
                tooltip={compactTooltips ? "Retorno sobre la inversión publicitaria total." : "Retorno sobre la inversión publicitaria total. Se calcula: ingresos totales (incluyendo recargas) / importe gastado."}
              />
            </>
          )}
        </div>

        {/* Ad spend input */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <label className="text-[11px] text-zinc-500 whitespace-nowrap">Importe gastado</label>
          <div className="relative max-w-[200px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-600">$</span>
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-6 pr-3 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-zinc-500"
            />
          </div>
          <p className="text-[10px] text-zinc-600">Ingresá el gasto publicitario para calcular ROAS.</p>
        </div>
      </div>

      {/*  MAPA DE ARGENTINA  */}
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

      {/*  GRÁFICOS TEMPORALES  */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cargas por hora */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-zinc-200">Distribución de cargas por hora del día</h4>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSmaMenuOpen((v) => !v)}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300 hover:bg-zinc-800"
              >
                SMA
                <svg className={`h-3 w-3 transition-transform ${smaMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {smaMenuOpen && (
                <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-zinc-700 bg-zinc-900/95 p-2 shadow-xl">
                  {[1, 3, 5].map((w) => {
                    const key = w as 1 | 3 | 5;
                    const color = key === 1 ? "bg-sky-400" : key === 3 ? "bg-fuchsia-400" : "bg-amber-400";
                    return (
                      <label key={w} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800/80">
                        <input
                          type="checkbox"
                          checked={smaEnabled[key]}
                          onChange={(e) => setSmaEnabled((prev) => ({ ...prev, [key]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                        />
                        <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                        {`SMA ${w}`}
                      </label>
                    );
                  })}
                </div>
              )}
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
              <Bar dataKey="cargas" name="Cargas" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={20} />
              {smaEnabled[1] && <Line type="monotone" dataKey="sma1" name="SMA 1" stroke="#38bdf8" strokeWidth={2} dot={false} />}
              {smaEnabled[3] && <Line type="monotone" dataKey="sma3" name="SMA 3" stroke="#e879f9" strokeWidth={2} dot={false} />}
              {smaEnabled[5] && <Line type="monotone" dataKey="sma5" name="SMA 5" stroke="#f59e0b" strokeWidth={2} dot={false} />}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Leads vs Cargas por día */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-zinc-200">
              {isTodayRange ? "Mensajes recibidos y total de cargas por hora" : "Mensajes recibidos y total de cargas por día"}
            </h4>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDailyLoadsMenuOpen((v) => !v)}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300 hover:bg-zinc-800"
              >
                Cargas
                <svg className={`h-3 w-3 transition-transform ${dailyLoadsMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {dailyLoadsMenuOpen && (
                <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-zinc-700 bg-zinc-900/95 p-2 shadow-xl">
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800/80">
                    <input
                      type="checkbox"
                      checked={dailyLoadsEnabled.first}
                      onChange={(e) => setDailyLoadsEnabled((prev) => ({ ...prev, first: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                    />
                    Primeras cargas (first)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800/80">
                    <input
                      type="checkbox"
                      checked={dailyLoadsEnabled.total}
                      onChange={(e) => setDailyLoadsEnabled((prev) => ({ ...prev, total: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                    />
                    Total de cargas
                  </label>
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyMessagesLoadsData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
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
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
                labelFormatter={(v) => isTodayRange ? `${v}:00 hs` : `${v}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "#a1a1aa" }}
              />
              <Line type="monotone" dataKey="leads" name="Mensajes recibidos" stroke="#fbbf24" strokeWidth={2} dot={{ r: 2, fill: "#fbbf24" }} activeDot={{ r: 4 }} />
              {dailyLoadsEnabled.total && (
                <Line type="monotone" dataKey="cargas" name="Cargas totales" stroke="#34d399" strokeWidth={2} dot={{ r: 2, fill: "#34d399" }} activeDot={{ r: 4 }} />
              )}
              {dailyLoadsEnabled.first && (
                <Line type="monotone" dataKey="cargas_first" name="Primeras cargas (first)" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2, fill: "#38bdf8" }} activeDot={{ r: 4 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/*  POR CAMPAA  */}
      {stats.byCampaign.length > 0 && (
        <div>
          <SectionTitle>Por campaña</SectionTitle>
          <div className="mt-3">
            <TableCard title="Mensajes recibidos, cargas e ingresos por campaña">
              <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ minWidth: 760 }}>
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Campaña</th>
                  <th className="text-center pb-2 font-medium w-24">Mensajes recibidos</th>
                  <th className="text-center pb-2 font-medium w-14">Cargas</th>
                  <th className="text-center pb-2 font-medium" style={{ width: 180 }}>% de carga</th>
                  <th className="text-center pb-2 font-medium" style={{ width: 220 }}>Ingresos</th>
                  {parsedAdSpend > 0 && (
                    <>
                      <th className="text-center pb-2 font-medium w-20">ROAS 1ra</th>
                      <th className="text-center pb-2 font-medium w-20">ROAS total</th>
                    </>
                  )}
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.byCampaign.map((r) => {
                    const roas1 = parsedAdSpend > 0 ? r.firstRevenue / parsedAdSpend : 0;
                    const roasT = parsedAdSpend > 0 ? r.revenue / parsedAdSpend : 0;
                    return (
                      <tr key={r.campaign}>
                        <td className="py-1.5 text-zinc-300 truncate">{r.campaign}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.mensajes}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.cargas}</td>
                        <td className="py-1.5 px-2"><PctBar num={r.cargas} den={r.mensajes || 1} color="bg-amber-500" /></td>
                        <td className="py-1.5 px-2"><BarCell value={r.revenue} max={maxCampaignRev} /></td>
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

      {/*  POR DISPOSITIVO  */}
      {stats.byDevice.length > 0 && (
        <div>
          <SectionTitle>Por dispositivo</SectionTitle>
          <div className="mt-3">
            <TableCard title="Mensajes recibidos, cargas e ingresos por dispositivo">
              <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ minWidth: 760 }}>
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Dispositivo</th>
                  <th className="text-center pb-2 font-medium w-24">Mensajes recibidos</th>
                  <th className="text-center pb-2 font-medium w-14">Cargas</th>
                  <th className="text-center pb-2 font-medium" style={{ width: 180 }}>% de carga</th>
                  <th className="text-center pb-2 font-medium" style={{ width: 220 }}>Ingresos</th>
                  {parsedAdSpend > 0 && (
                    <>
                      <th className="text-center pb-2 font-medium w-20">ROAS 1ra</th>
                      <th className="text-center pb-2 font-medium w-20">ROAS total</th>
                    </>
                  )}
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.byDevice.map((r) => {
                    const roas1 = parsedAdSpend > 0 ? r.firstRevenue / parsedAdSpend : 0;
                    const roasT = parsedAdSpend > 0 ? r.revenue / parsedAdSpend : 0;
                    return (
                      <tr key={r.device}>
                        <td className="py-1.5 text-zinc-300 capitalize truncate">{r.device}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.mensajes}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.cargas}</td>
                        <td className="py-1.5 px-2"><PctBar num={r.cargas} den={r.mensajes || 1} color="bg-violet-500" /></td>
                        <td className="py-1.5 px-2"><BarCell value={r.revenue} max={maxDeviceRev} /></td>
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
                  <th className="text-left pb-2 font-medium">Landing</th>
                  <th className="text-center pb-2 font-medium w-24">Mensajes recibidos</th>
                  <th className="text-center pb-2 font-medium w-14">Cargas</th>
                  <th className="text-center pb-2 font-medium" style={{ width: 180 }}>% de carga</th>
                  <th className="text-center pb-2 font-medium" style={{ width: 220 }}>Ingresos</th>
                  {parsedAdSpend > 0 && (
                    <>
                      <th className="text-center pb-2 font-medium w-20">ROAS 1ra</th>
                      <th className="text-center pb-2 font-medium w-20">ROAS total</th>
                    </>
                  )}
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.byLanding.map((r) => {
                    const roas1 = parsedAdSpend > 0 ? r.firstRevenue / parsedAdSpend : 0;
                    const roasT = parsedAdSpend > 0 ? r.revenue / parsedAdSpend : 0;
                    return (
                      <tr key={r.landing}>
                        <td className="py-1.5 text-zinc-300 truncate">{r.landing}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.mensajes}</td>
                        <td className="py-1.5 text-center text-zinc-400">{r.cargas}</td>
                        <td className="py-1.5 px-2"><PctBar num={r.cargas} den={r.mensajes || 1} color="bg-emerald-500" /></td>
                        <td className="py-1.5 px-2"><BarCell value={r.revenue} max={maxLandingRev} /></td>
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
      {stats.topContacts.length > 0 && (
        <div>
          <SectionTitle>Top contactos por monto</SectionTitle>
          <div className="mt-3">
            <TableCard title="Top 10 jugadores">
              <table className="w-full text-[11px]">
                <thead><tr className="text-zinc-500">
                  <th className="text-center pb-2 font-medium w-6">#</th>
                  <th className="text-left pb-2 font-medium">Teléfono</th>
                  <th className="text-left pb-2 font-medium">Nombre</th>
                  <th className="text-center pb-2 font-medium w-16">Cargas</th>
                  <th className="text-center pb-2 font-medium w-28">Total</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.topContacts.map((c, i) => (
                    <tr key={c.phone}>
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
                      <td className="py-1.5 text-center text-zinc-400">{c.purchase_count}</td>
                      <td className="py-1.5 text-center text-emerald-400 font-mono font-semibold">{formatCurrency(c.total_valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
        </div>
      )}
    </div>
  );
}








