"use client";

import { useMemo } from "react";
import type { FunnelContact, ConversionRow } from "@/lib/conversionsDb";
import { computeCoreStats } from "@/lib/conversionStats";

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

function Card({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900/80 text-zinc-300">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-zinc-500">{title}</p>
        <p className="text-lg font-semibold text-zinc-50 tabular-nums">{value}</p>
        {subtitle && <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

export function HomeOverview({
  role,
  landingsCount,
  funnelContacts,
  conversions,
  premiumThreshold,
}: {
  role: "admin" | "client";
  landingsCount: number;
  funnelContacts: FunnelContact[];
  conversions: ConversionRow[];
  premiumThreshold: number;
}) {
  const stats = useMemo(() => {
    const core = computeCoreStats(conversions, funnelContacts, conversions, premiumThreshold);

    const porcentajeCarga = core.uniqueLeads
      ? (core.firstLoadPurchasersLinkedToLead / core.uniqueLeads) * 100
      : 0;
    const cargaPromedio = core.totalPurchaseCount > 0 ? core.totalRevenue / core.totalPurchaseCount : 0;

    return {
      landings: landingsCount,
      porcentajeCarga,
      cargaPromedio,
      totalCargado: core.totalRevenue,
      premium: core.premiumPlayers,
      retencionActiva30d: core.activeRetention30d,
    };
  }, [landingsCount, funnelContacts, conversions, premiumThreshold]);

  const scopeLabel =
    role === "admin" ? "vista consolidada (todos los clientes)" : "vista consolidada";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">INICIO</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Resumen ejecutivo de landings y conversiones - {scopeLabel}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          title="Landings totales"
          value={stats.landings.toString()}
          subtitle="Cantidad de landings activas en el constructor."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <rect x="3" y="4" width="8" height="6" rx="1" className="text-sky-400" />
              <rect x="13" y="6" width="8" height="5" rx="1" />
              <rect x="4" y="13" width="7" height="7" rx="1" />
              <rect x="14" y="13" width="6" height="7" rx="1" />
            </svg>
          }
        />
        <Card
          title="Porcentaje de carga"
          value={pct(stats.porcentajeCarga, 100)}
          subtitle="Leads unicos que llegaron a cargar al menos una vez."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M4 4h4l2 6 3-10 3 8 2-4h2" className="text-emerald-400" />
              <path d="M4 20h16" />
            </svg>
          }
        />
        <Card
          title="Carga promedio"
          value={formatCurrency(stats.cargaPromedio)}
          subtitle="Monto promedio por carga."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <circle cx="12" cy="12" r="8" className="text-amber-400" />
              <path d="M9 10h4a2 2 0 0 1 0 4h-2.5" />
              <path d="M11 8v8" />
            </svg>
          }
        />
        <Card
          title="Total cargado"
          value={formatCurrency(stats.totalCargado)}
          subtitle="Ingresos totales de cargas."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <rect x="3" y="5" width="18" height="14" rx="2" className="text-emerald-400" />
              <path d="M3 10h18" />
              <path d="M8 15h2" />
              <path d="M14 15h2" />
            </svg>
          }
        />
        <Card
          title="Jugadores premium"
          value={stats.premium.toString()}
          subtitle="Contactos premium segun umbral configurado."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path
                d="M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.2L12 15.8 7.4 17.4l.9-5.2-3.8-3.7 5.2-.8L12 3z"
                className="text-yellow-400"
              />
            </svg>
          }
        />
        <Card
          title="Retencion activa 30d"
          value={stats.retencionActiva30d.toString()}
          subtitle="Jugadores con >=4 cargas en 30d y primera carga >=7d."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <circle cx="12" cy="12" r="8" className="text-violet-400" />
              <path d="M12 8v4l2 2" />
              <path d="M12 4v2" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
