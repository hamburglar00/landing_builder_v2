import { normalizeInternationalPhone } from "@/lib/phoneNormalization";

export type MetaAudienceType = "segmented" | "value_based";
export type MetaAudiencePurchaseScope = "all" | "first" | "repeat";
export type MetaAudienceField =
  | "email"
  | "phone"
  | "fn"
  | "ln"
  | "ct"
  | "st"
  | "zip"
  | "country";

export type MetaAudienceSummaryValueMetric =
  | "historical_first_purchase_value"
  | "historical_total_value"
  | "period_total_value"
  | "period_first_purchase_total_value"
  | "period_reload_total_value";

export const META_AUDIENCE_SUMMARY_METRICS: ReadonlyArray<{
  value: MetaAudienceSummaryValueMetric;
  label: string;
}> = [
  { value: "historical_first_purchase_value", label: "Primera carga histórica" },
  { value: "historical_total_value", label: "Valor histórico cargado" },
  { value: "period_total_value", label: "Valor cargado en el período" },
  { value: "period_first_purchase_total_value", label: "Primeras cargas del período" },
  { value: "period_reload_total_value", label: "Recargas del período" },
];

export const META_AUDIENCE_FIELDS: ReadonlyArray<{
  key: MetaAudienceField;
  label: string;
  description: string;
}> = [
  { key: "email", label: "Email", description: "Correo electrónico" },
  { key: "phone", label: "Teléfono", description: "Con código de país" },
  { key: "fn", label: "Nombre", description: "Nombre de la persona" },
  { key: "ln", label: "Apellido", description: "Apellido de la persona" },
  { key: "ct", label: "Ciudad", description: "Ciudad de residencia" },
  { key: "st", label: "Provincia", description: "Provincia o estado" },
  { key: "zip", label: "Código postal", description: "Código postal" },
  { key: "country", label: "País", description: "Código de país" },
];

export const RECOMMENDED_META_AUDIENCE_FIELDS: MetaAudienceField[] = [
  "email",
  "phone",
  "fn",
  "ln",
  "country",
];

export type MetaAudiencePerson = {
  key: string;
  fields: Record<MetaAudienceField, string>;
  currency: "ARS" | "PYG";
  historicalPurchaseCount: number;
  historicalFirstPurchaseCount: number;
  historicalReloadCount: number;
  historicalTotalValue: number;
  historicalAveragePurchaseValue: number | null;
  historicalMaxPurchaseValue: number | null;
  historicalFirstPurchaseValue: number | null;
  historicalFirstPurchaseAt: string | null;
  lastHistoricalPurchaseAt: string | null;
  daysSinceLastPurchase: number;
  periodPurchaseCount: number;
  periodFirstPurchaseCount: number;
  periodReloadCount: number;
  periodTotalValue: number;
  periodFirstPurchaseTotalValue: number;
  periodReloadTotalValue: number;
  periodAveragePurchaseValue: number | null;
  periodMaxPurchaseValue: number | null;
};

export type MetaAudienceBuyerRpcRow = {
  customer_key: unknown;
  phone: unknown;
  email: unknown;
  fn: unknown;
  ln: unknown;
  ct: unknown;
  st: unknown;
  zip: unknown;
  country: unknown;
  currency: unknown;
  historical_purchase_count: unknown;
  historical_first_purchase_count: unknown;
  historical_reload_count: unknown;
  historical_total_value: unknown;
  historical_average_purchase_value: unknown;
  historical_max_purchase_value: unknown;
  historical_first_purchase_value: unknown;
  historical_first_purchase_at: unknown;
  last_historical_purchase_at: unknown;
  days_since_last_purchase: unknown;
  period_purchase_count: unknown;
  period_first_purchase_count: unknown;
  period_reload_count: unknown;
  period_total_value: unknown;
  period_first_purchase_total_value: unknown;
  period_reload_total_value: unknown;
  period_average_purchase_value: unknown;
  period_max_purchase_value: unknown;
};

export type MetaAudienceBuyerPayload = {
  version: unknown;
  rows: unknown;
};

const EMPTY_FIELDS: Record<MetaAudienceField, string> = {
  email: "",
  phone: "",
  fn: "",
  ln: "",
  ct: "",
  st: "",
  zip: "",
  country: "",
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeMetaEmail(value: unknown): string {
  const email = clean(value).toLowerCase();
  return email.includes("@") ? email : "";
}

export function normalizeMetaPhone(value: unknown): string {
  return normalizeInternationalPhone(value, "");
}

function normalizeLatinText(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePostalCode(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCountry(value: unknown): string {
  const normalized = normalizeLatinText(value).replace(/\s/g, "");
  if (normalized === "argentina") return "ar";
  if (normalized === "paraguay") return "py";
  return normalized.length === 2 ? normalized : "";
}

export function normalizeMetaAudienceFields(
  fields: Partial<Record<MetaAudienceField, unknown>>,
): Record<MetaAudienceField, string> {
  return {
    email: normalizeMetaEmail(fields.email),
    phone: normalizeMetaPhone(fields.phone),
    fn: normalizeLatinText(fields.fn),
    ln: normalizeLatinText(fields.ln),
    ct: normalizeLatinText(fields.ct),
    st: normalizeLatinText(fields.st),
    zip: normalizePostalCode(fields.zip),
    country: normalizeCountry(fields.country),
  };
}

function nonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function nullableNonNegativeNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function nullableIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function rowCurrency(value: unknown): "ARS" | "PYG" {
  return clean(value).toUpperCase() === "PYG" ? "PYG" : "ARS";
}

export function mapMetaAudienceBuyerRows(
  rows: readonly MetaAudienceBuyerRpcRow[],
): MetaAudiencePerson[] {
  return rows.map((row) => ({
    key: clean(row.customer_key),
    fields: normalizeMetaAudienceFields({
      phone: row.phone,
      email: row.email,
      fn: row.fn,
      ln: row.ln,
      ct: row.ct,
      st: row.st,
      zip: row.zip,
      country: row.country,
    }),
    currency: rowCurrency(row.currency),
    historicalPurchaseCount: nonNegativeNumber(row.historical_purchase_count),
    historicalFirstPurchaseCount: nonNegativeNumber(row.historical_first_purchase_count),
    historicalReloadCount: nonNegativeNumber(row.historical_reload_count),
    historicalTotalValue: nonNegativeNumber(row.historical_total_value),
    historicalAveragePurchaseValue: nullableNonNegativeNumber(row.historical_average_purchase_value),
    historicalMaxPurchaseValue: nullableNonNegativeNumber(row.historical_max_purchase_value),
    historicalFirstPurchaseValue: nullableNonNegativeNumber(row.historical_first_purchase_value),
    historicalFirstPurchaseAt: nullableIsoDate(row.historical_first_purchase_at),
    lastHistoricalPurchaseAt: nullableIsoDate(row.last_historical_purchase_at),
    daysSinceLastPurchase: nonNegativeNumber(row.days_since_last_purchase),
    periodPurchaseCount: nonNegativeNumber(row.period_purchase_count),
    periodFirstPurchaseCount: nonNegativeNumber(row.period_first_purchase_count),
    periodReloadCount: nonNegativeNumber(row.period_reload_count),
    periodTotalValue: nonNegativeNumber(row.period_total_value),
    periodFirstPurchaseTotalValue: nonNegativeNumber(row.period_first_purchase_total_value),
    periodReloadTotalValue: nonNegativeNumber(row.period_reload_total_value),
    periodAveragePurchaseValue: nullableNonNegativeNumber(row.period_average_purchase_value),
    periodMaxPurchaseValue: nullableNonNegativeNumber(row.period_max_purchase_value),
  }));
}

export function mapMetaAudienceBuyerPayload(payload: unknown): MetaAudiencePerson[] {
  if (payload == null || typeof payload !== "object") {
    throw new Error("La respuesta de compradores de Audiencias Meta no es válida.");
  }
  const { version, rows } = payload as MetaAudienceBuyerPayload;
  if (version !== 2 || !Array.isArray(rows)) {
    throw new Error("La versión de datos de Audiencias Meta no es compatible.");
  }
  const namedRows = rows.map((row) => {
    if (!Array.isArray(row) || row.length !== 28) {
      throw new Error("Una fila de compradores de Audiencias Meta no es válida.");
    }
    return {
      customer_key: row[0],
      phone: row[1],
      email: row[2],
      fn: row[3],
      ln: row[4],
      ct: row[5],
      st: row[6],
      zip: row[7],
      country: row[8],
      currency: row[9],
      historical_purchase_count: row[10],
      historical_first_purchase_count: row[11],
      historical_reload_count: row[12],
      historical_total_value: row[13],
      historical_average_purchase_value: row[14],
      historical_max_purchase_value: row[15],
      historical_first_purchase_value: row[16],
      historical_first_purchase_at: row[17],
      last_historical_purchase_at: row[18],
      days_since_last_purchase: row[19],
      period_purchase_count: row[20],
      period_first_purchase_count: row[21],
      period_reload_count: row[22],
      period_total_value: row[23],
      period_first_purchase_total_value: row[24],
      period_reload_total_value: row[25],
      period_average_purchase_value: row[26],
      period_max_purchase_value: row[27],
    } satisfies MetaAudienceBuyerRpcRow;
  });
  return mapMetaAudienceBuyerRows(namedRows);
}

export function metaAudienceSummaryValue(
  person: MetaAudiencePerson,
  metric: MetaAudienceSummaryValueMetric,
): number | null {
  switch (metric) {
    case "historical_first_purchase_value": return person.historicalFirstPurchaseValue;
    case "historical_total_value": return person.historicalTotalValue;
    case "period_total_value": return person.periodTotalValue;
    case "period_first_purchase_total_value": return person.periodFirstPurchaseTotalValue;
    case "period_reload_total_value": return person.periodReloadTotalValue;
  }
}

export function metaAudienceRepresentedPurchases(
  person: MetaAudiencePerson,
  metric: MetaAudienceSummaryValueMetric,
): number {
  switch (metric) {
    case "historical_first_purchase_value": return person.historicalFirstPurchaseValue == null ? 0 : 1;
    case "historical_total_value": return person.historicalPurchaseCount;
    case "period_total_value": return person.periodPurchaseCount;
    case "period_first_purchase_total_value": return person.periodFirstPurchaseCount;
    case "period_reload_total_value": return person.periodReloadCount;
  }
}

export function getMetaAudiencePreviewStats(
  people: readonly MetaAudiencePerson[],
  summaryValueMetric: MetaAudienceSummaryValueMetric,
) {
  const values = people
    .map((person) => metaAudienceSummaryValue(person, summaryValueMetric))
    .filter((value): value is number => value != null);
  const sortedValues = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sortedValues.length / 2);
  const medianValue = sortedValues.length === 0
    ? 0
    : sortedValues.length % 2 === 0
      ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
      : sortedValues[middle];
  const totalValue = values.reduce((sum, value) => sum + value, 0);

  return {
    representedPurchases: people.reduce(
      (sum, person) => sum + metaAudienceRepresentedPurchases(person, summaryValueMetric),
      0,
    ),
    totalValue,
    averageValue: values.length > 0 ? totalValue / values.length : 0,
    medianValue,
    peopleWithValue: values.length,
  };
}

export function fieldCoverage(
  people: readonly MetaAudiencePerson[],
): Record<MetaAudienceField, number> {
  const coverage = { ...EMPTY_FIELDS } as unknown as Record<MetaAudienceField, number>;
  for (const field of META_AUDIENCE_FIELDS) {
    coverage[field.key] = people.reduce(
      (count, person) => count + (person.fields[field.key] ? 1 : 0),
      0,
    );
  }
  return coverage;
}

export function personHasSelectedIdentifier(
  person: MetaAudiencePerson,
  selectedFields: readonly MetaAudienceField[],
): boolean {
  return selectedFields.some(
    (field) => (field === "email" || field === "phone") && Boolean(person.fields[field]),
  );
}

export function getMetaAudienceExportStats({
  people,
  selectedFields,
  audienceType,
  exportValueMetric,
}: {
  people: readonly MetaAudiencePerson[];
  selectedFields: readonly MetaAudienceField[];
  audienceType: MetaAudienceType;
  exportValueMetric: MetaAudienceSummaryValueMetric;
}) {
  const exportablePeople = people.filter((person) => {
    if (!personHasSelectedIdentifier(person, selectedFields)) return false;
    if (audienceType === "segmented") return true;
    const value = metaAudienceSummaryValue(person, exportValueMetric);
    return value != null && value > 0;
  });
  return {
    exportablePeople,
    missingIdentifierCount: people.filter(
      (person) => !personHasSelectedIdentifier(person, selectedFields),
    ).length,
    missingValueCount: audienceType === "value_based"
      ? people.filter((person) => {
          const value = metaAudienceSummaryValue(person, exportValueMetric);
          return value == null || value <= 0;
        }).length
      : 0,
  };
}

function csvCell(value: string | number): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatCsvValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function buildMetaAudienceCsv({
  people,
  selectedFields,
  audienceType,
  exportValueMetric,
}: {
  people: readonly MetaAudiencePerson[];
  selectedFields: readonly MetaAudienceField[];
  audienceType: MetaAudienceType;
  exportValueMetric: MetaAudienceSummaryValueMetric;
}): string {
  const { exportablePeople } = getMetaAudienceExportStats({
    people,
    selectedFields,
    audienceType,
    exportValueMetric,
  });
  const headers = [
    ...selectedFields,
    ...(audienceType === "value_based" ? ["value"] : []),
  ];
  const lines = [headers.map(csvCell).join(",")];

  for (const person of exportablePeople) {
    const cells: Array<string | number> = selectedFields.map((field) => person.fields[field]);
    if (audienceType === "value_based") {
      cells.push(formatCsvValue(metaAudienceSummaryValue(person, exportValueMetric) as number));
    }
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\r\n");
}
