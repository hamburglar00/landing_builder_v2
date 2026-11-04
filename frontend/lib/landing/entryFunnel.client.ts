import type { EntryFunnelContext } from "./entryFunnel";
export type EntryFunnelClient = { flowId: string; beginAttempt(): void; emit(name: string, details?: Record<string, unknown>): void; flush(beacon?: boolean): void; context(): EntryFunnelContext; timings(header: string | null): void; adopt(context: EntryFunnelContext): void; stop(): void };

/** Self-contained to embed into the existing public runtime; no additional blocking request. */
export function installEntryFunnel(config: {
  navigationKind?: "preparation" | "gateway"; landingId?: string; template?: number; entryTemplate?: number; template8?: boolean; targetProvider?: string; skinCode?: string;
}, suppliedContext?: EntryFunnelContext, endpoint = "/api/entry-funnel"): EntryFunnelClient | undefined {
  const browser = window as typeof window & { __entryFunnel?: EntryFunnelClient; __ENTRY_FUNNEL_EARLY__?: { started_at?: number; context?: EntryFunnelContext; timings?: string[]; events?: Array<{ name: string; at: number; id?: string; error_code?: string }> } };
  if (browser.__entryFunnel) {
    if (!suppliedContext || browser.__entryFunnel.flowId === suppliedContext.flow_id) {
      if (suppliedContext) browser.__entryFunnel.adopt(suppliedContext);
      return browser.__entryFunnel;
    }
    browser.__entryFunnel.stop();
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const template = suppliedContext?.template || config.entryTemplate || (config.template8 || config.template === 8 ? 8 : config.template);
  const landing = suppliedContext?.landing_id || config.landingId;
  if (![7, 8, 9].includes(Number(template)) || !uuid.test(String(landing))) return;
  const allowed = ["page_visible", "form_visible", "name_focus", "name_started", "name_valid", "skin_selected", "cta_clicked", "destination_ready", "account_ready", "login_confirmed", "gateway_loaded", "iframe_loaded", "chat_bootstrap_ready", "welcome_ready", "wallet_ready", "chat_usable", "chat_ready", "entry_error", "visibility_hidden", "resumed", "stage_timing", "casino_account_ready", "entry_retry", "attempt_started"];
  const phases = ["landing_dns", "landing_connect", "landing_tls", "landing_ttfb", "landing_download", "landing_navigation",
    "gateway_dns", "gateway_connect", "gateway_tls", "gateway_ttfb", "gateway_download", "gateway_navigation",
    "casino_ttfb", "casino_download", "casino_navigation",
  "preparation_dns", "preparation_connect", "preparation_tls", "preparation_ttfb", "preparation_download", "preparation_navigation",
    "destination_scope", "destination_resolve", "destination_fallback", "destination_total", "identity_bootstrap",
  "builder_context", "atrio_identity", "casino_account", "atrio_link", "gateway_handoff", "entry_finalize", "entry_total",
    "account_lookup", "provider_create", "provider_verify", "account_finalize", "provider_login", "session_confirm"];
  const stages = ["runtime", "destination", "account", "login", "session", "chat_iframe", "chat_bootstrap", "welcome", "wallet", "chat"];
  const errors = ["destination_unavailable", "account_unavailable", "prepare_rejected", "prepare_unavailable", "login_unavailable", "session_unavailable", "chat_unavailable", "request_timeout", "network_error", "rate_limited", "invalid_entry", "unknown"];
  const providers = ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"];
  const skins = ["jugamos", "ganamos_plus", "casino_zeus", "bet30", "gana_en_casa", "celu_apuestas", "casino_zeta", "oro_puro", "fortu_bet", "gran_poseidon", "kona_bet", "mega_faraon", "camel_bet", "rhino_play"];
  const key = "entry-funnel:v1:" + landing;
  const now = Date.now();
  function id() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }
  const early = browser.__ENTRY_FUNNEL_EARLY__;
  let context: EntryFunnelContext | undefined = suppliedContext;
  try {
    if (!context) {
      const stored = early?.context || JSON.parse(sessionStorage.getItem(key) || "null");
      if (stored && uuid.test(stored.flow_id) && stored.landing_id === landing && stored.template === template &&
        stored.telemetry_origin === location.origin && Number.isSafeInteger(stored.started_at) &&
        stored.started_at <= now && stored.started_at > now - 86400000) context = stored;
    }
  } catch { /* Storage can be unavailable in embedded/private browsers. */ }
  const earlyStart = Number(early?.started_at);
  if (!context) context = { landing_id: String(landing), flow_id: id(), template: template as 7 | 8 | 9, telemetry_origin: location.origin, started_at: Number.isSafeInteger(earlyStart) && earlyStart <= now && earlyStart > now - 86400000 ? earlyStart : now };
  const flow: EntryFunnelContext = { landing_id: context.landing_id, flow_id: context.flow_id, template: context.template,
    telemetry_origin: context.telemetry_origin, started_at: context.started_at };
  if (uuid.test(String(context.attempt_id)) && Number.isInteger(context.attempt_number) && Number(context.attempt_number) >= 1 && Number(context.attempt_number) <= 1000) {
    flow.attempt_id = context.attempt_id; flow.attempt_number = context.attempt_number;
    if (context.account_kind === "new" || context.account_kind === "existing") flow.account_kind = context.account_kind;
  }
  function persistContext() { try { sessionStorage.setItem(key, JSON.stringify(flow)); } catch { /* best effort */ } }
  function beginAttempt() {
    flow.attempt_id = id(); flow.attempt_number = Math.min(1000, (flow.attempt_number || 0) + 1);
    delete flow.account_kind; persistContext();
    emit("attempt_started");
  }
  function adopt(value: EntryFunnelContext) {
    if (value.flow_id !== flow.flow_id || !uuid.test(String(value.attempt_id)) ||
      !Number.isInteger(value.attempt_number) || Number(value.attempt_number) < 1 || Number(value.attempt_number) > 1000) return;
    flow.attempt_id = value.attempt_id; flow.attempt_number = value.attempt_number;
    if (value.account_kind === "new" || value.account_kind === "existing") flow.account_kind = value.account_kind;
    else delete flow.account_kind;
    persistContext();
  }
  try { sessionStorage.setItem(key, JSON.stringify(flow)); } catch { /* diagnostics must never block entry */ }
  let queue: Array<Record<string, unknown>> = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight = false;
  let count = 0;
  let active = true;
  let retries = 0;
  const seen = new Set<string>();
  const pendingKey = key + ":pending";
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
    if (pending?.flow_id === flow.flow_id && Array.isArray(pending.events)) {
      queue = pending.events.slice(0, 20).filter((e: Record<string, unknown>) => uuid.test(String(e.id)) && allowed.includes(String(e.name)));
    }
  } catch { /* best effort */ }
  function saveQueue() {
    try { sessionStorage.setItem(pendingKey, JSON.stringify({ flow_id: flow.flow_id, events: queue })); } catch { /* best effort */ }
  }
  function flush(beacon = false) {
    if (!active) return;
    if (timer) { clearTimeout(timer); timer = undefined; }
    if (!queue.length || inflight && !beacon) return;
    const events = queue.slice(0, 20);
    const payload = JSON.stringify({ landing_id: flow.landing_id, flow_id: flow.flow_id, template: flow.template, events });
    if (beacon && navigator.sendBeacon) {
      try {
        // Retain until an acknowledged fetch. Replays carry the same IDs and SQL deduplicates.
        if (navigator.sendBeacon(endpoint, new Blob([payload], { type: "text/plain" }))) return;
      } catch { /* fallback to keepalive */ }
    }
    inflight = true;
    fetch(endpoint, { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, credentials: "same-origin", keepalive: true, cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("unavailable");
        const sent = new Set(events.map(e => e.id));
        queue = queue.filter(e => !sent.has(e.id)); retries = 0; saveQueue();
      }).catch(() => { retries += 1; })
      .finally(() => {
        inflight = false;
        if (active && queue.length && retries <= 1 && document.visibilityState !== "hidden") timer = setTimeout(() => flush(), 1800);
      });
  }
  function emit(name: string, details: Record<string, unknown> = {}) {
    if (!active || !allowed.includes(name) || count >= 120) return;
    if (name === "stage_timing" && (!phases.includes(String(details.phase)) || !Number.isSafeInteger(details.duration_ms) || Number(details.duration_ms) < 0 || Number(details.duration_ms) > 86400000)) return;
    if (name === "cta_clicked") beginAttempt();
    if (details.account_kind === "new" || details.account_kind === "existing") { flow.account_kind = details.account_kind; persistContext(); }
    const provider = details.provider || config.targetProvider;
    const skin = details.skin || config.skinCode;
    const once = !["cta_clicked", "entry_retry", "entry_error", "visibility_hidden", "resumed"].includes(name);
    const attemptScoped = !["page_visible", "form_visible", "name_focus", "name_started", "name_valid", "skin_selected"].includes(name);
    const stageKey = name + ":" + String(provider || "") + ":" + String(skin || "") + ":" + (attemptScoped ? flow.attempt_id || "" : "") + ":" + String(details.phase || "");
    if (once && seen.has(stageKey)) return;
    seen.add(stageKey); count += 1;
    const event: Record<string, unknown> = {
      id: uuid.test(String(details.event_id)) ? details.event_id : id(), name, elapsed_ms: Math.max(0, Math.min(86400000, Number.isSafeInteger(details.elapsed_ms) ? Number(details.elapsed_ms) : Date.now() - flow.started_at)),
    };
    if (flow.attempt_id && uuid.test(flow.attempt_id)) { event.attempt_id = flow.attempt_id; event.attempt_number = flow.attempt_number; }
    if (flow.account_kind) event.account_kind = flow.account_kind;
    if (name === "stage_timing") event.phase = details.phase;
    if (providers.includes(String(provider))) event.provider = provider;
    if (skins.includes(String(skin))) event.skin = skin;
    if (name === "entry_error") event.error_code = errors.includes(String(details.error_code)) ? details.error_code : "unknown";
    if (["entry_error", "entry_retry"].includes(name) && stages.includes(String(details.error_stage))) event.error_stage = details.error_stage;
    if (Number.isSafeInteger(details.duration_ms) && Number(details.duration_ms) >= 0 && Number(details.duration_ms) <= 86400000) event.duration_ms = details.duration_ms;
    if (Number.isInteger(details.status) && Number(details.status) >= 100 && Number(details.status) <= 599) event.status = details.status;
    queue.push(event); if (queue.length > 40) queue = queue.slice(-40); saveQueue();
    if (!timer) timer = setTimeout(() => flush(), 500);
  }
  function timings(header: string | null) {
    if (!header || header.length > 2048) return;
    const account = /(?:^|,\s*)t7-account;dur=[0-9]+;desc="(created|recovered)"/.exec(header);
    if (account) { flow.account_kind = account[1] === "created" ? "new" : "existing"; persistContext(); emit("casino_account_ready"); }
    const map: Record<string, string> = { "t7-destination-scope": "destination_scope", "t7-destination-resolve": "destination_resolve", "t7-destination-fallback": "destination_fallback", "t7-destination-total": "destination_total", "t7-identity-bootstrap": "identity_bootstrap", "t7-context": "builder_context", "t7-identity": "atrio_identity", "t7-account": "casino_account",
      "t7-link": "atrio_link", "t7-handoff": "gateway_handoff", "t7-finalize": "entry_finalize", "t7-total": "entry_total",
      "atrio_database_lookup": "account_lookup", "atrio_provider_create": "provider_create", "atrio_provider_verify": "provider_verify", "atrio_local_finalize": "account_finalize" };
    for (const part of header.split(",")) {
      const match = /^\s*([a-z0-9_-]+);dur=([0-9]+)(?:;desc="(?:created|recovered)")?\s*$/.exec(part);
      if (match && map[match[1]]) emit("stage_timing", { phase: map[match[1]], duration_ms: Number(match[2]) });
    }
  }
  function navigationTiming() {
    try {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!navigation || !navigation.responseEnd) return;
      const prefix = !suppliedContext ? "landing_" : config.navigationKind === "preparation" ? "preparation_" : "gateway_";
      for (const [phase, start, end] of [
        ["dns", navigation.domainLookupStart, navigation.domainLookupEnd], ["connect", navigation.connectStart, navigation.connectEnd],
        ["tls", navigation.secureConnectionStart, navigation.secureConnectionStart > 0 ? navigation.connectEnd : 0],
        ["ttfb", navigation.requestStart, navigation.responseStart], ["download", navigation.responseStart, navigation.responseEnd],
        ["navigation", navigation.startTime, navigation.responseEnd],
      ] as Array<[string, number, number]>) {
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start && (phase !== "tls" || start > 0))
          emit("stage_timing", { phase: prefix + phase, duration_ms: Math.round(end - start) });
      }
    } catch { /* Unsupported/restricted performance APIs do not affect entry. */ }
  }
  const api = { flowId: flow.flow_id, beginAttempt, emit, flush, timings, adopt, context: () => { if (!flow.attempt_id) beginAttempt(); return { ...flow }; }, stop: () => { active = false; if (timer) clearTimeout(timer); } };
  browser.__entryFunnel = api;
  if (!suppliedContext) {
    if (Array.isArray(early?.events)) early.events.slice(0, 8).forEach(event => {
      if (["page_visible", "form_visible", "name_focus", "name_started", "name_valid", "cta_clicked", "entry_error"].includes(event.name) &&
        Number.isSafeInteger(event.at) && event.at >= flow.started_at && event.at <= Date.now()) emit(event.name, { elapsed_ms: event.at - flow.started_at, event_id: event.id, error_code: event.error_code });
    });
    early?.timings?.slice(0, 8).forEach(header => timings(header));
    delete browser.__ENTRY_FUNNEL_EARLY__;
  }
  // Gateway renderers emit their own milestones and do not install landing observers.
  if (!suppliedContext) {
    const visibleForm = () => {
      if (document.visibilityState === "hidden") return;
      emit("page_visible");
      const form = document.querySelector("[data-template7-form]");
      if (form && form.getClientRects().length) emit("form_visible");
    };
    document.addEventListener("focusin", event => {
      if ((event.target as Element)?.matches?.("[data-template7-name]")) { visibleForm(); emit("name_focus"); }
    });
    document.addEventListener("input", event => {
      const target = event.target as HTMLInputElement;
      if (!target?.matches?.("[data-template7-name]")) return;
      if (target.value.length > 0) emit("name_started");
      if (target.value.trim() && target.checkValidity()) emit("name_valid");
    });
    const begin = () => {
      requestAnimationFrame(visibleForm);
      const observer = new MutationObserver(visibleForm);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class"] });
      setTimeout(() => observer.disconnect(), 120000);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin, { once: true });
    else begin();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { emit("visibility_hidden"); flush(true); }
    else { emit("resumed"); if (!suppliedContext) emit("page_visible"); flush(); }
  });
  window.addEventListener("pagehide", () => flush(true));
  window.addEventListener("pageshow", event => { if (event.persisted) { emit("resumed"); flush(); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", navigationTiming, { once: true });
  else navigationTiming();
  return api;
}

export function buildEntryFunnelFactoryScript() {
  // tsx/esbuild development builds can annotate nested names. Keep that helper local and harmless.
  return "(function(){var __name=function(fn){return fn;};return (" + installEntryFunnel.toString() + ");})()";
}
export function buildEntryFunnelRuntimeScript() { return "try { (" + buildEntryFunnelFactoryScript() + ")(cfg); } catch (_) {}"; }
