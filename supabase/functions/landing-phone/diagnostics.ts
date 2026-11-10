const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Phase = "owner" | "plan" | "cache" | "select";
type Outcome = "ok" | "preflight" | "method_not_allowed" | "invalid_request" | "config_error" | "backend_error" | "unexpected_error" | "not_found" | "blocked" | "no_assignments" | "no_phones";
export const phoneCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-entry-request-id",
  "Access-Control-Expose-Headers": "Server-Timing, X-Entry-Request-Id, X-Landing-Phone-Outcome",
};

/** No identity, URL, number, body, SQL text or upstream error is retained. */
export function createPhoneDiagnostics(request: Request) {
  const started = performance.now();
  const supplied = request.headers.get("x-entry-request-id") || "";
  const requestId = UUID.test(supplied) ? supplied : crypto.randomUUID();
  const phases: Partial<Record<Phase, number>> = {};
  let outcome: Outcome = "ok";
  let source: "landing" | "chatrace" | "warmup" = "landing";
  let cache: "not_attempted" | "miss" | "bypassed" | "used" = "not_attempted";
  const elapsed = (start: number) => Math.max(0, Math.round((performance.now() - start) * 10) / 10);
  return {
    requestId,
    outcome(value: Outcome) { outcome = value; },
    source(value: string | undefined) { source = value === "chatrace" || value === "warmup" ? value : "landing"; },
    cache(value: typeof cache) { cache = value; },
    async measure<T>(phase: Phase, task: () => PromiseLike<T>): Promise<T> {
      const start = performance.now();
      try { return await task(); } finally { phases[phase] = elapsed(start); }
    },
    finish(response: Response) {
      const total = elapsed(started);
      response.headers.set("Server-Timing", [...Object.entries(phases).map(([phase, duration]) => `phone-${phase};dur=${duration}`), `phone-total;dur=${total}`].join(", "));
      response.headers.set("X-Entry-Request-Id", requestId);
      response.headers.set("X-Landing-Phone-Outcome", outcome);
      if (request.method === "OPTIONS") response.headers.set("Access-Control-Max-Age", "600");
      else response.headers.set("Cache-Control", "no-store");
      console.log(JSON.stringify({ event: "landing_phone_request", request_id: requestId, source, outcome,
        cache, http_status: response.status, duration_ms: total, phases }));
      return response;
    },
  };
}

export function logPhoneBackgroundFailure(phase: "background" | "scope_usage" | "demand", requestId?: string) {
  console.error(JSON.stringify({ event: "landing_phone_background_error", phase,
    ...(requestId && UUID.test(requestId) ? { request_id: requestId } : {}) }));
}
