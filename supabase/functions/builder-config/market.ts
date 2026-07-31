export function phoneCountryCodeForCurrency(currency: unknown): "54" | "595" {
  return String(currency ?? "").trim().toUpperCase() === "PYG" ? "595" : "54";
}
