/** HTTP success alone is not a receipt for a Conversions API batch. */
export type MetaReceipt = {
  accepted: boolean;
  retryable: boolean;
  reason: "accepted" | "http_error" | "meta_error" | "invalid_json" | "unconfirmed_count";
};

/** A route without event_id cannot safely repeat an ambiguously accepted batch. */
export function requiresMetaReceiptReview(status: number, receipt: MetaReceipt, hasStableEventId: boolean): boolean {
  return !hasStableEventId && status >= 200 && status < 300 &&
    (receipt.reason === "invalid_json" || receipt.reason === "unconfirmed_count");
}

export function evaluateMetaReceipt(status: number, raw: string, expectedEvents = 1): MetaReceipt {
  const transientHttp = status === 408 || status === 429 || status >= 500;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { accepted: false, retryable: transientHttp || (status >= 200 && status < 300), reason: "invalid_json" };
  }
  const object = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
  if (object && "error" in object) {
    const error = object.error;
    const transientMeta = error !== null && typeof error === "object" &&
      (error as Record<string, unknown>).is_transient === true;
    return { accepted: false, retryable: transientHttp || transientMeta, reason: "meta_error" };
  }
  if (status < 200 || status >= 300) {
    return { accepted: false, retryable: transientHttp, reason: "http_error" };
  }
  if (!Number.isInteger(expectedEvents) || expectedEvents <= 0 ||
    object?.events_received !== expectedEvents) {
    // Unknown delivery: retain the original event ID/time when retrying.
    return { accepted: false, retryable: true, reason: "unconfirmed_count" };
  }
  return { accepted: true, retryable: false, reason: "accepted" };
}
