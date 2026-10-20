import type { StartRequest } from "./contracts";
import { normalizeArgentinaWhatsapp } from "../landing/argentinaWhatsapp";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,159}$/i;

const ADVISOR_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

const ATTRIBUTION_KEYS = ["landing", "landing_resolution", "facebook", "portofolio", "cp", "campana", "conjunto", "anuncio", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbp", "fbc", "referrer", "target_provider", "skin_code"] as const;

export function parseTemplate7StartPayload(value: unknown): StartRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim().replace(/\s+/g, " ") : "";
  if (!UUID_PATTERN.test(String(data.landing_id ?? "")) || !SLUG_PATTERN.test(String(data.landing_slug ?? "")) ||
      !UUID_PATTERN.test(String(data.atrio_client_id ?? "")) || !UUID_PATTERN.test(String(data.advisor_id ?? "")) ||
      !ADVISOR_SLUG_PATTERN.test(String(data.advisor_slug ?? "")) ||
      !name || name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) return null;
  const promo = typeof data.promo_code === "string" ? data.promo_code.trim() : "";
  if (!promo || promo.length > 128 || /[\x00-\x1f\x7f]/.test(promo)) return null;
  if (data.phone !== undefined && (typeof data.phone !== "string" || data.phone.length > 32)) return null;
  const phone = typeof data.phone === "string" ? normalizeArgentinaWhatsapp(data.phone) : "";
  const rawAttribution = data.attribution;
  if (rawAttribution !== undefined && (!rawAttribution || typeof rawAttribution !== "object" || Array.isArray(rawAttribution))) return null;
  const attribution: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const field = (rawAttribution as Record<string, unknown> | undefined)?.[key];
    if (field !== undefined && (typeof field !== "string" || field.length > 500 || /[\x00-\x1f\x7f]/.test(field))) return null;
    if (key === "landing_resolution" && field && !["url_parameter", "path", "automatic"].includes(String(field))) return null;
    if (field) attribution[key] = field;
  }
  return {
    landing_id: String(data.landing_id), landing_slug: String(data.landing_slug), name,
    atrio_client_id: String(data.atrio_client_id),
    advisor_id: String(data.advisor_id), advisor_slug: String(data.advisor_slug),
    promo_code: promo, ...(phone ? { phone } : {}), attribution,
  };
}
