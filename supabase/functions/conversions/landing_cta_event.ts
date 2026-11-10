type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
export type LandingCtaEvent = "Lead" | "CompleteRegistration";

type CaptureRow = {
  contact_payload_raw?: unknown;
  contact_event_id?: unknown;
  contact_event_time?: unknown;
  atrio_id?: unknown;
  atrio_players_id?: unknown;
  promo_code?: unknown;
  assigned_gerencia_id?: unknown;
  assigned_gerencia_external_id?: unknown;
  assigned_gerencia_name?: unknown;
  assigned_gerencia_label?: unknown;
};

/** Only the resolved, published landing can select the event. Strip browser markers. */
export function freezeLandingCtaEvent(payload: RecordValue, publishedValue: unknown): RecordValue {
  const clean = { ...payload };
  delete clean.landing_cta_meta_event;
  delete clean.landing_cta_event_version;
  delete clean.landing_cta_browser_config_mismatch;
  const published = object(publishedValue), layout = object(published.layout), tracking = object(published.tracking);
  if (![7, 8, 9].includes(Number(layout.template)) || String(payload.source_platform).toLowerCase() !== "landing" ||
    payload.cta_destination !== "atrio" || payload.lead_capture_form !== true || !String(payload.form_fn ?? "").trim()) return clean;
  // An old tab still sends Contact. Do not pair it with another server event.
  if (payload.cta_meta_event !== "Lead" && payload.cta_meta_event !== "CompleteRegistration") return clean;
  const selected = tracking.ctaMetaEvent === "CompleteRegistration" ? "CompleteRegistration" : "Lead";
  return { ...clean, landing_cta_event_version: 1, landing_cta_meta_event: selected,
    ...(payload.cta_meta_event !== selected ? { landing_cta_browser_config_mismatch: true } : {}) };
}

/** Frozen capture is reused by initial CAPI and its existing bounded retries. */
export function frozenLandingCtaEvent(row: { contact_payload_raw?: unknown; contact_event_id?: unknown }): LandingCtaEvent | null {
  try {
    const payload = object(JSON.parse(String(row.contact_payload_raw ?? "")));
    return payload.landing_cta_event_version === 1 && payload.source_platform === "landing" && payload.cta_destination === "atrio" &&
      String(payload.contact_event_id || payload.event_id || "") === String(row.contact_event_id || "") && Boolean(row.contact_event_id) &&
      (payload.landing_cta_meta_event === "Lead" || payload.landing_cta_meta_event === "CompleteRegistration")
      ? payload.landing_cta_meta_event : null;
  } catch { return null; }
}

/** Keep the captured CTA identity for lineage/deduplication; store its actual Meta milestone separately. */
export function landingCtaStoragePatch(row: CaptureRow): RecordValue {
  const selected = frozenLandingCtaEvent(row);
  if (!selected) return {};
  const stage = selected === "Lead" ? "lead" : "registration";
  return {
    estado: stage,
    [`${stage}_event_id`]: row.contact_event_id,
    [`${stage}_event_time`]: row.contact_event_time,
    [`${stage}_payload_raw`]: row.contact_payload_raw,
    [`${stage}_atrio_id`]: row.atrio_id || "",
    [`${stage}_atrio_players_id`]: row.atrio_players_id || "",
    [`${stage}_incoming_promo_code`]: row.promo_code || "",
    [`${stage}_agency_id`]: row.assigned_gerencia_external_id ? String(row.assigned_gerencia_external_id) : "",
    [`${stage}_gerencia_id`]: row.assigned_gerencia_id ?? null,
    [`${stage}_gerencia_external_id`]: row.assigned_gerencia_external_id ?? null,
    [`${stage}_gerencia_name`]: row.assigned_gerencia_name || "",
    [`${stage}_gerencia_label`]: row.assigned_gerencia_label || "",
  };
}

/** Contact retry counters belong to the captured CTA, including a selected CompleteRegistration. */
export function capiEventStorage(eventName: "Contact" | "Lead" | "CompleteRegistration" | "Purchase", row: CaptureRow) {
  const deliveredEvent = eventName === "Contact" ? frozenLandingCtaEvent(row) || eventName : eventName;
  const stage = deliveredEvent === "Contact" ? "contact" : deliveredEvent === "Lead" ? "lead"
    : deliveredEvent === "CompleteRegistration" ? "registration" : "purchase";
  return { eventName: deliveredEvent, stage, statusField: `${stage}_status_capi` } as const;
}

/** The old raw logger truncates at 4k. Keep a complete frozen envelope for retries. */
export function serializeLandingCtaCapture(payload: RecordValue, legacyRaw: string): string {
  if (payload.landing_cta_event_version !== 1) return legacyRaw;
  try { JSON.parse(legacyRaw); return legacyRaw; } catch { /* Preserve a compact valid envelope. */ }
  const compact: RecordValue = {};
  for (const key of ['landing_cta_event_version', 'landing_cta_meta_event', 'landing_cta_browser_config_mismatch',
    'source_platform', 'cta_destination', 'contact_event_id', 'event_id', 'landing_id', 'external_id', 'fbp', 'fbc', 'event_source_url']) {
    const value = payload[key], max = key === 'event_source_url' ? 1800 : 256;
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' && value.length <= max) compact[key] = value;
  }
  compact.raw_payload_truncated = true;
  return JSON.stringify(compact);
}

export function landingCtaCapiEnabled(config: { send_lead_capi?: boolean; send_complete_registration_capi?: boolean },
  eventName: string, row: { contact_payload_raw?: unknown; contact_event_id?: unknown }): boolean {
  if (eventName === "Contact") {
    try {
      const payload = object(JSON.parse(String(row.contact_payload_raw ?? "")));
      if (payload.landing_cta_event_version === 1 && (!frozenLandingCtaEvent(row) || payload.landing_cta_browser_config_mismatch === true)) return false;
    }
    catch { /* Historical non-JSON captures keep their original Contact behavior. */ }
  }
  const selected = eventName === "Contact" ? frozenLandingCtaEvent(row) : null;
  return selected === "Lead" ? config.send_lead_capi !== false
    : selected === "CompleteRegistration" ? config.send_complete_registration_capi === true : true;
}
