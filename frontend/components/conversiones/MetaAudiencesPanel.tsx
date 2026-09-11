"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "@/components/conversiones/DateRangeFilter";
import CustomSelect from "@/components/ui/CustomSelect";
import ModalPortal from "@/components/ui/ModalPortal";
import type { MetaAudienceBuyersRequest } from "@/lib/metaAudienceDb";
import {
  META_AUDIENCE_FIELDS,
  META_AUDIENCE_SUMMARY_METRICS,
  RECOMMENDED_META_AUDIENCE_FIELDS,
  buildMetaAudienceCsv,
  fieldCoverage,
  getMetaAudienceExportStats,
  getMetaAudiencePreviewStats,
  metaAudienceSummaryValue,
  type MetaAudienceField,
  type MetaAudiencePerson,
  type MetaAudiencePurchaseScope,
  type MetaAudienceSummaryValueMetric,
  type MetaAudienceType,
} from "@/lib/metaAudienceExport";
import {
  META_AUDIENCE_RULE_METRICS,
  META_AUDIENCE_RULE_OPERATORS,
  META_AUDIENCE_TOP_PERCENTAGES,
  applyMetaAudienceRules,
  createInitialMetaAudienceRules,
  type MetaAudienceRule,
  type MetaAudienceRuleMetric,
  type MetaAudienceRuleOperator,
} from "@/lib/metaAudienceRules";

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

const SCOPE_OPTIONS = [
  { value: "all", label: "Primeras cargas y recargas" },
  { value: "first", label: "Solo primeras cargas" },
  { value: "repeat", label: "Solo recargas" },
] as const;

const CONDITION_HELP_ROWS = [
  ["Históricas", "Cantidad histórica de cargas", "Todas las cargas conocidas de la persona"],
  ["Históricas", "Primeras cargas históricas", "Eventos registrados explícitamente como primera carga"],
  ["Históricas", "Recargas históricas", "Todas las recargas conocidas"],
  ["Período", "Cantidad de cargas en el período", "Cargas realizadas entre las fechas elegidas"],
  ["Período", "Primeras cargas en el período", "Primeras cargas realizadas dentro del período"],
  ["Período", "Recargas en el período", "Recargas realizadas dentro del período"],
  ["Valor histórico", "Valor histórico cargado", "Total de dinero cargado hasta ahora"],
  ["Valor histórico", "Promedio histórico por carga", "Promedio de todas sus cargas"],
  ["Valor histórico", "Mayor carga histórica", "La carga individual más grande"],
  ["Valor histórico", "Primera carga histórica", "Importe de su primera carga conocida"],
  ["Valor del período", "Valor cargado en el período", "Total cargado entre las fechas elegidas"],
  ["Valor del período", "Primeras cargas del período", "Suma de primeras cargas dentro del período"],
  ["Valor del período", "Recargas del período", "Suma de recargas dentro del período"],
  ["Valor del período", "Promedio por carga", "Promedio de las cargas del período"],
  ["Valor del período", "Mayor carga", "Mayor carga individual del período"],
  ["Actividad", "Días desde la última compra", "Cuántos días pasaron desde su última carga"],
] as const;

const inputClass = "h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10";

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
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
  if (!Number.isFinite(parsedStart.getTime()) || !Number.isFinite(parsedEnd.getTime()) || parsedStart > parsedEnd) return null;
  return { start: parsedStart, end: parsedEnd };
}

function formatPeriod(range: DateRange): string {
  const formatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${formatter.format(range.start)} al ${formatter.format(range.end)}`;
}

function safeDateForFilename(range: DateRange): string {
  const part = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `${part(range.start)}_${part(range.end)}`;
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

function scopeBaseLabel(scope: MetaAudiencePurchaseScope): string {
  if (scope === "first") return "Primera carga en el período ≥ 1";
  if (scope === "repeat") return "Recargas en el período ≥ 1";
  return "Cargas en el período ≥ 1";
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
      aria-pressed={selected}
      className={`rounded-xl border p-4 text-left transition ${selected ? "border-emerald-500/60 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950/45 hover:border-zinc-700"}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full border ${selected ? "border-emerald-300 bg-emerald-400" : "border-zinc-600 bg-zinc-900"}`} />
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

function InfoTooltip({ id, text }: { id: string; text: string }) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label="Más información"
        aria-describedby={id}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 text-[9px] font-bold text-zinc-400 outline-none transition hover:border-emerald-600 hover:text-emerald-300 focus:border-emerald-600 focus:text-emerald-300 focus:ring-2 focus:ring-emerald-500/20"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[60] mt-2 w-64 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-[11px] font-normal leading-relaxed text-zinc-300 opacity-0 shadow-2xl shadow-black/60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function RuleRow({
  rule,
  index,
  onChange,
  onRemove,
}: {
  rule: MetaAudienceRule;
  index: number;
  onChange: (rule: MetaAudienceRule) => void;
  onRemove: () => void;
}) {
  const definition = META_AUDIENCE_RULE_METRICS.find((item) => item.value === rule.metric) ?? META_AUDIENCE_RULE_METRICS[0];
  const operatorOptions = META_AUDIENCE_RULE_OPERATORS.filter((item) => definition.operators.includes(item.value));
  const changeMetric = (metric: MetaAudienceRuleMetric) => {
    const nextDefinition = META_AUDIENCE_RULE_METRICS.find((item) => item.value === metric) ?? META_AUDIENCE_RULE_METRICS[0];
    const operator = nextDefinition.operators.includes(rule.operator) ? rule.operator : nextDefinition.operators[0];
    onChange({ ...rule, metric, operator, value: operator === "top_percent" ? 10 : rule.value });
  };
  const changeOperator = (operator: MetaAudienceRuleOperator) => {
    onChange({
      ...rule,
      operator,
      value: operator === "top_percent" ? 10 : rule.value,
      value2: operator === "between" ? (rule.value2 ?? rule.value) : undefined,
    });
  };

  return (
    <div>
      {index > 0 ? <div className="my-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">Y</div> : null}
      <div className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/45 p-3 lg:grid-cols-[minmax(190px,2fr)_minmax(130px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_auto] lg:items-end">
        <CustomSelect
          label="Métrica"
          value={rule.metric}
          onChange={(value) => changeMetric(value as MetaAudienceRuleMetric)}
          options={META_AUDIENCE_RULE_METRICS}
        />
        <CustomSelect
          label="Operador"
          value={rule.operator}
          onChange={(value) => changeOperator(value as MetaAudienceRuleOperator)}
          options={operatorOptions}
        />
        {rule.operator === "top_percent" ? (
          <CustomSelect
            label="Porcentaje"
            value={String(rule.value)}
            onChange={(value) => onChange({ ...rule, value: Number(value) })}
            options={META_AUDIENCE_TOP_PERCENTAGES.map((value) => ({ value: String(value), label: `Top ${value}%` }))}
          />
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Valor</span>
            <input
              type="number"
              min="0"
              step={definition.kind === "money" ? "any" : "1"}
              value={rule.value}
              onChange={(event) => onChange({ ...rule, value: event.target.value })}
              className={inputClass}
            />
          </label>
        )}
        {rule.operator === "between" ? (
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Hasta</span>
            <input
              type="number"
              min="0"
              step={definition.kind === "money" ? "any" : "1"}
              value={rule.value2 ?? ""}
              onChange={(event) => onChange({ ...rule, value2: event.target.value })}
              className={inputClass}
            />
          </label>
        ) : <div className="hidden lg:block" />}
        <button type="button" onClick={onRemove} className="h-9 rounded-lg border border-red-900/60 px-3 text-xs text-red-300 hover:bg-red-950/30">
          Quitar
        </button>
      </div>
    </div>
  );
}

function ConditionsHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-[2px] sm:p-4"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="meta-audience-conditions-help-title"
          className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/60"
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3 sm:px-5">
            <h2 id="meta-audience-conditions-help-title" className="text-sm font-semibold text-zinc-100">
              Guía de condiciones
            </h2>
            <button
              type="button"
              aria-label="Cerrar ayuda de condiciones"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              ×
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                    <tr>
                      <th className="px-3 py-2.5">Grupo</th>
                      <th className="px-3 py-2.5">Condición</th>
                      <th className="px-3 py-2.5">Significado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 bg-zinc-950/30">
                    {CONDITION_HELP_ROWS.map(([group, condition, meaning]) => (
                      <tr key={condition}>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-emerald-300">{group}</td>
                        <td className="px-3 py-2.5 font-medium text-zinc-200">{condition}</td>
                        <td className="px-3 py-2.5 text-zinc-400">{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

export default function MetaAudiencesPanel({ currency, loadBuyers }: Props) {
  const initialRange = useMemo(() => recentDateRange(30), []);
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(30);
  const [draftStartDate, setDraftStartDate] = useState(() => dateInputValue(initialRange.start));
  const [draftEndDate, setDraftEndDate] = useState(() => dateInputValue(initialRange.end));
  const [buyers, setBuyers] = useState<MetaAudiencePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conditionsHelpOpen, setConditionsHelpOpen] = useState(false);
  const [audienceType, setAudienceType] = useState<MetaAudienceType>("segmented");
  const [purchaseScope, setPurchaseScope] = useState<MetaAudiencePurchaseScope>("all");
  const [rules, setRules] = useState<MetaAudienceRule[]>(createInitialMetaAudienceRules);
  const [summaryValueMetric, setSummaryValueMetric] = useState<MetaAudienceSummaryValueMetric>("historical_first_purchase_value");
  const [exportValueMetric, setExportValueMetric] = useState<MetaAudienceSummaryValueMetric>("historical_first_purchase_value");
  const [selectedFields, setSelectedFields] = useState<MetaAudienceField[]>(RECOMMENDED_META_AUDIENCE_FIELDS);
  const nextRuleId = useRef(1);
  const loadRequestId = useRef(0);
  const valueAudienceInitialized = useRef(false);

  const draftDateRange = useMemo(() => rangeFromDateInputs(draftStartDate, draftEndDate), [draftEndDate, draftStartDate]);
  const periodChanged = draftDateRange != null && (
    dateInputValue(dateRange.start) !== draftStartDate || dateInputValue(dateRange.end) !== draftEndDate
  );

  const load = useCallback(async () => {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const loadedBuyers = await loadBuyers({ currency, range: dateRange });
      if (loadRequestId.current === requestId) setBuyers(loadedBuyers);
    } catch (cause) {
      console.error(cause);
      if (loadRequestId.current === requestId) {
        setBuyers([]);
        setError(cause instanceof Error ? cause.message : "No se pudo calcular la audiencia.");
      }
    } finally {
      if (loadRequestId.current === requestId) setLoading(false);
    }
  }, [currency, dateRange, loadBuyers]);

  useEffect(() => {
    void load();
    return () => { loadRequestId.current += 1; };
  }, [load]);

  const evaluation = useMemo(
    () => applyMetaAudienceRules({ people: buyers, scope: purchaseScope, rules }),
    [buyers, purchaseScope, rules],
  );
  const segment = evaluation.people;
  const exportStats = useMemo(
    () => getMetaAudienceExportStats({ people: segment, selectedFields, audienceType, exportValueMetric }),
    [audienceType, exportValueMetric, segment, selectedFields],
  );
  const previewStats = useMemo(
    () => getMetaAudiencePreviewStats(segment, summaryValueMetric),
    [segment, summaryValueMetric],
  );
  const coverage = useMemo(() => fieldCoverage(segment), [segment]);
  const csv = useMemo(
    () => buildMetaAudienceCsv({ people: segment, selectedFields, audienceType, exportValueMetric }),
    [audienceType, exportValueMetric, segment, selectedFields],
  );
  const hasPrimaryIdentifier = selectedFields.includes("email") || selectedFields.includes("phone");
  const canExport = evaluation.errors.length === 0 && selectedFields.length > 0 && exportStats.exportablePeople.length > 0;

  const applyPeriodPreset = (days: 30 | 60 | 90 | 180) => {
    const range = recentDateRange(days);
    setPeriodPreset(days);
    setDraftStartDate(dateInputValue(range.start));
    setDraftEndDate(dateInputValue(range.end));
    setDateRange(range);
  };

  const applyCustomPeriod = () => {
    if (!draftDateRange) return;
    setPeriodPreset("custom");
    setDateRange(draftDateRange);
  };

  const toggleField = (field: MetaAudienceField) => {
    setSelectedFields((current) => current.includes(field)
      ? current.filter((item) => item !== field)
      : META_AUDIENCE_FIELDS.map((item) => item.key).filter((item) => item === field || current.includes(item)));
  };

  const addRule = () => {
    const id = `rule-${nextRuleId.current}`;
    nextRuleId.current += 1;
    setRules((current) => [...current, { id, metric: "period_total_value", operator: "gte", value: 0 }]);
  };

  const handleAudienceType = (next: MetaAudienceType) => {
    if (next === "value_based" && !valueAudienceInitialized.current) {
      valueAudienceInitialized.current = true;
      setExportValueMetric(summaryValueMetric);
    }
    setAudienceType(next);
  };

  const handleExport = () => {
    if (!canExport) return;
    const typePart = audienceType === "value_based" ? "basada-en-valor" : "segmentada";
    downloadCsv(csv, `audiencia-meta-${typePart}-${currency.toLowerCase()}-${safeDateForFilename(dateRange)}.csv`);
  };

  const closeConditionsHelp = useCallback(() => setConditionsHelpOpen(false), []);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-100">Audiencias Meta</h3>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-300">Archivo CSV</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-400">
            Construí segmentos de compradores y descargalos para cargarlos manualmente en Meta. No envía eventos, no usa CAPI y no modifica Conversiones.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
          {loading ? "Cargando..." : "Actualizar datos"}
        </button>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/25 px-3 py-2 text-xs text-red-300" role="alert">Error al cargar los datos: {error}</div> : null}

      <div className="mt-5">
        <p className="text-xs font-semibold text-zinc-200">1. Tipo de audiencia</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">Elegí qué información recibirá Meta.</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <AudienceTypeCard value="segmented" selected={audienceType === "segmented"} title="Segmentada por valor" description="El monto se usa para seleccionar personas. El archivo exporta solamente identificadores." onSelect={handleAudienceType} />
          <AudienceTypeCard value="value_based" selected={audienceType === "value_based"} title="Basada en valor" description="El archivo también incluye un valor individual por persona para Meta." onSelect={handleAudienceType} />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-zinc-200">2. Período</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">El histórico llega hasta ahora; estas fechas delimitan las métricas del período.</p>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300">{formatPeriod(dateRange)}</span>
            <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-2 py-1 font-semibold text-emerald-300">{currency}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PERIOD_PRESETS.map((preset) => (
            <button key={preset.days} type="button" onClick={() => applyPeriodPreset(preset.days)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] ${periodPreset === preset.days ? "border-emerald-600/60 bg-emerald-500/10 text-emerald-300" : "border-zinc-800 bg-zinc-900/60 text-zinc-400"}`}>{preset.label}</button>
          ))}
          {periodPreset === "custom" ? <span className="rounded-lg border border-sky-700/50 bg-sky-950/25 px-2.5 py-1.5 text-[10px] text-sky-300">Personalizado</span> : null}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label><span className="mb-1 block text-xs text-zinc-400">Desde</span><input type="date" value={draftStartDate} max={draftEndDate || undefined} onChange={(event) => { setDraftStartDate(event.target.value); setPeriodPreset("custom"); }} className={inputClass} /></label>
          <label><span className="mb-1 block text-xs text-zinc-400">Hasta</span><input type="date" value={draftEndDate} min={draftStartDate || undefined} max={dateInputValue(new Date())} onChange={(event) => { setDraftEndDate(event.target.value); setPeriodPreset("custom"); }} className={inputClass} /></label>
          <button type="button" onClick={applyCustomPeriod} disabled={!draftDateRange || !periodChanged} className="ui-button h-9 border border-zinc-700 bg-zinc-800 px-3 text-zinc-200 hover:bg-zinc-700 disabled:opacity-45">Aplicar período</button>
        </div>
        {!draftDateRange ? <p className="mt-2 text-[11px] text-red-300">Seleccioná fechas válidas.</p> : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <label htmlFor="meta-audience-scope" className="text-xs text-zinc-400">3. Compras que activan el segmento</label>
            <InfoTooltip
              id="meta-audience-scope-help"
              text="Define qué actividad debe tener la persona dentro del período: cualquier carga, una primera carga o una recarga. Es la condición base del segmento."
            />
          </div>
          <CustomSelect id="meta-audience-scope" value={purchaseScope} onChange={(value) => setPurchaseScope(value as MetaAudiencePurchaseScope)} options={SCOPE_OPTIONS} />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/45 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Condición base</p>
          <p className="mt-1 text-xs text-zinc-200">{scopeBaseLabel(purchaseScope)}</p>
          <p className="mt-1 text-[10px] text-zinc-500">Cambia únicamente al elegir otro tipo de compra.</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold text-zinc-200">4. Condiciones</p><p className="mt-0.5 text-[11px] text-zinc-500">Todas las condiciones se unen con “Y”.</p></div>
          <button type="button" onClick={addRule} className="h-8 rounded-lg border border-emerald-700/60 bg-emerald-950/25 px-3 text-[11px] font-medium text-emerald-300 hover:bg-emerald-950/45">Agregar condición</button>
        </div>
        <div className="mt-3">
          {rules.length === 0 ? <p className="rounded-lg border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">No hay condiciones adicionales.</p> : rules.map((rule, index) => (
            <RuleRow key={rule.id} rule={rule} index={index} onChange={(next) => setRules((current) => current.map((item) => item.id === next.id ? next : item))} onRemove={() => setRules((current) => current.filter((item) => item.id !== rule.id))} />
          ))}
        </div>
        {evaluation.errors.length > 0 ? <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/25 px-3 py-2 text-[11px] text-red-300" role="alert">{evaluation.errors.map((message) => <p key={message}>{message}</p>)}</div> : null}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setConditionsHelpOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600 text-[11px] font-bold text-emerald-300">i</span>
            Entender métricas y operadores
          </button>
        </div>
      </div>

      <div className={`mt-5 grid gap-3 ${audienceType === "value_based" ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <label htmlFor="meta-audience-summary-value" className="text-xs text-zinc-400">5. Resumen económico</label>
            <InfoTooltip
              id="meta-audience-summary-value-help"
              text="Elige qué monto muestran las tarjetas económicas y la columna “Valor del resumen”. No modifica las personas del segmento."
            />
          </div>
          <CustomSelect id="meta-audience-summary-value" value={summaryValueMetric} onChange={(value) => setSummaryValueMetric(value as MetaAudienceSummaryValueMetric)} options={META_AUDIENCE_SUMMARY_METRICS} />
        </div>
        {audienceType === "value_based" ? (
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <label htmlFor="meta-audience-export-value" className="text-xs text-zinc-400">6. Valor individual para Meta</label>
              <InfoTooltip
                id="meta-audience-export-value-help"
                text="Elige qué monto individual se escribe en la columna value del CSV. No modifica el segmento; las personas sin un valor positivo no entran en ese archivo."
              />
            </div>
            <CustomSelect id="meta-audience-export-value" value={exportValueMetric} onChange={(value) => setExportValueMetric(value as MetaAudienceSummaryValueMetric)} options={META_AUDIENCE_SUMMARY_METRICS} />
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">El resumen económico y el valor exportado son independientes y nunca modifican las personas del segmento.</p>

      <div className="mt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-semibold text-zinc-200">7. Datos para identificar personas</p><p className="mt-0.5 text-[11px] text-zinc-500">Meta exige al menos email o teléfono por fila.</p></div>
          <button type="button" onClick={() => setSelectedFields(RECOMMENDED_META_AUDIENCE_FIELDS)} className="text-[10px] font-medium text-emerald-300 hover:text-emerald-200">Usar recomendados</button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {META_AUDIENCE_FIELDS.map((field) => {
            const selected = selectedFields.includes(field.key);
            return <button key={field.key} type="button" onClick={() => toggleField(field.key)} aria-pressed={selected} className={`rounded-lg border px-3 py-2 text-left ${selected ? "border-emerald-700/60 bg-emerald-950/25" : "border-zinc-800 bg-zinc-950/40"}`}><span className="flex items-center justify-between text-xs font-medium text-zinc-200"><span>{field.label}</span><span className={selected ? "text-emerald-300" : "text-zinc-600"}>{selected ? "✓" : "+"}</span></span><span className="mt-1 block text-[10px] text-zinc-500">{coverage[field.key]} con dato</span></button>;
          })}
        </div>
        {!hasPrimaryIdentifier ? <p className="mt-2 text-[11px] text-amber-300">Seleccioná Email o Teléfono para generar filas exportables.</p> : null}
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold text-zinc-200">8. Preview</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">Las métricas económicas usan todo el segmento, incluso personas que no podrán exportarse.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Personas del segmento" value={loading ? "—" : segment.length.toLocaleString("es-AR")} detail={`De ${buyers.length.toLocaleString("es-AR")} compradores históricos`} />
          <SummaryCard label="Personas exportables" value={loading ? "—" : exportStats.exportablePeople.length.toLocaleString("es-AR")} detail="Con identificador y, si corresponde, valor válido" />
          <SummaryCard label="Sin identificador exportable" value={loading ? "—" : exportStats.missingIdentifierCount.toLocaleString("es-AR")} detail="Sin email o teléfono seleccionado" />
          <SummaryCard label="Sin valor exportable" value={audienceType === "value_based" ? exportStats.missingValueCount.toLocaleString("es-AR") : "—"} detail={audienceType === "value_based" ? "Valor individual nulo o menor o igual a cero" : "Solo aplica a audiencias basadas en valor"} />
          <SummaryCard label="Compras representadas" value={loading ? "—" : previewStats.representedPurchases.toLocaleString("es-AR")} detail="Según el resumen económico elegido" />
          <SummaryCard label="Valor representado" value={loading ? "—" : formatAmount(previewStats.totalValue, currency)} detail="Suma sobre todo el segmento" />
          <SummaryCard label="Promedio por persona" value={loading ? "—" : formatAmount(previewStats.averageValue, currency)} detail={`${previewStats.peopleWithValue.toLocaleString("es-AR")} personas con valor disponible`} />
          <SummaryCard label="Mediana por persona" value={loading ? "—" : formatAmount(previewStats.medianValue, currency)} detail="Valor central del resumen elegido" />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 px-3 py-2 text-xs text-zinc-400"><span className="text-zinc-200">{coverage.phone}</span> con teléfono</div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 px-3 py-2 text-xs text-zinc-400"><span className="text-zinc-200">{coverage.email}</span> con email</div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 px-3 py-2 text-xs text-zinc-400"><span className="text-zinc-200">{previewStats.peopleWithValue}</span> con valor de resumen</div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-950/70 text-[10px] uppercase tracking-[0.08em] text-zinc-500"><tr><th className="px-3 py-2">Persona</th><th className="px-3 py-2 text-right">Histórico</th><th className="px-3 py-2 text-right">Período</th><th className="px-3 py-2 text-right">Última compra</th><th className="px-3 py-2 text-right">Valor del resumen</th></tr></thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950/30">
              {segment.slice(0, 8).map((person) => <tr key={person.key}><td className="px-3 py-2 text-zinc-300">{person.fields.email || person.fields.phone || "Sin identificador"}</td><td className="px-3 py-2 text-right text-zinc-400">{formatAmount(person.historicalTotalValue, currency)}</td><td className="px-3 py-2 text-right text-zinc-400">{formatAmount(person.periodTotalValue, currency)}</td><td className="px-3 py-2 text-right text-zinc-400">Hace {person.daysSinceLastPurchase} días</td><td className="px-3 py-2 text-right font-medium text-zinc-200">{metaAudienceSummaryValue(person, summaryValueMetric) == null ? "—" : formatAmount(metaAudienceSummaryValue(person, summaryValueMetric) as number, currency)}</td></tr>)}
              {!loading && segment.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-500">No hay personas que cumplan las condiciones.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-semibold text-zinc-200">9. CSV</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">El archivo incluye únicamente las personas exportables del preview y mantiene {currency} separado.</p></div>
        <button type="button" onClick={handleExport} disabled={!canExport || loading} className="ui-button h-9 bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-45">Descargar CSV ({exportStats.exportablePeople.length.toLocaleString("es-AR")})</button>
      </div>

      <ConditionsHelpModal open={conditionsHelpOpen} onClose={closeConditionsHelp} />
    </section>
  );
}
