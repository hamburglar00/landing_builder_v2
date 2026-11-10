export type LandingPhoneResult = {
  outcome: "ready" | "empty" | "http_error" | "network_error" | "invalid_response" | "legacy_unknown" | "unconfigured" | "timeout";
  data: Record<string, unknown> | null;
  status?: number;
  duration_ms?: number;
};
export type LandingPhoneRequest = {
  promise: Promise<LandingPhoneResult>;
  settled: boolean;
  result?: LandingPhoneResult;
  reported?: boolean;
};
type PhoneConfig = { slug: string; supabaseUrl: string; supabaseAnonKey: string; initialPhone?: Record<string, unknown> | null };
type PhoneClient = {
  version: 1;
  request: (config: PhoneConfig, retrySettledFailure?: boolean) => LandingPhoneRequest;
  reset: (slug: string) => boolean;
  wait: (request: LandingPhoneRequest, milliseconds: number) => Promise<LandingPhoneResult>;
};

/** Serialized into both the early prewarm and the shared runtime. No selection rules live here. */
export function installLandingPhoneRequests(): PhoneClient {
  const host = window as Window & {
    __PUBLIC_LANDING_PHONE_CLIENT__?: PhoneClient;
    __PUBLIC_LANDING_PHONE_PROMISES?: Record<string, Promise<unknown>>;
  };
  if (host.__PUBLIC_LANDING_PHONE_CLIENT__?.version === 1) return host.__PUBLIC_LANDING_PHONE_CLIENT__;
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
    const refreshedAt = initial?.cacheRefreshedAt ? Date.parse(String(initial.cacheRefreshedAt)) : 0;
    const initialFresh = initial?.phone && refreshedAt && Date.now() - refreshedAt <= 90000;
    let pending: Promise<LandingPhoneResult>;
    if (previous && typeof previous.then === "function") {
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
      // Keep the public endpoint, authentication, availability and assignment contract unchanged.
      pending = Promise.resolve().then(() => fetch(config.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/landing-phone?name=" + encodeURIComponent(slug), {
        method: "GET", headers: { apikey: config.supabaseAnonKey, Authorization: "Bearer " + config.supabaseAnonKey },
        cache: "no-store", keepalive: true,
      })).then(async response => {
        if (!response.ok) return { outcome: "http_error" as const, data: null, status: response.status };
        try {
          const data: unknown = await response.json();
          if (!data || typeof data !== "object" || Array.isArray(data)) return { outcome: "invalid_response" as const, data: null, status: response.status };
          return { outcome: "phone" in data && data.phone ? "ready" as const : "empty" as const, data: data as Record<string, unknown>, status: response.status };
        } catch { return { outcome: "invalid_response" as const, data: null, status: response.status }; }
      }, () => ({ outcome: "network_error" as const, data: null }))
        .then(result => ({ ...result, duration_ms: Math.max(0, Date.now() - started) }));
    }
    record.promise = pending.then(result => { record.result = result; record.settled = true; return result; });
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
  const client: PhoneClient = { version: 1, request, reset, wait };
  host.__PUBLIC_LANDING_PHONE_CLIENT__ = client;
  return client;
}

export function buildLandingPhoneRequestFactoryScript() {
  return "(function(){var __name=function(fn){return fn;};return (" + installLandingPhoneRequests.toString() + ");})()";
}
