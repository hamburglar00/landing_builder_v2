"use client";

import { useMemo, useState } from "react";
import type {
  ConversionRow,
  TrackingRankingConfig,
  TrackingRankingRule,
} from "@/lib/conversionsDb";

type SortMode = TrackingRankingConfig["sortMode"];
type RankRule = TrackingRankingRule;

type TrackingRow = {
  phone: string;
  lastActive: string;
  loads: number;
  totalLoaded: number;
  avgLoad: number;
};

const DEFAULT_RULES: RankRule[] = [
  { id: "r1", indicator: "??", maxTotal: 1000 },
  { id: "r2", indicator: "??", maxTotal: 5000 },
  { id: "r3", indicator: "??", maxTotal: 10000 },
  { id: "r4", indicator: "??", maxTotal: 50000 },
  { id: "r5", indicator: "??", maxTotal: 100000 },
  { id: "r6", indicator: "?", maxTotal: 300000 },
  { id: "r7", indicator: "??", maxTotal: 500000 },
];
const DEFAULT_OVERFLOW = "??";
const DEFAULT_SORT: SortMode = "last_active_desc";

function formatThousands(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.trunc(n || 0)),
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);
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

function waLink(phone: string) {
  return `https://wa.me/${String(phone || "").replace(/\D/g, "")}`;
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.39-1.585l-.386-.234-2.647.887.887-2.647-.234-.386A9.94 9.94 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
  );
}

export default function TrackingBoard({
  conversions,
  onRefresh,
  refreshing = false,
  rankingConfig,
  onRankingConfigChange,
}: {
  conversions: ConversionRow[];
  onRefresh?: () => void;
  refreshing?: boolean;
  rankingConfig?: TrackingRankingConfig | null;
  onRankingConfigChange?: (cfg: TrackingRankingConfig) => void;
}) {
  const [rules, setRules] = useState<RankRule[]>(
    rankingConfig?.rules?.length ? rankingConfig.rules : DEFAULT_RULES,
  );
  const [overflowIndicator, setOverflowIndicator] = useState(
    rankingConfig?.overflowIndicator || DEFAULT_OVERFLOW,
  );
  const [sortMode, setSortMode] = useState<SortMode>(
    rankingConfig?.sortMode || DEFAULT_SORT,
  );
  const [openConfig, setOpenConfig] = useState(false);

  const pushConfig = (
    nextRules: RankRule[],
    nextOverflow: string,
    nextSort: SortMode,
  ) => {
    onRankingConfigChange?.({
      rules: nextRules,
      overflowIndicator: nextOverflow,
      sortMode: nextSort,
    });
  };

  const rows = useMemo<TrackingRow[]>(() => {
    const byPhone = new Map<string, ConversionRow[]>();
    for (const c of conversions) {
      if (!c.phone) continue;
      if (c.estado === "contact") continue;
      const arr = byPhone.get(c.phone) ?? [];
      arr.push(c);
      byPhone.set(c.phone, arr);
    }

    const out: TrackingRow[] = [];
    for (const [phone, group] of byPhone.entries()) {
      const lastActive = group.reduce((acc, cur) => {
        if (!acc) return cur.created_at;
        return new Date(cur.created_at).getTime() > new Date(acc).getTime()
          ? cur.created_at
          : acc;
      }, "");
      const purchaseRows = group.filter((g) => (g.purchase_event_id ?? "") !== "");
      const loads = purchaseRows.length;
      const totalLoaded = purchaseRows.reduce((s, r) => s + Number(r.valor || 0), 0);
      const avgLoad = loads > 0 ? totalLoaded / loads : 0;
      out.push({ phone, lastActive, loads, totalLoaded, avgLoad });
    }
    return out;
  }, [conversions]);

  const sortedRows = useMemo(() => {
    const withLoads = rows.filter((r) => r.loads > 0);
    const leads = rows.filter((r) => r.loads === 0);

    const sorter = (a: TrackingRow, b: TrackingRow) => {
      if (sortMode === "total_loaded_desc") return b.totalLoaded - a.totalLoaded;
      if (sortMode === "loads_desc") return b.loads - a.loads;
      if (sortMode === "avg_load_desc") return b.avgLoad - a.avgLoad;
      return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
    };

    withLoads.sort(sorter);
    leads.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
    return [...withLoads, ...leads];
  }, [rows, sortMode]);

  const indicatorFor = (total: number) => {
    const sorted = [...rules].sort((a, b) => a.maxTotal - b.maxTotal);
    for (const r of sorted) {
      if (total < r.maxTotal) return r.indicator || "-";
    }
    return overflowIndicator || "-";
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">Seguimiento</h3>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={!onRefresh || refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-60"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={() => setOpenConfig(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
          >
            Configurar ranking
          </button>
        </div>
      </div>
      <p className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
        Abre WhatsApp Web en tu navegador e inicia sesion con el WhatsApp de soporte para que puedas contactar a tus jugadores y realizar un seguimiento.
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-700">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-zinc-800/95">
            <tr>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Ranking</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Numero de telefono</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Whatsapp</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Ultima vez activo</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Cargas</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Carga promedio</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Total cargado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-zinc-500">
                  Aun no hay datos para seguimiento.
                </td>
              </tr>
            ) : (
              sortedRows.map((r) => (
                <tr key={r.phone} className="bg-zinc-950/40">
                  <td className="px-2 py-1.5 text-base" title={`Total: ${formatThousands(r.totalLoaded)}`}>
                    {indicatorFor(r.totalLoaded)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-200 font-mono">{r.phone}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <a
                      href={waLink(r.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-500 hover:text-emerald-300"
                      title="Abrir WhatsApp"
                    >
                      <WaIcon className="h-3.5 w-3.5" />
                    </a>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-400" title={new Date(r.lastActive).toLocaleString("es-AR")}>
                    {relDate(r.lastActive)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-300">{r.loads}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-300">{formatCurrency(r.avgLoad)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-100 font-semibold">{formatCurrency(r.totalLoaded)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">Configuracion de ranking</h4>
              <button
                type="button"
                onClick={() => setOpenConfig(false)}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <label className="text-xs text-zinc-400">Criterio de sort</label>
              <select
                value={sortMode}
                onChange={(e) => {
                  const next = e.target.value as SortMode;
                  setSortMode(next);
                  pushConfig(rules, overflowIndicator, next);
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
              >
                <option value="last_active_desc">Ultima vez activo</option>
                <option value="total_loaded_desc">Total cargado</option>
                <option value="loads_desc">Cargas</option>
                <option value="avg_load_desc">Carga promedio</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-800/95">
                  <tr>
                    <th className="px-2 py-2 text-zinc-300">Indicador</th>
                    <th className="px-2 py-2 text-zinc-300">Criterio</th>
                    <th className="px-2 py-2 text-zinc-300">Total cargado</th>
                    <th className="px-2 py-2 text-zinc-300"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2">
                        <input
                          value={r.indicator}
                          onChange={(e) => {
                            const next = rules.map((x) =>
                              x.id === r.id ? { ...x, indicator: e.target.value } : x,
                            );
                            setRules(next);
                            pushConfig(next, overflowIndicator, sortMode);
                          }}
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
                        />
                      </td>
                      <td className="px-2 py-2 text-zinc-400">menor que</td>
                      <td className="px-2 py-2">
                        <input
                          value={formatThousands(r.maxTotal)}
                          onChange={(e) => {
                            const n = Number(
                              String(e.target.value)
                                .replace(/\./g, "")
                                .replace(/\D/g, ""),
                            );
                            const next = rules.map((x) =>
                              x.id === r.id
                                ? { ...x, maxTotal: Number.isFinite(n) ? n : 0 }
                                : x,
                            );
                            setRules(next);
                            pushConfig(next, overflowIndicator, sortMode);
                          }}
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const next = rules.filter((x) => x.id !== r.id);
                            setRules(next);
                            pushConfig(next, overflowIndicator, sortMode);
                          }}
                          className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = [
                    ...rules,
                    {
                      id: `r${Date.now()}`,
                      indicator: "?",
                      maxTotal: rules[rules.length - 1]?.maxTotal + 1000 || 1000,
                    },
                  ];
                  setRules(next);
                  pushConfig(next, overflowIndicator, sortMode);
                }}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Agregar regla
              </button>

              <div className="ml-auto flex items-center gap-2">
                <label className="text-xs text-zinc-400">Indicador final ({">="} ultimo rango)</label>
                <input
                  value={overflowIndicator}
                  onChange={(e) => {
                    setOverflowIndicator(e.target.value);
                    pushConfig(rules, e.target.value, sortMode);
                  }}
                  className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRules(DEFAULT_RULES);
                  setOverflowIndicator(DEFAULT_OVERFLOW);
                  setSortMode(DEFAULT_SORT);
                  pushConfig(DEFAULT_RULES, DEFAULT_OVERFLOW, DEFAULT_SORT);
                }}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Restaurar default
              </button>
              <button
                type="button"
                onClick={() => setOpenConfig(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-xs text-zinc-900 hover:bg-zinc-200"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
