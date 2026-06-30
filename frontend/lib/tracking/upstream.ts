const MAX_UPSTREAM_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 250, 700];
const UPSTREAM_TIMEOUT_MS = 4000;

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isSuccessStatus(status: number) {
  return status >= 200 && status < 300;
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export type UpstreamDeliveryResult = {
  ok: boolean;
  attempts: number;
  upstreamStatus: number | null;
  details: string;
};

export async function deliverToUpstream(
  postUrl: string,
  payload: Record<string, unknown>,
  maxAttempts = MAX_UPSTREAM_ATTEMPTS,
): Promise<UpstreamDeliveryResult> {
  let response: Response | null = null;
  let text = "";
  let lastError: unknown = null;
  let lastStatus: number | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(RETRY_DELAYS_MS[attempt] ?? 0);
    attempts = attempt + 1;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

      response = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });
      text = await response.text();
      lastStatus = response.status;

      if (isSuccessStatus(response.status)) {
        break;
      }

      if (!shouldRetryStatus(response.status)) {
        break;
      }
    } catch (error) {
      lastError = error;
      response = null;
      text = "";
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  return {
    ok: !!response && isSuccessStatus(response.status),
    attempts,
    upstreamStatus: lastStatus,
    details:
      text ||
      (lastError instanceof Error ? lastError.message : "upstream_no_response"),
  };
}
