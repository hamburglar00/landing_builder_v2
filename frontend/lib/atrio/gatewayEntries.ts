import type { ConversionRow } from "../conversionsDb";
import { supabase } from "../supabaseClient";
import { isAtrioGatewayCta } from "./gatewayCta";

type Evidence = { measured: string[]; entries: { conversion_id: string; message_id: string; event_time: number }[] };
type ReadBatch = (ids: string[]) => Promise<Evidence>;

export async function attachGatewayEntries(rows: ConversionRow[], read: ReadBatch, signal?: AbortSignal): Promise<ConversionRow[]> {
  const ids = [...new Set(rows.filter(isAtrioGatewayCta).map(r => r.id))];
  if (!ids.length) return rows;
  const measured = new Set<string>();
  const entries = new Map<string, Evidence["entries"][number]>();
  // Limit concurrent reads even when exporting a large period in the admin panel.
  for (let offset = 0; offset < ids.length; offset += 300) {
    if (signal?.aborted) return rows;
    const batches: Promise<Evidence>[] = [];
    for (let start = offset; start < Math.min(offset + 300, ids.length); start += 100)
      batches.push(read(ids.slice(start, start + 100)));
    const results = await Promise.allSettled(batches);
    if (signal?.aborted) return rows;
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const id of result.value.measured) measured.add(id);
      for (const entry of result.value.entries) entries.set(entry.conversion_id, entry);
    }
    if (results.every(r => r.status === "rejected")) break;
  }
  return rows.map(row => {
    if (!measured.has(row.id)) return row;
    const evidence = entries.get(row.id);
    return { ...row, gateway_entry_measured: true,
      gateway_entry_event_id: evidence?.message_id ?? null, gateway_entry_event_time: evidence?.event_time ?? null };
  });
}

export async function fetchGatewayEntryBatch(ids: string[], viewerId: string, signal: AbortSignal): Promise<Evidence> {
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== viewerId || signal.aborted) throw new Error("inactive_view");
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch("/api/atrio/gateway-entries", {
    method: "POST", cache: "no-store", signal: typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(ids),
  });
  if (!response.ok) throw new Error("gateway_entries_unavailable");
  return response.json();
}
