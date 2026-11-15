import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeMetaEventSourceUrl } from "./meta_source_url.ts";

export type PurchaseSourceRow = {
  id?: unknown;
  user_id?: unknown;
  landing_name?: unknown;
  event_source_url?: unknown;
  contact_payload_raw?: unknown;
  purchase_attribution_conversion_id?: unknown;
  pixel_attribution_conversion_id?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Validate provenance first; remove query data and fragments before persistence/delivery. */
function websiteUrl(value: unknown, allowRoot: boolean): string {
  const raw = text(value);
  if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) return "";
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname ||
      parsed.username || parsed.password) return "";
    if (!allowRoot && !parsed.pathname.replace(/\//g, "")) return "";
    return sanitizeMetaEventSourceUrl(raw);
  } catch {
    return "";
  }
}

/** Read only complete JSON: historical payloads may have been truncated. */
export function sourceUrlFromPayload(raw: unknown): unknown {
  if (typeof raw !== "string") return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed.event_source_url : undefined;
  } catch {
    return undefined;
  }
}

function matchedUrl(row: PurchaseSourceRow | null): string {
  if (!row) return "";
  // This is a routing marker, not a website. Preserve the selected WABA.
  const marker = text(row.event_source_url);
  if (/^whatsapp-cloud-api:\/\/\d+\/?$/.test(marker)) return marker;
  return websiteUrl(sourceUrlFromPayload(row.contact_payload_raw), false) ||
    websiteUrl(row.event_source_url, false);
}

/** Resolve only after the handler has selected its tenant-scoped journey. */
export async function resolvePurchaseEventSourceUrl(
  db: SupabaseClient,
  input: {
    userId: string;
    explicitUrl?: unknown;
    matchedRow?: PurchaseSourceRow | null;
    /** Only a name resolved from this tenant's landings table, never raw input. */
    landingName?: string;
  },
): Promise<string> {
  const matched = input.matchedRow?.user_id === input.userId
    ? input.matchedRow : null;
  const capturedContact = websiteUrl(sourceUrlFromPayload(matched?.contact_payload_raw), false);
  if (capturedContact) return capturedContact;
  const capturedMarker = text(matched?.event_source_url);
  if (/^whatsapp-cloud-api:\/\/\d+\/?$/.test(capturedMarker)) return capturedMarker;

  // One bounded hop through existing lineage IDs; no phone/promo/inbox search.
  const ids = [...new Set([
    matched?.purchase_attribution_conversion_id,
    matched?.pixel_attribution_conversion_id,
  ].map(text).filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) &&
    id !== text(matched?.id)
  ))];
  if (ids.length) {
    const { data } = await db.from("conversions")
      .select("id,user_id,event_source_url,contact_payload_raw")
      .eq("user_id", input.userId).in("id", ids);
    for (const id of ids) {
      const source = (data ?? []).find((row: PurchaseSourceRow) =>
        row.id === id && row.user_id === input.userId
      ) as PurchaseSourceRow | undefined;
      const linked = matchedUrl(source ?? null);
      if (linked) return linked;
    }
  }

  const captured = matchedUrl(matched);
  if (captured) return captured;

  // Dedicated Business Messaging routing markers are not acquisition URLs.
  const explicitMarker = text(input.explicitUrl);
  if (/^whatsapp-cloud-api:\/\/\d+\/?$/.test(explicitMarker)) return explicitMarker;

  const name = text(matched?.landing_name) || text(input.landingName);
  // Match the public landing/revalidation name contract, including legacy dots.
  // The leading alphanumeric character excludes standalone . and .. segments.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(name)) return "";
  const { data } = await db.from("settings").select("url_base").eq("id", 1)
    .maybeSingle();
  // Reject query/fragment on the configured base before sanitizing it.
  if (/[?#]/.test(text(data?.url_base))) return "";
  const base = websiteUrl(data?.url_base, true);
  if (!base) return "";
  const parsed = new URL(base);
  if (parsed.search || parsed.hash) return "";
  // The configured base owns its route prefix (including /l/ for Builder).
  // Do not infer a motor from a hostname or from an inherited broken root URL.
  const canonical = `${base.replace(/\/+$/, "")}/${encodeURIComponent(name)}`;
  // An integration URL is usable only when it names the already-authorized
  // route. It can never introduce another domain, route or landing override.
  const explicit = websiteUrl(input.explicitUrl, true);
  return explicit === canonical ? explicit : canonical;
}
