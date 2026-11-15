/** Meta needs the page's location, not its form values, tokens or URL fragment. */
export function sanitizeMetaEventSourceUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname ||
      parsed.username || parsed.password) return "";
    // Email addresses must not be embedded in event paths either.
    if (decodeURIComponent(parsed.pathname).includes("@")) return "";
    // `landing` is the only supported query parameter that changes the public
    // route. Advertising identifiers are supplied through their own fields.
    const landing = parsed.searchParams.get("landing");
    parsed.search = "";
    parsed.hash = "";
    if (landing && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(landing)) {
      parsed.searchParams.set("landing", landing);
    }
    return parsed.toString();
  } catch { return ""; }
}
