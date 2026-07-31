export function phoneCountryCodeForMarket(country: unknown): "54" | "595" {
  return String(country ?? "").trim().toUpperCase() === "PY" ? "595" : "54";
}
