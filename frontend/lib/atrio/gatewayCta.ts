type CapturedCta = {
  landing_id?: string | null; atrio_id?: string | null; promo_code?: string | null;
  contact_event_id?: string | null; cta_clicked_event_id?: string | null; source_platform?: string | null;
  telefono_asignado?: string | null; contact_payload_raw?: string | null;
};

/** Only the acquisition CTA establishes the channel, including for enriched rows. */
export function isAtrioGatewayCta(row: CapturedCta): boolean {
  if (!row.landing_id || !row.atrio_id || !row.promo_code || !(row.cta_clicked_event_id || row.contact_event_id)) return false;
  let captured;
  try { captured = JSON.parse(row.contact_payload_raw || "{}"); } catch { return false; }
  if (!captured || typeof captured !== "object" || Array.isArray(captured)) return false;
  if ((captured.source_platform || row.source_platform) !== "landing") return false;
  if (captured.cta_destination) return captured.cta_destination === "atrio";
  // Legacy landings froze their assignment at capture, before the explicit destination field.
  return Boolean(captured.atrio_id || captured.atrio_client_id || !row.telefono_asignado);
}
