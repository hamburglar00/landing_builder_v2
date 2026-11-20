import { createClient } from "@supabase/supabase-js";
import { isSameOriginRequest } from "@/lib/http/sameOrigin";
import { gatewayEntryEvidence } from "@/lib/atrio/gatewayEntries.server";
import { isAtrioGatewayCta } from "@/lib/atrio/gatewayCta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: object, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "invalid_origin" }, 403);
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return json({ error: "unauthorized" }, 401);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json({ error: "invalid_request" }, 415);
  const raw = await request.text();
  if (raw.length > 4096) return json({ error: "invalid_request" }, 400);
  let ids: unknown;
  try { ids = JSON.parse(raw); } catch { return json({ error: "invalid_request" }, 400); }
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== "string" || !uuid.test(id)))
    return json({ error: "invalid_request" }, 400);
  try {
    // RLS on conversions, landings and the directory applies equally to the panel and admin dashboard.
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user || auth.user.is_anonymous) return json({ error: "unauthorized" }, 401);
    const { data: rows, error } = await db.from("conversions")
      .select("id,user_id,landing_id,atrio_id,atrio_players_id,promo_code,contact_event_id,cta_clicked_event_id,contact_event_time,cta_clicked_event_time,contact_payload_raw,source_platform,telefono_asignado")
      .in("id", [...new Set(ids)]);
    if (error) throw error;
    const candidates = (rows ?? []).filter(isAtrioGatewayCta);
    if (!candidates.length) return json({ entries: [], measured: [] });
    const [landings, advisors] = await Promise.all([
      db.from("landings").select("id,user_id").in("id", [...new Set(candidates.map(r => r.landing_id))]),
      db.from("atrio_clients").select("atrio_id,user_id").in("atrio_id", [...new Set(candidates.map(r => r.atrio_id))]),
    ]);
    if (landings.error || advisors.error) throw landings.error || advisors.error;
    const scope = candidates.filter(row =>
      landings.data.some(l => l.id === row.landing_id && l.user_id === row.user_id) &&
      advisors.data.some(a => a.atrio_id === row.atrio_id && a.user_id === row.user_id));
    return json(await gatewayEntryEvidence(scope));
  } catch {
    return json({ error: "gateway_entries_unavailable" }, 503);
  }
}
