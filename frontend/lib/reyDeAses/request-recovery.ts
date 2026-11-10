/** Only use with account-entry endpoints that resume a persisted identity/token. */
export async function fetchWithEntryRecovery(url: string, init: RequestInit, onRetry?: () => void, options?: { combinedPreparation?: boolean }): Promise<Response> {
  // The opt-in preparation experiment includes the existing account and login
  // stages. All ordinary operations retain their original 45/42 second bounds.
  const combined = options?.combinedPreparation === true && new URL(url, location.origin).pathname === "/api/preparations/complete";
  type Diagnostic = { emit(name: string, details: Record<string, unknown>): void; context?(): Record<string, unknown> | null; peekContext?(): Record<string, unknown> };
  const browser = (typeof window === "undefined" ? {} : window) as typeof window & { __entryFunnel?: Diagnostic; __gatewayEntryFunnel?: Diagnostic };
  const diagnostic = browser.__gatewayEntryFunnel || browser.__entryFunnel;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const deadline = Date.now() + (combined ? 90000 : 45000);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (init.signal?.aborted) throw init.signal.reason || new Error('entry_cancelled');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('entry_recovery_pending');
    const controller = new AbortController();
    // The private account endpoint may legitimately take 35–40 seconds. Do not
    // abandon its response at 15 seconds and start another overlapping request.
    const timer = setTimeout(() => controller.abort(), Math.min(combined ? 87000 : 42000, remaining));
    const cancel = () => controller.abort(init.signal?.reason);
    init.signal?.addEventListener('abort', cancel, { once: true });
    if (init.signal?.aborted) cancel();
    const feedback = onRetry ? setTimeout(onRetry, Math.min(8000, remaining)) : undefined;
    let response: Response | undefined;
    let failure: unknown;
    let retryAfter = 0;
    let requestId: string | undefined, trace: Record<string, unknown> | null | undefined;
    const requestStartedAt = Date.now();
    let headers = init.headers;
    try {
      if (diagnostic && new URL(url, location.origin).origin === location.origin) {
        const augmented = new Headers(init.headers);
        trace = diagnostic?.peekContext?.() || diagnostic?.context?.();
        if (typeof crypto !== "undefined") {
          const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
          const h = Array.from(b, value => value.toString(16).padStart(2, "0")).join("");
          requestId = h.slice(0,8) + "-" + h.slice(8,12) + "-" + h.slice(12,16) + "-" + h.slice(16,20) + "-" + h.slice(20);
          augmented.set("x-entry-request-id", requestId);
        }
        for (const field of ["flow", "attempt", "navigation"]) if (uuid.test(String(trace?.[field + "_id"]))) augmented.set("x-entry-" + field + "-id", String(trace![field + "_id"]));
        headers = augmented;
      }
    } catch { /* Diagnostic failure never changes the entry request. */ }
    try {
      response = await fetch(url, Object.assign({}, init, { headers, signal: controller.signal }));
      if (!response.ok && ![408, 429, 500, 502, 503, 504].includes(response.status)) return response;
      // Headers are not confirmation: keep the deadline active until the full JSON
      // arrives. A truncated/aborted body resumes the exact same persisted intent.
      const received = response;
      response = undefined;
      const text = await received.text();
      let body: any = null;
      try { body = JSON.parse(text); }
      catch (error) { if (received.ok) throw error; }
      response = new Response(text, { status: received.status, statusText: received.statusText, headers: received.headers });
      if (response.ok) return response;
      if (body && (body.retryable === false || ["integration_pending", "api2_not_configured", "landing_unavailable", "advisor_not_assigned"].includes(body.error))) return response;
      const header = response.headers.get("Retry-After");
      if (header) retryAfter = /^\d+$/.test(header) ? Number(header) * 1000 : Math.max(0, Date.parse(header) - Date.now());
      if (retryAfter > 60000) return response;
    } catch (error) { failure = error; }
    finally {
      clearTimeout(timer); if (feedback !== undefined) clearTimeout(feedback); init.signal?.removeEventListener('abort', cancel);
      try {
        const path = new URL(url, location.origin).pathname;
        const phases: Record<string, string> = { "/api/preparations/complete": "account_request", "/api/preparations/finalize": "account_request", "/api/template7/prepare": "prepare_request", "/api/template7/start": "account_request", "/start": "login_request", "/api/session/recover": "session_request" };
        if (requestId && phases[path]) diagnostic?.emit("stage_timing", { phase: phases[path], duration_ms: Math.max(0, Date.now() - requestStartedAt), request_id: requestId, navigation_id: trace?.navigation_id, ...(response ? { status: response.status } : {}) });
      } catch { /* Closed diagnostics only. */ }
    }
    if (init.signal?.aborted) throw init.signal.reason || failure || new Error('entry_cancelled');
    if (attempt === 3) {
      if (response) return response;
      throw failure;
    }
    if (onRetry) onRetry();
    const delay = Math.max(Number.isFinite(retryAfter) ? retryAfter : 0, [500, 1500, 3500][attempt]);
    if (Date.now() + delay >= deadline) { if (response) return response; throw failure || new Error('entry_recovery_pending'); }
    // Purely observational: keep the same identity, request body and retry policy.
    try {
      const browser = window as typeof window & { __entryFunnel?: { emit(name: string, details: Record<string, unknown>): void }; __gatewayEntryFunnel?: { emit(name: string, details: Record<string, unknown>): void } };
      const diagnostic = browser.__gatewayEntryFunnel || browser.__entryFunnel;
      const path = new URL(url, location.origin).pathname;
      const stage = path === "/api/session/recover" ? "session" : path === "/start" ? "login" : "account";
      diagnostic?.emit("entry_retry", { request_id: requestId, navigation_id: trace?.navigation_id, error_stage: stage, ...(response ? { status: response.status } : {}) });
    } catch { /* Diagnostics never control recovery or expose the URL. */ }
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(pause); init.signal?.removeEventListener('abort', abort); reject(init.signal?.reason || new Error('entry_cancelled')); };
      const pause = setTimeout(() => { init.signal?.removeEventListener('abort', abort); resolve(); }, delay);
      init.signal?.addEventListener('abort', abort, { once: true });
      if (init.signal?.aborted) abort();
    });
  }
  throw new Error("entry_recovery_exhausted");
}

// The function has no module-local dependencies; the generated classic runtime uses the same implementation.
export const ENTRY_REQUEST_RECOVERY_SCRIPT = `var fetchWithEntryRecovery = ${fetchWithEntryRecovery.toString()};`;
