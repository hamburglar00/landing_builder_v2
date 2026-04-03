"use client";

import { useEffect, useMemo, useState } from "react";
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
  gerenciaIds: number[];
};

type GerenciaOption = {
  id: number;
  label: string;
};

const DEFAULT_RULES: RankRule[] = [
  { id: "r1", indicator: "\u{1F4A9}", maxTotal: 1000 },
  { id: "r2", indicator: "\u{1F7E2}", maxTotal: 5000 },
  { id: "r3", indicator: "\u{1F7E1}", maxTotal: 10000 },
  { id: "r4", indicator: "\u{1F7E0}", maxTotal: 50000 },
  { id: "r5", indicator: "\u{1F534}", maxTotal: 100000 },
  { id: "r6", indicator: "\u{26AB}", maxTotal: 300000 },
  { id: "r7", indicator: "\u{1F525}", maxTotal: 500000 },
];
const DEFAULT_OVERFLOW = "\u{1F4A3}";
const LEAD_INDICATOR = "\u{1F4F2}";
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
  onDeletePhone,
  gerenciaOptions = [],
  assignedPhoneToGerenciaId = {},
}: {
  conversions: ConversionRow[];
  onRefresh?: () => void;
  refreshing?: boolean;
  rankingConfig?: TrackingRankingConfig | null;
  onRankingConfigChange?: (cfg: TrackingRankingConfig) => void;
  onDeletePhone?: (phone: string) => Promise<void> | void;
  gerenciaOptions?: GerenciaOption[];
  assignedPhoneToGerenciaId?: Record<string, number>;
}) {
  const initialRules = rankingConfig?.rules?.length ? rankingConfig.rules : DEFAULT_RULES;
  const initialOverflow = rankingConfig?.overflowIndicator || DEFAULT_OVERFLOW;
  const initialSort = rankingConfig?.sortMode || DEFAULT_SORT;
  const initialGerenciaFilter = rankingConfig?.gerenciaFilter || "";

  const [rules, setRules] = useState<RankRule[]>(initialRules);
  const [overflowIndicator, setOverflowIndicator] = useState(initialOverflow);
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);
  const [gerenciaFilter, setGerenciaFilter] = useState<string>(
    initialGerenciaFilter,
  );

  const [draftRules, setDraftRules] = useState<RankRule[]>(initialRules);
  const [draftOverflowIndicator, setDraftOverflowIndicator] = useState(initialOverflow);
  const [draftSortMode, setDraftSortMode] = useState<SortMode>(initialSort);
  const [draftGerenciaFilter, setDraftGerenciaFilter] = useState<string>(
    initialGerenciaFilter,
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deletingPhone, setDeletingPhone] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  const [openConfig, setOpenConfig] = useState(false);

  const stripArPrefix = (phone: string) => {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.startsWith("549") ? digits.slice(3) : digits;
  };

  useEffect(() => {
    const nextRules = rankingConfig?.rules?.length
      ? rankingConfig.rules
      : DEFAULT_RULES;
    const nextOverflow = rankingConfig?.overflowIndicator || DEFAULT_OVERFLOW;
    const nextSort = rankingConfig?.sortMode || DEFAULT_SORT;
    const nextGerenciaFilter = rankingConfig?.gerenciaFilter || "";

    // Sincroniza estado persistido desde config, sin depender de abrir/cerrar modal.
    // Evita pisar el sort recién guardado al cerrar la ventana.
    setRules(nextRules);
    setOverflowIndicator(nextOverflow);
    setSortMode(nextSort);
    setGerenciaFilter(nextGerenciaFilter);
    setDraftRules(nextRules);
    setDraftOverflowIndicator(nextOverflow);
    setDraftSortMode(nextSort);
    setDraftGerenciaFilter(nextGerenciaFilter);
  }, [rankingConfig]);

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
      const gerenciaSet = new Set<number>();
      for (const row of group) {
        const assignedDigits = String(row.telefono_asignado ?? "").replace(/\D/g, "");
        if (!assignedDigits) continue;
        const gid = assignedPhoneToGerenciaId[assignedDigits];
        if (Number.isFinite(gid)) gerenciaSet.add(gid);
      }
      out.push({
        phone,
        lastActive,
        loads,
        totalLoaded,
        avgLoad,
        gerenciaIds: Array.from(gerenciaSet),
      });
    }
    return out;
  }, [conversions, assignedPhoneToGerenciaId]);

  const sortedRows = useMemo(() => {
    const byLastActiveDesc = (a: TrackingRow, b: TrackingRow) =>
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();

    // Si se ordena por última actividad, se aplica sobre TODO el listado.
    // En los demás criterios mantenemos leads al final.
    if (sortMode === "last_active_desc") {
      return [...rows].sort(byLastActiveDesc);
    }

    const withLoads = rows.filter((r) => r.loads > 0);
    const leads = rows.filter((r) => r.loads === 0);

    const sorter = (a: TrackingRow, b: TrackingRow) => {
      if (sortMode === "total_loaded_desc") return b.totalLoaded - a.totalLoaded;
      if (sortMode === "loads_desc") return b.loads - a.loads;
      return b.avgLoad - a.avgLoad;
    };

    withLoads.sort(sorter);
    leads.sort(byLastActiveDesc);
    return [...withLoads, ...leads];
  }, [rows, sortMode]);

  const indicatorFor = (total: number) => {
    const sorted = [...rules].sort((a, b) => a.maxTotal - b.maxTotal);
    for (const r of sorted) {
      if (total < r.maxTotal) return r.indicator || "-";
    }
    return overflowIndicator || "-";
  };

  const filteredRows = useMemo(() => {
    const selectedGerencia = Number(gerenciaFilter || 0);
    const baseRows =
      selectedGerencia > 0
        ? sortedRows.filter((r) => r.gerenciaIds.includes(selectedGerencia))
        : sortedRows;

    const q = search.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter((r) => {
      const rank = r.loads === 0 ? LEAD_INDICATOR : indicatorFor(r.totalLoaded);
      return (
        String(rank).toLowerCase().includes(q) ||
        String(r.phone).toLowerCase().includes(q) ||
        String(r.loads).toLowerCase().includes(q) ||
        formatCurrency(r.avgLoad).toLowerCase().includes(q) ||
        formatCurrency(r.totalLoaded).toLowerCase().includes(q) ||
        formatThousands(r.totalLoaded).toLowerCase().includes(q)
      );
    });
  }, [sortedRows, search, rules, overflowIndicator, gerenciaFilter]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const openConfigModal = () => {
    setDraftRules(rules);
    setDraftOverflowIndicator(overflowIndicator);
    setDraftSortMode(sortMode);
    setDraftGerenciaFilter(gerenciaFilter);
    setOpenConfig(true);
  };

  const saveConfig = () => {
    setRules(draftRules);
    setOverflowIndicator(draftOverflowIndicator);
    setSortMode(draftSortMode);
    setGerenciaFilter(draftGerenciaFilter);
    onRankingConfigChange?.({
      rules: draftRules,
      overflowIndicator: draftOverflowIndicator,
      sortMode: draftSortMode,
      gerenciaFilter: draftGerenciaFilter,
    });
    setOpenConfig(false);
  };

  const handleDelete = async (phone: string) => {
    if (!onDeletePhone) return;
    const ok = window.confirm(`Eliminar jugador ${phone} y su historial?`);
    if (!ok) return;
    try {
      setDeletingPhone(phone);
      await onDeletePhone(phone);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo eliminar el jugador.";
      window.alert(msg);
    } finally {
      setDeletingPhone(null);
    }
  };

  const exportMessage = useMemo(() => {
    if (filteredRows.length === 0) return "No hay jugadores en el filtro actual.";
    const lines: string[] = [];
    lines.push("📌 RESUMEN DE JUGADORES");
    lines.push("");
    lines.push(`📊 Jugadores en filtro: ${filteredRows.length}`);
    lines.push("");
    for (const r of filteredRows) {
      const rank = r.loads === 0 ? LEAD_INDICATOR : indicatorFor(r.totalLoaded);
      lines.push(`• ${rank} wa.me/${stripArPrefix(r.phone)}`);
      lines.push(`⏳ Última actividad: ${relDate(r.lastActive)}`);
      lines.push(`💸 Carga promedio: ${formatCurrency(r.avgLoad)}`);
      lines.push(`🏦 Total cargado: ${formatCurrency(r.totalLoaded)}`);
      lines.push("");
    }
    return lines.join("\n").trim();
  }, [filteredRows, overflowIndicator, rules]);

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportMessage);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 1800);
    } catch {
      setCopiedExport(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, sortMode, gerenciaFilter, conversions.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Seguimiento ({filteredRows.length})</h3>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ranking, telefono, cargas..."
            className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-500 sm:w-[280px]"
          />
          <button
            type="button"
            onClick={onRefresh}
            disabled={!onRefresh || refreshing}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-60 sm:flex-none"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={openConfigModal}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 sm:flex-none"
          >
            Configurar ranking
          </button>
        </div>
      </div>

      <p className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
        Abre WhatsApp Web en tu navegador e inicia sesion con el WhatsApp de soporte para que puedas contactar a tus jugadores y realizar un seguimiento.
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-700">
        <table className="w-full text-left text-[11px] sm:min-w-[840px]">
          <thead className="bg-zinc-800/95">
            <tr>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Ranking</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Numero de telefono</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Whatsapp</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">
                <span className="hidden sm:inline">Ultima vez activo</span>
                <span className="inline sm:hidden">Ultima vez<br />activo</span>
              </th>
              <th className="hidden sm:table-cell px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Cargas</th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">
                <span className="hidden sm:inline">Carga promedio</span>
                <span className="inline sm:hidden">Carga<br />promedio</span>
              </th>
              <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">
                <span className="hidden sm:inline">Total cargado</span>
                <span className="inline sm:hidden">Total<br />cargado</span>
              </th>
              {onDeletePhone && (
                <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap text-right">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={onDeletePhone ? 8 : 7} className="px-2 py-6 text-center text-zinc-500">
                  Aun no hay datos para seguimiento.
                </td>
              </tr>
            ) : (
              pagedRows.map((r) => (
                <tr key={r.phone} className="bg-zinc-950/40">
                  <td className="px-2 py-1.5 text-base" title={`Total: ${formatThousands(r.totalLoaded)}`}>
                    {r.loads === 0 ? LEAD_INDICATOR : indicatorFor(r.totalLoaded)}
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
                  <td className="hidden sm:table-cell px-2 py-1.5 whitespace-nowrap text-zinc-300">{r.loads}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-300">{formatCurrency(r.avgLoad)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-zinc-100 font-semibold">{formatCurrency(r.totalLoaded)}</td>
                  {onDeletePhone && (
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(r.phone)}
                        disabled={deletingPhone === r.phone}
                        className="rounded border border-red-900/70 bg-red-950/30 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/50 disabled:opacity-60"
                      >
                        {deletingPhone === r.phone ? "Eliminando..." : "Eliminar"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filteredRows.length > pageSize && (
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
          <span>
            Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRows.length)} de {filteredRows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Anterior
            </button>
            <span>
              {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
        >
          Exportar jugadores
        </button>
      </div>

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 p-3 sm:p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-zinc-100">Exportar jugadores (filtro actual)</h4>
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <pre className="whitespace-pre-wrap break-words text-xs text-zinc-200">{exportMessage}</pre>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void handleCopyExport()}
                className="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-lime-300"
              >
                {copiedExport ? "Copiado" : "Copiar mensaje"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-3 sm:p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-zinc-100">Configuracion de ranking</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenConfig(false)}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={saveConfig}
                  className="rounded-lg border border-zinc-700 bg-zinc-100 px-2 py-1 text-xs text-zinc-900 hover:bg-zinc-200"
                >
                  Guardar
                </button>
              </div>
            </div>

            <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <label className="text-xs text-zinc-400">Criterio de sort</label>
              <select
                value={draftSortMode}
                onChange={(e) => setDraftSortMode(e.target.value as SortMode)}
                className="w-full sm:w-auto rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
              >
                <option value="last_active_desc">Ultima vez activo</option>
                <option value="total_loaded_desc">Total cargado</option>
                <option value="loads_desc">Cargas</option>
                <option value="avg_load_desc">Carga promedio</option>
              </select>
            </div>

            <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <label className="text-xs text-zinc-400">Filtrar por gerencia</label>
              <select
                value={draftGerenciaFilter}
                onChange={(e) => setDraftGerenciaFilter(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
              >
                <option value="">Todas</option>
                {gerenciaOptions.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="min-w-[640px] w-full text-left text-xs">
                <thead className="bg-zinc-800/95">
                  <tr>
                    <th className="px-2 py-2 text-zinc-300">Indicador</th>
                    <th className="px-2 py-2 text-zinc-300">Criterio</th>
                    <th className="px-2 py-2 text-zinc-300">Total cargado</th>
                    <th className="px-2 py-2 text-zinc-300"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {draftRules.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2">
                        <input
                          value={r.indicator}
                          onChange={(e) => {
                            const next = draftRules.map((x) =>
                              x.id === r.id ? { ...x, indicator: e.target.value } : x,
                            );
                            setDraftRules(next);
                          }}
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
                        />
                      </td>
                      <td className="px-2 py-2 text-zinc-400">menor que</td>
                      <td className="px-2 py-2">
                        <input
                          value={formatThousands(r.maxTotal)}
                          onChange={(e) => {
                            const n = Number(String(e.target.value).replace(/\./g, "").replace(/\D/g, ""));
                            const next = draftRules.map((x) =>
                              x.id === r.id ? { ...x, maxTotal: Number.isFinite(n) ? n : 0 } : x,
                            );
                            setDraftRules(next);
                          }}
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setDraftRules((prev) => prev.filter((x) => x.id !== r.id))}
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

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  setDraftRules((prev) => [
                    ...prev,
                    {
                      id: `r${Date.now()}`,
                      indicator: "\u{2B50}",
                      maxTotal: prev[prev.length - 1]?.maxTotal + 1000 || 1000,
                    },
                  ]);
                }}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Agregar regla
              </button>

              <div className="flex items-center gap-2 sm:ml-auto">
                <label className="text-xs text-zinc-400">Indicador final ({">="} ultimo rango)</label>
                <input
                  value={draftOverflowIndicator}
                  onChange={(e) => setDraftOverflowIndicator(e.target.value)}
                  className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftRules(DEFAULT_RULES);
                  setDraftOverflowIndicator(DEFAULT_OVERFLOW);
                  setDraftSortMode(DEFAULT_SORT);
                  setDraftGerenciaFilter("");
                }}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Restaurar default
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
