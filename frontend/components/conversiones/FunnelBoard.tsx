"use client";

import { useState, useMemo } from "react";
import {
  type FunnelContact,
  type FunnelStage,
  classifyContact,
} from "@/lib/conversionsDb";

type SortKey = "date" | "amount";

const STAGES: FunnelStage[] = ["leads", "primera_carga", "recurrente", "premium"];

const STAGE_META: Record<FunnelStage, {
  label: string;
  accent: string;
  accentMuted: string;
  dotColor: string;
  headerBorder: string;
}> = {
  leads: {
    label: "Leads",
    accent: "text-slate-300",
    accentMuted: "text-slate-500",
    dotColor: "bg-slate-400",
    headerBorder: "border-slate-700/60",
  },
  primera_carga: {
    label: "Primera Carga",
    accent: "text-emerald-400",
    accentMuted: "text-emerald-600",
    dotColor: "bg-emerald-500",
    headerBorder: "border-emerald-800/40",
  },
  recurrente: {
    label: "Jugador Recurrente",
    accent: "text-violet-400",
    accentMuted: "text-violet-600",
    dotColor: "bg-violet-500",
    headerBorder: "border-violet-800/40",
  },
  premium: {
    label: "Jugador Premium",
    accent: "text-amber-400",
    accentMuted: "text-amber-600",
    dotColor: "bg-amber-400",
    headerBorder: "border-amber-700/40",
  },
};

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString("es-AR")}`;
}

function formatCurrencyFull(n: number) {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

/* ─── WhatsApp Icon SVG ─── */
function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.39-1.585l-.386-.234-2.647.887.887-2.647-.234-.386A9.94 9.94 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
  );
}

/* ─── Search Icon ─── */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT CARD — The core visual unit
   ═══════════════════════════════════════════════════════════════════════════ */
function ContactCard({
  c,
  stage,
}: {
  c: FunnelContact;
  stage: FunnelStage;
}) {
  const meta = STAGE_META[stage];
  const name = [c.fn, c.ln].filter(Boolean).join(" ");

  return (
    <div className="group relative rounded-xl border border-zinc-800/80 bg-[#1a1a20] p-3.5 transition-all duration-200 hover:border-zinc-700/80 hover:bg-[#1e1e25] hover:shadow-lg hover:shadow-black/20">
      {/* Top: Phone + WhatsApp */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-zinc-100 font-mono tracking-tight leading-tight">
            {c.phone}
          </p>
          {name && (
            <p className="mt-0.5 text-xs text-zinc-400 truncate">{name}</p>
          )}
        </div>
        <a
          href={waLink(c.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-emerald-950/50 hover:text-emerald-400"
          title="Abrir WhatsApp"
        >
          <WaIcon className="h-4 w-4" />
        </a>
      </div>

      {/* Email */}
      {c.email && (
        <p className="mt-1.5 text-[11px] text-zinc-500 truncate">{c.email}</p>
      )}

      {/* Metrics row */}
      {c.purchase_count > 0 && (
        <div className="mt-3 flex items-baseline gap-3">
          <span className={`text-lg font-bold tracking-tight ${meta.accent}`}>
            {formatCurrencyFull(c.total_valor)}
          </span>
          <span className="text-[11px] text-zinc-500">
            {c.purchase_count} carga{c.purchase_count !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Footer: date + region */}
      <div className="mt-2.5 flex items-center gap-2 text-[10px] text-zinc-600">
        <span>{relativeDate(c.last_activity)}</span>
        {c.region && (
          <>
            <span className="text-zinc-800">·</span>
            <span className="truncate">{c.region}</span>
          </>
        )}
        {c.utm_campaign && (
          <>
            <span className="text-zinc-800">·</span>
            <span className="truncate max-w-[80px]">{c.utm_campaign}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUMMARY PILL — Top bar metric
   ═══════════════════════════════════════════════════════════════════════════ */
function SummaryPill({
  label,
  value,
  accent,
  dotColor,
}: {
  label: string;
  value: string | number;
  accent: string;
  dotColor: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800/60 bg-[#16161b] px-3.5 py-2">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 leading-none">{label}</p>
        <p className={`text-sm font-bold ${accent} leading-tight mt-0.5`}>{value}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FUNNEL BOARD — Main export
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FunnelBoard({
  contacts,
  premiumThreshold,
}: {
  contacts: FunnelContact[];
  premiumThreshold: number;
}) {
  const [sort, setSort] = useState<SortKey>("date");
  const [search, setSearch] = useState("");

  const { grouped, totals } = useMemo(() => {
    const g: Record<FunnelStage, FunnelContact[]> = {
      leads: [],
      primera_carga: [],
      recurrente: [],
      premium: [],
    };

    let totalRevenue = 0;
    const q = search.replace(/\D/g, "");

    for (const c of contacts) {
      if (q && !c.phone.includes(q)) continue;
      const stage = classifyContact(c, premiumThreshold);
      g[stage].push(c);
      totalRevenue += c.total_valor;
    }

    const sortFn = (a: FunnelContact, b: FunnelContact) =>
      sort === "amount"
        ? b.total_valor - a.total_valor
        : new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();

    for (const s of STAGES) g[s].sort(sortFn);

    return {
      grouped: g,
      totals: {
        leads: g.leads.length,
        primera: g.primera_carga.length,
        recurrente: g.recurrente.length,
        premium: g.premium.length,
        revenue: totalRevenue,
      },
    };
  }, [contacts, premiumThreshold, sort, search]);

  const stageRevenue = useMemo(() => {
    const rev: Record<FunnelStage, number> = { leads: 0, primera_carga: 0, recurrente: 0, premium: 0 };
    for (const s of STAGES) {
      for (const c of grouped[s]) rev[s] += c.total_valor;
    }
    return rev;
  }, [grouped]);

  return (
    <div className="space-y-5">

      {/* ─── Top Summary Bar ─── */}
      <div className="rounded-2xl border border-zinc-800/50 bg-[#111116] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SummaryPill label="Leads" value={totals.leads} accent="text-slate-200" dotColor="bg-slate-400" />
          <SummaryPill label="1ra Carga" value={totals.primera} accent="text-emerald-400" dotColor="bg-emerald-500" />
          <SummaryPill label="Recurrentes" value={totals.recurrente} accent="text-violet-400" dotColor="bg-violet-500" />
          <SummaryPill label="Premium" value={totals.premium} accent="text-amber-400" dotColor="bg-amber-400" />
          <div className="hidden sm:block h-6 w-px bg-zinc-800" />
          <SummaryPill label="Revenue total" value={formatCurrencyFull(totals.revenue)} accent="text-zinc-100" dotColor="bg-emerald-500" />
        </div>
      </div>

      {/* ─── Controls Bar ─── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar teléfono..."
            className="h-8 w-52 rounded-lg border border-zinc-800/60 bg-[#16161b] pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800/60 bg-[#16161b] p-0.5">
          {(["date", "amount"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`cursor-pointer rounded-md px-3 py-1 text-[11px] font-medium transition-all ${
                sort === k
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {k === "date" ? "Fecha" : "Monto"}
            </button>
          ))}
        </div>

        {/* Contact total count */}
        <span className="ml-auto text-[11px] text-zinc-600">
          {contacts.length} contacto{contacts.length !== 1 ? "s" : ""}
          {search && ` · ${totals.leads + totals.primera + totals.recurrente + totals.premium} resultado${totals.leads + totals.primera + totals.recurrente + totals.premium !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ─── Kanban Columns ─── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const meta = STAGE_META[stage];
          const list = grouped[stage];
          const rev = stageRevenue[stage];

          return (
            <div key={stage} className="flex flex-col rounded-2xl border border-zinc-800/50 bg-[#111116] overflow-hidden">
              {/* Column Header */}
              <div className={`border-b ${meta.headerBorder} px-4 py-3`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />
                  <h4 className={`text-xs font-semibold uppercase tracking-wider ${meta.accent}`}>
                    {meta.label}
                  </h4>
                  <span className="ml-auto rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] font-semibold text-zinc-300 tabular-nums">
                    {list.length}
                  </span>
                </div>
                {rev > 0 && (
                  <p className={`mt-1 text-xs font-medium ${meta.accentMuted}`}>
                    {formatCurrencyFull(rev)}
                  </p>
                )}
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-[68vh] scrollbar-thin">
                {list.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-[11px] text-zinc-700">Sin contactos</p>
                  </div>
                ) : (
                  list.map((c) => (
                    <ContactCard key={c.phone} c={c} stage={stage} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
