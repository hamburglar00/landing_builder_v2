export function phoneCountryCodeForMarket(country: unknown): "54" | "595" {
  return String(country ?? "").trim().toUpperCase() === "PY" ? "595" : "54";
}

export function phoneCountryCodeForWorkspace(
  workspaceCurrency: unknown,
): "54" | "595" {
  return String(workspaceCurrency ?? "").trim().toUpperCase() === "PYG"
    ? "595"
    : "54";
}
