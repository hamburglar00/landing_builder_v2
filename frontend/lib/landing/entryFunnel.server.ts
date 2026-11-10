import { createClient } from "@supabase/supabase-js";
import { validateEntryFunnelBatch, type EntryFunnelBatch } from "./entryFunnel";

export type EntryFunnelBackend = { write(batch: EntryFunnelBatch): Promise<boolean> };
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
/** No CORS, cookies, client-selected tenant or authentication identity. Service RPC derives ownership. */
export async function handleEntryFunnel(request: Request, backend: EntryFunnelBackend): Promise<Response> {
  const reply = (status: number) => {
    const reason = status === 422 ? "collector_rejected" : status === 429 ? "rate_limited" : status === 503 ? "delivery_failed" : "invalid_batch";
    console.info(JSON.stringify({ source: "entry_funnel.collector", result: "rejected", reason, status }));
    return Response.json({ accepted: false, reason }, { status, headers });
  };
  if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin ||
    !["application/json", "text/plain"].includes(request.headers.get("content-type")?.split(";")[0].trim() || "")) return reply(400);
  if (Number(request.headers.get("content-length") || 0) > 16_384) return reply(413);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    reader = request.body?.getReader();
    if (!reader) return reply(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16_384) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply(400); }
    const batch = validateEntryFunnelBatch(payload);
    if (!batch) return reply(400);
    return await backend.write(batch) ? Response.json({ accepted: true, event_ids: [...new Set(batch.events.map(event => event.id))] }, { status: 200, headers }) : reply(422);
  } catch { return reply(503); }
  finally { reader?.releaseLock(); }
}

export function productionEntryFunnelBackend(): EntryFunnelBackend {
  return { async write(batch) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("entry_funnel_unavailable");
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) }),
    } });
    const { data, error } = await db.rpc("record_entry_funnel_events", {
      p_landing_id: batch.landing_id, p_flow_id: batch.flow_id, p_template: batch.template, p_events: batch.events,
    });
    if (error) throw new Error("entry_funnel_unavailable");
    return data === true;
  } };
}

/** Closed diagnostic trace; no client value changes authorization or business identity. */
export function entryRequestTrace(request: Request, context?: { flow_id?: string; attempt_id?: string } | null) {
  const trace: Record<string, string> = {};
  for (const field of ["flow", "attempt", "navigation", "request"]) {
    const value = request.headers.get("x-entry-" + field + "-id");
    if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) trace[field + "_id"] = value;
  }
  if (context?.flow_id) trace.flow_id = context.flow_id;
  if (context?.attempt_id) trace.attempt_id = context.attempt_id;
  const release = process.env.VERCEL_GIT_COMMIT_SHA || process.env.ENTRY_FUNNEL_RELEASE;
  return { ...trace, component: "landing", ...(release && /^[0-9a-f]{7,40}$/.test(release) ? { component_release: release } : {}) };
}
export function entryLogTrace(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, unknown>, out: Record<string, string> = {};
  for (const field of ["flow_id", "attempt_id", "navigation_id", "request_id"]) {
    if (typeof value[field] === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value[field] as string)) out[field] = value[field] as string;
  }
  if (value.component === "landing") out.component = "landing";
  if (typeof value.component_release === "string" && /^[0-9a-f]{7,40}$/.test(value.component_release)) out.component_release = value.component_release;
  return out;
}
