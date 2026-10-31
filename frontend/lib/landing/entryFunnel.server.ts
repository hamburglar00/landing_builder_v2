import { createClient } from "@supabase/supabase-js";
import { validateEntryFunnelBatch, type EntryFunnelBatch } from "./entryFunnel";

export type EntryFunnelBackend = { write(batch: EntryFunnelBatch): Promise<boolean> };
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
/** No CORS, cookies, client-selected tenant or authentication identity. Service RPC derives ownership. */
export async function handleEntryFunnel(request: Request, backend: EntryFunnelBackend): Promise<Response> {
  const reply = (status: number) => new Response(null, { status, headers });
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
    const batch = validateEntryFunnelBatch(JSON.parse(new TextDecoder().decode(bytes)));
    if (!batch) return reply(400);
    return reply(await backend.write(batch) ? 204 : 429);
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
