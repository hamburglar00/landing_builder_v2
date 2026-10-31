import type { EntryFunnelContext } from "./entryFunnel";
export type EntryFunnelClient = { flowId: string; emit(name: string, details?: Record<string, unknown>): void; flush(beacon?: boolean): void; context(): EntryFunnelContext; stop(): void };

/** Self-contained to embed into the existing public runtime; no additional blocking request. */
export function installEntryFunnel(config: {
  landingId?: string; template?: number; template8?: boolean; targetProvider?: string; skinCode?: string;
}, suppliedContext?: EntryFunnelContext, endpoint = "/api/entry-funnel"): EntryFunnelClient | undefined {
  const browser = window as typeof window & { __entryFunnel?: EntryFunnelClient; __ENTRY_FUNNEL_EARLY__?: { started_at?: number; context?: EntryFunnelContext; events?: Array<{ name: string; at: number; id?: string; error_code?: string }> } };
  if (browser.__entryFunnel) {
    if (!suppliedContext || browser.__entryFunnel.flowId === suppliedContext.flow_id) return browser.__entryFunnel;
    browser.__entryFunnel.stop();
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const template = suppliedContext?.template || (config.template8 || config.template === 8 ? 8 : config.template);
  const landing = suppliedContext?.landing_id || config.landingId;
  if (![7, 8].includes(Number(template)) || !uuid.test(String(landing))) return;
  const allowed = ["page_visible", "form_visible", "name_focus", "name_started", "name_valid", "skin_selected", "cta_clicked", "destination_ready", "account_ready", "login_confirmed", "gateway_loaded", "iframe_loaded", "chat_bootstrap_ready", "welcome_ready", "wallet_ready", "chat_ready", "entry_error", "visibility_hidden", "resumed"];
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
  if (!context) context = { landing_id: String(landing), flow_id: id(), template: template as 7 | 8, telemetry_origin: location.origin, started_at: Number.isSafeInteger(earlyStart) && earlyStart <= now && earlyStart > now - 86400000 ? earlyStart : now };
  const flow = context;
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
    if (!active || !allowed.includes(name) || count >= 80) return;
    const provider = details.provider || config.targetProvider;
    const skin = details.skin || config.skinCode;
    const once = !["cta_clicked", "entry_error", "visibility_hidden", "resumed"].includes(name);
    const stageKey = name + ":" + String(provider || "") + ":" + String(skin || "");
    if (once && seen.has(stageKey)) return;
    seen.add(stageKey); count += 1;
    const event: Record<string, unknown> = {
      id: uuid.test(String(details.event_id)) ? details.event_id : id(), name, elapsed_ms: Math.max(0, Math.min(86400000, Number.isSafeInteger(details.elapsed_ms) ? Number(details.elapsed_ms) : Date.now() - flow.started_at)),
    };
    if (providers.includes(String(provider))) event.provider = provider;
    if (skins.includes(String(skin))) event.skin = skin;
    if (name === "entry_error") event.error_code = errors.includes(String(details.error_code)) ? details.error_code : "unknown";
    if (name === "entry_error" && stages.includes(String(details.error_stage))) event.error_stage = details.error_stage;
    if (Number.isSafeInteger(details.duration_ms) && Number(details.duration_ms) >= 0 && Number(details.duration_ms) <= 86400000) event.duration_ms = details.duration_ms;
    if (Number.isInteger(details.status) && Number(details.status) >= 100 && Number(details.status) <= 599) event.status = details.status;
    queue.push(event); if (queue.length > 40) queue = queue.slice(-40); saveQueue();
    if (!timer) timer = setTimeout(() => flush(), 500);
  }
  const api = { flowId: flow.flow_id, emit, flush, context: () => ({ ...flow }), stop: () => { active = false; if (timer) clearTimeout(timer); } };
  browser.__entryFunnel = api;
  if (!suppliedContext && Array.isArray(early?.events)) {
    early.events.slice(0, 8).forEach(event => {
      if (["page_visible", "form_visible", "name_focus", "name_started", "name_valid", "cta_clicked", "entry_error"].includes(event.name) &&
        Number.isSafeInteger(event.at) && event.at >= flow.started_at && event.at <= Date.now()) emit(event.name, { elapsed_ms: event.at - flow.started_at, event_id: event.id, error_code: event.error_code });
    });
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
  return api;
}

export function buildEntryFunnelFactoryScript() {
  // tsx/esbuild development builds can annotate nested names. Keep that helper local and harmless.
  return "(function(){var __name=function(fn){return fn;};return (" + installEntryFunnel.toString() + ");})()";
}
export function buildEntryFunnelRuntimeScript() { return "try { (" + buildEntryFunnelFactoryScript() + ")(cfg); } catch (_) {}"; }
