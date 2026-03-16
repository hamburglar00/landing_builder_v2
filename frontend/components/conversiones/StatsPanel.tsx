"use client";

import { useMemo } from "react";
import {
  type FunnelContact,
  type ConversionRow,
  classifyContact,
} from "@/lib/conversionsDb";

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

function KpiCard({
  label,
  value,
  sub,
  color = "text-zinc-100",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-[11px] text-zinc-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarCell({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-600"
          style={{ width: `${w}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-400 w-16 text-right font-mono">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export default function StatsPanel({
  funnelContacts,
  conversions,
  premiumThreshold,
}: {
  funnelContacts: FunnelContact[];
  conversions: ConversionRow[];
  premiumThreshold: number;
}) {
  const stats = useMemo(() => {
    const total = funnelContacts.length;
    let leads = 0,
      primera = 0,
      recurrente = 0,
      premium = 0;
    let totalRevenue = 0;
    let totalPurchaseCount = 0;
    const withEmail = funnelContacts.filter((c) => c.email).length;

    for (const c of funnelContacts) {
      const stage = classifyContact(c, premiumThreshold);
      if (stage === "leads") leads++;
      else if (stage === "primera_carga") primera++;
      else if (stage === "recurrente") recurrente++;
      else premium++;
      totalRevenue += c.total_valor;
      totalPurchaseCount += c.purchase_count;
    }

    const purchasers = primera + recurrente + premium;
    const avgTicket =
      totalPurchaseCount > 0 ? totalRevenue / totalPurchaseCount : 0;
    const leadToPurchase = leads + purchasers > 0 ? purchasers / (leads + purchasers) : 0;
    const recurrenceRate = purchasers > 0 ? (recurrente + premium) / purchasers : 0;
    const avgLoadsPerPlayer =
      purchasers > 0 ? totalPurchaseCount / purchasers : 0;
    const emailRate = total > 0 ? withEmail / total : 0;

    // By region
    const regionMap = new Map<
      string,
      { leads: number; purchases: number; revenue: number }
    >();
    for (const c of funnelContacts) {
      const r = c.region || c.country || "Sin región";
      const entry = regionMap.get(r) ?? { leads: 0, purchases: 0, revenue: 0 };
      const stage = classifyContact(c, premiumThreshold);
      if (stage === "leads") entry.leads++;
      else entry.purchases++;
      entry.revenue += c.total_valor;
      regionMap.set(r, entry);
    }
    const byRegion = [...regionMap.entries()]
      .map(([region, d]) => ({ region, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // By campaign
    const campaignMap = new Map<
      string,
      { leads: number; purchases: number; revenue: number }
    >();
    for (const c of funnelContacts) {
      const camp = c.utm_campaign || "Sin campaña";
      const entry = campaignMap.get(camp) ?? {
        leads: 0,
        purchases: 0,
        revenue: 0,
      };
      const stage = classifyContact(c, premiumThreshold);
      if (stage === "leads") entry.leads++;
      else entry.purchases++;
      entry.revenue += c.total_valor;
      campaignMap.set(camp, entry);
    }
    const byCampaign = [...campaignMap.entries()]
      .map(([campaign, d]) => ({ campaign, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // By device
    const deviceMap = new Map<
      string,
      { contacts: number; revenue: number }
    >();
    for (const c of funnelContacts) {
      const dev = c.device_type || "Desconocido";
      const entry = deviceMap.get(dev) ?? { contacts: 0, revenue: 0 };
      entry.contacts++;
      entry.revenue += c.total_valor;
      deviceMap.set(dev, entry);
    }
    const byDevice = [...deviceMap.entries()]
      .map(([device, d]) => ({ device, ...d }))
      .sort((a, b) => b.revenue - a.revenue);

    // Top contacts by revenue
    const topContacts = [...funnelContacts]
      .filter((c) => c.total_valor > 0)
      .sort((a, b) => b.total_valor - a.total_valor)
      .slice(0, 10);

    // By landing
    const landingMap = new Map<string, { contacts: number; revenue: number }>();
    for (const c of funnelContacts) {
      const ln = c.landing_name || "Sin landing";
      const entry = landingMap.get(ln) ?? { contacts: 0, revenue: 0 };
      entry.contacts++;
      entry.revenue += c.total_valor;
      landingMap.set(ln, entry);
    }
    const byLanding = [...landingMap.entries()]
      .map(([landing, d]) => ({ landing, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Single vs multiple purchases
    const singlePurchasers = funnelContacts.filter(
      (c) => c.purchase_count === 1,
    ).length;
    const multiPurchasers = funnelContacts.filter(
      (c) => c.purchase_count > 1,
    ).length;

    // CAPI status from raw conversions
    const capiTotal = conversions.filter(
      (c) =>
        c.contact_status_capi || c.lead_status_capi || c.purchase_status_capi,
    ).length;
    const capiOk = conversions.filter(
      (c) =>
        c.contact_status_capi === "enviado" ||
        c.lead_status_capi === "enviado" ||
        c.purchase_status_capi === "enviado",
    ).length;

    return {
      total,
      leads,
      primera,
      recurrente,
      premium,
      purchasers,
      totalRevenue,
      totalPurchaseCount,
      avgTicket,
      leadToPurchase,
      recurrenceRate,
      avgLoadsPerPlayer,
      emailRate,
      withEmail,
      byRegion,
      byCampaign,
      byDevice,
      topContacts,
      byLanding,
      singlePurchasers,
      multiPurchasers,
      capiTotal,
      capiOk,
    };
  }, [funnelContacts, conversions, premiumThreshold]);

  const maxRegionRevenue = Math.max(...stats.byRegion.map((r) => r.revenue), 1);
  const maxCampaignRevenue = Math.max(
    ...stats.byCampaign.map((r) => r.revenue),
    1,
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard label="Contactos únicos" value={stats.total} />
        <KpiCard label="Leads" value={stats.leads} color="text-amber-300" />
        <KpiCard
          label="Primera carga"
          value={stats.primera}
          color="text-sky-300"
        />
        <KpiCard
          label="Recurrentes"
          value={stats.recurrente}
          color="text-violet-300"
        />
        <KpiCard
          label="Premium"
          value={stats.premium}
          color="text-emerald-300"
        />
        <KpiCard
          label="Total cargado"
          value={formatCurrency(stats.totalRevenue)}
          color="text-emerald-400"
        />
        <KpiCard
          label="Ticket promedio"
          value={formatCurrency(stats.avgTicket)}
          sub={`${stats.totalPurchaseCount} cargas totales`}
        />
        <KpiCard
          label="Lead → Compra"
          value={pct(stats.purchasers, stats.leads + stats.purchasers)}
          sub={`${stats.purchasers} de ${stats.leads + stats.purchasers}`}
          color="text-sky-400"
        />
        <KpiCard
          label="Tasa de recurrencia"
          value={pct(
            stats.recurrente + stats.premium,
            stats.purchasers,
          )}
          sub={`${stats.recurrente + stats.premium} de ${stats.purchasers} compradores`}
          color="text-violet-400"
        />
        <KpiCard
          label="Promedio cargas/jugador"
          value={stats.avgLoadsPerPlayer.toFixed(1)}
          sub={`${stats.singlePurchasers} con 1 carga · ${stats.multiPurchasers} con múltiples`}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Contactos con email"
          value={pct(stats.withEmail, stats.total)}
          sub={`${stats.withEmail} de ${stats.total}`}
        />
        <KpiCard
          label="CAPI exitoso"
          value={pct(stats.capiOk, stats.capiTotal)}
          sub={`${stats.capiOk} de ${stats.capiTotal} envíos`}
          color="text-emerald-400"
        />
      </div>

      {/* Breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By region */}
        {stats.byRegion.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h4 className="text-xs font-semibold text-zinc-200 mb-3">
              Por región
            </h4>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Región</th>
                  <th className="text-right pb-2 font-medium w-12">Leads</th>
                  <th className="text-right pb-2 font-medium w-16">Compras</th>
                  <th className="pb-2 font-medium w-36">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {stats.byRegion.map((r) => (
                  <tr key={r.region}>
                    <td className="py-1.5 text-zinc-300">{r.region}</td>
                    <td className="py-1.5 text-right text-zinc-400">
                      {r.leads}
                    </td>
                    <td className="py-1.5 text-right text-zinc-400">
                      {r.purchases}
                    </td>
                    <td className="py-1.5">
                      <BarCell value={r.revenue} max={maxRegionRevenue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* By campaign */}
        {stats.byCampaign.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h4 className="text-xs font-semibold text-zinc-200 mb-3">
              Por campaña
            </h4>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Campaña</th>
                  <th className="text-right pb-2 font-medium w-12">Leads</th>
                  <th className="text-right pb-2 font-medium w-16">Compras</th>
                  <th className="pb-2 font-medium w-36">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {stats.byCampaign.map((r) => (
                  <tr key={r.campaign}>
                    <td className="py-1.5 text-zinc-300 truncate max-w-[160px]">
                      {r.campaign}
                    </td>
                    <td className="py-1.5 text-right text-zinc-400">
                      {r.leads}
                    </td>
                    <td className="py-1.5 text-right text-zinc-400">
                      {r.purchases}
                    </td>
                    <td className="py-1.5">
                      <BarCell value={r.revenue} max={maxCampaignRevenue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* By device */}
        {stats.byDevice.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h4 className="text-xs font-semibold text-zinc-200 mb-3">
              Por dispositivo
            </h4>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Dispositivo</th>
                  <th className="text-right pb-2 font-medium w-16">
                    Contactos
                  </th>
                  <th className="text-right pb-2 font-medium w-24">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {stats.byDevice.map((r) => (
                  <tr key={r.device}>
                    <td className="py-1.5 text-zinc-300">{r.device}</td>
                    <td className="py-1.5 text-right text-zinc-400">
                      {r.contacts}
                    </td>
                    <td className="py-1.5 text-right text-zinc-200 font-mono">
                      {formatCurrency(r.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* By landing */}
        {stats.byLanding.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h4 className="text-xs font-semibold text-zinc-200 mb-3">
              Por landing (LTV)
            </h4>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Landing</th>
                  <th className="text-right pb-2 font-medium w-16">
                    Contactos
                  </th>
                  <th className="text-right pb-2 font-medium w-24">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {stats.byLanding.map((r) => (
                  <tr key={r.landing}>
                    <td className="py-1.5 text-zinc-300 truncate max-w-[160px]">
                      {r.landing}
                    </td>
                    <td className="py-1.5 text-right text-zinc-400">
                      {r.contacts}
                    </td>
                    <td className="py-1.5 text-right text-zinc-200 font-mono">
                      {formatCurrency(r.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top contacts */}
      {stats.topContacts.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h4 className="text-xs font-semibold text-zinc-200 mb-3">
            Top contactos por monto
          </h4>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-zinc-500">
                <th className="text-left pb-2 font-medium">#</th>
                <th className="text-left pb-2 font-medium">Teléfono</th>
                <th className="text-left pb-2 font-medium">Nombre</th>
                <th className="text-right pb-2 font-medium">Cargas</th>
                <th className="text-right pb-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {stats.topContacts.map((c, i) => (
                <tr key={c.phone}>
                  <td className="py-1.5 text-zinc-600">{i + 1}</td>
                  <td className="py-1.5 text-zinc-200 font-mono">{c.phone}</td>
                  <td className="py-1.5 text-zinc-400">
                    {[c.fn, c.ln].filter(Boolean).join(" ") || "-"}
                  </td>
                  <td className="py-1.5 text-right text-zinc-400">
                    {c.purchase_count}
                  </td>
                  <td className="py-1.5 text-right text-emerald-400 font-mono font-semibold">
                    {formatCurrency(c.total_valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
