"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "@/components/conversiones/DateRangeFilter";
import CustomSelect from "@/components/ui/CustomSelect";
import type { MetaAudienceBuyersRequest } from "@/lib/metaAudienceDb";
import {
  META_AUDIENCE_FIELDS,
  RECOMMENDED_META_AUDIENCE_FIELDS,
  buildMetaAudienceCsv,
  fieldCoverage,
  filterMetaAudienceByValue,
  personHasSelectedIdentifier,
  type MetaAudienceField,
  type MetaAudiencePerson,
  type MetaAudiencePurchaseScope,
  type MetaAudienceType,
  type MetaAudienceValueMetric,
} from "@/lib/metaAudienceExport";

type Props = {
  currency: "ARS" | "PYG";
  loadBuyers: (request: MetaAudienceBuyersRequest) => Promise<MetaAudiencePerson[]>;
};

type PeriodPreset = 30 | 60 | 90 | 180 | "custom";

const PERIOD_PRESETS: ReadonlyArray<{ days: 30 | 60 | 90 | 180; label: string }> = [
  { days: 30, label: "Últimos 30 días" },
  { days: 60, label: "Últimos 60 días" },
  { days: 90, label: "Últimos 90 días" },
  { days: 180, label: "Últimos 180 días" },
];

const inputClass =
  "h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10";

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function formatPeriod(range: DateRange | null): string {
  if (!range) return "Todo el historial";
  const formatter = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${formatter.format(range.start)} al ${formatter.format(range.end)}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function recentDateRange(days: number, now = new Date()): DateRange {
  const start = startOfDay(now);
  start.setDate(start.getDate() - (days - 1));
  return { start, end: endOfDay(now) };
}

function dateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function rangeFromDateInputs(start: string, end: string): DateRange | null {
  if (!start || !end) return null;
  const parsedStart = new Date(`${start}T00:00:00`);
  const parsedEnd = new Date(`${end}T23:59:59.999`);
  if (!Number.isFinite(parsedStart.getTime()) || !Number.isFinite(parsedEnd.getTime())) return null;
  if (parsedStart > parsedEnd) return null;
  return { start: parsedStart, end: parsedEnd };
}

function parseOptionalAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function downloadCsv(contents: string, filename: string): void {
  const blob = new Blob(["\uFEFF", contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeDateForFilename(range: DateRange | null): string {
  if (!range) return "historial-completo";
  const part = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `${part(range.start)}_${part(range.end)}`;
}

function AudienceTypeCard({
  value,
  selected,
  title,
  description,
  onSelect,
}: {
  value: MetaAudienceType;
  selected: boolean;
  title: string;
  description: string;
  onSelect: (value: MetaAudienceType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-xl border p-4 text-left transition ${
        selected
          ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
          : "border-zinc-800 bg-zinc-950/45 hover:border-zinc-700 hover:bg-zinc-900/70"
      }`}
      aria-pressed={selected}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <span
          aria-hidden
          className={`h-2.5 w-2.5 rounded-full border ${
            selected ? "border-emerald-300 bg-emerald-400" : "border-zinc-600 bg-zinc-900"
          }`}
        />
        {title}
      </span>
      <span className="mt-2 block text-xs leading-relaxed text-zinc-400">{description}</span>
    </button>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/45 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-zinc-100">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{detail}</p>
    </div>
  );
}

export default function MetaAudiencesPanel({ currency, loadBuyers }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>(() => recentDateRange(30));
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(30);
  const [draftStartDate, setDraftStartDate] = useState(() => dateInputValue(recentDateRange(30).start));
  const [draftEndDate, setDraftEndDate] = useState(() => dateInputValue(recentDateRange(30).end));
  const [buyers, setBuyers] = useState<MetaAudiencePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audienceType, setAudienceType] = useState<MetaAudienceType>("segmented");
  const [valueMetric, setValueMetric] = useState<MetaAudienceValueMetric>("first_purchase");
  const [purchaseScope, setPurchaseScope] = useState<MetaAudiencePurchaseScope>("all");
  const [minimumValue, setMinimumValue] = useState("0");
  const [maximumValue, setMaximumValue] = useState("");
  const [selectedFields, setSelectedFields] = useState<MetaAudienceField[]>(
    RECOMMENDED_META_AUDIENCE_FIELDS,
  );

  const draftDateRange = useMemo(
    () => rangeFromDateInputs(draftStartDate, draftEndDate),
    [draftEndDate, draftStartDate],
  );
  const invalidDateRange = draftDateRange == null;
  const periodChanged = !invalidDateRange && (
    dateInputValue(dateRange.start) !== draftStartDate ||
    dateInputValue(dateRange.end) !== draftEndDate
  );

  const applyPeriodPreset = (days: 30 | 60 | 90 | 180) => {
    const nextRange = recentDateRange(days);
    setPeriodPreset(days);
    setDraftStartDate(dateInputValue(nextRange.start));
    setDraftEndDate(dateInputValue(nextRange.end));
    setDateRange(nextRange);
  };

  const applyCustomPeriod = () => {
    if (!draftDateRange) return;
    setPeriodPreset("custom");
    setDateRange(draftDateRange);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBuyers(await loadBuyers({
        currency,
        range: dateRange,
        purchaseScope: valueMetric === "first_purchase" ? "all" : purchaseScope,
        valueMetric,
      }));
    } catch (cause) {
      console.error(cause);
      setBuyers([]);
      setError(cause instanceof Error ? cause.message : "No se pudo calcular la audiencia.");
    } finally {
      setLoading(false);
    }
  }, [currency, dateRange, loadBuyers, purchaseScope, valueMetric]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void loadBuyers({
      currency,
      range: dateRange,
      purchaseScope: valueMetric === "first_purchase" ? "all" : purchaseScope,
      valueMetric,
    })
      .then((loadedBuyers) => {
        if (active) setBuyers(loadedBuyers);
      })
      .catch((cause) => {
        console.error(cause);
        if (!active) return;
        setBuyers([]);
        setError(cause instanceof Error ? cause.message : "No se pudo calcular la audiencia.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currency, dateRange, loadBuyers, purchaseScope, valueMetric]);

  const minimum = audienceType === "segmented" ? parseOptionalAmount(minimumValue) : null;
  const maximum = audienceType === "segmented" ? parseOptionalAmount(maximumValue) : null;
  const invalidRange = minimum != null && maximum != null && maximum < minimum;

  const people = useMemo(
    () => filterMetaAudienceByValue(
      buyers,
      audienceType === "value_based" ? Number.MIN_VALUE : invalidRange ? null : minimum,
      invalidRange ? null : maximum,
    ),
    [audienceType, buyers, invalidRange, maximum, minimum],
  );
  const excludedByValue = buyers.length - people.length;
  const coverage = useMemo(() => fieldCoverage(people), [people]);
  const eligiblePeople = useMemo(
    () => people.filter((person) => personHasSelectedIdentifier(person, selectedFields)),
    [people, selectedFields],
  );
  const missingIdentifierCount = people.length - eligiblePeople.length;
  const csv = useMemo(
    () => buildMetaAudienceCsv({ people, selectedFields, audienceType }),
    [audienceType, people, selectedFields],
  );

  const toggleField = (field: MetaAudienceField) => {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((currentField) => currentField !== field)
        : META_AUDIENCE_FIELDS.map((item) => item.key).filter(
            (candidate) => candidate === field || current.includes(candidate),
          ),
    );
  };

  const handleExport = () => {
    if (invalidRange || selectedFields.length === 0 || eligiblePeople.length === 0) return;
    const typePart = audienceType === "value_based" ? "basada-en-valor" : "segmentada";
    const filename = `audiencia-meta-${typePart}-${currency.toLowerCase()}-${safeDateForFilename(dateRange)}.csv`;
    downloadCsv(csv, filename);
  };

  const totalAudienceValue = eligiblePeople.reduce((sum, person) => sum + person.value, 0);
  const representedPurchases = eligiblePeople.reduce((sum, person) => sum + person.purchaseCount, 0);
  const averageBuyerValue = eligiblePeople.length > 0
    ? totalAudienceValue / eligiblePeople.length
    : 0;
  const medianBuyerValue = median(eligiblePeople.map((person) => person.value));
  const peopleWithPhone = people.filter((person) => Boolean(person.fields.phone)).length;
  const peopleWithEmail = people.filter((person) => Boolean(person.fields.email)).length;
  const peopleWithPhoneOrEmail = people.filter(
    (person) => Boolean(person.fields.phone || person.fields.email),
  ).length;
  const exportablePercentage = buyers.length > 0
    ? Math.round((eligiblePeople.length / buyers.length) * 100)
    : 0;
  const hasPrimaryIdentifier = selectedFields.includes("email") || selectedFields.includes("phone");

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-100">Audiencias Meta</h3>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-300">
              Archivo CSV
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-400">
            Generá una lista de compradores para cargar manualmente en Meta. Esta herramienta no envía eventos,
            no usa CAPI y no modifica las conversiones registradas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.6 15a7 7 0 0 0 11.8 2M18.4 9A7 7 0 0 0 6.6 7" />
          </svg>
          {loading ? "Cargando..." : "Actualizar datos"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/25 px-3 py-2 text-xs text-red-300" role="alert">
          Error al cargar los datos: {error}
        </div>
      ) : null}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-zinc-200">1. Tipo de audiencia</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Elegí qué información recibirá Meta.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <AudienceTypeCard
            value="segmented"
            selected={audienceType === "segmented"}
            title="Segmentada por valor"
            description="El monto se usa para seleccionar personas. El archivo exporta solamente sus identificadores."
            onSelect={setAudienceType}
          />
          <AudienceTypeCard
            value="value_based"
            selected={audienceType === "value_based"}
            title="Basada en valor"
            description="Además de los identificadores, el archivo incluye el valor individual calculado para cada persona."
            onSelect={setAudienceType}
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-zinc-200">2. Periodo y cálculo</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Elegí un periodo rápido o definí las fechas exactas desde el calendario.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300">
              {formatPeriod(dateRange)}
            </span>
            <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-2 py-1 font-semibold text-emerald-300">
              {currency}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/35 p-3">
          <div className="flex flex-wrap gap-1.5">
            {PERIOD_PRESETS.map((preset) => {
              const selected = periodPreset === preset.days;
              return (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => applyPeriodPreset(preset.days)}
                  aria-pressed={selected}
                  className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition ${
                    selected
                      ? "border-emerald-600/60 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            {periodPreset === "custom" ? (
              <span className="rounded-lg border border-sky-700/50 bg-sky-950/25 px-2.5 py-1.5 text-[10px] font-medium text-sky-300">
                Personalizado
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">Desde</span>
              <input
                type="date"
                value={draftStartDate}
                max={draftEndDate || undefined}
                onChange={(event) => {
                  setDraftStartDate(event.target.value);
                  setPeriodPreset("custom");
                }}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">Hasta</span>
              <input
                type="date"
                value={draftEndDate}
                min={draftStartDate || undefined}
                max={dateInputValue(new Date())}
                onChange={(event) => {
                  setDraftEndDate(event.target.value);
                  setPeriodPreset("custom");
                }}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={applyCustomPeriod}
              disabled={invalidDateRange || !periodChanged}
              className="ui-button h-9 border border-zinc-700 bg-zinc-800 px-3 text-zinc-200 hover:bg-zinc-700 disabled:opacity-45"
            >
              Aplicar periodo
            </button>
          </div>
          {invalidDateRange ? (
            <p className="mt-2 text-[11px] text-red-300" role="alert">
              Seleccioná una fecha desde y hasta válidas.
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <CustomSelect
            id="meta-audience-value-metric"
            label="Calcular el valor según"
            value={valueMetric}
            onChange={(value) => setValueMetric(value as MetaAudienceValueMetric)}
            options={[
              { value: "first_purchase", label: "Valor de la primera carga" },
              { value: "period_total", label: "Total cargado en el periodo" },
            ]}
          />
          {valueMetric === "period_total" ? (
            <CustomSelect
              id="meta-audience-purchase-scope"
              label="Compras incluidas en el total"
              value={purchaseScope}
              onChange={(value) => setPurchaseScope(value as MetaAudiencePurchaseScope)}
              options={[
                { value: "all", label: "Primeras cargas y recargas" },
                { value: "first", label: "Solo primeras cargas" },
                { value: "repeat", label: "Solo recargas" },
              ]}
            />
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Compras incluidas</p>
              <p className="mt-1 text-xs text-zinc-300">Primera carga histórica de compradores activos en el periodo</p>
            </div>
          )}
        </div>

        {audienceType === "segmented" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">Monto mínimo {currency}</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={minimumValue}
                onChange={(event) => setMinimumValue(event.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">Monto máximo {currency} (opcional)</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={maximumValue}
                onChange={(event) => setMaximumValue(event.target.value)}
                className={inputClass}
                placeholder="Sin máximo"
              />
            </label>
            {invalidRange ? (
              <p className="md:col-span-2 text-[11px] text-red-300" role="alert">
                El monto máximo debe ser igual o mayor al mínimo.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-sky-900/50 bg-sky-950/20 px-3 py-2 text-[11px] leading-relaxed text-sky-200/80">
            La columna <span className="font-mono text-sky-200">value</span> contendrá el valor calculado para cada persona, sin símbolo de moneda.
            Al cargar el archivo en Meta, indicá {currency} como moneda del valor.
          </p>
        )}
      </div>

      <div className="mt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-200">3. Datos para identificar personas</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Cada fila incluirá únicamente los campos seleccionados y disponibles.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedFields(RECOMMENDED_META_AUDIENCE_FIELDS)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Seleccionar recomendados
            </button>
            <button
              type="button"
              onClick={() => setSelectedFields(META_AUDIENCE_FIELDS.map((field) => field.key))}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedFields([])}
              className="rounded-lg border border-zinc-800 px-2.5 py-1 text-[10px] text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {META_AUDIENCE_FIELDS.map((field) => {
            const selected = selectedFields.includes(field.key);
            const available = coverage[field.key];
            const percentage = people.length > 0
              ? Math.round((available / people.length) * 100)
              : 0;
            return (
              <label
                key={field.key}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                  selected
                    ? "border-emerald-700/60 bg-emerald-950/25"
                    : "border-zinc-800 bg-zinc-950/35 hover:border-zinc-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleField(field.key)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-zinc-200">{field.label}</span>
                  <span className="mt-0.5 block text-[10px] text-zinc-500">
                    {available}/{people.length} · {percentage}% disponible
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {!hasPrimaryIdentifier && selectedFields.length > 0 ? (
          <p className="mt-2 rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
            Para mejorar la coincidencia en Meta, conviene incluir al menos teléfono o email.
          </p>
        ) : null}
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-zinc-200">4. Vista previa</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">El archivo tendrá una fila por persona identificada.</p>
          </div>
          {loading ? <span className="text-[11px] text-zinc-500">Calculando audiencia...</span> : null}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Personas encontradas"
            value={loading ? "—" : String(buyers.length)}
            detail="Compradores con actividad en el periodo"
          />
          <SummaryCard
            label="Personas exportables"
            value={loading ? "—" : String(eligiblePeople.length)}
            detail="Cumplen monto e identificadores elegidos"
          />
          <SummaryCard
            label="Excluidas por monto"
            value={loading ? "—" : String(excludedByValue)}
            detail="Fuera del mínimo o máximo configurado"
          />
          <SummaryCard
            label="Sin identificadores"
            value={loading ? "—" : String(missingIdentifierCount)}
            detail="Sin teléfono o email entre los campos elegidos"
          />
          <SummaryCard
            label="Compras representadas"
            value={loading ? "—" : String(representedPurchases)}
            detail="Eventos únicos que aportan al valor"
          />
          <SummaryCard
            label="Valor total representado"
            value={loading ? "—" : formatAmount(totalAudienceValue, currency)}
            detail={valueMetric === "first_purchase" ? "Suma de primeras cargas históricas" : "Suma del valor calculado"}
          />
          <SummaryCard
            label="Promedio por comprador"
            value={loading ? "—" : formatAmount(averageBuyerValue, currency)}
            detail="Promedio de las personas exportables"
          />
          <SummaryCard
            label="Mediana por comprador"
            value={loading ? "—" : formatAmount(medianBuyerValue, currency)}
            detail="Punto medio del valor exportable"
          />
          <SummaryCard
            label="Con teléfono"
            value={loading ? "—" : String(peopleWithPhone)}
            detail="Después del filtro de monto"
          />
          <SummaryCard
            label="Con email"
            value={loading ? "—" : String(peopleWithEmail)}
            detail="Después del filtro de monto"
          />
          <SummaryCard
            label="Con teléfono o email"
            value={loading ? "—" : String(peopleWithPhoneOrEmail)}
            detail="Identificación principal disponible"
          />
          <SummaryCard
            label="Porcentaje exportable"
            value={loading ? "—" : `${exportablePercentage}%`}
            detail="Sobre todas las personas encontradas"
          />
        </div>

        {!loading && eligiblePeople.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-zinc-900/90 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Persona</th>
                  <th className="px-3 py-2 font-medium">Teléfono</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 text-right font-medium">Valor calculado</th>
                  <th className="px-3 py-2 text-right font-medium">Compras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950/30">
                {eligiblePeople.slice(0, 8).map((person) => (
                  <tr key={person.key}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-200">
                      {[person.fields.fn, person.fields.ln].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-400">{person.fields.phone || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{person.fields.email || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-zinc-200">
                      {formatAmount(person.value, currency)}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400">{person.purchaseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading ? (
          <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-8 text-center text-xs text-zinc-500">
            No hay personas exportables con esta configuración.
          </p>
        ) : null}
        {eligiblePeople.length > 8 ? (
          <p className="mt-2 text-right text-[10px] text-zinc-600">
            Vista previa de 8 personas sobre {eligiblePeople.length}.
          </p>
        ) : null}

        {eligiblePeople.length > 0 && eligiblePeople.length < 100 ? (
          <p className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
            La lista tiene menos de 100 registros. Además, Meta puede encontrar menos coincidencias que filas exportadas.
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/45 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-200">Archivo para carga manual en Meta</p>
          <p className="mt-0.5 max-w-2xl text-[10px] leading-relaxed text-zinc-500">
            El CSV contiene datos personales normalizados. Descargalo sólo si contás con autorización para usarlos
            y cargalo desde las herramientas de audiencias de Meta.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={loading || invalidRange || selectedFields.length === 0 || eligiblePeople.length === 0}
          className="ui-button ui-button-primary h-9 shrink-0 px-4 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
          </svg>
          Descargar CSV ({eligiblePeople.length})
        </button>
      </div>
    </section>
  );
}
