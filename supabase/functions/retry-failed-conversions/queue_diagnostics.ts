type RetryQueuePhase = "contact_selection" | "lead_selection" | "purchase_selection";

// Closed vocabulary: database messages/details/hints can contain customer data.
const SQLSTATES = new Set([
  "57014", "55P03", "40001", "40P01", "42501", "42P01", "42703", "42883",
  "53300", "53400", "08000", "08003", "08006", "08001", "08004", "08P01", "XX000",
]);
const PHASES = new Set<RetryQueuePhase>([
  "contact_selection", "lead_selection", "purchase_selection",
]);

export function logRetryQueueSelectionFailure(phase: RetryQueuePhase, error: unknown): void {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  console.error(JSON.stringify({
    event: "capi_retry_queue_selection_failed",
    version: 1,
    phase: PHASES.has(phase) ? phase : "unknown",
    sqlstate: typeof code === "string" && SQLSTATES.has(code) ? code : "unknown",
  }));
}
