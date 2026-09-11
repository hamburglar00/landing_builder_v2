import type { ConversionRow } from "@/lib/conversionsDb";
import { normalizeInternationalPhone } from "@/lib/phoneNormalization";

export type MetaAudienceType = "segmented" | "value_based";
export type MetaAudienceValueMetric = "first_purchase" | "period_total";
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
  value: number;
  purchaseCount: number;
  firstPurchaseAt: string;
  lastPurchaseAt: string;
};

export type MetaAudienceBuildOptions = {
  valueMetric: MetaAudienceValueMetric;
  purchaseScope: MetaAudiencePurchaseScope;
  countryCallingCode?: "54" | "595";
  minimumValue?: number | null;
  maximumValue?: number | null;
};

export type MetaAudienceBuildResult = {
  people: MetaAudiencePerson[];
  purchaseEvents: number;
  buyersBeforeValueFilter: number;
  excludedByValue: number;
};

type PurchaseRecord = {
  row: ConversionRow;
  eventKey: string;
  purchaseType: "first" | "repeat";
  value: number;
  timestamp: number;
  aliases: string[];
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

export function normalizeMetaPhone(value: unknown, countryCallingCode?: "54" | "595"): string {
  return normalizeInternationalPhone(value, countryCallingCode ?? "");
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
  const countryNames: Record<string, string> = {
    argentina: "ar",
    paraguay: "py",
  };
  if (countryNames[normalized]) return countryNames[normalized];
  return normalized.length === 2 ? normalized : "";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
}

function fieldsFromRow(
  row: ConversionRow,
  countryCallingCode?: "54" | "595",
): Record<MetaAudienceField, string> {
  return {
    email: normalizeMetaEmail(firstNonEmpty(row.email, row.form_email)),
    phone: normalizeMetaPhone(firstNonEmpty(row.phone, row.form_phone), countryCallingCode),
    fn: normalizeLatinText(firstNonEmpty(row.fn, row.form_fn)),
    ln: normalizeLatinText(firstNonEmpty(row.ln, row.form_ln)),
    ct: normalizeLatinText(firstNonEmpty(row.ct, row.geo_city)),
    st: normalizeLatinText(firstNonEmpty(row.st, row.geo_region)),
    zip: normalizePostalCode(row.zip),
    country: normalizeCountry(firstNonEmpty(row.country, row.geo_country)),
  };
}

function purchaseType(row: ConversionRow): "first" | "repeat" {
  if (row.purchase_type === "first" || row.purchase_type === "repeat") {
    return row.purchase_type;
  }
  return clean(row.observaciones).toUpperCase().includes("REPEAT") ? "repeat" : "first";
}

function purchaseEventKey(row: ConversionRow): string {
  return firstNonEmpty(
    row.purchase_transaction_id,
    row.purchase_coelsa_id,
    row.purchase_event_id,
    row.id,
  );
}

function aliasesForRow(row: ConversionRow, countryCallingCode?: "54" | "595"): string[] {
  const fields = fieldsFromRow(row, countryCallingCode);
  const aliases = [
    fields.phone ? `phone:${fields.phone}` : "",
    fields.email ? `email:${fields.email}` : "",
    clean(row.purchase_atrio_players_id)
      ? `player:${clean(row.purchase_atrio_players_id).toLowerCase()}`
      : "",
    clean(row.atrio_players_id)
      ? `player:${clean(row.atrio_players_id).toLowerCase()}`
      : "",
    clean(row.external_id) ? `external:${clean(row.external_id).toLowerCase()}` : "",
  ].filter(Boolean);
  return Array.from(new Set(aliases));
}

function toPurchaseRecords(
  rows: readonly ConversionRow[],
  countryCallingCode?: "54" | "595",
): PurchaseRecord[] {
  const seenEvents = new Set<string>();
  const records: PurchaseRecord[] = [];

  for (const row of rows) {
    if (clean(row.test_event_code)) continue;
    if (!clean(row.purchase_event_id)) continue;
    const eventKey = purchaseEventKey(row);
    if (!eventKey || seenEvents.has(eventKey)) continue;
    seenEvents.add(eventKey);

    const timestamp = new Date(row.created_at).getTime();
    records.push({
      row,
      eventKey,
      purchaseType: purchaseType(row),
      value: Math.max(0, Number(row.valor) || 0),
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      aliases: aliasesForRow(row, countryCallingCode),
    });
  }

  return records.sort((a, b) => a.timestamp - b.timestamp);
}

class AliasGroups {
  private readonly parent = new Map<string, string>();

  add(value: string): void {
    if (!this.parent.has(value)) this.parent.set(value, value);
  }

  find(value: string): string {
    this.add(value);
    const parent = this.parent.get(value) ?? value;
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot);
  }
}

function groupPurchaseRecords(records: PurchaseRecord[]): PurchaseRecord[][] {
  const aliases = new AliasGroups();
  for (const record of records) {
    const recordAliases = record.aliases.length > 0
      ? record.aliases
      : [`row:${record.row.id || record.eventKey}`];
    for (const alias of recordAliases) aliases.add(alias);
    for (let index = 1; index < recordAliases.length; index += 1) {
      aliases.union(recordAliases[0], recordAliases[index]);
    }
  }

  const grouped = new Map<string, PurchaseRecord[]>();
  for (const record of records) {
    const primaryAlias = record.aliases[0] || `row:${record.row.id || record.eventKey}`;
    const groupKey = aliases.find(primaryAlias);
    const group = grouped.get(groupKey) ?? [];
    group.push(record);
    grouped.set(groupKey, group);
  }
  return Array.from(grouped.values());
}

function rowMatchesScope(
  record: PurchaseRecord,
  scope: MetaAudiencePurchaseScope,
): boolean {
  return scope === "all" || record.purchaseType === scope;
}

function mergeFields(
  records: PurchaseRecord[],
  countryCallingCode?: "54" | "595",
): Record<MetaAudienceField, string> {
  const merged = { ...EMPTY_FIELDS };
  for (const record of records) {
    const fields = fieldsFromRow(record.row, countryCallingCode);
    for (const field of META_AUDIENCE_FIELDS) {
      if (fields[field.key]) merged[field.key] = fields[field.key];
    }
  }
  return merged;
}

export function buildMetaAudience(
  rows: readonly ConversionRow[],
  options: MetaAudienceBuildOptions,
): MetaAudienceBuildResult {
  const records = toPurchaseRecords(rows, options.countryCallingCode);
  const groups = groupPurchaseRecords(records);
  const minimumValue = Math.max(0, Number(options.minimumValue) || 0);
  const maximumValue = options.maximumValue == null || options.maximumValue === 0
    ? null
    : Math.max(0, Number(options.maximumValue) || 0);
  const peopleBeforeValueFilter: MetaAudiencePerson[] = [];

  for (const group of groups) {
    const scopedRecords = options.valueMetric === "first_purchase"
      ? group.filter((record) => record.purchaseType === "first")
      : group.filter((record) => rowMatchesScope(record, options.purchaseScope));
    if (scopedRecords.length === 0) continue;

    const value = options.valueMetric === "first_purchase"
      ? scopedRecords[0].value
      : scopedRecords.reduce((total, record) => total + record.value, 0);
    const allGroupFields = mergeFields(group, options.countryCallingCode);
    const first = scopedRecords[0];
    const last = scopedRecords[scopedRecords.length - 1];
    peopleBeforeValueFilter.push({
      key: first.aliases[0] || `row:${first.row.id || first.eventKey}`,
      fields: allGroupFields,
      value,
      purchaseCount: scopedRecords.length,
      firstPurchaseAt: first.row.created_at,
      lastPurchaseAt: last.row.created_at,
    });
  }

  const people = peopleBeforeValueFilter
    .filter((person) => person.value >= minimumValue)
    .filter((person) => maximumValue == null || person.value <= maximumValue)
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));

  return {
    people,
    purchaseEvents: records.length,
    buyersBeforeValueFilter: peopleBeforeValueFilter.length,
    excludedByValue: peopleBeforeValueFilter.length - people.length,
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
  return selectedFields.some((field) => Boolean(person.fields[field]));
}

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCsvValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function buildMetaAudienceCsv({
  people,
  selectedFields,
  audienceType,
}: {
  people: readonly MetaAudiencePerson[];
  selectedFields: readonly MetaAudienceField[];
  audienceType: MetaAudienceType;
}): string {
  const eligible = people.filter((person) => personHasSelectedIdentifier(person, selectedFields));
  const headers = [
    ...selectedFields,
    ...(audienceType === "value_based" ? ["value"] : []),
  ];
  const lines = [headers.map(csvCell).join(",")];

  for (const person of eligible) {
    const cells: Array<string | number> = selectedFields.map((field) => person.fields[field]);
    if (audienceType === "value_based") cells.push(formatCsvValue(person.value));
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\r\n");
}
