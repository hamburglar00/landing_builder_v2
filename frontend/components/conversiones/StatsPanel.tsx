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
  premiumThreshold,
}: {
  funnelContacts: FunnelContact[];
  conversions: ConversionRow[];
  premiumThreshold: number;
}) {
  const stats = useMemo(() => {
    const total = funnelContacts.length;
    let leads = 0, primera = 0, recurrente = 0, premium = 0;
    let totalRevenue = 0, totalPurchaseCount = 0;
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
    const reachedLead = funnelContacts.filter((c) => c.lead_count > 0 || c.purchase_count > 0).length;
    const avgTicket = totalPurchaseCount > 0 ? totalRevenue / totalPurchaseCount : 0;
    const avgLoadsPerPlayer = purchasers > 0 ? totalPurchaseCount / purchasers : 0;

    const singlePurchasers = funnelContacts.filter((c) => c.purchase_count === 1).length;
    const multiPurchasers = funnelContacts.filter((c) => c.purchase_count > 1).length;

    // CAPI
    const capiEvents = conversions.filter((c) => c.contact_status_capi || c.lead_status_capi || c.purchase_status_capi);
    const capiTotal = capiEvents.length;
    const capiOk = capiEvents.filter((c) => c.contact_status_capi === "enviado" || c.lead_status_capi === "enviado" || c.purchase_status_capi === "enviado").length;
    const capiContactOk = conversions.filter((c) => c.contact_status_capi === "enviado").length;
    const capiContactTotal = conversions.filter((c) => c.contact_status_capi).length;
    const capiLeadOk = conversions.filter((c) => c.lead_status_capi === "enviado").length;
    const capiLeadTotal = conversions.filter((c) => c.lead_status_capi).length;
    const capiPurchOk = conversions.filter((c) => c.purchase_status_capi === "enviado").length;
    const capiPurchTotal = conversions.filter((c) => c.purchase_status_capi).length;

    // By region
    const regionMap = new Map<string, { leads: number; purchases: number; revenue: number; total: number }>();
    for (const c of funnelContacts) {
      const r = c.region || c.country || "Sin región";
      const entry = regionMap.get(r) ?? { leads: 0, purchases: 0, revenue: 0, total: 0 };
      entry.total++;
      const stage = classifyContact(c, premiumThreshold);
      if (stage === "leads") entry.leads++; else entry.purchases++;
      entry.revenue += c.total_valor;
      regionMap.set(r, entry);
    }
    const byRegion = [...regionMap.entries()].map(([region, d]) => ({ region, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // By campaign
    const campaignMap = new Map<string, { leads: number; purchases: number; revenue: number; total: number }>();
    for (const c of funnelContacts) {
      const camp = c.utm_campaign || "Sin campaña";
      const entry = campaignMap.get(camp) ?? { leads: 0, purchases: 0, revenue: 0, total: 0 };
      entry.total++;
      const stage = classifyContact(c, premiumThreshold);
      if (stage === "leads") entry.leads++; else entry.purchases++;
      entry.revenue += c.total_valor;
      campaignMap.set(camp, entry);
    }
    const byCampaign = [...campaignMap.entries()].map(([campaign, d]) => ({ campaign, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // By device
    const deviceMap = new Map<string, { contacts: number; purchases: number; revenue: number }>();
    for (const c of funnelContacts) {
      const dev = c.device_type || "Desconocido";
      const entry = deviceMap.get(dev) ?? { contacts: 0, purchases: 0, revenue: 0 };
      entry.contacts++;
      if (c.purchase_count > 0) entry.purchases++;
      entry.revenue += c.total_valor;
      deviceMap.set(dev, entry);
    }
    const byDevice = [...deviceMap.entries()].map(([device, d]) => ({ device, ...d })).sort((a, b) => b.revenue - a.revenue);

    // By landing
    const landingMap = new Map<string, { contacts: number; purchases: number; revenue: number }>();
    for (const c of funnelContacts) {
      const ln = c.landing_name || "Sin landing";
      const entry = landingMap.get(ln) ?? { contacts: 0, purchases: 0, revenue: 0 };
      entry.contacts++;
      if (c.purchase_count > 0) entry.purchases++;
      entry.revenue += c.total_valor;
      landingMap.set(ln, entry);
    }
    const byLanding = [...landingMap.entries()].map(([landing, d]) => ({ landing, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Top contacts
    const topContacts = [...funnelContacts].filter((c) => c.total_valor > 0).sort((a, b) => b.total_valor - a.total_valor).slice(0, 10);

    return {
      total, leads, primera, recurrente, premium, purchasers, reachedLead,
      totalRevenue, totalPurchaseCount, avgTicket, avgLoadsPerPlayer,
      withEmail, singlePurchasers, multiPurchasers,
      capiTotal, capiOk, capiContactOk, capiContactTotal, capiLeadOk, capiLeadTotal, capiPurchOk, capiPurchTotal,
      byRegion, byCampaign, byDevice, byLanding, topContacts,
    };
  }, [funnelContacts, conversions, premiumThreshold]);

  const maxRegionRev = Math.max(...stats.byRegion.map((r) => r.revenue), 1);
  const maxCampaignRev = Math.max(...stats.byCampaign.map((r) => r.revenue), 1);

  return (
    <div className="space-y-8">

      {/* ── RESUMEN GENERAL ── */}
      <div>
        <SectionTitle>Resumen general</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Contactos únicos" value={stats.total} />
          <KpiCard label="Leads" value={stats.leads} color="text-amber-300" />
          <KpiCard label="Primera carga" value={stats.primera} color="text-sky-300" />
          <KpiCard label="Recurrentes" value={stats.recurrente} color="text-violet-300" />
          <KpiCard label="Premium" value={stats.premium} color="text-emerald-300" />
        </div>
      </div>

      {/* ── REVENUE ── */}
      <div>
        <SectionTitle>Revenue</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KpiCard label="Total cargado" value={formatCurrency(stats.totalRevenue)} color="text-emerald-400" />
          <KpiCard label="Ticket promedio" value={formatCurrency(stats.avgTicket)} sub={`${stats.totalPurchaseCount} cargas totales`} />
          <KpiCard label="Promedio cargas/jugador" value={stats.avgLoadsPerPlayer.toFixed(1)} sub={`${stats.singlePurchasers} con 1 carga · ${stats.multiPurchasers} con múltiples`} />
          <KpiCard label="Jugadores con 1 vs múltiples" value={`${stats.singlePurchasers} / ${stats.multiPurchasers}`} sub={`${pct(stats.multiPurchasers, stats.singlePurchasers + stats.multiPurchasers)} repiten`} />
        </div>
      </div>

      {/* ── TASAS DE CONVERSIÓN ── */}
      <div>
        <SectionTitle>Tasas de conversión</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Contact → Lead" value={pct(stats.reachedLead, stats.total)} sub={`${stats.reachedLead} de ${stats.total} contactos`} color="text-amber-400" />
          <KpiCard label="Lead → Compra" value={pct(stats.purchasers, stats.reachedLead)} sub={`${stats.purchasers} de ${stats.reachedLead} leads`} color="text-sky-400" />
          <KpiCard label="Tasa de recurrencia" value={pct(stats.recurrente + stats.premium, stats.purchasers)} sub={`${stats.recurrente + stats.premium} de ${stats.purchasers} compradores`} color="text-violet-400" />
          <KpiCard label="Contactos con email" value={pct(stats.withEmail, stats.total)} sub={`${stats.withEmail} de ${stats.total}`} />
          <KpiCard label="% Premium" value={pct(stats.premium, stats.total)} sub={`${stats.premium} de ${stats.total} contactos`} color="text-emerald-400" />
        </div>
      </div>

      {/* ── ENVÍOS CAPI ── */}
      <div>
        <SectionTitle>Envíos Meta CAPI</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="CAPI total exitoso" value={pct(stats.capiOk, stats.capiTotal)} sub={`${stats.capiOk} de ${stats.capiTotal} envíos`} color="text-emerald-400" />
          <KpiCard label="Contact CAPI" value={pct(stats.capiContactOk, stats.capiContactTotal)} sub={`${stats.capiContactOk} de ${stats.capiContactTotal}`} />
          <KpiCard label="Lead CAPI" value={pct(stats.capiLeadOk, stats.capiLeadTotal)} sub={`${stats.capiLeadOk} de ${stats.capiLeadTotal}`} />
          <KpiCard label="Purchase CAPI" value={pct(stats.capiPurchOk, stats.capiPurchTotal)} sub={`${stats.capiPurchOk} de ${stats.capiPurchTotal}`} />
        </div>
      </div>

      {/* ── POR REGIÓN ── */}
      {stats.byRegion.length > 0 && (
        <div>
          <SectionTitle>Por región</SectionTitle>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <TableCard title="Revenue y conversión por región">
              <table className="w-full text-[11px]">
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Región</th>
                  <th className="text-right pb-2 font-medium w-12">Leads</th>
                  <th className="text-right pb-2 font-medium w-14">Compras</th>
                  <th className="text-right pb-2 font-medium w-14">Conv.</th>
                  <th className="pb-2 font-medium w-36">Revenue</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.byRegion.map((r) => (
                    <tr key={r.region}>
                      <td className="py-1.5 text-zinc-300">{r.region}</td>
                      <td className="py-1.5 text-right text-zinc-400">{r.leads}</td>
                      <td className="py-1.5 text-right text-zinc-400">{r.purchases}</td>
                      <td className="py-1.5 text-right"><PctBar num={r.purchases} den={r.total} /></td>
                      <td className="py-1.5"><BarCell value={r.revenue} max={maxRegionRev} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
            <TableCard title="% de carga por región">
              <div className="space-y-2">
                {stats.byRegion.map((r) => (
                  <div key={r.region} className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 w-24 truncate">{r.region}</span>
                    <PctBar num={r.revenue} den={stats.totalRevenue} color="bg-emerald-500" />
                  </div>
                ))}
              </div>
            </TableCard>
          </div>
        </div>
      )}

      {/* ── POR CAMPAÑA ── */}
      {stats.byCampaign.length > 0 && (
        <div>
          <SectionTitle>Por campaña (utm_campaign)</SectionTitle>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <TableCard title="Revenue y conversión por campaña">
              <table className="w-full text-[11px]">
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Campaña</th>
                  <th className="text-right pb-2 font-medium w-12">Leads</th>
                  <th className="text-right pb-2 font-medium w-14">Compras</th>
                  <th className="text-right pb-2 font-medium w-14">Conv.</th>
                  <th className="pb-2 font-medium w-36">Revenue</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.byCampaign.map((r) => (
                    <tr key={r.campaign}>
                      <td className="py-1.5 text-zinc-300 truncate max-w-[140px]">{r.campaign}</td>
                      <td className="py-1.5 text-right text-zinc-400">{r.leads}</td>
                      <td className="py-1.5 text-right text-zinc-400">{r.purchases}</td>
                      <td className="py-1.5 text-right"><PctBar num={r.purchases} den={r.total} color="bg-amber-500" /></td>
                      <td className="py-1.5"><BarCell value={r.revenue} max={maxCampaignRev} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
            <TableCard title="Top campañas por monto">
              <div className="space-y-2">
                {stats.byCampaign.map((r) => (
                  <div key={r.campaign} className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 w-28 truncate">{r.campaign}</span>
                    <PctBar num={r.revenue} den={stats.totalRevenue} color="bg-amber-500" />
                  </div>
                ))}
              </div>
            </TableCard>
          </div>
        </div>
      )}

      {/* ── POR DISPOSITIVO ── */}
      {stats.byDevice.length > 0 && (
        <div>
          <SectionTitle>Por dispositivo</SectionTitle>
          <div className="mt-3">
            <TableCard title="Volumen y revenue por dispositivo">
              <table className="w-full text-[11px]">
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Dispositivo</th>
                  <th className="text-right pb-2 font-medium w-16">Contactos</th>
                  <th className="text-right pb-2 font-medium w-16">Compradores</th>
                  <th className="text-right pb-2 font-medium w-14">Conv.</th>
                  <th className="text-right pb-2 font-medium w-24">Revenue</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.byDevice.map((r) => (
                    <tr key={r.device}>
                      <td className="py-1.5 text-zinc-300 capitalize">{r.device}</td>
                      <td className="py-1.5 text-right text-zinc-400">{r.contacts}</td>
                      <td className="py-1.5 text-right text-zinc-400">{r.purchases}</td>
                      <td className="py-1.5 text-right"><PctBar num={r.purchases} den={r.contacts} color="bg-violet-500" /></td>
                      <td className="py-1.5 text-right text-zinc-200 font-mono">{formatCurrency(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
        </div>
      )}

      {/* ── POR LANDING ── */}
      {stats.byLanding.length > 0 && (
        <div>
          <SectionTitle>Por landing (LTV)</SectionTitle>
          <div className="mt-3">
            <TableCard title="Contactos y revenue por landing">
              <table className="w-full text-[11px]">
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium">Landing</th>
                  <th className="text-right pb-2 font-medium w-16">Contactos</th>
                  <th className="text-right pb-2 font-medium w-16">Compradores</th>
                  <th className="text-right pb-2 font-medium w-24">Revenue</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.byLanding.map((r) => (
                    <tr key={r.landing}>
                      <td className="py-1.5 text-zinc-300 truncate max-w-[160px]">{r.landing}</td>
                      <td className="py-1.5 text-right text-zinc-400">{r.contacts}</td>
                      <td className="py-1.5 text-right text-zinc-400">{r.purchases}</td>
                      <td className="py-1.5 text-right text-emerald-400 font-mono font-semibold">{formatCurrency(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
        </div>
      )}

      {/* ── TOP CONTACTOS ── */}
      {stats.topContacts.length > 0 && (
        <div>
          <SectionTitle>Top contactos por monto</SectionTitle>
          <div className="mt-3">
            <TableCard title="Top 10 jugadores">
              <table className="w-full text-[11px]">
                <thead><tr className="text-zinc-500">
                  <th className="text-left pb-2 font-medium w-6">#</th>
                  <th className="text-left pb-2 font-medium">Teléfono</th>
                  <th className="text-left pb-2 font-medium">Nombre</th>
                  <th className="text-right pb-2 font-medium w-14">Cargas</th>
                  <th className="text-right pb-2 font-medium w-24">Total</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.topContacts.map((c, i) => (
                    <tr key={c.phone}>
                      <td className="py-1.5 text-zinc-600">{i + 1}</td>
                      <td className="py-1.5 text-zinc-200 font-mono">{c.phone}</td>
                      <td className="py-1.5 text-zinc-400">{[c.fn, c.ln].filter(Boolean).join(" ") || "-"}</td>
                      <td className="py-1.5 text-right text-zinc-400">{c.purchase_count}</td>
                      <td className="py-1.5 text-right text-emerald-400 font-mono font-semibold">{formatCurrency(c.total_valor)}</td>
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
