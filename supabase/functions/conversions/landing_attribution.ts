type Payload = Record<string, unknown>;

export type ResolvedAttributionLanding = {
  id: string;
  attribution_scope_resolved?: boolean;
  workspace_currency?: string;
  pixel_id?: string | null;
  landing_config?: unknown;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function hasLandingAttributionV2(payload: Payload): boolean {
  const source = text(payload.source_platform).toLowerCase();
  return (!source || source === "landing") &&
    record(payload.landing_attribution) && payload.landing_attribution.version === 2;
}

/** Match builder-config's published branch, including an explicitly empty pixel. */
function publishedPixelId(landing: ResolvedAttributionLanding): string {
  if (landing.landing_config != null) {
    const published = record(landing.landing_config) ? landing.landing_config : {};
    const tracking = record(published.tracking) ? published.tracking : {};
    return String(tracking.pixelId || "").replace(/\D/g, "");
  }
  return text(landing.pixel_id).replace(/\D/g, "");
}

/**
 * Consistency guard for NEW landing CONTACTs only, after existing deduplication.
 * V2 is provenance metadata, not signed proof of an advertising click. Legacy
 * and messaging channels retain their existing rules. UTM/CTWA are untouched;
 * the existing database trigger can still classify an explicit UTM as Meta.
 */
export function guardNewContactLandingAttribution<T extends Payload>(
  payload: T,
  landing: ResolvedAttributionLanding,
  nowMs = Date.now(),
): T {
  if (!hasLandingAttributionV2(payload)) return payload;

  const metadata = payload.landing_attribution as Record<string, unknown>;
  const discard = (): T => ({ ...payload, fbc: "", from_meta_ads: false });
  const expectedCurrency = text(landing.workspace_currency).toUpperCase() === "PYG" ? "PYG" : "ARS";
  const expectedPixel = publishedPixelId(landing);
  if (
    landing.attribution_scope_resolved !== true ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(landing.id) ||
    metadata.landing_id !== landing.id ||
    metadata.workspace_currency !== expectedCurrency ||
    metadata.pixel_id !== expectedPixel ||
    String(payload.meta_pixel_id || payload.pixel_id || "").trim() !== expectedPixel ||
    [payload.currency, payload.workspace_currency].some((value) =>
      text(value) !== "" && text(value).toUpperCase() !== expectedCurrency
    )
  ) return discard();

  const entry = metadata.entry_source;
  const source = metadata.fbc_source;
  if (
    !["url", "referrer", "sdk_fresh", "direct"].includes(String(entry)) ||
    typeof metadata.legacy_fbc_quarantined !== "boolean"
  ) return discard();

  // A valid current/scoped click is allowed even if a different global cookie
  // was quarantined. The client quarantine flag never grants attribution.
  const fbc = text(payload.fbc);
  if (source === "none") return discard();
  if (
    !(source === "persisted" ? entry === "direct" :
      ["url", "referrer", "sdk_fresh"].includes(String(source)) && source === entry) ||
    fbc.length > 500
  ) return discard();

  const parsed = /^fb\.1\.(\d+)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/.exec(fbc);
  const capturedAt = metadata.captured_at;
  const createdAt = parsed ? Number(parsed[1]) : NaN;
  if (
    !Number.isSafeInteger(createdAt) || createdAt <= 0 ||
    typeof capturedAt !== "number" || !Number.isSafeInteger(capturedAt) ||
    capturedAt !== createdAt ||
    createdAt > nowMs + 5 * 60 * 1000 ||
    nowMs - createdAt > 90 * 24 * 60 * 60 * 1000
  ) return discard();

  return { ...payload, fbc, from_meta_ads: true };
}
