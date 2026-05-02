"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildFunnelContactsFromConversions,
  type ConversionRow,
  type FetchDateRange,
} from "@/lib/conversionsDb";
import { computeCoreStats } from "@/lib/conversionStats";

type Props = {
  fetchConversionsForMonth: (range: FetchDateRange) => Promise<ConversionRow[]>;
  gerenciaByPhone: Record<string, string[]>;
  premiumThreshold: number;
  storageKey: string;
};

type Row = {
  label: string;
  mensajes: number;
  cargas: number;
  pctCarga: number;
  pctRecarga: number;
};

type SortKey = "label" | "mensajes" | "cargas" | "pctCarga" | "pctRecarga" | "cost" | "gasto";
type SortDirection = "asc" | "desc";

const FIRST_DATA_MONTH = "2026-01";

const normalizePhone = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "");

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(monthValue: string): FetchDateRange {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return monthRange(currentMonthValue());
  }
  return {
    start: new Date(year, monthIndex, 1, 0, 0, 0, 0),
    end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
  };
}

function monthLabel(monthValue: string): string {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
  if (!Number.isFinite(date.getTime())) return monthValue;
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}

function monthOptions(firstMonthValue = FIRST_DATA_MONTH): Array<{ value: string; label: string }> {
  const now = new Date();
  const [firstYearRaw, firstMonthRaw] = firstMonthValue.split("-");
  const firstYear = Number(firstYearRaw);
  const firstMonthIndex = Number(firstMonthRaw) - 1;
  const firstDate = new Date(firstYear, firstMonthIndex, 1);
  const monthCount = Number.isFinite(firstDate.getTime())
    ? ((now.getFullYear() - firstDate.getFullYear()) * 12) + now.getMonth() - firstDate.getMonth() + 1
    : 1;

  return Array.from({ length: Math.max(monthCount, 1) }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: monthLabel(value) };
  });
}

function parseAmount(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value || 0)}%`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function GerenciasPerformancePanel({
  fetchConversionsForMonth,
  gerenciaByPhone,
  premiumThreshold,
  storageKey,
}: Props) {
  const [month, setMonth] = useState(currentMonthValue());
  const [rows, setRows] = useState<ConversionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalCost, setGlobalCost] = useState("");
  const [costByGerencia, setCostByGerencia] = useState<Record<string, string>>({});
  const [costStorageReadyKey, setCostStorageReadyKey] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const costStorageKey = `gerencias-performance-costs:v1:${storageKey}`;
  const monthSelectOptions = useMemo(() => monthOptions(), []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(costStorageKey);
      setCostByGerencia(raw ? JSON.parse(raw) as Record<string, string> : {});
    } catch {
      setCostByGerencia({});
    } finally {
      setCostStorageReadyKey(costStorageKey);
    }
  }, [costStorageKey]);

  useEffect(() => {
    if (costStorageReadyKey !== costStorageKey) return;
    try {
      window.localStorage.setItem(costStorageKey, JSON.stringify(costByGerencia));
    } catch {
      // LocalStorage puede no estar disponible en modo privado; el calculo sigue funcionando en memoria.
    }
  }, [costByGerencia, costStorageKey, costStorageReadyKey]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConversionsForMonth(monthRange(month));
      setRows(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "No se pudo cargar el desempeño por gerencias.");
    } finally {
      setLoading(false);
    }
  }, [fetchConversionsForMonth, month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const performanceRows = useMemo<Row[]>(() => {
    const allLabels = new Set<string>();
    for (const labels of Object.values(gerenciaByPhone)) {
      for (const label of labels) allLabels.add(label);
    }

    const rowsByGerencia = new Map<string, ConversionRow[]>();
    const cleanRows = rows.filter((row) => !String(row.test_event_code ?? "").trim());
    for (const row of cleanRows) {
      const assignedPhone = normalizePhone(row.telefono_asignado);
      if (!assignedPhone) continue;
      const labels = gerenciaByPhone[assignedPhone] ?? [];
      for (const label of labels) {
        allLabels.add(label);
        const bucket = rowsByGerencia.get(label) ?? [];
        bucket.push(row);
        rowsByGerencia.set(label, bucket);
      }
    }

    return Array.from(allLabels)
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((label) => {
        const gerenciaRows = rowsByGerencia.get(label) ?? [];
        const funnel = buildFunnelContactsFromConversions(gerenciaRows);
        const core = computeCoreStats(gerenciaRows, funnel, gerenciaRows, premiumThreshold);
        const mensajes = core.uniqueLeadsLinkedToContact;
        const cargas = core.totalPurchases;
        return {
          label,
          mensajes,
          cargas,
          pctCarga: mensajes > 0 ? (core.firstLoadPurchasersLinkedToLead / mensajes) * 100 : 0,
          pctRecarga: core.firstLoadPurchasersLinkedToLead > 0
            ? (core.repeatFromFirstInRange / core.firstLoadPurchasersLinkedToLead) * 100
            : 0,
        };
      });
  }, [gerenciaByPhone, premiumThreshold, rows]);

  const totals = useMemo(() => {
    return performanceRows.reduce(
      (acc, row) => {
        const cost = parseAmount(costByGerencia[`${month}::${row.label}`] ?? "");
        return {
          mensajes: acc.mensajes + row.mensajes,
          cargas: acc.cargas + row.cargas,
          gasto: acc.gasto + row.mensajes * cost,
        };
      },
      { mensajes: 0, cargas: 0, gasto: 0 },
    );
  }, [costByGerencia, month, performanceRows]);

  const applyGlobalCost = () => {
    setCostByGerencia((prev) => {
      const next = { ...prev };
      for (const row of performanceRows) {
        next[`${month}::${row.label}`] = globalCost;
      }
      return next;
    });
  };

  const getCost = useCallback((row: Row) => parseAmount(costByGerencia[`${month}::${row.label}`] ?? ""), [costByGerencia, month]);
  const getGasto = useCallback((row: Row) => row.mensajes * getCost(row), [getCost]);

  const sortedRows = useMemo(() => {
    const valueFor = (row: Row): number | string => {
      if (sortKey === "label") return row.label;
      if (sortKey === "cost") return getCost(row);
      if (sortKey === "gasto") return getGasto(row);
      return row[sortKey];
    };
    return [...performanceRows].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      const result = typeof av === "string" || typeof bv === "string"
        ? String(av).localeCompare(String(bv), "es")
        : av - bv;
      return sortDirection === "asc" ? result : -result;
    });
  }, [getCost, getGasto, performanceRows, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDirection((currentDirection) => currentDirection === "asc" ? "desc" : "asc");
        return currentKey;
      }
      setSortDirection(key === "label" ? "asc" : "desc");
      return key;
    });
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return "△";
    return sortDirection === "asc" ? "▲" : "▼";
  };

  const SortHeader = ({ sort, children }: { sort: SortKey; children: ReactNode }) => (
    <button
      type="button"
      onClick={() => toggleSort(sort)}
      className="inline-flex w-full items-center justify-center gap-1 text-center font-medium text-zinc-300 transition hover:text-zinc-100"
      title="Ordenar columna"
    >
      <span>{children}</span>
      <span className={sortKey === sort ? "text-zinc-100" : "text-zinc-600"}>{sortIcon(sort)}</span>
    </button>
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">Desempeño por Gerencias</h3>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonthValue())}
            aria-label="Seleccionar mes"
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs font-medium text-zinc-100"
          >
            {monthSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void loadMonth()}
          disabled={loading}
          className="h-8 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-700">
          <table className="w-full min-w-[980px] table-fixed text-[11px]">
            <colgroup>
              <col className="w-[14.285%]" />
              <col className="w-[14.285%]" />
              <col className="w-[14.285%]" />
              <col className="w-[14.285%]" />
              <col className="w-[14.285%]" />
              <col className="w-[14.285%]" />
              <col className="w-[14.285%]" />
            </colgroup>
            <thead className="bg-zinc-800/95">
              <tr>
                <th className="px-3 py-2"><SortHeader sort="label">Nombre Gerencia (ID)</SortHeader></th>
                <th className="px-3 py-2"><SortHeader sort="mensajes">Mensajes recibidos</SortHeader></th>
                <th className="px-3 py-2"><SortHeader sort="cargas">Cargas Totales</SortHeader></th>
                <th className="px-3 py-2"><SortHeader sort="pctCarga">Porcentaje de carga</SortHeader></th>
                <th className="px-3 py-2"><SortHeader sort="pctRecarga">Porcentaje de recarga</SortHeader></th>
                <th className="px-3 py-2">
                  <div className="flex flex-col items-center gap-1.5">
                    <SortHeader sort="cost">Costo por msj</SortHeader>
                    <div className="flex w-full items-center justify-center gap-1">
                      <input
                        value={globalCost}
                        onChange={(e) => setGlobalCost(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        aria-label="Costo por mensaje general"
                        className="h-7 w-16 rounded border border-zinc-700 bg-zinc-950 px-2 text-center text-[11px] font-normal text-zinc-100 placeholder:text-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={applyGlobalCost}
                        className="h-7 rounded border border-zinc-700 bg-zinc-800 px-2 text-[10px] font-medium text-zinc-200 transition hover:bg-zinc-700"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </th>
                <th className="px-3 py-2"><SortHeader sort="gasto">Gasto</SortHeader></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {performanceRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                    No hay gerencias configuradas para comparar.
                  </td>
                </tr>
              ) : sortedRows.map((row) => {
                const costKey = `${month}::${row.label}`;
                const costRaw = costByGerencia[costKey] ?? "";
                const gasto = getGasto(row);
                return (
                  <tr key={row.label} className="bg-zinc-950/40">
                    <td className="px-3 py-2 text-center font-medium text-zinc-100">{row.label}</td>
                    <td className="px-3 py-2 text-center text-amber-300">{formatNumber(row.mensajes)}</td>
                    <td className="px-3 py-2 text-center text-sky-300">{formatNumber(row.cargas)}</td>
                    <td className="px-3 py-2 text-center text-zinc-200">{formatPercent(row.pctCarga)}</td>
                    <td className="px-3 py-2 text-center text-zinc-200">{formatPercent(row.pctRecarga)}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        value={costRaw}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCostByGerencia((prev) => ({ ...prev, [costKey]: value }));
                        }}
                        inputMode="decimal"
                        placeholder="0"
                        className="h-7 w-24 rounded border border-zinc-700 bg-zinc-900 px-2 text-center text-xs text-zinc-100"
                      />
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-emerald-300">{formatMoney(gasto)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-zinc-700 bg-zinc-900/80">
              <tr>
                <td className="px-3 py-2 text-center font-semibold text-zinc-100">Totales</td>
                <td className="px-3 py-2 text-center font-semibold text-amber-300">{formatNumber(totals.mensajes)}</td>
                <td className="px-3 py-2 text-center font-semibold text-sky-300">{formatNumber(totals.cargas)}</td>
                <td className="px-3 py-2 text-center text-zinc-500">-</td>
                <td className="px-3 py-2 text-center text-zinc-500">-</td>
                <td className="px-3 py-2 text-center text-zinc-500">-</td>
                <td className="px-3 py-2 text-center font-semibold text-emerald-300">{formatMoney(totals.gasto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
