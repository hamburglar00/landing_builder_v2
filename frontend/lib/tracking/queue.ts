import { getSupabaseServerClient } from "@/lib/supabase/server";

export type TrackQueueItem = {
  id: string;
  post_url: string;
  payload: Record<string, unknown>;
  event_id: string | null;
  attempt_count: number;
  lease_token: string;
  lease_expires_at: string;
};

export type PersistedTrackEvent = {
  ok: boolean;
  id: string | null;
  status: string | null;
  isNew: boolean;
  alreadyDelivered: boolean;
};

function isQueueEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function getEventId(payload: Record<string, unknown>) {
  const raw = payload.event_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function buildQueueRow(input: {
  postUrl: string;
  payload: Record<string, unknown>;
  eventId: string | null;
  reason?: string;
  upstreamStatus?: number | null;
}) {
  return {
    post_url: input.postUrl,
    payload: input.payload,
    event_id: input.eventId,
    status: "pending",
    attempt_count: 0,
    next_attempt_at: new Date().toISOString(),
    last_error: input.reason || null,
    last_status: input.upstreamStatus ?? null,
  };
}

async function findTrackEventByEventId(eventId: string) {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("tracking_queue")
    .select("id,status")
    .eq("event_id", eventId)
    .maybeSingle();

  return data;
}

export async function persistTrackEvent(input: {
  postUrl: string;
  payload: Record<string, unknown>;
}): Promise<PersistedTrackEvent> {
  if (!isQueueEnabled()) {
    return { ok: false, id: null, status: null, isNew: false, alreadyDelivered: false };
  }

  const supabase = getSupabaseServerClient();
  const eventId = getEventId(input.payload);

  if (eventId) {
    const existing = await findTrackEventByEventId(eventId);
    if (existing) {
      const status = typeof existing.status === "string" ? existing.status : null;
      return {
        ok: true,
        id: typeof existing.id === "string" ? existing.id : null,
        status,
        isNew: false,
        alreadyDelivered: status === "sent",
      };
    }
  }

  const { data, error } = await supabase
    .from("tracking_queue")
    .insert(buildQueueRow({ postUrl: input.postUrl, payload: input.payload, eventId }))
    .select("id,status")
    .maybeSingle();

  if (!error) {
    return {
      ok: true,
      id: typeof data?.id === "string" ? data.id : null,
      status: typeof data?.status === "string" ? data.status : "pending",
      isNew: true,
      alreadyDelivered: false,
    };
  }

  if (eventId && error.code === "23505") {
    const existing = await findTrackEventByEventId(eventId);
    const status = typeof existing?.status === "string" ? existing.status : null;
    return {
      ok: Boolean(existing),
      id: typeof existing?.id === "string" ? existing.id : null,
      status,
      isNew: false,
      alreadyDelivered: status === "sent",
    };
  }

  return { ok: false, id: null, status: null, isNew: false, alreadyDelivered: false };
}

export async function enqueueTrackEvent(input: {
  postUrl: string;
  payload: Record<string, unknown>;
  reason: string;
  upstreamStatus: number | null;
}) {
  if (!isQueueEnabled()) return false;

  const supabase = getSupabaseServerClient();
  const eventId = getEventId(input.payload);

  if (eventId) {
    const existing = await findTrackEventByEventId(eventId);
    // A duplicate cannot revoke a worker's lease or revive a terminal job.
    if (existing?.status === "sent" || existing?.status === "processing" || existing?.status === "review_required") return true;

    if (existing?.id) {
      const { error } = await supabase
        .from("tracking_queue")
        .update({
          status: "retry",
          next_attempt_at: new Date().toISOString(),
          last_error: input.reason || null,
          last_status: input.upstreamStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .in("status", ["pending", "retry"]);

      return !error;
    }
  }

  const { error } = await supabase.from("tracking_queue").insert(
    buildQueueRow({
      postUrl: input.postUrl,
      payload: input.payload,
      eventId,
      reason: input.reason,
      upstreamStatus: input.upstreamStatus,
    }),
  );

  return !error;
}

export async function claimPendingTrackEvents(limit = 50): Promise<TrackQueueItem[]> {
  if (!isQueueEnabled()) return [];
  const { data, error } = await getSupabaseServerClient().rpc("claim_tracking_queue", {
    p_limit: Math.max(1, Math.min(Math.floor(limit), 10)),
  });
  if (error) throw new Error("tracking_queue_claim_unavailable");
  return (data ?? []) as TrackQueueItem[];
}

export async function claimTrackEvent(id: string): Promise<TrackQueueItem | null> {
  if (!isQueueEnabled()) return null;
  const { data, error } = await getSupabaseServerClient().rpc("claim_tracking_queue", { p_limit: 1, p_id: id });
  if (error) throw new Error("tracking_queue_claim_unavailable");
  return (data?.[0] ?? null) as TrackQueueItem | null;
}

export async function markTrackEventDelivered(id: string, leaseToken: string) {
  if (!isQueueEnabled()) return false;
  const { data, error } = await getSupabaseServerClient().rpc("finish_tracking_queue", {
    p_id: id, p_lease_token: leaseToken, p_delivered: true,
  });
  if (error) throw new Error("tracking_queue_finish_unavailable");
  return data === true;
}

export async function scheduleTrackEventRetry(input: {
  id: string;
  leaseToken: string;
  reason: string;
  upstreamStatus: number | null;
}) {
  if (!isQueueEnabled()) return false;
  const { data, error } = await getSupabaseServerClient().rpc("finish_tracking_queue", {
    p_id: input.id, p_lease_token: input.leaseToken, p_delivered: false,
    p_reason: input.reason || null, p_upstream_status: input.upstreamStatus,
  });
  if (error) throw new Error("tracking_queue_finish_unavailable");
  return data === true;
}

/** A lost HTTP response is not a reason to send an already accepted capture again. */
export async function hasTrackingIngestReceipt(item: TrackQueueItem): Promise<boolean | null> {
  // Legacy processing rows did not increment attempts when claimed. Their first
  // recovered claim can still have attempt_count=1 and needs the receipt check.
  if (!item.event_id) return false;
  let receiverName = "";
  try {
    const destination = new URL(item.post_url);
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (destination.origin !== project.origin || destination.pathname !== "/functions/v1/conversions") return false;
    receiverName = destination.searchParams.get("name")?.trim() || "";
    if (!receiverName) return false;
  } catch { return false; }
  const rawAction = String(item.payload.action || item.payload.event_name || "CONTACT").toUpperCase().replace(/[^A-Z]/g, "");
  if (!["CONTACT", "LEAD", "COMPLETEREGISTRATION", "PURCHASE"].includes(rawAction)) return false;
  const actionEventId = String(item.payload.action_event_id || item.payload.contact_event_id || item.payload.event_id || "").trim();
  if (!actionEventId) return false;
  const supabase = getSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("nombre", receiverName).maybeSingle();
  if (profileError) return null;
  if (!profile) return false;
  const { data, error } = await supabase.from("conversion_inbox")
    .select("id").eq("user_id", profile.id).eq("action", rawAction)
    .eq("action_event_id", actionEventId).in("status", ["processed", "deduplicated"])
    .gte("http_status", 200).lt("http_status", 300).limit(1);
  return error ? null : Boolean(data?.length);
}
