/** Operational milestones are independent of the event selected for Meta. */
export type InternalEventFields = {
  internal_events_version?: number | null;
  cta_clicked_event_id?: string | null;
  cta_clicked_event_time?: number | null;
  conversation_started_event_id?: string | null;
  conversation_started_event_time?: number | null;
  purchase_confirmed_event_id?: string | null;
  purchase_confirmed_event_time?: number | null;
};

type EventRow = InternalEventFields & {
  estado?: string | null;
  contact_event_id?: string | null;
  contact_event_time?: number | null;
  contact_payload_raw?: string | null;
  lead_event_id?: string | null;
  lead_event_time?: number | null;
  registration_event_id?: string | null;
  registration_event_time?: number | null;
  confirmed_registration_event_id?: string | null;
  confirmed_registration_event_time?: number | null;
  purchase_event_id?: string | null;
  purchase_event_time?: number | null;
};

// Local to derived rows: survives object spreads, never appears in JSON exports or DB writes.
const projected = Symbol("internal-statistics-projection");
const text = (value: unknown) => String(value ?? "").trim();

export function isAdvertisingCtaStage(row: EventRow, stage: "lead" | "registration"): boolean {
  try {
    const capture = JSON.parse(row.contact_payload_raw || "{}");
    return capture.landing_cta_event_version === 1 && capture.source_platform === "landing" &&
      capture.cta_destination === "atrio" && !!text(row.contact_event_id) &&
      text(capture.contact_event_id || capture.event_id) === text(row.contact_event_id) &&
      text(row[`${stage}_event_id`]) === text(row.contact_event_id) &&
      capture.landing_cta_meta_event === (stage === "lead" ? "Lead" : "CompleteRegistration");
  } catch { return false; }
}

/**
 * Adapt legacy calculation inputs without changing the persisted Meta fields.
 * Versioned rows must never fall back to an advertising Lead when an internal
 * conversation has not been recorded. Historical rows retain evidenced events.
 */
export function projectInternalConversion<T extends EventRow>(row: T): T {
  if ((row as T & { [projected]?: boolean })[projected]) return row;
  const result = { ...row, [projected]: true };
  if (row.internal_events_version === 1) {
    result.contact_event_id = text(row.cta_clicked_event_id);
    result.contact_event_time = row.cta_clicked_event_time ?? null;
    result.lead_event_id = text(row.conversation_started_event_id);
    result.lead_event_time = row.conversation_started_event_time ?? null;
    result.purchase_event_id = text(row.purchase_confirmed_event_id);
    result.purchase_event_time = row.purchase_confirmed_event_time ?? null;
  } else if (isAdvertisingCtaStage(row, "lead")) {
    result.lead_event_id = "";
    result.lead_event_time = null;
  }
  if (text(row.confirmed_registration_event_id)) {
    result.registration_event_id = text(row.confirmed_registration_event_id);
    result.registration_event_time = row.confirmed_registration_event_time ?? null;
  } else if (isAdvertisingCtaStage(row, "registration")) {
    result.registration_event_id = "";
    result.registration_event_time = null;
  }
  // The public estado is a delivery summary, not evidence of a human message.
  result.estado = text(result.purchase_event_id) ? "purchase" : text(result.lead_event_id) ? "lead"
    : text(result.registration_event_id) ? "registration" : text(result.contact_event_id) ? "contact" : "";
  return result;
}

export function internalConversionStage(row: EventRow): string {
  const value = projectInternalConversion(row);
  return text(value.purchase_event_id) ? "purchase" : text(value.lead_event_id) ? "lead"
    : text(value.registration_event_id) ? "registration" : text(value.contact_event_id) ? "contact" : "";
}

export function internalEventName(row: EventRow): string {
  const stage = internalConversionStage(row);
  return stage === "contact" ? "cta_clicked" : stage === "lead" ? "conversation_started"
    : stage === "purchase" ? "purchase_confirmed" : stage === "registration" ? "account_registered" : "";
}
