function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const GLOBAL_CONFIG_KEYS = [
  "marketCountry", "sendContactPixel", "ctaDestination", "targetProvider",
  "atrioRedirectUrl", "atrioClientId", "atrioId", "atrioSlug",
];

/** Public rendering and account entry must read the same saved active template. */
export function resolveEffectiveLandingConfig(value: unknown, publishedValue?: unknown): Record<string, unknown> {
  const raw = isRecord(value) ? value : {};
  const template = String(raw.template || "template1").trim();
  const variants = isRecord(raw.templateConfigs) ? raw.templateConfigs : {};
  const active = isRecord(variants[template]) ? variants[template] : null;
  const effective: Record<string, unknown> = active ? { ...raw, ...active, template } : { ...raw };
  for (const key of GLOBAL_CONFIG_KEYS) if (raw[key] !== undefined) effective[key] = raw[key];

  // Older T7 rows can contain their only explicit skin in landing_config.
  // T8 card scope still requires raw config and its existing SQL validation.
  // Never replace an explicit invalid value with another skin.
  const published = isRecord(publishedValue) ? publishedValue : {};
  const tracking = isRecord(published.tracking) ? published.tracking : {};
  const layout = isRecord(published.layout) ? published.layout : {};
  if ((effective.template === "template7" || effective.template === undefined && layout.template === 7) &&
      effective.multiSkinCode === undefined && tracking.skin_code !== undefined) effective.multiSkinCode = tracking.skin_code;
  return effective;
}
