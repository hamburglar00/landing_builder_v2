/** Internal diagnostics only. These identifiers are never accepted as authentication. */
export const ENTRY_FUNNEL_EVENTS = [
  "page_visible", "form_visible", "name_focus", "name_started", "name_valid", "skin_selected",
  "cta_clicked", "destination_ready", "account_ready", "login_confirmed", "gateway_loaded",
  "chat_ready", "entry_error", "visibility_hidden", "resumed",
] as const;
export const ENTRY_FUNNEL_ERRORS = [
  "destination_unavailable", "account_unavailable", "prepare_rejected", "prepare_unavailable",
  "login_unavailable", "session_unavailable", "chat_unavailable", "request_timeout",
  "network_error", "rate_limited", "invalid_entry", "unknown",
] as const;
export const ENTRY_FUNNEL_ORIGINS = ["https://landing.panelbotadmin.com", "https://mkt.panelbotadmin.com"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type EntryFunnelContext = {
  landing_id: string; flow_id: string; template: 7 | 8; telemetry_origin: string; started_at: number;
};
export type EntryFunnelEvent = {
  id: string; name: typeof ENTRY_FUNNEL_EVENTS[number]; elapsed_ms: number;
  provider?: string; skin?: string; error_code?: typeof ENTRY_FUNNEL_ERRORS[number]; status?: number;
};
export type EntryFunnelBatch = { landing_id: string; flow_id: string; template: 7 | 8; events: EntryFunnelEvent[] };
const providers = ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"];
const skins = ["jugamos", "ganamos_plus", "casino_zeus", "bet30", "gana_en_casa", "celu_apuestas", "casino_zeta", "oro_puro", "fortu_bet", "gran_poseidon", "kona_bet", "mega_faraon", "camel_bet", "rhino_play"];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function validateEntryFunnelContext(value: unknown, now = Date.now()): EntryFunnelContext | null {
  if (!record(value) || !uuid.test(String(value.landing_id)) || !uuid.test(String(value.flow_id)) ||
    ![7, 8].includes(Number(value.template)) || typeof value.template !== "number" ||
    !ENTRY_FUNNEL_ORIGINS.includes(String(value.telemetry_origin)) || typeof value.started_at !== "number" ||
    !Number.isSafeInteger(value.started_at) || value.started_at > now + 60_000 || value.started_at < now - 86_400_000) return null;
  return { landing_id: String(value.landing_id), flow_id: String(value.flow_id), template: value.template as 7 | 8,
    telemetry_origin: String(value.telemetry_origin), started_at: value.started_at };
}

/** Reject unknown properties instead of accidentally retaining names, tokens, URLs or free-form errors. */
export function validateEntryFunnelBatch(value: unknown): EntryFunnelBatch | null {
  if (!record(value) || Object.keys(value).some(key => !["landing_id", "flow_id", "template", "events"].includes(key)) ||
    !uuid.test(String(value.landing_id)) || !uuid.test(String(value.flow_id)) || ![7, 8].includes(Number(value.template)) ||
    typeof value.template !== "number" || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 20) return null;
  const events: EntryFunnelEvent[] = [];
  for (const row of value.events) {
    if (!record(row) || Object.keys(row).some(key => !["id", "name", "elapsed_ms", "provider", "skin", "error_code", "status"].includes(key)) ||
      !uuid.test(String(row.id)) || !ENTRY_FUNNEL_EVENTS.includes(row.name as never) ||
      typeof row.elapsed_ms !== "number" || !Number.isSafeInteger(row.elapsed_ms) || row.elapsed_ms < 0 || row.elapsed_ms > 86_400_000 ||
      row.provider !== undefined && !providers.includes(String(row.provider)) ||
      row.skin !== undefined && !skins.includes(String(row.skin)) ||
      row.error_code !== undefined && !ENTRY_FUNNEL_ERRORS.includes(row.error_code as never) ||
      row.status !== undefined && (typeof row.status !== "number" || !Number.isInteger(row.status) || row.status < 100 || row.status > 599)) return null;
    events.push({ id: String(row.id), name: row.name as EntryFunnelEvent["name"], elapsed_ms: row.elapsed_ms,
      ...(row.provider ? { provider: String(row.provider) } : {}), ...(row.skin ? { skin: String(row.skin) } : {}),
      ...(row.error_code ? { error_code: row.error_code as EntryFunnelEvent["error_code"] } : {}),
      ...(row.status ? { status: row.status as number } : {}) });
  }
  return { landing_id: String(value.landing_id), flow_id: String(value.flow_id), template: value.template as 7 | 8, events };
}
