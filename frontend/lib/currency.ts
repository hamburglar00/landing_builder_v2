import type { ConversionRow } from "@/lib/conversionsDb";

export const CURRENCY_ALL = "__all__" as const;
export const REPORTING_CURRENCIES = ["ARS", "PYG"] as const;
export const META_CURRENCY_OPTIONS = ["ARS", "PYG", "USD", "EUR", "BRL", "CLP", "MXN", "COP"] as const;

export type ReportingCurrency = (typeof REPORTING_CURRENCIES)[number];
export type CurrencyScope = ReportingCurrency | typeof CURRENCY_ALL;

export function normalizeCurrencyCode(value: unknown, fallback = "ARS"): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  const normalizedFallback = String(fallback ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalizedFallback) ? normalizedFallback : "ARS";
}

export function normalizeCurrency(value: unknown, fallback: ReportingCurrency = "ARS"): ReportingCurrency {
  const normalized = normalizeCurrencyCode(value, fallback);
  return REPORTING_CURRENCIES.includes(normalized as ReportingCurrency)
    ? (normalized as ReportingCurrency)
    : fallback;
}

export function isReportingCurrency(value: unknown): value is ReportingCurrency {
  return REPORTING_CURRENCIES.includes(String(value ?? "").trim().toUpperCase() as ReportingCurrency);
}

export function filterConversionsByCurrency(
  rows: ConversionRow[],
  scope: CurrencyScope,
): ConversionRow[] {
  if (scope === CURRENCY_ALL) return rows;
  return rows.filter((row) => normalizeCurrencyCode(row.currency) === scope);
}

export function formatCurrencyAmount(
  value: number,
  currency: ReportingCurrency | string,
): string {
  const normalized = normalizeCurrencyCode(currency);
  const locale = normalized === "PYG" ? "es-PY" : "es-AR";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalized,
      currencyDisplay: "code",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  } catch {
    return `${normalized} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
  }
}

export function formatCompactCurrency(
  value: number,
  currency: ReportingCurrency | string,
): string {
  const normalized = normalizeCurrencyCode(currency);
  const locale = normalized === "PYG" ? "es-PY" : "es-AR";
  const formatted = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
  return `${normalized} ${formatted}`;
}

export function currencyScopeLabel(scope: CurrencyScope): string {
  return scope === CURRENCY_ALL ? "Todas" : scope;
}
