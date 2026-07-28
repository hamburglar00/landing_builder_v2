import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PurchasePixelAttributionSource =
  | "explicit_payload"
  | "stored_attribution"
  | "contact_context"
  | "explicit_stored_payload"
  | "chatrace_context"
  | "promo_root"
  | "landing_id"
  | "landing_tag"
  | "single_configured_pixel";

export interface PurchasePixelAttribution {
  pixelId: string;
  source: PurchasePixelAttributionSource;
  sourceConversionId: string | null;
}

export interface PurchasePixelCandidate {
  id?: string | null;
  pixel_id?: unknown;
  meta_pixel_id?: unknown;
  pixel_attribution_source?: unknown;
  pixel_attribution_conversion_id?: unknown;
  promo_code?: unknown;
  contact_event_id?: unknown;
  contact_payload_raw?: unknown;
  lead_payload_raw?: unknown;
  purchase_payload_raw?: unknown;
  source_platform?: unknown;
  created_at?: unknown;
}

export interface PurchasePixelAttributionInput {
  inboundPixelId?: unknown;
  currentRow?: PurchasePixelCandidate | null;
  promoRoots?: PurchasePixelCandidate[];
  landingById?: { id?: unknown; pixel_id?: unknown } | null;
  landingTagMatches?: Array<{ id?: unknown; pixel_id?: unknown }>;
  configuredPixelIds: unknown[];
}

export interface ResolvePurchasePixelAttributionInput {
  userId: string;
  inboundPixelId?: unknown;
  currentRow?: PurchasePixelCandidate | null;
  promoCode?: unknown;
  landingId?: unknown;
  configuredPixelIds: unknown[];
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePixelId(value: unknown): string {
  const normalized = normalizeText(value);
  return /^\d+$/.test(normalized) ? normalized : "";
}

function payloadHasExplicitPixel(rawPayload: unknown): boolean {
  const raw = normalizeText(rawPayload);
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    return Boolean(normalizePixelId(payload.meta_pixel_id ?? payload.pixel_id));
  } catch {
    return false;
  }
}

function candidatePixel(
  candidate: PurchasePixelCandidate | null | undefined,
): string {
  return normalizePixelId(candidate?.pixel_id) ||
    normalizePixelId(candidate?.meta_pixel_id);
}

function candidateTrustSource(
  candidate: PurchasePixelCandidate | null | undefined,
):
  | Exclude<
    PurchasePixelAttributionSource,
    | "explicit_payload"
    | "promo_root"
    | "landing_id"
    | "landing_tag"
    | "single_configured_pixel"
  >
  | null {
  if (!candidate) return null;
  const storedSource = normalizeText(
    candidate.pixel_attribution_source,
  ) as PurchasePixelAttributionSource;
  if (storedSource === "contact_context") return "contact_context";
  if (storedSource === "chatrace_context") return "chatrace_context";
  if (
    storedSource === "explicit_payload" ||
    storedSource === "explicit_stored_payload"
  ) {
    return "explicit_stored_payload";
  }
  if (
    storedSource === "stored_attribution" ||
    storedSource === "promo_root" ||
    storedSource === "landing_id" ||
    storedSource === "landing_tag" ||
    storedSource === "single_configured_pixel"
  ) {
    return "stored_attribution";
  }
  if (
    payloadHasExplicitPixel(candidate.contact_payload_raw) ||
    payloadHasExplicitPixel(candidate.lead_payload_raw) ||
    payloadHasExplicitPixel(candidate.purchase_payload_raw)
  ) {
    return "explicit_stored_payload";
  }
  if (
    normalizeText(candidate.contact_event_id) ||
    normalizeText(candidate.contact_payload_raw)
  ) {
    return "contact_context";
  }
  if (normalizeText(candidate.source_platform).toLowerCase() === "chatrace") {
    return "chatrace_context";
  }
  return null;
}

function validConfiguredPixels(values: unknown[]): Set<string> {
  return new Set(values.map(normalizePixelId).filter(Boolean));
}

function sortPromoRoots(
  candidates: PurchasePixelCandidate[],
): PurchasePixelCandidate[] {
  return [...candidates].sort((a, b) => {
    const aExplicit = payloadHasExplicitPixel(a.contact_payload_raw) ? 1 : 0;
    const bExplicit = payloadHasExplicitPixel(b.contact_payload_raw) ? 1 : 0;
    if (aExplicit !== bExplicit) return bExplicit - aExplicit;
    const aContact =
      normalizeText(a.contact_event_id) || normalizeText(a.contact_payload_raw)
        ? 1
        : 0;
    const bContact =
      normalizeText(b.contact_event_id) || normalizeText(b.contact_payload_raw)
        ? 1
        : 0;
    if (aContact !== bContact) return bContact - aContact;
    return Date.parse(normalizeText(a.created_at)) -
      Date.parse(normalizeText(b.created_at));
  });
}

export function choosePurchasePixelAttribution(
  input: PurchasePixelAttributionInput,
): PurchasePixelAttribution | null {
  const configured = validConfiguredPixels(input.configuredPixelIds);
  if (configured.size === 0) return null;

  const inboundPixel = normalizePixelId(input.inboundPixelId);
  if (inboundPixel && configured.has(inboundPixel)) {
    return {
      pixelId: inboundPixel,
      source: "explicit_payload",
      sourceConversionId: null,
    };
  }

  const currentPixel = candidatePixel(input.currentRow);
  const currentSource = candidateTrustSource(input.currentRow);
  if (currentPixel && currentSource && configured.has(currentPixel)) {
    return {
      pixelId: currentPixel,
      source: currentSource,
      sourceConversionId:
        normalizeText(input.currentRow?.pixel_attribution_conversion_id) ||
        (currentSource === "stored_attribution"
          ? null
          : normalizeText(input.currentRow?.id)) ||
        null,
    };
  }

  for (const root of sortPromoRoots(input.promoRoots ?? [])) {
    const pixelId = candidatePixel(root);
    if (!pixelId || !configured.has(pixelId) || !candidateTrustSource(root)) {
      continue;
    }
    return {
      pixelId,
      source: "promo_root",
      sourceConversionId: normalizeText(root.id) || null,
    };
  }

  const landingPixel = normalizePixelId(input.landingById?.pixel_id);
  if (landingPixel && configured.has(landingPixel)) {
    return {
      pixelId: landingPixel,
      source: "landing_id",
      sourceConversionId: null,
    };
  }

  const tagPixels = Array.from(
    new Set(
      (input.landingTagMatches ?? [])
        .map((landing) => normalizePixelId(landing.pixel_id))
        .filter((pixelId) => pixelId && configured.has(pixelId)),
    ),
  );
  if (tagPixels.length === 1) {
    return {
      pixelId: tagPixels[0],
      source: "landing_tag",
      sourceConversionId: null,
    };
  }

  if (configured.size === 1) {
    return {
      pixelId: Array.from(configured)[0],
      source: "single_configured_pixel",
      sourceConversionId: null,
    };
  }

  return null;
}

export async function resolvePurchasePixelAttribution(
  db: SupabaseClient,
  input: ResolvePurchasePixelAttributionInput,
): Promise<PurchasePixelAttribution | null> {
  const promoCode = normalizeText(input.promoCode);
  const landingId = normalizeText(input.landingId);
  const promoPrefix = promoCode.includes("-")
    ? normalizeText(promoCode.split("-", 1)[0])
    : "";
  const currentPromoCode = normalizeText(input.currentRow?.promo_code);
  const currentRow = !promoCode ||
      currentPromoCode.toLowerCase() === promoCode.toLowerCase()
    ? input.currentRow
    : null;

  let promoRoots: PurchasePixelCandidate[] = [];
  if (promoCode) {
    const { data } = await db
      .from("conversions")
      .select(
        "id, pixel_id, meta_pixel_id, pixel_attribution_source, pixel_attribution_conversion_id, promo_code, contact_event_id, contact_payload_raw, lead_payload_raw, purchase_payload_raw, source_platform, created_at",
      )
      .eq("user_id", input.userId)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: true })
      .limit(100);
    promoRoots = (data ?? []) as PurchasePixelCandidate[];
  }

  let landingById: { id?: unknown; pixel_id?: unknown } | null = null;
  if (landingId) {
    const { data } = await db
      .from("landings")
      .select("id, pixel_id")
      .eq("user_id", input.userId)
      .eq("id", landingId)
      .maybeSingle();
    landingById = data;
  }

  let landingTagMatches: Array<{ id?: unknown; pixel_id?: unknown }> = [];
  if (promoPrefix) {
    const { data } = await db
      .from("landings")
      .select("id, pixel_id")
      .eq("user_id", input.userId)
      .ilike("landing_tag", promoPrefix);
    landingTagMatches = data ?? [];
  }

  return choosePurchasePixelAttribution({
    inboundPixelId: input.inboundPixelId,
    currentRow,
    promoRoots,
    landingById,
    landingTagMatches,
    configuredPixelIds: input.configuredPixelIds,
  });
}
