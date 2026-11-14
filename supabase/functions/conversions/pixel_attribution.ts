import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canUsePromoForJourney, evaluatePromoGerenciaCoherence } from "./event_attribution.ts";
import { journeyCaptureIsAfterEvent } from "./meta_origin.ts";

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
  phone?: unknown;
  assigned_gerencia_id?: unknown;
  lead_gerencia_id?: unknown;
  registration_gerencia_id?: unknown;
  purchase_gerencia_id?: unknown;
  atrio_id?: unknown;
  atrio_players_id?: unknown;
  id?: string | null;
  pixel_id?: unknown;
  meta_pixel_id?: unknown;
  pixel_attribution_source?: unknown;
  pixel_attribution_conversion_id?: unknown;
  promo_code?: unknown;
  contact_event_id?: unknown;
  contact_event_time?: unknown;
  cta_clicked_event_id?: unknown;
  cta_clicked_event_time?: unknown;
  lead_event_id?: unknown;
  lead_event_time?: unknown;
  meta_origin_evidence?: unknown;
  contact_payload_raw?: unknown;
  lead_payload_raw?: unknown;
  purchase_payload_raw?: unknown;
  source_platform?: unknown;
  created_at?: unknown;
}

export interface PurchasePixelAttributionInput {
  eventTime?: unknown;
  identityContext?: PurchasePixelCandidate | null;
  inboundPixelId?: unknown;
  currentRow?: PurchasePixelCandidate | null;
  promoRoots?: PurchasePixelCandidate[];
  landingById?: { id?: unknown; pixel_id?: unknown } | null;
  landingTagMatches?: Array<{ id?: unknown; pixel_id?: unknown }>;
  configuredPixelIds: unknown[];
}

export interface ResolvePurchasePixelAttributionInput {
  eventTime?: unknown;
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
  if (normalizeText(candidate?.contact_event_id)) {
    try {
      const capture = JSON.parse(normalizeText(candidate?.contact_payload_raw));
      const captureId = normalizeText(capture.contact_event_id || capture.event_id);
      const capturedPixel = normalizePixelId(capture.meta_pixel_id || capture.pixel_id);
      if (capturedPixel && (!captureId || captureId === normalizeText(candidate?.contact_event_id))) return capturedPixel;
    } catch { /* Legacy captures without JSON retain their stored destination. */ }
  }
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

export function trustedJourneyPixel(candidate: PurchasePixelCandidate | null | undefined): string {
  return candidateTrustSource(candidate) ? candidatePixel(candidate) : "";
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
  if (journeyCaptureIsAfterEvent(input.currentRow, input.eventTime)) return null;

  const roots = sortPromoRoots(input.promoRoots ?? []).filter(root => {
    const current = input.identityContext ?? input.currentRow;
    const coherence = evaluatePromoGerenciaCoherence({ promoFound: true,
      promoPlayerPhone: root.phone, eventPlayerPhone: current?.phone,
      promoGerenciaId: root.assigned_gerencia_id || root.lead_gerencia_id || root.purchase_gerencia_id,
      eventGerenciaId: current?.assigned_gerencia_id || current?.lead_gerencia_id || current?.registration_gerencia_id || current?.purchase_gerencia_id });
    return canUsePromoForJourney(coherence) &&
      !(normalizeText(root.atrio_id) && normalizeText(current?.atrio_id) && root.atrio_id !== current?.atrio_id) &&
      !(normalizeText(root.atrio_players_id) && normalizeText(current?.atrio_players_id) && root.atrio_players_id !== current?.atrio_players_id);
  });
  // A positively future root must not be rescued by explicit/landing/single
  // fallback, nor by selecting another campaign from the candidate collection.
  if (roots.some(root => candidateTrustSource(root) && journeyCaptureIsAfterEvent(root, input.eventTime))) return null;

  const inboundPixel = normalizePixelId(input.inboundPixelId);
  if (inboundPixel && !configured.has(inboundPixel)) return null;
  const currentPixel = candidatePixel(input.currentRow);
  const currentSource = candidateTrustSource(input.currentRow);
  // Removing credentials never changes an already captured destination.
  if (currentPixel && currentSource && !configured.has(currentPixel)) return null;
  if (inboundPixel && currentPixel && currentSource && inboundPixel !== currentPixel) return null;
  if (inboundPixel && configured.has(inboundPixel)) {
    return {
      pixelId: inboundPixel,
      source: "explicit_payload",
      sourceConversionId: null,
    };
  }

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

  if ((input.promoRoots?.length ?? 0) > 0 && roots.length === 0) return null;
  const rootPixels = new Set(roots.filter(root => candidateTrustSource(root)).map(candidatePixel).filter(Boolean));
  if (rootPixels.size > 1) return null;
  if (rootPixels.size === 1 && !configured.has(Array.from(rootPixels)[0])) return null;
  for (const root of roots) {
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
  if (landingPixel && !configured.has(landingPixel)) return null;
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
        .filter(Boolean),
    ),
  );
  if (tagPixels.length > 1 || (tagPixels.length === 1 && !configured.has(tagPixels[0]))) return null;
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
    const { data, error } = await db
      .from("conversions")
      .select(
        "id, pixel_id, meta_pixel_id, pixel_attribution_source, pixel_attribution_conversion_id, promo_code, contact_event_id, contact_event_time, cta_clicked_event_id, cta_clicked_event_time, lead_event_id, lead_event_time, meta_origin_evidence, contact_payload_raw, lead_payload_raw, purchase_payload_raw, source_platform, created_at, phone, assigned_gerencia_id, lead_gerencia_id, registration_gerencia_id, purchase_gerencia_id, atrio_id, atrio_players_id",
      )
      .eq("user_id", input.userId)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error; // Unavailable evidence is not an empty/unique candidate set.
    promoRoots = (data ?? []) as PurchasePixelCandidate[];
  }

  let landingById: { id?: unknown; pixel_id?: unknown } | null = null;
  if (landingId) {
    const { data, error } = await db
      .from("landings")
      .select("id, pixel_id")
      .eq("user_id", input.userId)
      .eq("id", landingId)
      .maybeSingle();
    if (error) throw error;
    landingById = data;
  }

  let landingTagMatches: Array<{ id?: unknown; pixel_id?: unknown }> = [];
  if (promoPrefix) {
    const { data, error } = await db
      .from("landings")
      .select("id, pixel_id")
      .eq("user_id", input.userId)
      .ilike("landing_tag", promoPrefix);
    if (error) throw error;
    landingTagMatches = data ?? [];
  }

  return choosePurchasePixelAttribution({
    eventTime: input.eventTime,
    identityContext: input.currentRow,
    inboundPixelId: input.inboundPixelId,
    currentRow,
    promoRoots,
    landingById,
    landingTagMatches,
    configuredPixelIds: input.configuredPixelIds,
  });
}

/** Same evidence policy for Lead, registration and Purchase after journey matching. */
export const resolveJourneyPixelAttribution = resolvePurchasePixelAttribution;
export const chooseJourneyPixelAttribution = choosePurchasePixelAttribution;
