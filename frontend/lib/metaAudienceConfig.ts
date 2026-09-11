import type { DateRange } from "@/components/conversiones/DateRangeFilter";
import {
  META_AUDIENCE_FIELDS,
  META_AUDIENCE_SUMMARY_METRICS,
  RECOMMENDED_META_AUDIENCE_FIELDS,
  type MetaAudienceField,
  type MetaAudiencePurchaseScope,
  type MetaAudienceSummaryValueMetric,
  type MetaAudienceType,
} from "@/lib/metaAudienceExport";
import {
  META_AUDIENCE_RULE_METRICS,
  META_AUDIENCE_MAX_RULES,
  validateMetaAudienceRules,
  type MetaAudienceRule,
} from "@/lib/metaAudienceRules";

export type MetaAudienceCurrency = "ARS" | "PYG";
export const META_AUDIENCE_TIMEZONE = "America/Argentina/Buenos_Aires" as const;
export const META_AUDIENCE_CONFIG_VERSION = 1 as const;

export type MetaAudiencePeriod =
  | { kind: "relative"; days: number; timezone: typeof META_AUDIENCE_TIMEZONE }
  | { kind: "custom"; startDate: string; endDate: string; timezone: typeof META_AUDIENCE_TIMEZONE };

export type MetaAudienceConfig = {
  currency: MetaAudienceCurrency;
  audienceType: MetaAudienceType;
  period: MetaAudiencePeriod;
  purchaseScope: MetaAudiencePurchaseScope;
  rules: MetaAudienceRule[];
  summaryValueMetric: MetaAudienceSummaryValueMetric;
  exportValueMetric: MetaAudienceSummaryValueMetric;
  selectedFields: MetaAudienceField[];
  sourcePresetId: string | null;
  sourcePresetVersion: number | null;
  configVersion: typeof META_AUDIENCE_CONFIG_VERSION;
};

export type MetaAudiencePresetId =
  | "high_value_30d"
  | "vip_90d"
  | "historical_top_10"
  | "repeat_buyers"
  | "active_large_customers"
  | "inactive_high_value";

export type MetaAudiencePreset = {
  id: MetaAudiencePresetId;
  version: number;
  name: string;
  description: string;
  createConfig: (currency: MetaAudienceCurrency) => MetaAudienceConfig;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_FIELDS = new Set(META_AUDIENCE_FIELDS.map((field) => field.key));
const VALID_SUMMARY_METRICS = new Set(META_AUDIENCE_SUMMARY_METRICS.map((metric) => metric.value));
const VALID_RULE_METRICS = new Set(META_AUDIENCE_RULE_METRICS.map((metric) => metric.value));

function relativePeriod(days: number): MetaAudiencePeriod {
  return { kind: "relative", days, timezone: META_AUDIENCE_TIMEZONE };
}

function presetRule(id: string, metric: MetaAudienceRule["metric"], operator: MetaAudienceRule["operator"], value: number): MetaAudienceRule {
  return { id, metric, operator, value };
}

function presetConfig(
  currency: MetaAudienceCurrency,
  presetId: MetaAudiencePresetId,
  period: MetaAudiencePeriod,
  purchaseScope: MetaAudiencePurchaseScope,
  rules: MetaAudienceRule[],
  summaryValueMetric: MetaAudienceSummaryValueMetric,
): MetaAudienceConfig {
  return {
    currency,
    audienceType: "segmented",
    period,
    purchaseScope,
    rules,
    summaryValueMetric,
    exportValueMetric: summaryValueMetric,
    selectedFields: [...RECOMMENDED_META_AUDIENCE_FIELDS],
    sourcePresetId: presetId,
    sourcePresetVersion: 1,
    configVersion: META_AUDIENCE_CONFIG_VERSION,
  };
}

const META_AUDIENCE_PRESET_DEFINITIONS: MetaAudiencePreset[] = [
  {
    id: "high_value_30d",
    version: 1,
    name: "Alto valor 30D",
    description: "Top 25% por valor cargado durante los últimos 30 días.",
    createConfig: (currency) => presetConfig(currency, "high_value_30d", relativePeriod(30), "all", [
      presetRule("preset-high-value-30d", "period_total_value", "top_percent", 25),
    ], "period_total_value"),
  },
  {
    id: "vip_90d",
    version: 1,
    name: "VIP 90D",
    description: "Top 10% por valor y al menos 3 cargas durante los últimos 90 días.",
    createConfig: (currency) => presetConfig(currency, "vip_90d", relativePeriod(90), "all", [
      presetRule("preset-vip-value", "period_total_value", "top_percent", 10),
      presetRule("preset-vip-frequency", "period_purchase_count", "gte", 3),
    ], "period_total_value"),
  },
  {
    id: "historical_top_10",
    version: 1,
    name: "Top 10% histórico",
    description: "Top 10% por todo el valor histórico cargado.",
    createConfig: (currency) => presetConfig(currency, "historical_top_10", relativePeriod(30), "none", [
      presetRule("preset-historical-top", "historical_total_value", "top_percent", 10),
    ], "historical_total_value"),
  },
  {
    id: "repeat_buyers",
    version: 1,
    name: "Recompradores",
    description: "Personas con al menos una recarga histórica.",
    createConfig: (currency) => presetConfig(currency, "repeat_buyers", relativePeriod(30), "none", [
      presetRule("preset-repeat-buyers", "historical_reload_count", "gte", 1),
    ], "historical_total_value"),
  },
  {
    id: "active_large_customers",
    version: 1,
    name: "Grandes clientes activos",
    description: "Top 5% histórico con actividad durante los últimos 30 días.",
    createConfig: (currency) => presetConfig(currency, "active_large_customers", relativePeriod(30), "none", [
      presetRule("preset-active-large-value", "historical_total_value", "top_percent", 5),
      presetRule("preset-active-large-recency", "days_since_last_purchase", "lte", 30),
    ], "historical_total_value"),
  },
  {
    id: "inactive_high_value",
    version: 1,
    name: "Alto valor inactivo",
    description: "Top 10% histórico cuya última carga fue hace más de 90 días.",
    createConfig: (currency) => presetConfig(currency, "inactive_high_value", relativePeriod(90), "none", [
      presetRule("preset-inactive-value", "historical_total_value", "top_percent", 10),
      presetRule("preset-inactive-recency", "days_since_last_purchase", "gt", 90),
    ], "historical_total_value"),
  },
];

export const META_AUDIENCE_PRESETS: readonly MetaAudiencePreset[] = Object.freeze(
  META_AUDIENCE_PRESET_DEFINITIONS.map((preset) => Object.freeze(preset)),
);

export function createDefaultMetaAudienceConfig(currency: MetaAudienceCurrency): MetaAudienceConfig {
  return {
    currency,
    audienceType: "segmented",
    period: relativePeriod(30),
    purchaseScope: "all",
    rules: [{ id: "initial-minimum", metric: "historical_first_purchase_value", operator: "gte", value: 0 }],
    summaryValueMetric: "historical_first_purchase_value",
    exportValueMetric: "historical_first_purchase_value",
    selectedFields: [...RECOMMENDED_META_AUDIENCE_FIELDS],
    sourcePresetId: null,
    sourcePresetVersion: null,
    configVersion: META_AUDIENCE_CONFIG_VERSION,
  };
}

export function cloneMetaAudienceConfig(config: MetaAudienceConfig): MetaAudienceConfig {
  return {
    ...config,
    period: { ...config.period },
    rules: config.rules.map((rule) => ({ ...rule })),
    selectedFields: [...config.selectedFields],
  };
}

export function applyMetaAudiencePreset(presetId: MetaAudiencePresetId, currency: MetaAudienceCurrency): MetaAudienceConfig {
  const preset = META_AUDIENCE_PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new Error("El preset seleccionado no existe.");
  return cloneMetaAudienceConfig(preset.createConfig(currency));
}

export function dateInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: META_AUDIENCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function argentinaDate(date: string, endOfDay: boolean): Date {
  const suffix = endOfDay ? "T23:59:59.999-03:00" : "T00:00:00.000-03:00";
  return new Date(`${date}${suffix}`);
}

function shiftCalendarDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function resolveMetaAudiencePeriod(period: MetaAudiencePeriod, asOf = new Date()): DateRange {
  if (!Number.isFinite(asOf.getTime())) throw new Error("La fecha de ejecución no es válida.");
  if (period.timezone !== META_AUDIENCE_TIMEZONE) throw new Error("La zona horaria no es válida.");
  if (period.kind === "relative") {
    if (!Number.isInteger(period.days) || period.days < 1 || period.days > 3650) throw new Error("El período relativo no es válido.");
    const today = dateInputValue(asOf);
    return {
      start: argentinaDate(shiftCalendarDate(today, -(period.days - 1)), false),
      end: new Date(asOf.getTime()),
    };
  }
  if (!DATE_PATTERN.test(period.startDate) || !DATE_PATTERN.test(period.endDate) || period.startDate > period.endDate) {
    throw new Error("El período personalizado no es válido.");
  }
  const start = argentinaDate(period.startDate, false);
  const configuredEnd = argentinaDate(period.endDate, true);
  const end = new Date(Math.min(configuredEnd.getTime(), asOf.getTime()));
  if (start > end) throw new Error("El período personalizado todavía no comenzó.");
  return { start, end };
}

function validateMetaAudiencePeriod(period: MetaAudiencePeriod): string | null {
  if (period.timezone !== META_AUDIENCE_TIMEZONE) return "La zona horaria no es válida.";
  if (period.kind === "relative") {
    return Number.isInteger(period.days) && period.days >= 1 && period.days <= 3650 ? null : "El período relativo no es válido.";
  }
  return DATE_PATTERN.test(period.startDate) && DATE_PATTERN.test(period.endDate) && period.startDate <= period.endDate
    ? null
    : "El período personalizado no es válido.";
}

export function normalizeMetaAudienceConfig(config: MetaAudienceConfig): MetaAudienceConfig {
  return {
    ...cloneMetaAudienceConfig(config),
    rules: config.rules.map((rule) => rule.operator === "between"
      ? { ...rule, value: Number(rule.value), value2: Number(rule.value2) }
      : { id: rule.id, metric: rule.metric, operator: rule.operator, value: Number(rule.value) }),
  };
}

export function validateMetaAudienceConfig(config: MetaAudienceConfig): string[] {
  const errors: string[] = [];
  if (config.currency !== "ARS" && config.currency !== "PYG") errors.push("La moneda no es válida.");
  if (config.audienceType !== "segmented" && config.audienceType !== "value_based") errors.push("El tipo de audiencia no es válido.");
  if (!["all", "first", "repeat", "none"].includes(config.purchaseScope)) errors.push("El alcance de compras no es válido.");
  if (config.configVersion !== META_AUDIENCE_CONFIG_VERSION) errors.push("La versión de configuración no es compatible.");
  const periodError = validateMetaAudiencePeriod(config.period);
  if (periodError) errors.push(periodError);
  if (config.rules.length > META_AUDIENCE_MAX_RULES) errors.push(`La audiencia admite hasta ${META_AUDIENCE_MAX_RULES} condiciones.`);
  if (new Set(config.rules.map((rule) => rule.id)).size !== config.rules.length) errors.push("Las condiciones tienen identificadores repetidos.");
  if (config.rules.some((rule) => !VALID_RULE_METRICS.has(rule.metric))) errors.push("Hay métricas no permitidas.");
  errors.push(...validateMetaAudienceRules(config.rules));
  if (!VALID_SUMMARY_METRICS.has(config.summaryValueMetric) || !VALID_SUMMARY_METRICS.has(config.exportValueMetric)) errors.push("La métrica de valor no es válida.");
  if (config.selectedFields.length === 0 || config.selectedFields.some((field) => !VALID_FIELDS.has(field))) errors.push("Los identificadores seleccionados no son válidos.");
  if (new Set(config.selectedFields).size !== config.selectedFields.length) errors.push("Los identificadores no pueden repetirse.");
  if (!config.selectedFields.includes("email") && !config.selectedFields.includes("phone")) errors.push("Seleccioná email o teléfono.");
  if (config.sourcePresetId != null && !/^[a-z0-9_]{1,80}$/.test(config.sourcePresetId)) errors.push("El preset de origen no es válido.");
  if ((config.sourcePresetId == null) !== (config.sourcePresetVersion == null)) errors.push("El origen del preset está incompleto.");
  if (config.sourcePresetVersion != null && (!Number.isInteger(config.sourcePresetVersion) || config.sourcePresetVersion < 1)) errors.push("La versión del preset no es válida.");
  return [...new Set(errors)];
}

export function serializeMetaAudienceConfig(config: MetaAudienceConfig): string {
  return JSON.stringify(normalizeMetaAudienceConfig(config));
}

export function deserializeMetaAudienceConfig(serialized: string): MetaAudienceConfig {
  const parsed = JSON.parse(serialized) as MetaAudienceConfig;
  const errors = validateMetaAudienceConfig(parsed);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return normalizeMetaAudienceConfig(parsed);
}

export function metaAudienceConfigFingerprint(config: MetaAudienceConfig): string {
  return serializeMetaAudienceConfig(config);
}

export function canReplaceMetaAudienceDraft(dirty: boolean, confirmDiscard: () => boolean): boolean {
  return !dirty || confirmDiscard();
}
