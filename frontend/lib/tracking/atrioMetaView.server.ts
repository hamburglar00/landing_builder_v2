import { after, NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { reserveAtrioMetaJourney } from "@/lib/tracking/atrioMetaJourney.server";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function captureAtrioMetaView(request: NextRequest, input: Record<string, unknown>) {
  const reply = (eventId?: string, status = 200, pixel?: string) =>
    NextResponse.json({ eventId, pixel }, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      Number(request.headers.get("content-length") || 0) > 4096) return reply(undefined, 400);
  try {
    if (typeof input.landing_id !== "string" || !uuid.test(input.landing_id) ||
        typeof input.sessionId !== "string" || !uuid.test(input.sessionId) ||
        !input.provenance || typeof input.provenance !== "object") {
      return reply(undefined, 400);
    }
    const scope = input.provenance as { pixel_id?: string; workspace_currency?: string };
    if (typeof scope.pixel_id !== "string" || typeof scope.workspace_currency !== "string") return reply(undefined, 400);
    const db = getSupabaseServerClient();
    const { data: landing, error } = await db.from("landings")
      .select("id,name,user_id,workspace_currency,pixel_id,config,landing_config").eq("id", input.landing_id).maybeSingle();
    if (error) throw error;
    if (!landing) return reply();
    const event = await reserveAtrioMetaJourney({
      request, landing, name: "ViewContent", key: input.sessionId,
      fbc: input.fbc, fbp: input.fbp, provenance: input.provenance,
    });
    if (!event) return reply();
    after(async () => { try { await event.deliver(); } catch { /* Independent from the landing. */ } });
    return reply(event.eventId, 200, event.pixel);
  } catch {
    return reply(undefined, 503);
  }
}
