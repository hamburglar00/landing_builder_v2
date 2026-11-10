/** Internal diagnostics only. These identifiers are never accepted as authentication. */
export const ENTRY_FUNNEL_EVENTS = [
  "navigation_started", "phone_at_click", "phone_wait_completed", "wallet_result", "welcome_visible", "wallet_visible", "telemetry_loss",
  "page_visible", "form_visible", "name_focus", "name_started", "name_valid", "skin_selected",
  "cta_clicked", "destination_ready", "account_ready", "login_confirmed", "gateway_loaded",
  "iframe_loaded", "chat_bootstrap_ready", "welcome_ready", "wallet_ready",
  "chat_usable", "chat_ready", "entry_error", "visibility_hidden", "resumed", "stage_timing", "casino_account_ready", "entry_retry", "attempt_started", "cta_available", "outbound_requested",
] as const;
export const ENTRY_FUNNEL_PHASES = [
  "phone_owner", "phone_plan", "phone_cache", "phone_select", "phone_total",
  "landing_dns", "landing_connect", "landing_tls", "landing_ttfb", "landing_download", "landing_navigation",
  "gateway_dns", "gateway_connect", "gateway_tls", "gateway_ttfb", "gateway_download", "gateway_navigation",
  "casino_ttfb", "casino_download", "casino_navigation",
  "preparation_dns", "preparation_connect", "preparation_tls", "preparation_ttfb", "preparation_download", "preparation_navigation",
  "destination_scope", "destination_resolve", "destination_fallback", "destination_total", "identity_bootstrap",
  "builder_context", "atrio_identity", "casino_account", "atrio_link", "gateway_handoff", "entry_finalize", "entry_total",
  "account_lookup", "provider_create", "provider_verify", "account_finalize", "provider_login", "session_confirm",
  "landing_dom", "landing_load", "landing_fcp", "landing_lcp", "landing_blocked", "landing_runtime",
  "gateway_dom", "gateway_load", "gateway_fcp", "gateway_lcp", "gateway_blocked", "gateway_runtime",
  "preparation_dom", "preparation_load", "preparation_fcp", "preparation_lcp", "preparation_blocked", "preparation_runtime",
  "identity_request", "destination_request", "account_request", "prepare_request", "login_request", "session_request", "chat_session_request",
  "chat_dns", "chat_connect", "chat_tls", "chat_ttfb", "chat_download", "chat_navigation", "chat_dom", "chat_load", "chat_fcp", "chat_hydration", "chat_visible_to_usable",
] as const;
export const ENTRY_FUNNEL_ERROR_STAGES = ["runtime", "destination", "account", "login", "session", "chat_iframe", "chat_bootstrap", "welcome", "wallet", "chat"] as const;
export const ENTRY_FUNNEL_ERRORS = [
  "destination_unavailable", "account_unavailable", "prepare_rejected", "prepare_unavailable",
  "login_unavailable", "session_unavailable", "chat_unavailable", "request_timeout",
  "network_error", "rate_limited", "invalid_entry", "unknown",
] as const;
export const ENTRY_FUNNEL_ORIGINS = ["https://landing.panelbotadmin.com", "https://mkt.panelbotadmin.com", "https://nexobet.fun"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type EntryFunnelTemplate = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type EntryFunnelProvenance = {
  engine?: "classic" | "constructor" | "nexobet";
  /** SHA of the landing release, carried unchanged through the gateway. */
  release?: string;
  environment?: "production" | "preview" | "development" | "unknown";
  /** Absence of automation evidence does not prove a real customer visit. */
  source?: "synthetic" | "unknown";
  /** Opt-in cohort, including its failed attempts/fallbacks; not proof of login success. */
  entry_strategy?: "sequential" | "combined_login";
};
export type EntryFunnelContext = EntryFunnelProvenance & {
  landing_id: string; flow_id: string; template: EntryFunnelTemplate; telemetry_origin: string; started_at: number;
  attempt_id?: string; attempt_number?: number; account_kind?: "new" | "existing"; navigation_id?: string;
};
export const ENTRY_PHONE_READINESS = ["ready", "pending", "failed", "unknown"] as const;
export const ENTRY_PHONE_OUTCOMES = ["ready", "empty", "http_error", "network_error", "invalid_response", "legacy_unknown", "unconfigured", "timeout"] as const;
export const ENTRY_WALLET_OUTCOMES = ["available", "not_applicable", "unavailable", "error"] as const;
export const ENTRY_LOSS_REASONS = ["overflow", "invalid_batch", "context_mismatch", "rate_limited", "collector_rejected", "delivery_failed"] as const;
export type EntryFunnelObservation = {
  navigation_id?: string; navigation_elapsed_ms?: number; request_id?: string;
  component?: "landing" | "gateway" | "chat"; component_release?: string;
  phone_readiness?: typeof ENTRY_PHONE_READINESS[number]; phone_outcome?: typeof ENTRY_PHONE_OUTCOMES[number];
  wallet_outcome?: typeof ENTRY_WALLET_OUTCOMES[number]; loss_reason?: typeof ENTRY_LOSS_REASONS[number]; loss_count?: number;
};
export function entryFunnelObservation(value: Record<string, unknown>): EntryFunnelObservation | null {
  const out: Record<string, unknown> = {};
  for (const name of ["navigation_id", "request_id"]) {
    if (value[name] === undefined) continue;
    if (typeof value[name] !== "string" || !uuid.test(value[name] as string)) return null;
    out[name] = value[name];
  }
  for (const [name, allowed] of Object.entries({ component: ["landing", "gateway", "chat"], phone_readiness: ENTRY_PHONE_READINESS,
    phone_outcome: ENTRY_PHONE_OUTCOMES, wallet_outcome: ENTRY_WALLET_OUTCOMES, loss_reason: ENTRY_LOSS_REASONS })) {
    if (value[name] === undefined) continue;
    if (typeof value[name] !== "string" || !(allowed as readonly string[]).includes(value[name] as string)) return null;
    out[name] = value[name];
  }
  if (value.component_release !== undefined) {
    if (typeof value.component_release !== "string" || !/^[0-9a-f]{7,40}$/.test(value.component_release)) return null;
    out.component_release = value.component_release;
  }
  for (const [name, min, max] of [["navigation_elapsed_ms", 0, 86400000], ["loss_count", 1, 10000]] as const) {
    if (value[name] === undefined) continue;
    if (!Number.isSafeInteger(value[name]) || Number(value[name]) < min || Number(value[name]) > max) return null;
    out[name] = value[name];
  }
  return out as EntryFunnelObservation;
}
export type EntryFunnelEvent = EntryFunnelProvenance & EntryFunnelObservation & {
  id: string; name: typeof ENTRY_FUNNEL_EVENTS[number]; elapsed_ms: number;
  provider?: string; skin?: string; error_code?: typeof ENTRY_FUNNEL_ERRORS[number]; status?: number;
  error_stage?: typeof ENTRY_FUNNEL_ERROR_STAGES[number]; duration_ms?: number;
  phase?: typeof ENTRY_FUNNEL_PHASES[number]; attempt_id?: string; attempt_number?: number; account_kind?: "new" | "existing";
};
export type EntryFunnelBatch = { landing_id: string; flow_id: string; template: EntryFunnelTemplate; events: EntryFunnelEvent[] };
const providers = ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"];
const skins = ["jugamos", "ganamos_plus", "casino_zeus", "bet30", "gana_en_casa", "celu_apuestas", "casino_zeta", "oro_puro", "fortu_bet", "gran_poseidon", "kona_bet", "mega_faraon", "camel_bet", "rhino_play"];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function entryFunnelProvenance(value: Record<string, unknown>): EntryFunnelProvenance | null {
  if (value.engine !== undefined && (typeof value.engine !== "string" || !["classic", "constructor", "nexobet"].includes(value.engine)) ||
    value.release !== undefined && (typeof value.release !== "string" || !/^[0-9a-f]{7,40}$/.test(value.release)) ||
    value.environment !== undefined && (typeof value.environment !== "string" || !["production", "preview", "development", "unknown"].includes(value.environment)) ||
    value.source !== undefined && (typeof value.source !== "string" || !["synthetic", "unknown"].includes(value.source)) ||
    value.entry_strategy !== undefined && (typeof value.entry_strategy !== "string" || !["sequential", "combined_login"].includes(value.entry_strategy))) return null;
  return {
    ...(value.engine !== undefined ? { engine: value.engine as EntryFunnelProvenance["engine"] } : {}),
    ...(value.release !== undefined ? { release: value.release as string } : {}),
    ...(value.environment !== undefined ? { environment: value.environment as EntryFunnelProvenance["environment"] } : {}),
    ...(value.source !== undefined ? { source: value.source as EntryFunnelProvenance["source"] } : {}),
    ...(value.entry_strategy !== undefined ? { entry_strategy: value.entry_strategy as EntryFunnelProvenance["entry_strategy"] } : {}),
  };
}
function validAttempt(value: Record<string, unknown>): boolean {
  return (value.attempt_id === undefined && value.attempt_number === undefined ||
    typeof value.attempt_id === "string" && uuid.test(value.attempt_id) &&
    Number.isInteger(value.attempt_number) && Number(value.attempt_number) >= 1 && Number(value.attempt_number) <= 1000) &&
    (value.account_kind === undefined || value.account_kind === "new" || value.account_kind === "existing");
}

export function validateEntryFunnelContext(value: unknown, now = Date.now()): EntryFunnelContext | null {
  if (!record(value) || !uuid.test(String(value.landing_id)) || !uuid.test(String(value.flow_id)) ||
    ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(Number(value.template)) || typeof value.template !== "number" ||
    !ENTRY_FUNNEL_ORIGINS.includes(String(value.telemetry_origin)) || typeof value.started_at !== "number" ||
    !Number.isSafeInteger(value.started_at) || value.started_at > now + 60_000 || value.started_at < now - 86_400_000 || !validAttempt(value) || !entryFunnelProvenance(value) ||
    value.navigation_id !== undefined && (typeof value.navigation_id !== "string" || !uuid.test(value.navigation_id))) return null;
  return { ...entryFunnelProvenance(value), landing_id: String(value.landing_id), flow_id: String(value.flow_id), template: value.template as EntryFunnelTemplate,
    telemetry_origin: String(value.telemetry_origin), started_at: value.started_at,
    ...(value.attempt_id ? { attempt_id: String(value.attempt_id), attempt_number: Number(value.attempt_number) } : {}),
    ...(value.account_kind ? { account_kind: value.account_kind as "new" | "existing" } : {}),
    ...(value.navigation_id ? { navigation_id: String(value.navigation_id) } : {}) };
}

/** Reject unknown properties instead of accidentally retaining names, tokens, URLs or free-form errors. */
export function validateEntryFunnelBatch(value: unknown): EntryFunnelBatch | null {
  if (!record(value) || Object.keys(value).some(key => !["landing_id", "flow_id", "template", "events"].includes(key)) ||
    !uuid.test(String(value.landing_id)) || !uuid.test(String(value.flow_id)) || ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(Number(value.template)) ||
    typeof value.template !== "number" || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 20) return null;
  const events: EntryFunnelEvent[] = [];
  for (const row of value.events) {
    if (!record(row) || !validAttempt(row) || !entryFunnelProvenance(row) || !entryFunnelObservation(row) || Object.keys(row).some(key => !["id", "name", "elapsed_ms", "provider", "skin", "error_code", "status", "error_stage", "duration_ms", "phase", "attempt_id", "attempt_number", "account_kind", "engine", "release", "environment", "source", "entry_strategy", "navigation_id", "navigation_elapsed_ms", "request_id", "component", "component_release", "phone_readiness", "phone_outcome", "wallet_outcome", "loss_reason", "loss_count"].includes(key)) ||
      !uuid.test(String(row.id)) || !ENTRY_FUNNEL_EVENTS.includes(row.name as never) ||
      typeof row.elapsed_ms !== "number" || !Number.isSafeInteger(row.elapsed_ms) || row.elapsed_ms < 0 || row.elapsed_ms > 86_400_000 ||
      row.name === "wallet_result" && row.wallet_outcome === undefined ||
      row.name === "telemetry_loss" && (row.loss_reason === undefined || row.loss_count === undefined) ||
      (row.name === "stage_timing" ? !ENTRY_FUNNEL_PHASES.includes(row.phase as never) || row.duration_ms === undefined : row.phase !== undefined) ||
      row.provider !== undefined && !providers.includes(String(row.provider)) ||
      row.skin !== undefined && !skins.includes(String(row.skin)) ||
      row.error_code !== undefined && !ENTRY_FUNNEL_ERRORS.includes(row.error_code as never) ||
      row.error_stage !== undefined && !ENTRY_FUNNEL_ERROR_STAGES.includes(row.error_stage as never) ||
      row.duration_ms !== undefined && (typeof row.duration_ms !== "number" || !Number.isSafeInteger(row.duration_ms) || row.duration_ms < 0 || row.duration_ms > 86_400_000) ||
      row.status !== undefined && (typeof row.status !== "number" || !Number.isInteger(row.status) || row.status < 100 || row.status > 599)) return null;
    events.push({ ...entryFunnelProvenance(row), ...entryFunnelObservation(row), id: String(row.id), name: row.name as EntryFunnelEvent["name"], elapsed_ms: row.elapsed_ms,
      ...(row.provider ? { provider: String(row.provider) } : {}), ...(row.skin ? { skin: String(row.skin) } : {}),
      ...(row.error_code ? { error_code: row.error_code as EntryFunnelEvent["error_code"] } : {}),
      ...(row.error_stage ? { error_stage: row.error_stage as EntryFunnelEvent["error_stage"] } : {}),
      ...(row.duration_ms !== undefined ? { duration_ms: row.duration_ms as number } : {}),
      ...(row.phase ? { phase: row.phase as EntryFunnelEvent["phase"] } : {}),
      ...(row.attempt_id ? { attempt_id: String(row.attempt_id), attempt_number: Number(row.attempt_number) } : {}),
      ...(row.account_kind ? { account_kind: row.account_kind as "new" | "existing" } : {}),
      ...(row.status ? { status: row.status as number } : {}) });
  }
  return { landing_id: String(value.landing_id), flow_id: String(value.flow_id), template: value.template as EntryFunnelTemplate, events };
}
