import type {
  MetaAudiencePerson,
  MetaAudiencePurchaseScope,
} from "@/lib/metaAudienceExport";

export type MetaAudienceRuleMetric =
  | "historical_purchase_count"
  | "historical_first_purchase_count"
  | "historical_reload_count"
  | "period_purchase_count"
  | "period_first_purchase_count"
  | "period_reload_count"
  | "historical_total_value"
  | "historical_average_purchase_value"
  | "historical_max_purchase_value"
  | "historical_first_purchase_value"
  | "period_total_value"
  | "period_first_purchase_total_value"
  | "period_reload_total_value"
  | "period_average_purchase_value"
  | "period_max_purchase_value"
  | "days_since_last_purchase";

export type MetaAudienceRuleOperator =
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eq"
  | "between"
  | "top_percent";

export type MetaAudienceRule = {
  id: string;
  metric: MetaAudienceRuleMetric;
  operator: MetaAudienceRuleOperator;
  value: number | string;
  value2?: number | string;
};

type MetricKind = "count" | "money" | "recency";
type MetricUniverse = "historical" | "period";

export type MetaAudienceRuleMetricDefinition = {
  value: MetaAudienceRuleMetric;
  label: string;
  kind: MetricKind;
  universe: MetricUniverse;
  operators: readonly MetaAudienceRuleOperator[];
};

const STANDARD_OPERATORS = ["gt", "gte", "lt", "lte", "eq", "between"] as const;
const MONEY_OPERATORS = [...STANDARD_OPERATORS, "top_percent"] as const;
const PURCHASE_COUNT_OPERATORS = [...STANDARD_OPERATORS, "top_percent"] as const;

export const META_AUDIENCE_RULE_METRICS: readonly MetaAudienceRuleMetricDefinition[] = [
  { value: "historical_purchase_count", label: "Cantidad histórica de cargas", kind: "count", universe: "historical", operators: PURCHASE_COUNT_OPERATORS },
  { value: "historical_first_purchase_count", label: "Primeras cargas históricas", kind: "count", universe: "historical", operators: STANDARD_OPERATORS },
  { value: "historical_reload_count", label: "Recargas históricas", kind: "count", universe: "historical", operators: STANDARD_OPERATORS },
  { value: "period_purchase_count", label: "Cantidad de cargas en el período", kind: "count", universe: "period", operators: PURCHASE_COUNT_OPERATORS },
  { value: "period_first_purchase_count", label: "Primeras cargas en el período", kind: "count", universe: "period", operators: STANDARD_OPERATORS },
  { value: "period_reload_count", label: "Recargas en el período", kind: "count", universe: "period", operators: STANDARD_OPERATORS },
  { value: "historical_total_value", label: "Valor histórico cargado", kind: "money", universe: "historical", operators: MONEY_OPERATORS },
  { value: "historical_average_purchase_value", label: "Promedio histórico por carga", kind: "money", universe: "historical", operators: MONEY_OPERATORS },
  { value: "historical_max_purchase_value", label: "Mayor carga histórica", kind: "money", universe: "historical", operators: MONEY_OPERATORS },
  { value: "historical_first_purchase_value", label: "Primera carga histórica", kind: "money", universe: "historical", operators: MONEY_OPERATORS },
  { value: "period_total_value", label: "Valor cargado en el período", kind: "money", universe: "period", operators: MONEY_OPERATORS },
  { value: "period_first_purchase_total_value", label: "Primeras cargas del período", kind: "money", universe: "period", operators: MONEY_OPERATORS },
  { value: "period_reload_total_value", label: "Recargas del período", kind: "money", universe: "period", operators: MONEY_OPERATORS },
  { value: "period_average_purchase_value", label: "Promedio por carga en el período", kind: "money", universe: "period", operators: MONEY_OPERATORS },
  { value: "period_max_purchase_value", label: "Mayor carga del período", kind: "money", universe: "period", operators: MONEY_OPERATORS },
  { value: "days_since_last_purchase", label: "Días desde la última compra", kind: "recency", universe: "historical", operators: STANDARD_OPERATORS },
];

export const META_AUDIENCE_RULE_OPERATORS: ReadonlyArray<{
  value: MetaAudienceRuleOperator;
  label: string;
}> = [
  { value: "gt", label: "Mayor que" },
  { value: "gte", label: "Mayor o igual" },
  { value: "lt", label: "Menor que" },
  { value: "lte", label: "Menor o igual" },
  { value: "eq", label: "Igual a" },
  { value: "between", label: "Entre" },
  { value: "top_percent", label: "Top %" },
];

export const META_AUDIENCE_TOP_PERCENTAGES = [50, 25, 10, 5, 1] as const;

export function createInitialMetaAudienceRules(): MetaAudienceRule[] {
  return [{
    id: "initial-minimum",
    metric: "historical_first_purchase_value",
    operator: "gte",
    value: 0,
  }];
}

export function metaAudienceMetricValue(
  person: MetaAudiencePerson,
  metric: MetaAudienceRuleMetric,
): number | null {
  switch (metric) {
    case "historical_purchase_count": return person.historicalPurchaseCount;
    case "historical_first_purchase_count": return person.historicalFirstPurchaseCount;
    case "historical_reload_count": return person.historicalReloadCount;
    case "period_purchase_count": return person.periodPurchaseCount;
    case "period_first_purchase_count": return person.periodFirstPurchaseCount;
    case "period_reload_count": return person.periodReloadCount;
    case "historical_total_value": return person.historicalTotalValue;
    case "historical_average_purchase_value": return person.historicalAveragePurchaseValue;
    case "historical_max_purchase_value": return person.historicalMaxPurchaseValue;
    case "historical_first_purchase_value": return person.historicalFirstPurchaseValue;
    case "period_total_value": return person.periodTotalValue;
    case "period_first_purchase_total_value": return person.periodFirstPurchaseTotalValue;
    case "period_reload_total_value": return person.periodReloadTotalValue;
    case "period_average_purchase_value": return person.periodAveragePurchaseValue;
    case "period_max_purchase_value": return person.periodMaxPurchaseValue;
    case "days_since_last_purchase": return person.daysSinceLastPurchase;
  }
}

function numericValue(value: number | string | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateMetaAudienceRule(rule: MetaAudienceRule): string | null {
  const definition = META_AUDIENCE_RULE_METRICS.find((item) => item.value === rule.metric);
  if (!definition) return "La métrica seleccionada no es válida.";
  if (!definition.operators.includes(rule.operator)) return "El operador no está disponible para esta métrica.";
  const value = numericValue(rule.value);
  if (value == null || value < 0) return "Ingresá un valor válido igual o mayor que cero.";
  if (rule.operator === "top_percent") {
    if (!META_AUDIENCE_TOP_PERCENTAGES.includes(value as typeof META_AUDIENCE_TOP_PERCENTAGES[number])) {
      return "El percentil debe ser 50, 25, 10, 5 o 1%.";
    }
  }
  if (rule.operator === "between") {
    const value2 = numericValue(rule.value2);
    if (value2 == null || value2 < value) return "El segundo valor debe ser igual o mayor al primero.";
  }
  return null;
}

export function validateMetaAudienceRules(rules: readonly MetaAudienceRule[]): string[] {
  return rules.flatMap((rule, index) => {
    const error = validateMetaAudienceRule(rule);
    return error ? [`Condición ${index + 1}: ${error}`] : [];
  });
}

export function personMatchesMetaAudienceScope(
  person: MetaAudiencePerson,
  scope: MetaAudiencePurchaseScope,
): boolean {
  if (scope === "first") return person.periodFirstPurchaseCount >= 1;
  if (scope === "repeat") return person.periodReloadCount >= 1;
  return person.periodPurchaseCount >= 1;
}

function compareRule(value: number, rule: MetaAudienceRule): boolean {
  const expected = numericValue(rule.value) as number;
  switch (rule.operator) {
    case "gt": return value > expected;
    case "gte": return value >= expected;
    case "lt": return value < expected;
    case "lte": return value <= expected;
    case "eq": return value === expected;
    case "between": return value >= expected && value <= (numericValue(rule.value2) as number);
    case "top_percent": return false;
  }
}

function percentileSelections(
  people: readonly MetaAudiencePerson[],
  rules: readonly MetaAudienceRule[],
): Map<string, Set<string>> {
  const selections = new Map<string, Set<string>>();
  const rankingCache = new Map<string, Array<{ key: string; value: number }>>();

  for (const rule of rules) {
    if (rule.operator !== "top_percent") continue;
    const definition = META_AUDIENCE_RULE_METRICS.find((item) => item.value === rule.metric);
    if (!definition) continue;
    const selected = new Set<string>();
    for (const currency of ["ARS", "PYG"] as const) {
      const cacheKey = `${currency}:${rule.metric}:${definition.universe}`;
      let ranking = rankingCache.get(cacheKey);
      if (!ranking) {
        ranking = people
          .filter((person) => person.currency === currency)
          .filter((person) => definition.universe === "historical" || person.periodPurchaseCount > 0)
          .map((person) => ({ key: person.key, value: metaAudienceMetricValue(person, rule.metric) }))
          .filter((item): item is { key: string; value: number } => item.value != null)
          .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key));
        rankingCache.set(cacheKey, ranking);
      }
      if (ranking.length === 0) continue;
      const cutoffIndex = Math.max(0, Math.ceil(ranking.length * (numericValue(rule.value) as number) / 100) - 1);
      const cutoffValue = ranking[cutoffIndex].value;
      for (const item of ranking) {
        if (item.value < cutoffValue) break;
        selected.add(`${currency}:${item.key}`);
      }
    }
    selections.set(rule.id, selected);
  }
  return selections;
}

export function applyMetaAudienceRules({
  people,
  scope,
  rules,
}: {
  people: readonly MetaAudiencePerson[];
  scope: MetaAudiencePurchaseScope;
  rules: readonly MetaAudienceRule[];
}): { people: MetaAudiencePerson[]; errors: string[] } {
  const errors = validateMetaAudienceRules(rules);
  if (errors.length > 0) return { people: [], errors };
  const topSelections = percentileSelections(people, rules);
  return {
    errors: [],
    people: people.filter((person) => {
      if (!personMatchesMetaAudienceScope(person, scope)) return false;
      return rules.every((rule) => {
        const value = metaAudienceMetricValue(person, rule.metric);
        if (value == null) return false;
        if (rule.operator === "top_percent") {
          return topSelections.get(rule.id)?.has(`${person.currency}:${person.key}`) ?? false;
        }
        return compareRule(value, rule);
      });
    }),
  };
}
