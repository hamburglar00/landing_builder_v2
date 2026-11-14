type Row = Record<string, unknown>;
export interface MetaOriginEvidence {
  version: 1;
  classification: "meta_ads" | "unidentified";
  method:
    | "fbc"
    | "fbclid"
    | "ctwa_clid"
    | "meta_paid_parameters"
    | "legacy_chatrace_promo"
    | "no_supported_evidence";
  parameters: string[];
  values: Record<string, string>;
  observed_at: string;
  source_conversion_id?: string;
}
const text = (v: unknown) => String(v ?? "").trim();
function object(v: unknown): Row {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
}
function parse(v: unknown): Row {
  try {
    return object(JSON.parse(text(v)));
  } catch {
    return {};
  }
}
function usable(v: unknown): string {
  const s = text(v);
  return s.length <= 512 && !/[{}<>\s]/.test(s) ? s : "";
}
function urlParams(payload: Row): URLSearchParams {
  try {
    return new URL(text(payload.event_source_url)).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function eventSeconds(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const numeric = typeof value === "number" || /^\d+(?:\.\d+)?$/.test(raw)
    ? Number(value)
    : NaN;
  const seconds = Number.isFinite(numeric)
    ? (numeric >= 1e12 ? numeric / 1000 : numeric)
    : /^\d{4}-\d{2}-\d{2}T/.test(raw)
    ? Date.parse(raw) / 1000
    : NaN;
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 8.64e12
    ? seconds
    : null;
}

/** Acquisition chronology is independent of when a webhook/derived row arrived. */
export function journeyCaptureTime(
  candidateValue?: object | null,
): number | null {
  if (!candidateValue) return null;
  const row = candidateValue as Row;
  const contact = parse(row.contact_payload_raw);
  const capturedId = text(contact.contact_event_id || contact.event_id);
  const contactId = text(row.contact_event_id || row.cta_clicked_event_id);
  const coherentContact = !capturedId || !contactId || capturedId === contactId;
  const evidence = object(row.meta_origin_evidence);
  const candidates = [
    row.cta_clicked_event_time,
    row.contact_event_time,
    ...(coherentContact
      ? [contact.contact_event_time, contact.event_time]
      : []),
    ...(evidence.version === 1 ? [evidence.observed_at] : []),
  ];
  for (const value of candidates) {
    const seconds = eventSeconds(value);
    if (seconds !== null) return seconds;
  }
  // A repeat row's own creation/purchase date is not its acquisition date.
  const inherited = text(row.pixel_attribution_conversion_id);
  if (inherited && inherited !== text(row.id)) return null;
  const lead = parse(row.lead_payload_raw);
  for (
    const value of [row.lead_event_time, lead.lead_event_time, lead.event_time]
  ) {
    const seconds = eventSeconds(value);
    if (seconds !== null) return seconds;
  }
  return contactId || text(row.contact_payload_raw) ||
      text(row.lead_event_id) || text(row.lead_payload_raw)
    ? eventSeconds(row.created_at)
    : null;
}

/** Missing historical timing stays compatible; positively future acquisition cannot supply a destination. */
export function journeyCaptureIsAfterEvent(
  candidate: object | null | undefined,
  eventTime: unknown,
): boolean {
  const event = eventSeconds(eventTime),
    captured = journeyCaptureTime(candidate);
  return event !== null && captured !== null && captured > event + 300;
}
/** Classification is distinct from pixel routing and is never inferred from fbp or an arbitrary campaign name. */
export function classifyMetaOrigin(
  payload: Row,
  observedAt: number,
): MetaOriginEvidence {
  const observedMs = Number.isFinite(observedAt) && observedAt > 0
    ? observedAt * 1000
    : Date.now();
  const base = {
    version: 1 as const,
    observed_at: new Date(observedMs).toISOString(),
  };
  const found = (
    method: MetaOriginEvidence["method"],
    values: Record<string, string>,
  ): MetaOriginEvidence => ({
    ...base,
    classification: "meta_ads",
    method,
    parameters: Object.keys(values),
    values,
  });
  const fbc = usable(payload.fbc);
  const match = /^fb\.\d+\.(\d{13})\.([A-Za-z0-9_-]+)(?:\.[A-Za-z0-9_-]+)*$/
    .exec(fbc);
  if (
    match && Number(match[1]) <= observedMs + 300_000 &&
    observedMs - Number(match[1]) <= 90 * 86400_000
  ) {
    return found("fbc", { fbc });
  }
  const params = urlParams(payload);
  const fbclid = usable(params.get("fbclid"));
  // A v2 rejection must not be bypassed by recovering a click from a conflicting URL.
  if (!payload.landing_attribution && /^[A-Za-z0-9_-]{10,512}$/.test(fbclid)) {
    return found("fbclid", { fbclid });
  }
  const source = text(payload.source_platform).toLowerCase();
  const ctwa = usable(payload.ctwa_clid);
  if (["chatrace", "whatsapp_cloud_api"].includes(source) && ctwa) {
    return found("ctwa_clid", { ctwa_clid: ctwa });
  }
  const campaignValues = Object.fromEntries(
    ["utm_source", "utm_medium", "utm_campaign"].map(
      (key) => [key, text(payload[key] || params.get(key))],
    ),
  );
  if (
    /^(facebook|instagram|meta|fb|ig)$/i.test(campaignValues.utm_source) &&
    /^(cpc|ppc|paid|paid_social|paid-social|paidsocial|social_paid)$/i.test(
      campaignValues.utm_medium,
    ) &&
    campaignValues.utm_campaign && campaignValues.utm_campaign.length <= 256 &&
    !/[{}<>]/.test(campaignValues.utm_campaign)
  ) {
    return found("meta_paid_parameters", campaignValues);
  }
  // Preserve the secondary integration's existing explicit convention, and label its weaker evidence.
  if (
    source === "chatrace" &&
    /^[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(text(payload.promo_code))
  ) {
    return found("legacy_chatrace_promo", {
      promo_code: text(payload.promo_code),
    });
  }
  return {
    ...base,
    classification: "unidentified",
    method: "no_supported_evidence",
    parameters: [],
    values: {},
  };
}

/** Only pass a database row already matched by the journey/coherence guards as lineage. Never a browser-provided evidence object. */
export function metaOriginPatch(
  payload: Row,
  lineageValue?: object | null,
): { from_meta_ads: boolean; meta_origin_evidence: MetaOriginEvidence } {
  const lineage = lineageValue as Row | null | undefined;
  const suppliedTime = Number(
    payload.event_time || payload.contact_event_time ||
      payload.lead_event_time || payload.purchase_event_time,
  );
  let evidence = classifyMetaOrigin(payload, suppliedTime);
  if (lineage) {
    const saved = object(lineage.meta_origin_evidence);
    let inherited = saved.version === 1 &&
        ["meta_ads", "unidentified"].includes(String(saved.classification)) &&
        Array.isArray(saved.parameters)
      ? saved as unknown as MetaOriginEvidence
      : null;
    if (!inherited) {
      const capture = parse(
        lineage.contact_payload_raw || lineage.lead_payload_raw ||
          lineage.purchase_payload_raw,
      );
      const originalTime = Number(
        lineage.contact_event_time || lineage.lead_event_time ||
          lineage.purchase_event_time,
      ) ||
        Math.floor(Date.parse(text(lineage.created_at)) / 1000);
      const legacy = classifyMetaOrigin({
        ...capture,
        fbc: lineage.fbc,
        ctwa_clid: lineage.ctwa_clid,
        source_platform: lineage.source_platform,
        promo_code: lineage.promo_code,
        event_source_url: capture.event_source_url || lineage.event_source_url,
      }, originalTime);
      if (legacy.classification === "meta_ads") inherited = legacy;
    }
    // Preserve even an unidentified acquisition. A later message's cookie cannot relabel the exact journey.
    if (inherited) {
      evidence = {
        ...inherited,
        source_conversion_id:
          text(inherited.source_conversion_id || lineage.id) || undefined,
      };
    }
  }
  return {
    from_meta_ads: evidence.classification === "meta_ads",
    meta_origin_evidence: evidence,
  };
}
