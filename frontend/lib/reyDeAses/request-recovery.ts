/** Only use with account-entry endpoints that resume a persisted identity/token. */
export async function fetchWithEntryRecovery(url: string, init: RequestInit, onRetry?: () => void): Promise<Response> {
  const deadline = Date.now() + 30000;
  for (let attempt = 0; attempt < 4; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('entry_recovery_pending');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(15000, remaining));
    const feedback = onRetry ? setTimeout(onRetry, Math.min(8000, remaining)) : undefined;
    let response: Response | undefined;
    let failure: unknown;
    let retryAfter = 0;
    try {
      response = await fetch(url, Object.assign({}, init, { signal: controller.signal }));
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
    finally { clearTimeout(timer); if (feedback !== undefined) clearTimeout(feedback); }
    if (attempt === 3) {
      if (response) return response;
      throw failure;
    }
    if (onRetry) onRetry();
    const delay = Math.max(Number.isFinite(retryAfter) ? retryAfter : 0, [500, 1500, 3500][attempt]);
    if (Date.now() + delay >= deadline) { if (response) return response; throw failure || new Error('entry_recovery_pending'); }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error("entry_recovery_exhausted");
}

// The function has no module-local dependencies; the generated classic runtime uses the same implementation.
export const ENTRY_REQUEST_RECOVERY_SCRIPT = `var fetchWithEntryRecovery = ${fetchWithEntryRecovery.toString()};`;
