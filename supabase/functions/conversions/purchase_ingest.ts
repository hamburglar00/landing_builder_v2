import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type IngestDb = Pick<SupabaseClient, "rpc" | "from">;
type JsonObject = Record<string, unknown>;
type JobStatus = "queued" | "processing" | "completed" | "failed";
const JOB_STATUSES = new Set<JobStatus>(["queued", "processing", "completed", "failed"]);
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const MAX_CONTEXT_BYTES = 16 * 1024;
const MAX_ATTEMPTS = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PurchaseIngestPayloadTooLargeError extends Error {
  readonly status = 413;
  constructor() {
    super("purchase_ingest_payload_too_large");
    this.name = "PurchaseIngestPayloadTooLargeError";
  }
}

export type PurchaseIngestContext = {
  jobId: string;
  userId: string;
  idempotencyKey: string;
  leaseToken: string;
};

export type PurchaseIngestProcessor = (
  req: Request,
  trustedContext: PurchaseIngestContext,
) => Promise<Response>;

export type PurchaseIngestReceipt = {
  id: string;
  status: JobStatus;
  inserted: boolean;
};

export type PurchaseIngestStats = {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
  fenced: number;
};

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= 300 && value.trim() === value;
}

function checkedJson(value: unknown, maxBytes: number): string {
  if (!isObject(value)) throw new Error("purchase_ingest_invalid_input");
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > maxBytes) {
    throw new PurchaseIngestPayloadTooLargeError();
  }
  return serialized;
}

/** Returns a receipt only after the private enqueue RPC confirms persistence. */
export async function enqueuePurchaseIngestJob(
  db: IngestDb,
  input: {
    userId: string;
    idempotencyKey: string;
    payload: JsonObject;
    requestContext: {
      clientName: string;
      requestId: string;
      receivedAt: string;
      idempotencyKeys: string[];
    };
  },
): Promise<PurchaseIngestReceipt> {
  if (!UUID.test(input.userId) || !validKey(input.idempotencyKey)) {
    throw new Error("purchase_ingest_invalid_identity");
  }
  const context = input.requestContext;
  if (!context.clientName.trim() || /[\r\n]/.test(context.requestId) ||
    !Number.isFinite(Date.parse(context.receivedAt)) ||
    !Array.isArray(context.idempotencyKeys) || context.idempotencyKeys.length > 32 ||
    !context.idempotencyKeys.every(validKey)) {
    throw new Error("purchase_ingest_invalid_context");
  }
  // Do not copy request headers, credentials or client-controlled control fields
  // into the trusted context. The full payload itself remains immutable.
  const requestContext = {
    client_name: context.clientName,
    request_id: context.requestId,
    received_at: context.receivedAt,
    idempotency_keys: [...new Set(context.idempotencyKeys)],
  };
  checkedJson(input.payload, MAX_PAYLOAD_BYTES);
  checkedJson(requestContext, MAX_CONTEXT_BYTES);
  const { data, error } = await db.rpc("enqueue_purchase_ingest_job", {
    p_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_payload: input.payload,
    p_request_context: requestContext,
  });
  if (error) throw new Error("purchase_ingest_enqueue_failed");
  const row = Array.isArray(data) ? data[0] : data;
  if (!isObject(row) || typeof row.id !== "string" || !UUID.test(row.id) ||
    !JOB_STATUSES.has(row.status as JobStatus) || typeof row.inserted !== "boolean") {
    throw new Error("purchase_ingest_receipt_missing");
  }
  return { id: row.id, status: row.status as JobStatus, inserted: row.inserted };
}

/** A query failure must block direct CAPI retry, never assume no active worker. */
export async function hasActivePurchaseIngestEvent(
  db: IngestDb,
  userId: string,
  eventId: string,
): Promise<boolean> {
  if (!eventId.trim()) return false; // Legacy rows without a claimed event ID.
  const { data, error } = await db.rpc("purchase_ingest_event_pending", {
    p_user_id: userId,
    p_event_id: eventId,
  });
  if (error || typeof data !== "boolean") {
    throw new Error("purchase_ingest_pending_check_failed");
  }
  return data;
}

function requestForJob(job: JsonObject): {
  req: Request;
  context: PurchaseIngestContext;
} {
  const requestContext = job.request_context;
  if (typeof job.id !== "string" || !UUID.test(job.id) ||
    typeof job.user_id !== "string" || !UUID.test(job.user_id) ||
    typeof job.lease_token !== "string" || !UUID.test(job.lease_token) ||
    !validKey(job.idempotency_key) || job.status !== "processing" ||
    !isObject(requestContext) || typeof requestContext.client_name !== "string" ||
    !requestContext.client_name.trim() || typeof requestContext.request_id !== "string" ||
    /[\r\n]/.test(requestContext.request_id) ||
    typeof requestContext.received_at !== "string" ||
    !Number.isFinite(Date.parse(requestContext.received_at))) {
    throw new Error("purchase_ingest_invalid_job");
  }
  const url = new URL("https://purchase-ingest.internal/functions/v1/conversions");
  url.searchParams.set("name", requestContext.client_name);
  const req = new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestContext.request_id,
    },
    body: checkedJson(job.payload, MAX_PAYLOAD_BYTES),
  });
  return {
    req,
    context: {
      jobId: job.id,
      userId: job.user_id,
      idempotencyKey: job.idempotency_key,
      leaseToken: job.lease_token,
    },
  };
}

/** Claims are leased in SQL; every completion is fenced by its exact token. */
export async function processPurchaseIngestJobs(
  db: IngestDb,
  processor: PurchaseIngestProcessor,
  options: { jobId?: string; limit?: number } = {},
): Promise<PurchaseIngestStats> {
  const limit = options.limit ?? 4;
  if (!Number.isInteger(limit) || limit < 1 || limit > 4 ||
    (options.jobId !== undefined && !UUID.test(options.jobId))) {
    throw new Error("purchase_ingest_invalid_claim");
  }
  const { data, error } = await db.rpc("claim_purchase_ingest_jobs", {
    p_limit: limit,
    p_job_id: options.jobId ?? null,
  });
  if (error || !Array.isArray(data)) throw new Error("purchase_ingest_claim_failed");
  const stats: PurchaseIngestStats = {
    claimed: data.length, completed: 0, retried: 0, failed: 0, fenced: 0,
  };
  // Bounded parallel processing keeps four independent requests within the Edge
  // worker lifetime. No timeout races abandon a still-running processor locally.
  const results = await Promise.allSettled(data.map(async (job: JsonObject) => {
    let status = 422;
    let responseBody = "purchase_ingest_invalid_job";
    let retryable = false;
    let prepared: ReturnType<typeof requestForJob> | null = null;
    try {
      prepared = requestForJob(job);
    } catch {
      // Invalid persisted work is terminal and never reaches the business handler.
    }
    if (prepared) {
      try {
        const response = await processor(prepared.req, prepared.context);
        status = response.status;
        responseBody = (await response.text()).slice(0, 1000);
        retryable = status === 408 || status === 429 || status >= 500;
      } catch {
        status = 503;
        responseBody = "purchase_ingest_processing_error";
        retryable = true;
      }
    }
    const { data: finished, error: finishError } = await db.rpc("finish_purchase_ingest_job", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_http_status: status,
      p_response_body: responseBody,
      p_retryable: retryable,
    });
    if (finishError || typeof finished !== "boolean") {
      // Leave the lease in place; the SQL reclaimer recovers a crash/failed finish.
      throw new Error("purchase_ingest_finish_failed");
    }
    if (!finished) stats.fenced++;
    else if (retryable && Number(job.attempts) < MAX_ATTEMPTS) stats.retried++;
    else if (!retryable && status >= 200 && status < 300) stats.completed++;
    else stats.failed++;
  }));
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("purchase_ingest_batch_incomplete");
  }
  return stats;
}

function jsonResponse(body: JsonObject, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function matchesSecret(actual: string, expected: unknown): boolean {
  if (typeof expected !== "string" || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

/** Private scheduler entry. Authentication happens before any queue claim. */
export async function handlePurchaseIngestWorker(
  req: Request,
  options: { db: IngestDb; processor: PurchaseIngestProcessor; cronSecret?: string },
): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!bearer) return jsonResponse({ error: "unauthorized" }, 401);
  if (!matchesSecret(bearer, options.cronSecret ?? Deno.env.get("CRON_SECRET"))) {
    try {
      const { data, error } = await options.db.from("cron_config")
        .select("value").eq("key", "sync_phones_cron_secret").maybeSingle();
      if (error) return jsonResponse({ error: "worker_auth_unavailable" }, 503);
      if (!matchesSecret(bearer, data?.value)) return jsonResponse({ error: "unauthorized" }, 401);
    } catch {
      return jsonResponse({ error: "worker_auth_unavailable" }, 503);
    }
  }
  try {
    const stats = await processPurchaseIngestJobs(options.db, options.processor);
    return jsonResponse({ ok: true, ...stats }, 200);
  } catch {
    return jsonResponse({ error: "purchase_ingest_worker_unavailable" }, 503);
  }
}
