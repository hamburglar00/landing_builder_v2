type ActionSourceRow = {
  source_platform?: unknown;
  lead_payload_raw?: unknown;
  purchase_payload_raw?: unknown;
};
const text = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";

/** The acquisition source does not determine where a later conversion happened. */
export function resolveMetaActionSource(
  row: ActionSourceRow,
  eventName: string,
): "website" | "chat" {
  // A public landing CTA keeps website even when its advertised name is Lead.
  if (eventName !== "Lead" && eventName !== "Purchase") return "website";
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(eventName === "Lead" ? row.lead_payload_raw : row.purchase_payload_raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "website";
    payload = parsed;
  } catch { return "website"; }
  if (text(payload.action) !== eventName.toLowerCase()) return "website";
  const rowSource = text(row.source_platform), source = text(payload.source_platform);
  const emitters = [text(payload.emitter_platform), text(payload.emitter)];
  // Dedicated CTWA integrations retain their independent route and fallback.
  if ([rowSource, source, ...emitters].some(value => ["chatrace", "whatsapp_cloud_api"].includes(value))) return "website";
  if (eventName === "Purchase" && [source, ...emitters].includes("atrio") &&
    ["", "landing", "atrio"].includes(rowSource) &&
    [source, ...emitters].every(value => ["", "atrio"].includes(value))) return "chat";
  // The existing API2 WhatsApp webhook has no source_platform/emitter. Its
  // LEAD/PURCHASE envelope carries the bot number. A bare action/phone or the
  // row's acquisition label alone is not sufficient to classify a chat.
  if (!source && emitters.every(value => !value) && ["", "landing"].includes(rowSource) &&
    /^(?:\+?[\d ()-]{6,})$/.test(String(payload.bot_phone ?? "")) &&
    !payload.atrio_id && !payload.atrioId && !payload.atrio_client_uuid) return "chat";
  return "website";
}
