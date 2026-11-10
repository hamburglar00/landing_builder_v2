import { canUseCachedLandingPhone } from "./phoneCachePolicy";

export type LandingPhoneResult = {
  outcome: "ready" | "empty" | "http_error" | "network_error" | "invalid_response" | "legacy_unknown" | "unconfigured" | "timeout";
  data: Record<string, unknown> | null;
  status?: number;
  duration_ms?: number;
  completed_at?: number;
  server_timings?: Record<string, number>;
};
export type LandingPhoneRequest = {
  promise: Promise<LandingPhoneResult>;
  settled: boolean;
  result?: LandingPhoneResult;
  reported?: boolean;
  started_at?: number;
  request_id?: string;
  navigation_id?: string;
  legacy?: boolean;
};
type PhoneConfig = { slug: string; supabaseUrl: string; supabaseAnonKey: string; initialPhone?: Record<string, unknown> | null };
type PhoneClient = {
  version: 2;
  request: (config: PhoneConfig, retrySettledFailure?: boolean) => LandingPhoneRequest;
  reset: (slug: string) => boolean;
  wait: (request: LandingPhoneRequest, milliseconds: number) => Promise<LandingPhoneResult>;
};

/** Serialized into both the early prewarm and the shared runtime. No selection rules live here. */
export function installLandingPhoneRequests(cachePolicy: typeof canUseCachedLandingPhone): PhoneClient {
  const host = window as Window & {
    __PUBLIC_LANDING_PHONE_CLIENT__?: PhoneClient;
    __PUBLIC_LANDING_PHONE_PROMISES?: Record<string, Promise<unknown>>;
    __ENTRY_FUNNEL_NAVIGATION__?: { id?: string };
  };
  if (host.__PUBLIC_LANDING_PHONE_CLIENT__?.version === 2) return host.__PUBLIC_LANDING_PHONE_CLIENT__;
  const records: Record<string, LandingPhoneRequest> = Object.create(null);
  const promises = host.__PUBLIC_LANDING_PHONE_PROMISES = host.__PUBLIC_LANDING_PHONE_PROMISES || {};
  function reset(slug: string) {
    // An expired UI wait is not proof that the server stopped selecting a number.
    if (!records[slug]?.settled) return false;
    delete records[slug]; delete promises[slug]; return true;
  }
  function request(config: PhoneConfig, retrySettledFailure = false): LandingPhoneRequest {
    const slug = config.slug;
    if (records[slug]) {
      if (!retrySettledFailure || !records[slug].settled || records[slug].result?.outcome === "ready") return records[slug];
      reset(slug);
    }
    const record = { settled: false } as LandingPhoneRequest;
    records[slug] = record;
    const previous = promises[slug];
    const initial = config.initialPhone;
    const initialFresh = cachePolicy(initial);
    record.navigation_id = host.__ENTRY_FUNNEL_NAVIGATION__?.id;
    let pending: Promise<LandingPhoneResult>;
    if (previous && typeof previous.then === "function") {
      record.legacy = true;
      // Old cached HTML exposes Promise<data|null>; its discarded error cause cannot be reconstructed.
      pending = Promise.resolve(previous).then(data => data && typeof data === "object" && "phone" in data && data.phone
        ? { outcome: "ready", data: data as Record<string, unknown> }
        : { outcome: "legacy_unknown", data: null }, () => ({ outcome: "legacy_unknown", data: null }));
    } else if (initialFresh) {
      pending = Promise.resolve({ outcome: "ready", data: initial! });
    } else if (!slug || !config.supabaseUrl || !config.supabaseAnonKey) {
      pending = Promise.resolve({ outcome: "unconfigured", data: null });
    } else {
      const started = Date.now();
      record.started_at = started;
      // Diagnostic correlation never authenticates or participates in the selector's reservation IDs.
      try {
        if (crypto.randomUUID) record.request_id = crypto.randomUUID();
        else {
          const bytes = crypto.getRandomValues(new Uint8Array(16));
          bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
          const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
          record.request_id = hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
        }
      } catch { /* Old/restricted browsers still use the same public transport. */ }
      const headers: Record<string, string> = { apikey: config.supabaseAnonKey, Authorization: "Bearer " + config.supabaseAnonKey };
      if (record.request_id) headers["x-entry-request-id"] = record.request_id;
      // Edge sends no-store for every response: fresh assignment, reusable CORS permission only.
      // Deploy that Edge response policy before publishing this browser transport.
      pending = Promise.resolve().then(() => fetch(config.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/landing-phone?name=" + encodeURIComponent(slug), {
        method: "GET", headers,
        cache: "default", keepalive: true,
      })).then(async response => {
        const server_timings: Record<string, number> = {};
        const timing = response.headers?.get("server-timing") || "";
        if (timing.length <= 2048) for (const part of timing.split(",")) {
          const match = /^\s*phone-(owner|plan|cache|select|total);dur=([0-9]+(?:\.[0-9]+)?)\s*$/.exec(part);
          if (match && Number(match[2]) <= 86400000) server_timings["phone_" + match[1]] = Math.round(Number(match[2]));
        }
        const measured = { status: response.status, server_timings };
        if (!response.ok) {
          const outcome = response.headers?.get("x-landing-phone-outcome");
          return { ...measured, outcome: outcome === "no_phones" || outcome === "no_assignments" ? "empty" as const : "http_error" as const, data: null };
        }
        try {
          const data: unknown = await response.json();
          if (!data || typeof data !== "object" || Array.isArray(data)) return { ...measured, outcome: "invalid_response" as const, data: null };
          return { ...measured, outcome: "phone" in data && data.phone ? "ready" as const : "empty" as const, data: data as Record<string, unknown> };
        } catch { return { ...measured, outcome: "invalid_response" as const, data: null }; }
      }, () => ({ outcome: "network_error" as const, data: null }))
        .then(result => ({ ...result, duration_ms: Math.max(0, Date.now() - started) }));
    }
    record.promise = pending.then(result => { record.result = { ...result, completed_at: Date.now() }; record.settled = true; return record.result; });
    // Preserve the legacy shape for older consumers, while retaining diagnostics separately.
    if (!previous) promises[slug] = record.promise.then(result => result.outcome === "ready" ? result.data : null);
    return record;
  }
  function wait(record: LandingPhoneRequest, milliseconds: number): Promise<LandingPhoneResult> {
    return new Promise(resolve => {
      const timer = window.setTimeout(() => resolve({ outcome: "timeout", data: null }), milliseconds);
      record.promise.then(result => { window.clearTimeout(timer); resolve(result); });
    });
  }
  const client: PhoneClient = { version: 2, request, reset, wait };
  host.__PUBLIC_LANDING_PHONE_CLIENT__ = client;
  return client;
}

export function buildLandingPhoneRequestFactoryScript() {
  return "(function(){var __name=function(fn){return fn;};return function(){return (" + installLandingPhoneRequests.toString() + ")(" + canUseCachedLandingPhone.toString() + ");};})()";
}
