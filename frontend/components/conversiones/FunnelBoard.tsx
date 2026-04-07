"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  type FunnelContact,
  type FunnelStage,
  type TrackingRankingConfig,
  classifyContact,
} from "@/lib/conversionsDb";

type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";

const STAGES: FunnelStage[] = ["leads", "primera_carga", "recurrente", "premium"];

const STAGE_META: Record<FunnelStage, {
  label: string;
  accent: string;
  accentSoft: string;
  amountColor: string;
  chipClass: string;
  cardGlow: string;
  cardBorder: string;
  cardRing: string;
  dot: string;
  headerGlow: string;
  columnBorder: string;
}> = {
  leads: {
    label: "Leads",
    accent: "text-emerald-400",
    accentSoft: "text-emerald-400/60",
    amountColor: "text-emerald-400",
    chipClass: "border-emerald-500/20 bg-emerald-500/7 text-emerald-300/90",
    cardGlow: "from-emerald-500/8 via-emerald-500/2 to-transparent",
    cardBorder: "border-emerald-900/25",
    cardRing: "hover:ring-emerald-500/12",
    dot: "bg-emerald-400",
    headerGlow: "from-emerald-500/5 to-transparent",
    columnBorder: "border-emerald-900/30",
  },
  primera_carga: {
    label: "Primeras cargas",
    accent: "text-sky-300",
    accentSoft: "text-sky-400/60",
    amountColor: "text-sky-300/80",
    chipClass: "border-sky-500/20 bg-sky-500/7 text-sky-300/90",
    cardGlow: "from-sky-500/8 via-sky-500/2 to-transparent",
    cardBorder: "border-sky-900/25",
    cardRing: "hover:ring-sky-500/12",
    dot: "bg-sky-400",
    headerGlow: "from-sky-500/5 to-transparent",
    columnBorder: "border-sky-900/30",
  },
  recurrente: {
    label: "Jugadores con recargas",
    accent: "text-violet-400",
    accentSoft: "text-violet-400/60",
    amountColor: "text-violet-400",
    chipClass: "border-violet-500/20 bg-violet-500/7 text-violet-300/90",
    cardGlow: "from-violet-500/8 via-violet-500/2 to-transparent",
    cardBorder: "border-violet-900/25",
    cardRing: "hover:ring-violet-500/12",
    dot: "bg-violet-400",
    headerGlow: "from-violet-500/5 to-transparent",
    columnBorder: "border-violet-900/30",
  },
  premium: {
    label: "Jugadores premium",
    accent: "text-amber-400",
    accentSoft: "text-amber-400/60",
    amountColor: "text-amber-300",
    chipClass: "border-amber-500/20 bg-amber-500/8 text-amber-300/90",
    cardGlow: "from-amber-500/10 via-amber-500/2 to-transparent",
    cardBorder: "border-amber-900/28",
    cardRing: "hover:ring-amber-500/12",
    dot: "bg-amber-400",
    headerGlow: "from-amber-500/6 to-transparent",
    columnBorder: "border-amber-800/30",
  },
};

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function fmtCurrency(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString("es-AR")}`;
}

function relDate(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mes`;
}

const DEFAULT_RANK_RULES = [
  { id: "r1", indicator: "\u{1F4A9}", maxTotal: 1000 },
  { id: "r2", indicator: "\u{1F7E2}", maxTotal: 5000 },
  { id: "r3", indicator: "\u{1F7E1}", maxTotal: 10000 },
  { id: "r4", indicator: "\u{1F7E0}", maxTotal: 50000 },
  { id: "r5", indicator: "\u{1F534}", maxTotal: 100000 },
  { id: "r6", indicator: "\u{26AB}", maxTotal: 300000 },
  { id: "r7", indicator: "\u{1F525}", maxTotal: 500000 },
];
const DEFAULT_OVERFLOW_INDICATOR = "\u{1F4A3}";
const LEAD_INDICATOR = "\u{1F4F2}";

function rankIndicatorForTotal(
  total: number,
  rankingConfig?: TrackingRankingConfig | null,
) {
  const rules = rankingConfig?.rules?.length ? rankingConfig.rules : DEFAULT_RANK_RULES;
  const overflow = rankingConfig?.overflowIndicator || DEFAULT_OVERFLOW_INDICATOR;
  const sorted = [...rules].sort((a, b) => a.maxTotal - b.maxTotal);
  for (const r of sorted) {
    if (total < r.maxTotal) return r.indicator || "-";
  }
  return overflow || "-";
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.39-1.585l-.386-.234-2.647.887.887-2.647-.234-.386A9.94 9.94 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
  );
}

/* aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
   CONTACT CARD
   aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa */
function ContactCard({
  c,
  stage,
  rankingConfig,
}: {
  c: FunnelContact;
  stage: FunnelStage;
  rankingConfig?: TrackingRankingConfig | null;
}) {
  const meta = STAGE_META[stage];
  const name = [c.fn, c.ln].filter(Boolean).join(" ");
  const hasPurchases = c.purchase_count > 0;
  const rankIndicator = hasPurchases
    ? rankIndicatorForTotal(c.total_valor, rankingConfig)
    : LEAD_INDICATOR;
  const statusLabel = hasPurchases
    ? `${c.purchase_count} carga${c.purchase_count !== 1 ? "s" : ""}`
    : "Sin cargas";

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border ${meta.cardBorder} bg-zinc-900/88 px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.28)] ring-1 ring-white/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700/70 hover:shadow-[0_12px_30px_rgba(0,0,0,0.32)] ${meta.cardRing}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${meta.cardGlow}`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/7" />
      <div className={`pointer-events-none absolute inset-y-0 left-0 w-[2px] ${meta.dot} opacity-55`} />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-[16px] font-extrabold text-zinc-50 font-mono tracking-tight leading-none"
            title={c.phone}
          >
            {c.phone}
          </p>
        </div>
        <a
          href={waLink(c.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/80 text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-zinc-500/70 hover:bg-zinc-800/70 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/35"
          title="Abrir WhatsApp"
          aria-label={`Abrir WhatsApp para ${c.phone}`}
        >
          <WaIcon className="h-3.5 w-3.5" />
        </a>
      </div>

      {(name || c.email) && (
        <div className="relative z-10 mt-2 space-y-1 border-t border-zinc-800/35 pt-1.5">
          {name && (
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-medium text-zinc-300/85 leading-none" title={name}>
                {name}
              </p>
              <span
                className="text-base leading-none"
                title={`Ranking: ${rankIndicator}`}
                aria-label={`Ranking ${rankIndicator}`}
              >
                {rankIndicator}
              </span>
            </div>
          )}
          {c.email && (
            <p className="text-[11px] text-zinc-500 truncate leading-none" title={c.email}>
              {c.email}
            </p>
          )}
        </div>
      )}

      {hasPurchases && (
        <div className="relative z-10 mt-2 border-t border-zinc-800/35 pt-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-[16px] font-extrabold tracking-tight leading-none tabular-nums ${meta.amountColor}`}>
              {fmtCurrency(c.total_valor)}
            </span>
            <span className="text-[10px] font-medium text-zinc-500/80">
              {c.purchase_count} carga{c.purchase_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      <div className="relative z-10 mt-2 flex min-w-0 items-center gap-1.5 border-t border-zinc-800/30 pt-1.5 text-[10px] leading-none">
        <span
          className="text-zinc-400/95 font-medium"
          title="Tiempo desde la ultima actividad del contacto (ultimo cambio de estado registrado)."
        >
          {relDate(c.last_activity)}
        </span>
        {!hasPurchases && (
          <>
            <span className="text-zinc-700"></span>
            <span className="text-zinc-500">{statusLabel}</span>
          </>
        )}
        {c.region && (
          <>
            <span className="text-zinc-700"></span>
            <span className="min-w-0 truncate text-zinc-600" title={c.region}>{c.region}</span>
          </>
        )}
      </div>
    </div>
  );
}
export default function FunnelBoard({
  contacts,
  premiumThreshold,
  headerSlot,
  rankingConfig,
}: {
  contacts: FunnelContact[];
  premiumThreshold: number;
  headerSlot?: ReactNode;
  rankingConfig?: TrackingRankingConfig | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const grouped = useMemo(() => {
    const g: Record<FunnelStage, FunnelContact[]> = {
      leads: [], primera_carga: [], recurrente: [], premium: [],
    };

    for (const c of contacts) {
      const stage = classifyContact(c, premiumThreshold);
      g[stage].push(c);
    }

    const dir = sortDir === "desc" ? 1 : -1;
    const sortFn = (a: FunnelContact, b: FunnelContact) =>
      sortKey === "amount"
        ? (b.total_valor - a.total_valor) * dir
        : (new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()) * dir;

    for (const s of STAGES) g[s].sort(sortFn);

    return g;
  }, [contacts, premiumThreshold, sortKey, sortDir]);

  const stageRevenue = useMemo(() => {
    const rev: Record<FunnelStage, number> = { leads: 0, primera_carga: 0, recurrente: 0, premium: 0 };
    for (const s of STAGES) for (const c of grouped[s]) rev[s] += c.total_valor;
    return rev;
  }, [grouped]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>{headerSlot}</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-600 font-medium">Ordenar</span>
          <div className="flex items-center rounded-lg border border-zinc-800/40 bg-[#0d0d11] p-0.5">
          {(["date", "amount"] as SortKey[]).map((k) => {
            const active = sortKey === k;
            return (
              <button
                key={k}
                onClick={() => toggleSort(k)}
                className={`cursor-pointer rounded-md px-3 py-1 text-[11px] font-medium transition-all flex items-center gap-1 ${
                  active
                    ? "bg-zinc-800 text-zinc-200 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                {k === "date" ? "Fecha" : "Monto"}
                <svg viewBox="0 0 10 14" className={`h-3 w-2.5 flex-shrink-0 ${active ? "" : "opacity-30"}`}>
                  <path d="M5 0L9.5 5H0.5L5 0Z" fill={active && sortDir === "asc" ? "currentColor" : "currentColor"} opacity={active && sortDir === "asc" ? 1 : 0.25} />
                  <path d="M5 14L0.5 9H9.5L5 14Z" fill={active && sortDir === "desc" ? "currentColor" : "currentColor"} opacity={active && sortDir === "desc" ? 1 : 0.25} />
                </svg>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {/* aa KANBAN COLUMNS aa */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const meta = STAGE_META[stage];
          const list = grouped[stage];
          const rev = stageRevenue[stage];

          return (
            <div key={stage} className={`flex flex-col rounded-2xl border ${meta.columnBorder} bg-[#0d0d11] overflow-hidden`}>
              {/* Column Header */}
              <div className={`sticky top-0 z-10 bg-[#0d0d11]/95 backdrop-blur-[2px] bg-gradient-to-b ${meta.headerGlow} px-4 pt-3.5 pb-3 border-b border-zinc-800/30`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-[13px] font-bold uppercase tracking-wide ${meta.accent} leading-none`}>
                      {meta.label}
                    </h4>
                  </div>
                  <span className="rounded-full bg-zinc-800/70 px-2.5 py-0.5 text-[11px] font-bold text-zinc-300 tabular-nums leading-none">
                    {list.length}
                  </span>
                </div>
                {rev > 0 && (
                  <p className={`mt-1.5 text-sm font-bold ${meta.accentSoft} tabular-nums leading-none`}>
                    {fmtCompact(rev)}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-1.5">
                {list.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-[11px] text-zinc-800">Sin contactos</p>
                  </div>
                ) : (
                  list.map((c) => (
                    <ContactCard
                      key={c.phone}
                      c={c}
                      stage={stage}
                      rankingConfig={rankingConfig}
                    />
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





