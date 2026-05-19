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
  landingOptions?: LandingPerformanceFilterOption[];
  premiumThreshold: number;
  storageKey: string;
};

export type LandingPerformanceFilterOption = {
  id: string;
  name: string;
  userId?: string;
  gerenciaLabels: string[];
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function externalKey(row: ConversionRow): string {
  const ext = String(row.external_id ?? "").trim();
  return ext ? `${row.user_id}::${ext}` : "";
}

function getAttributedPurchaseRows(rows: ConversionRow[]): ConversionRow[] {
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
    (leadLinkedKeys.has(externalKey(row)) || contactKeys.has(externalKey(row)))
  ));
}

export default function GerenciasPerformancePanel({
  fetchConversionsForMonth,
  fetchAvailabilityForMonth,
  gerenciaByPhone,
  landingOptions = [],
  premiumThreshold,
  storageKey,
}: Props) {
  const [month, setMonth] = useState(currentMonthValue());
  const [landingFilter, setLandingFilter] = useState("__all__");
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
  const selectedLanding = useMemo(
    () => landingOptions.find((option) => option.id === landingFilter) ?? null,
    [landingFilter, landingOptions],
  );
  const selectedLandingLabelSet = useMemo(
    () => selectedLanding ? new Set(selectedLanding.gerenciaLabels) : null,
    [selectedLanding],
  );

  useEffect(() => {
    if (landingFilter === "__all__") return;
    if (!landingOptions.some((option) => option.id === landingFilter)) {
      setLandingFilter("__all__");
    }
  }, [landingFilter, landingOptions]);

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
    if (selectedLandingLabelSet) {
      for (const label of selectedLandingLabelSet) allLabels.add(label);
    } else {
      for (const labels of Object.values(gerenciaByPhone)) {
        for (const label of labels) allLabels.add(label);
      }
    }
    for (const row of availabilityRows) {
      if (!selectedLandingLabelSet || selectedLandingLabelSet.has(row.label)) allLabels.add(row.label);
    }

    const rowsByGerencia = new Map<string, ConversionRow[]>();
    const availabilityByLabel = new Map(availabilityRows.map((row) => [row.label, row]));
    const cleanRows = rows.filter((row) => (
      !String(row.test_event_code ?? "").trim() &&
      (!metaAdsOnly || Boolean(row.from_meta_ads)) &&
      (
        !selectedLanding ||
        String(row.landing_id ?? "").trim() === selectedLanding.id ||
        (
          String(row.landing_name ?? "").trim() === selectedLanding.name &&
          (!selectedLanding.userId || String(row.user_id ?? "") === selectedLanding.userId)
        )
      )
    ));
    for (const row of cleanRows) {
      const assignedPhone = normalizePhone(row.telefono_asignado);
      if (!assignedPhone) continue;
      const labels = gerenciaByPhone[assignedPhone] ?? [];
      for (const label of labels) {
        if (selectedLandingLabelSet && !selectedLandingLabelSet.has(label)) continue;
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
        const mensajes = core.uniqueLeadsLinkedToContactWithInferred;
        const attributedPurchaseRows = getAttributedPurchaseRows(gerenciaRows);
        const cargas = attributedPurchaseRows.length;
        const montoCargado = attributedPurchaseRows.reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
        return {
          label,
          contactos,
          pctInicioConversacion: contactos > 0 ? (mensajes / contactos) * 100 : 0,
          mensajes,
          cargas,
          montoCargado,
          disponibilidad: availabilityByLabel.get(label)?.availabilityPct ?? null,
          pctCarga: mensajes > 0 ? (core.firstLoadPurchasersAttributed / mensajes) * 100 : 0,
          pctRecarga: core.firstLoadPurchasersAttributed > 0
            ? (core.repeatFromAttributedFirstInRange / core.firstLoadPurchasersAttributed) * 100
            : 0,
        };
      });
  }, [availabilityRows, gerenciaByPhone, metaAdsOnly, premiumThreshold, rows, selectedLanding, selectedLandingLabelSet]);

  const visiblePerformanceRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return performanceRows;
    return performanceRows.filter((row) => row.label.toLowerCase().includes(query));
  }, [performanceRows, searchTerm]);

  const totals = useMemo(() => {
    return visiblePerformanceRows.reduce(
      (acc, row) => {
        const cost = parseAmount(costByGerencia[`${month}::${row.label}`] ?? "");
        const gasto = row.mensajes * cost;
        return {
          contactos: acc.contactos + row.contactos,
          pctInicioConversacion: acc.pctInicioConversacion + row.pctInicioConversacion,
          mensajes: acc.mensajes + row.mensajes,
          cargas: acc.cargas + row.cargas,
          montoCargado: acc.montoCargado + row.montoCargado,
          pctCarga: acc.pctCarga + row.pctCarga,
          pctRecarga: acc.pctRecarga + row.pctRecarga,
          gasto: acc.gasto + gasto,
          roas: acc.roas + (gasto > 0 ? row.montoCargado / gasto : 0),
          roasCount: acc.roasCount + (gasto > 0 ? 1 : 0),
        };
      },
      {
        contactos: 0,
        pctInicioConversacion: 0,
        mensajes: 0,
        cargas: 0,
        montoCargado: 0,
        pctCarga: 0,
        pctRecarga: 0,
        gasto: 0,
        roas: 0,
        roasCount: 0,
      },
    );
  }, [costByGerencia, month, visiblePerformanceRows]);
  const rowAverageDivisor = visiblePerformanceRows.length || 1;
  const roasAverageDivisor = totals.roasCount || 1;

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

  const exportPdf = () => {
    const reportWindow = window.open("", "_blank", "width=1200,height=800");
    if (!reportWindow) {
      setError("El navegador bloqueó la ventana para exportar el PDF. Permití popups e intentá nuevamente.");
      return;
    }

    const landingLabel = selectedLanding?.name || "Todas las landings";
    const filters = [
      `Mes: ${monthLabel(month)}`,
      `Landing: ${landingLabel}`,
      `Meta Ads: ${metaAdsOnly ? "Sí" : "No"}`,
      `Búsqueda: ${searchTerm.trim() || "-"}`,
      `Orden: ${sortKey} ${sortDirection === "asc" ? "ascendente" : "descendente"}`,
    ];
    const roasHeader = showRoas ? "<th>ROAS</th>" : "";
    const roasAverage = showRoas
      ? `<td>${totals.roasCount > 0 ? formatRoas(totals.roas / roasAverageDivisor) : "-"}</td>`
      : "";
    const roasTotal = showRoas
      ? `<td>${totals.gasto > 0 ? formatRoas(totals.montoCargado / totals.gasto) : "-"}</td>`
      : "";

    const bodyRows = sortedRows.map((row) => {
      const cost = getCost(row);
      const gasto = getGasto(row);
      const roasCell = showRoas ? `<td>${gasto > 0 ? formatRoas(getRoas(row)) : "-"}</td>` : "";
      return `
        <tr>
          <td class="left">${escapeHtml(row.label)}</td>
          <td>${formatOptionalPercent(row.disponibilidad)}</td>
          <td>${formatNumber(row.contactos)}</td>
          <td>${formatPercent(row.pctInicioConversacion)}</td>
          <td>${formatNumber(row.mensajes)}</td>
          <td>${formatNumber(row.cargas)}</td>
          <td>${formatMoney(row.montoCargado)}</td>
          <td>${formatPercent(row.pctCarga)}</td>
          <td>${formatPercent(row.pctRecarga)}</td>
          <td>${cost > 0 ? formatMoney(cost) : "-"}</td>
          <td>${formatMoney(gasto)}</td>
          ${roasCell}
        </tr>
      `;
    }).join("");

    const emptyRow = sortedRows.length === 0
      ? `<tr><td colspan="${showRoas ? 12 : 11}" class="empty">No hay datos para los filtros aplicados.</td></tr>`
      : "";

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Desempeño por Gerencias - ${escapeHtml(monthLabel(month))}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #0f172a;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 10px;
              background: #ffffff;
            }
            header {
              align-items: flex-start;
              background: linear-gradient(135deg, #061f1c 0%, #0f3d34 58%, #0ea5a4 100%);
              border-radius: 14px;
              color: #ffffff;
              display: flex;
              justify-content: space-between;
              margin-bottom: 14px;
              padding: 16px 18px;
              gap: 16px;
            }
            h1 {
              font-size: 20px;
              letter-spacing: 0.02em;
              margin: 0 0 5px;
              text-transform: uppercase;
            }
            .meta {
              color: #c7f9ef;
              line-height: 1.45;
              font-size: 11px;
            }
            .filters {
              color: #eafff8;
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              justify-content: flex-end;
              max-width: 58%;
            }
            .chip {
              background: rgba(255, 255, 255, 0.13);
              border: 1px solid rgba(255, 255, 255, 0.28);
              border-radius: 999px;
              padding: 4px 8px;
              white-space: nowrap;
            }
            .summary {
              display: grid;
              gap: 8px;
              grid-template-columns: repeat(4, 1fr);
              margin-bottom: 12px;
            }
            .summary-card {
              background: #f8fafc;
              border: 1px solid #dbe4ee;
              border-radius: 12px;
              padding: 9px 10px;
            }
            .summary-label {
              color: #64748b;
              font-size: 8px;
              font-weight: 700;
              letter-spacing: 0.08em;
              margin-bottom: 4px;
              text-transform: uppercase;
            }
            .summary-value {
              color: #0f172a;
              font-size: 14px;
              font-weight: 800;
            }
            table {
              border-collapse: collapse;
              border-radius: 12px;
              overflow: hidden;
              table-layout: fixed;
              width: 100%;
            }
            th, td {
              border: 1px solid #d7dee8;
              padding: 5px 4px;
              text-align: center;
              vertical-align: middle;
              word-break: break-word;
            }
            th {
              background: #0f766e;
              color: #ffffff;
              font-size: 9px;
              letter-spacing: 0.03em;
              text-transform: uppercase;
            }
            thead th:first-child { background: #134e4a; }
            tbody tr:nth-child(even) td { background: #f9fafb; }
            tbody tr:nth-child(odd) td { background: #ffffff; }
            tfoot td {
              background: #ecfdf5;
              border-color: #a7f3d0;
              font-weight: 700;
            }
            tfoot tr:last-child td {
              background: #d1fae5;
            }
            .left { text-align: left; }
            .money { color: #047857; font-weight: 700; }
            .empty {
              color: #6b7280;
              padding: 18px;
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>Desempeño por Gerencias</h1>
              <div class="meta">Reporte de rendimiento para los filtros aplicados</div>
            </div>
            <div class="filters">
              ${filters.map((filter) => `<span class="chip">${escapeHtml(filter)}</span>`).join("")}
            </div>
          </header>
          <section class="summary">
            <div class="summary-card">
              <div class="summary-label">Contactos</div>
              <div class="summary-value">${formatNumber(totals.contactos)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Mensajes</div>
              <div class="summary-value">${formatNumber(totals.mensajes)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Cargas</div>
              <div class="summary-value">${formatNumber(totals.cargas)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Monto cargado</div>
              <div class="summary-value">${formatMoney(totals.montoCargado)}</div>
            </div>
          </section>
          <table>
            <thead>
              <tr>
                <th>Gerencia (ID)</th>
                <th>Disponibilidad</th>
                <th>Contactos</th>
                <th>% inicio conversación</th>
                <th>Mensajes</th>
                <th>Cargas</th>
                <th>Monto</th>
                <th>% Carga</th>
                <th>% Recarga</th>
                <th>Costo/msj</th>
                <th>Gasto</th>
                ${roasHeader}
              </tr>
            </thead>
            <tbody>
              ${emptyRow || bodyRows}
            </tbody>
            <tfoot>
              <tr>
                <td class="left">Promedio</td>
                <td>-</td>
                <td>${formatNumber(totals.contactos / rowAverageDivisor)}</td>
                <td>${formatPercent(totals.pctInicioConversacion / rowAverageDivisor)}</td>
                <td>${formatNumber(totals.mensajes / rowAverageDivisor)}</td>
                <td>${formatNumber(totals.cargas / rowAverageDivisor)}</td>
                <td>${formatMoney(totals.montoCargado / rowAverageDivisor)}</td>
                <td>${formatPercent(totals.pctCarga / rowAverageDivisor)}</td>
                <td>${formatPercent(totals.pctRecarga / rowAverageDivisor)}</td>
                <td>-</td>
                <td>${formatMoney(totals.gasto / rowAverageDivisor)}</td>
                ${roasAverage}
              </tr>
              <tr>
                <td class="left">Totales</td>
                <td>-</td>
                <td>${formatNumber(totals.contactos)}</td>
                <td>-</td>
                <td>${formatNumber(totals.mensajes)}</td>
                <td>${formatNumber(totals.cargas)}</td>
                <td>${formatMoney(totals.montoCargado)}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>${formatMoney(totals.gasto)}</td>
                ${roasTotal}
              </tr>
            </tfoot>
          </table>
          <script>
            window.addEventListener("load", () => {
              setTimeout(() => {
                window.print();
              }, 250);
            });
          </script>
        </body>
      </html>`;

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
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
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
      <div className="mb-3 grid grid-cols-1 gap-2 lg:flex lg:items-center lg:gap-2">
        <h3 className="shrink-0 text-sm font-semibold text-zinc-100 lg:mr-1">Desempeño por Gerencias</h3>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonthValue())}
          aria-label="Seleccionar mes"
          className="h-8 w-full shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs font-medium text-zinc-100 lg:w-auto"
        >
          {monthSelectOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={landingFilter}
          onChange={(e) => setLandingFilter(e.target.value || "__all__")}
          aria-label="Filtrar por landing"
          className="h-8 w-full shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs font-medium text-zinc-100 lg:w-[200px] xl:w-[220px]"
          title="Filtrar desempeno por landing"
        >
          <option value="__all__">Todas las landings</option>
          {landingOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name || "Landing sin nombre"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMetaAdsOnly((value) => !value)}
          aria-pressed={metaAdsOnly}
          className="inline-flex h-8 w-full shrink-0 items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600 lg:w-auto lg:justify-start"
          title="Filtrar metricas por origen Meta Ads"
        >
          <span>Meta Ads</span>
          <span className={`relative inline-flex h-4 w-7 rounded-full border transition ${metaAdsOnly ? "border-cyan-400/60 bg-cyan-500/30" : "border-zinc-600 bg-zinc-800"}`}>
            <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition ${metaAdsOnly ? "left-3.5 bg-cyan-300" : "left-0.5 bg-zinc-400"}`} />
          </span>
        </button>
        <div className="hidden lg:block lg:flex-1" />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar gerencia o ID..."
          aria-label="Buscar gerencia por nombre o ID"
          className="h-8 w-full shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 lg:w-52 xl:w-56"
        />
        <button
          type="button"
          onClick={() => void loadMonth()}
          disabled={loading}
          className="h-8 w-full shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60 lg:w-auto"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={loading}
          className="h-8 w-full shrink-0 rounded-lg border border-emerald-700 bg-emerald-900/20 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/35 disabled:opacity-60 lg:w-auto"
        >
          Exportar PDF
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-700">
          <table className="min-w-[1080px] table-fixed text-[9.5px] leading-tight md:min-w-full lg:text-[10px]">
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
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-100">Promedio</td>
                <td className="px-1.5 py-2 text-center text-zinc-500">-</td>
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-200">{formatNumber(totals.contactos / rowAverageDivisor)}</td>
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-200">
                  {formatPercent(totals.pctInicioConversacion / rowAverageDivisor)}
                </td>
                <td className="px-1.5 py-2 text-center font-semibold text-amber-300">{formatNumber(totals.mensajes / rowAverageDivisor)}</td>
                <td className="px-1.5 py-2 text-center font-semibold text-sky-300">{formatNumber(totals.cargas / rowAverageDivisor)}</td>
                <td className="px-1.5 py-2 text-center font-semibold text-emerald-300">{formatMoney(totals.montoCargado / rowAverageDivisor)}</td>
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-200">{formatPercent(totals.pctCarga / rowAverageDivisor)}</td>
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-200">{formatPercent(totals.pctRecarga / rowAverageDivisor)}</td>
                <td className="px-1.5 py-2 text-center text-zinc-500">-</td>
                <td className="px-1.5 py-2 text-center font-semibold text-emerald-300">{formatMoney(totals.gasto / rowAverageDivisor)}</td>
                {showRoas && (
                  <td className="px-1.5 py-2 text-center font-semibold text-cyan-300">
                    {totals.roasCount > 0 ? formatRoas(totals.roas / roasAverageDivisor) : "-"}
                  </td>
                )}
              </tr>
              <tr className="border-t border-zinc-800/80">
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-100">Totales</td>
                <td className="px-1.5 py-2 text-center text-zinc-500">-</td>
                <td className="px-1.5 py-2 text-center font-semibold text-zinc-200">{formatNumber(totals.contactos)}</td>
                <td className="px-1.5 py-2 text-center text-zinc-500">-</td>
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
