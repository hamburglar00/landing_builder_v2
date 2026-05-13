"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildFunnelContactsFromConversions,
  type ConversionRow,
  type FetchDateRange,
  type GerenciaAvailabilitySummary,
} from "@/lib/conversionsDb";
import { computeCoreStats } from "@/lib/conversionStats";

type Props = {
  fetchConversionsForMonth: (range: FetchDateRange) => Promise<ConversionRow[]>;
  fetchAvailabilityForMonth: (range: FetchDateRange) => Promise<GerenciaAvailabilitySummary[]>;
  gerenciaByPhone: Record<string, string[]>;
  premiumThreshold: number;
  storageKey: string;
};

type Row = {
  label: string;
  contactos: number;
  pctInicioConversacion: number;
  mensajes: number;
  cargas: number;
  montoCargado: number;
  disponibilidad: number | null;
  pctCarga: number;
  pctRecarga: number;
};

type SortKey = "label" | "contactos" | "pctInicioConversacion" | "mensajes" | "cargas" | "montoCargado" | "disponibilidad" | "pctCarga" | "pctRecarga" | "cost" | "gasto" | "roas";
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
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value || 0)}%`;
}

function formatOptionalPercent(value: number | null): string {
  return value === null ? "-" : formatPercent(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatRoas(value: number): string {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}x`;
}

function externalKey(row: ConversionRow): string {
  const ext = String(row.external_id ?? "").trim();
  return ext ? `${row.user_id}::${ext}` : "";
}

function getLinkedPurchaseRows(rows: ConversionRow[]): ConversionRow[] {
  const contactKeys = new Set(
    rows
      .filter((row) => String(row.contact_event_id ?? "").trim())
      .map(externalKey)
      .filter(Boolean),
  );
  const leadLinkedKeys = new Set(
    rows
      .filter((row) => String(row.lead_event_id ?? "").trim())
      .map(externalKey)
      .filter((key) => key && contactKeys.has(key)),
  );

  return rows.filter((row) => (
    String(row.purchase_event_id ?? "").trim() !== "" &&
    leadLinkedKeys.has(externalKey(row))
  ));
}

export default function GerenciasPerformancePanel({
  fetchConversionsForMonth,
  fetchAvailabilityForMonth,
  gerenciaByPhone,
  premiumThreshold,
  storageKey,
}: Props) {
  const [month, setMonth] = useState(currentMonthValue());
  const [rows, setRows] = useState<ConversionRow[]>([]);
  const [availabilityRows, setAvailabilityRows] = useState<GerenciaAvailabilitySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalCost, setGlobalCost] = useState("");
  const [costByGerencia, setCostByGerencia] = useState<Record<string, string>>({});
  const [costStorageReadyKey, setCostStorageReadyKey] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [metaAdsOnly, setMetaAdsOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
      const range = monthRange(month);
      const [data, availability] = await Promise.all([
        fetchConversionsForMonth(range),
        fetchAvailabilityForMonth(range),
      ]);
      setRows(data);
      setAvailabilityRows(availability);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "No se pudo cargar el desempeño por gerencias.");
    } finally {
      setLoading(false);
    }
  }, [fetchAvailabilityForMonth, fetchConversionsForMonth, month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const performanceRows = useMemo<Row[]>(() => {
    const allLabels = new Set<string>();
    for (const labels of Object.values(gerenciaByPhone)) {
      for (const label of labels) allLabels.add(label);
    }
    for (const row of availabilityRows) allLabels.add(row.label);

    const rowsByGerencia = new Map<string, ConversionRow[]>();
    const availabilityByLabel = new Map(availabilityRows.map((row) => [row.label, row]));
    const cleanRows = rows.filter((row) => (
      !String(row.test_event_code ?? "").trim() &&
      (!metaAdsOnly || Boolean(row.from_meta_ads))
    ));
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
        const contactos = core.uniqueContacts;
        const mensajes = core.uniqueLeadsLinkedToContact;
        const linkedPurchaseRows = getLinkedPurchaseRows(gerenciaRows);
        const cargas = linkedPurchaseRows.length;
        const montoCargado = linkedPurchaseRows.reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
        return {
          label,
          contactos,
          pctInicioConversacion: contactos > 0 ? (mensajes / contactos) * 100 : 0,
          mensajes,
          cargas,
          montoCargado,
          disponibilidad: availabilityByLabel.get(label)?.availabilityPct ?? null,
          pctCarga: mensajes > 0 ? (core.firstLoadPurchasersLinkedToLead / mensajes) * 100 : 0,
          pctRecarga: core.firstLoadPurchasersLinkedToLead > 0
            ? (core.repeatFromFirstInRange / core.firstLoadPurchasersLinkedToLead) * 100
            : 0,
        };
      });
  }, [availabilityRows, gerenciaByPhone, metaAdsOnly, premiumThreshold, rows]);

  const visiblePerformanceRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return performanceRows;
    return performanceRows.filter((row) => row.label.toLowerCase().includes(query));
  }, [performanceRows, searchTerm]);

  const totals = useMemo(() => {
    return visiblePerformanceRows.reduce(
      (acc, row) => {
        const cost = parseAmount(costByGerencia[`${month}::${row.label}`] ?? "");
        return {
          contactos: acc.contactos + row.contactos,
          mensajes: acc.mensajes + row.mensajes,
          cargas: acc.cargas + row.cargas,
          montoCargado: acc.montoCargado + row.montoCargado,
          gasto: acc.gasto + row.mensajes * cost,
        };
      },
      { contactos: 0, mensajes: 0, cargas: 0, montoCargado: 0, gasto: 0 },
    );
  }, [costByGerencia, month, visiblePerformanceRows]);

  const applyGlobalCost = () => {
    setCostByGerencia((prev) => {
      const next = { ...prev };
      for (const row of visiblePerformanceRows) {
        next[`${month}::${row.label}`] = globalCost;
      }
      return next;
    });
  };

  const getCost = useCallback((row: Row) => parseAmount(costByGerencia[`${month}::${row.label}`] ?? ""), [costByGerencia, month]);
  const getGasto = useCallback((row: Row) => row.mensajes * getCost(row), [getCost]);
  const getRoas = useCallback((row: Row) => {
    const gasto = getGasto(row);
    return gasto > 0 ? row.montoCargado / gasto : 0;
  }, [getGasto]);
  const showRoas = useMemo(() => visiblePerformanceRows.some((row) => getGasto(row) > 0), [getGasto, visiblePerformanceRows]);
  const columnCount = showRoas ? 12 : 11;

  const sortedRows = useMemo(() => {
    const valueFor = (row: Row): number | string => {
      if (sortKey === "label") return row.label;
      if (sortKey === "cost") return getCost(row);
      if (sortKey === "gasto") return getGasto(row);
      if (sortKey === "roas") return getRoas(row);
      if (sortKey === "disponibilidad") return row.disponibilidad ?? -1;
      return row[sortKey];
    };
    return [...visiblePerformanceRows].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      const result = typeof av === "string" || typeof bv === "string"
        ? String(av).localeCompare(String(bv), "es")
        : av - bv;
      return sortDirection === "asc" ? result : -result;
    });
  }, [getCost, getGasto, getRoas, visiblePerformanceRows, sortDirection, sortKey]);

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
    if (sortKey !== key) return "\u25B3";
    return sortDirection === "asc" ? "\u25B2" : "\u25BC";
  };

  const SortHeader = ({ sort, children }: { sort: SortKey; children: ReactNode }) => (
    <button
      type="button"
      onClick={() => toggleSort(sort)}
      className="inline-flex w-full items-center justify-center gap-0.5 text-center font-medium leading-tight text-zinc-300 transition hover:text-zinc-100"
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
          <button
            type="button"
            onClick={() => setMetaAdsOnly((value) => !value)}
            aria-pressed={metaAdsOnly}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600"
            title="Filtrar metricas por origen Meta Ads"
          >
            <span>Meta Ads</span>
            <span className={`relative inline-flex h-4 w-7 rounded-full border transition ${metaAdsOnly ? "border-cyan-400/60 bg-cyan-500/30" : "border-zinc-600 bg-zinc-800"}`}>
              <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition ${metaAdsOnly ? "left-3.5 bg-cyan-300" : "left-0.5 bg-zinc-400"}`} />
            </span>
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar gerencia o ID..."
            aria-label="Buscar gerencia por nombre o ID"
            className="h-8 w-56 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={() => void loadMonth()}
            disabled={loading}
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-700">
          <table className="w-full max-w-full table-fixed text-[9.5px] leading-tight lg:text-[10px]">
            <colgroup>
              <col className={showRoas ? "w-[12%]" : "w-[14%]"} />
              <col className={showRoas ? "w-[10%]" : "w-[11%]"} />
              <col className={showRoas ? "w-[7%]" : "w-[8%]"} />
              <col className={showRoas ? "w-[9%]" : "w-[10%]"} />
              <col className={showRoas ? "w-[7%]" : "w-[8%]"} />
              <col className={showRoas ? "w-[6%]" : "w-[7%]"} />
              <col className={showRoas ? "w-[9%]" : "w-[10%]"} />
              <col className={showRoas ? "w-[7%]" : "w-[8%]"} />
              <col className={showRoas ? "w-[7%]" : "w-[8%]"} />
              <col className={showRoas ? "w-[11%]" : "w-[10%]"} />
              <col className={showRoas ? "w-[8%]" : "w-[6%]"} />
              {showRoas && <col className="w-[7%]" />}
            </colgroup>
            <thead className="bg-zinc-800/95">
              <tr>
                <th className="px-1.5 py-2"><SortHeader sort="label">Gerencia (ID)</SortHeader></th>
                <th className="px-1.5 py-2">
                  <SortHeader sort="disponibilidad">Disponibilidad</SortHeader>
                </th>
                <th className="px-1.5 py-2"><SortHeader sort="contactos">Contactos</SortHeader></th>
                <th className="px-1.5 py-2"><SortHeader sort="pctInicioConversacion">% inicio conversación</SortHeader></th>
                <th className="px-1.5 py-2"><SortHeader sort="mensajes">Mensajes</SortHeader></th>
                <th className="px-1.5 py-2"><SortHeader sort="cargas">Cargas</SortHeader></th>
                <th className="px-1.5 py-2"><SortHeader sort="montoCargado">Monto</SortHeader></th>
                <th className="px-1.5 py-2"><SortHeader sort="pctCarga">% Carga</SortHeader></th>
                <th className="px-1.5 py-2"><SortHeader sort="pctRecarga">% Recarga</SortHeader></th>
                <th className="px-1.5 py-2">
                  <div className="flex flex-col items-center gap-1.5">
                    <SortHeader sort="cost">Costo/msj</SortHeader>
                    <div className="flex w-full items-center justify-center gap-1">
                      <input
                        value={globalCost}
                        onChange={(e) => setGlobalCost(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        aria-label="Costo por mensaje general"
                        className="h-7 w-12 rounded border border-zinc-700 bg-zinc-950 px-1.5 text-center text-[10px] font-normal text-zinc-100 placeholder:text-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={applyGlobalCost}
                        className="h-7 rounded border border-zinc-700 bg-zinc-800 px-1.5 text-[10px] font-medium text-zinc-200 transition hover:bg-zinc-700"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </th>
                <th className="px-1.5 py-2"><SortHeader sort="gasto">Gasto</SortHeader></th>
                {showRoas && <th className="px-1.5 py-2"><SortHeader sort="roas">ROAS</SortHeader></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {visiblePerformanceRows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-3 py-8 text-center text-zinc-500">
                    {searchTerm.trim()
                      ? "No hay gerencias que coincidan con la busqueda."
                      : "No hay gerencias configuradas para comparar."}
                  </td>
                </tr>
              ) : sortedRows.map((row) => {
                const costKey = `${month}::${row.label}`;
                const costRaw = costByGerencia[costKey] ?? "";
                const gasto = getGasto(row);
                const roas = getRoas(row);
                return (
                  <tr key={row.label} className="bg-zinc-950/40">
                    <td className="truncate px-1.5 py-2 text-center font-medium text-zinc-100" title={row.label}>{row.label}</td>
                    <td
                      className="px-1.5 py-2 text-center text-zinc-200"
                      title="Porcentaje del mes en que la gerencia tuvo al menos un telefono activo."
                    >
                      {formatOptionalPercent(row.disponibilidad)}
                    </td>
                    <td className="px-1.5 py-2 text-center text-zinc-200">{formatNumber(row.contactos)}</td>
                    <td className="px-1.5 py-2 text-center text-zinc-200">{formatPercent(row.pctInicioConversacion)}</td>
                    <td className="px-1.5 py-2 text-center text-amber-300">{formatNumber(row.mensajes)}</td>
                    <td className="px-1.5 py-2 text-center text-sky-300">{formatNumber(row.cargas)}</td>
                    <td className="px-1.5 py-2 text-center font-semibold text-emerald-300">{formatMoney(row.montoCargado)}</td>
                    <td className="px-1.5 py-2 text-center text-zinc-200">{formatPercent(row.pctCarga)}</td>
                    <td className="px-1.5 py-2 text-center text-zinc-200">{formatPercent(row.pctRecarga)}</td>
                    <td className="px-1.5 py-2 text-center">
                      <input
                        value={costRaw}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCostByGerencia((prev) => ({ ...prev, [costKey]: value }));
                        }}
                        inputMode="decimal"
                        placeholder="0"
                        className="h-7 w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 text-center text-[10px] text-zinc-100"
                      />
                    </td>
                    <td className="px-1.5 py-2 text-center font-semibold text-emerald-300">{formatMoney(gasto)}</td>
                    {showRoas && (
                      <td className="px-1.5 py-2 text-center font-semibold text-cyan-300">
                        {gasto > 0 ? formatRoas(roas) : "-"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-zinc-700 bg-zinc-900/80">
              <tr>
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-100">Totales</td>
                <td className="px-1.5 py-2 text-center text-zinc-500">-</td>
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-200">{formatNumber(totals.contactos)}</td>
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-200">
                  {formatPercent(totals.contactos > 0 ? (totals.mensajes / totals.contactos) * 100 : 0)}
                </td>
                <td className="px-1.5 py-2 text-center font-semibold text-amber-300">{formatNumber(totals.mensajes)}</td>
                <td className="px-1.5 py-2 text-center font-semibold text-sky-300">{formatNumber(totals.cargas)}</td>
                <td className="px-1.5 py-2 text-center font-semibold text-emerald-300">{formatMoney(totals.montoCargado)}</td>
                <td className="px-1.5 py-2 text-center text-zinc-500">-</td>
                <td className="px-1.5 py-2 text-center text-zinc-500">-</td>
                <td className="px-1.5 py-2 text-center text-zinc-500">-</td>
                <td className="px-1.5 py-2 text-center font-semibold text-emerald-300">{formatMoney(totals.gasto)}</td>
                {showRoas && (
                  <td className="px-1.5 py-2 text-center font-semibold text-cyan-300">
                    {totals.gasto > 0 ? formatRoas(totals.montoCargado / totals.gasto) : "-"}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
