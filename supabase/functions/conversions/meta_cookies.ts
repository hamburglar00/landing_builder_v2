/** Cookie validation shared by the server senders. Never invent capture time. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const FBC_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function cookieParts(raw: unknown, kind: "fbc" | "fbp", nowMs: number) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  // Parameter Builder adds a base64url appendix. Keep its bytes and the
  // subdomain index; both are part of the cookie captured by the browser.
  const match = /^fb\.(\d+)\.(\d{10}|\d{13})\.([A-Za-z0-9_-]+)(\.[A-Za-z0-9_-]+)?$/.exec(value);
  if (!match || (kind === "fbp" && !/^\d+$/.test(match[3]))) return null;
  const captured = Number(match[2]) * (match[2].length === 10 ? 1000 : 1);
  if (captured <= 0 || captured > nowMs + CLOCK_SKEW_MS) return null;
  if (kind === "fbc" && nowMs - captured > FBC_MAX_AGE_MS) return null;
  return { match, captured };
}

/** Complete browser cookie only; a raw random value cannot identify its birth. */
export function normalizeMetaFbp(raw: unknown, nowMs = Date.now()): string {
  const parts = cookieParts(raw, "fbp", nowMs);
  if (!parts) return "";
  const { match, captured } = parts;
  return `fb.${match[1]}.${captured}.${match[3]}${match[4] ?? ""}`;
}

/** Complete cookie only. Creating fbc from fbclid belongs at first capture. */
export function normalizeMetaFbc(raw: unknown, nowMs = Date.now()): string {
  const parts = cookieParts(raw, "fbc", nowMs);
  if (!parts) return "";
  const { match, captured } = parts;
  return `fb.${match[1]}.${captured}.${match[3]}${match[4] ?? ""}`;
}
