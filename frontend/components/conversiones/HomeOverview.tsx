"use client";

import { useMemo } from "react";
import type { FunnelContact, ConversionRow, HomeOverviewStats } from "@/lib/conversionsDb";
import { computeCoreStats } from "@/lib/conversionStats";
import { buildFunnelContactsFromConversions } from "@/lib/conversionsDb";
import { formatCurrencyAmount, type ReportingCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/ui/PanelPrimitives";

function pct(num: number, den: number) {
  if (den === 0) return "0%";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function Card({
  title,
  value,
  subtitle,
  icon,
  tooltip,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div
      title={tooltip}
      className="ui-card ui-card-interactive group flex min-h-[104px] items-center gap-3 px-4 py-4"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] text-[var(--color-text-muted)] transition group-hover:border-[var(--color-primary-soft-border)] group-hover:text-[var(--color-primary)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{title}</p>
        <p className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--color-text-strong)] tabular-nums">{value}</p>
        {subtitle && <p className="mt-1 truncate text-[10px] text-[var(--color-text-disabled)]">{subtitle}</p>}
      </div>
    </div>
  );
}

export function HomeOverview({
  role,
  landingsCount,
  conversions,
  premiumThreshold,
  overviewStats,
  currency,
}: {
  role: "admin" | "client";
  landingsCount?: number;
  funnelContacts?: FunnelContact[];
  conversions?: ConversionRow[];
  premiumThreshold?: number;
  overviewStats?: HomeOverviewStats;
  currency: ReportingCurrency;
}) {
  const stats = useMemo(() => {
    if (overviewStats) return overviewStats;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const sourceConversions = conversions ?? [];
    const monthlyConversions = sourceConversions.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return Number.isFinite(t) && t >= startOfMonth.getTime() && t <= now.getTime();
    });
    const monthlyFunnelContacts = buildFunnelContactsFromConversions(monthlyConversions);
    const core = computeCoreStats(
      monthlyConversions,
      monthlyFunnelContacts,
      monthlyConversions,
      premiumThreshold ?? 50000,
    );

    const porcentajeCarga = core.uniqueLeadsLinkedToContactWithInferred ? (core.firstLoadPurchasersAttributed / core.uniqueLeadsLinkedToContactWithInferred) * 100 : 0;
    const cargaPromedio = core.totalPurchaseCount > 0 ? core.totalRevenue / core.totalPurchaseCount : 0;

    return {
      landingsCount: landingsCount ?? 0,
      porcentajeCarga,
      cargaPromedio,
      totalCargado: core.totalRevenue,
      premium: core.premiumPlayers,
      retencionActiva30d: core.activeRetention30d,
    };
  }, [landingsCount, conversions, premiumThreshold, overviewStats]);

  const scopeLabel =
    role === "admin" ? "vista consolidada (todos los clientes)" : "vista consolidada";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={role === "admin" ? "Control center" : "Workspace"}
        title="Inicio"
        description={`Resumen ejecutivo de landings y conversiones · ${scopeLabel} en ${currency}.`}
        actions={<span className="ui-badge">{currency} · Mes actual</span>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          title="Landings totales"
          value={stats.landingsCount.toString()}
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
          tooltip="Métrica mensual (mes actual)."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M4 4h4l2 6 3-10 3 8 2-4h2" className="text-emerald-400" />
              <path d="M4 20h16" />
            </svg>
          }
        />
        <Card
          title="Carga promedio"
          value={formatCurrencyAmount(stats.cargaPromedio, currency)}
          subtitle="Monto promedio por carga."
          tooltip="Métrica mensual (mes actual)."
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
          value={formatCurrencyAmount(stats.totalCargado, currency)}
          subtitle="Ingresos totales de cargas."
          tooltip="Métrica mensual (mes actual)."
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
          tooltip="Métrica mensual (mes actual)."
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
          tooltip="Métrica mensual (mes actual)."
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
