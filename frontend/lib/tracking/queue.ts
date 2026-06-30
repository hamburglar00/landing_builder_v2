import { getSupabaseServerClient } from "@/lib/supabase/server";

const RETRY_BASE_DELAY_SECONDS = 30;
const RETRY_MAX_DELAY_SECONDS = 30 * 60;

export type TrackQueueItem = {
  id: string;
  post_url: string;
  payload: Record<string, unknown>;
  event_id: string | null;
  attempt_count: number;
};

export type PersistedTrackEvent = {
  ok: boolean;
  id: string | null;
  status: string | null;
  isNew: boolean;
  alreadyDelivered: boolean;
};

function getBackoffSeconds(attemptCount: number) {
  const exponent = Math.max(0, attemptCount);
  const value = RETRY_BASE_DELAY_SECONDS * 2 ** exponent;
  return Math.min(value, RETRY_MAX_DELAY_SECONDS);
}

function computeNextAttemptIso(attemptCount: number) {
  const delaySec = getBackoffSeconds(attemptCount);
  return new Date(Date.now() + delaySec * 1000).toISOString();
}

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
    if (existing?.status === "sent") return true;

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
        .eq("id", existing.id);

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

  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("tracking_queue")
    .select("id,post_url,payload,event_id,attempt_count")
    .in("status", ["pending", "retry"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (error || !data?.length) return [];

  const claimed: TrackQueueItem[] = [];
  for (const row of data) {
    const { data: updated } = await supabase
      .from("tracking_queue")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .in("status", ["pending", "retry"])
      .select("id,post_url,payload,event_id,attempt_count")
      .maybeSingle();

    if (updated) {
      claimed.push(updated as TrackQueueItem);
    }
  }

  return claimed;
}

export async function markTrackEventDelivered(id: string) {
  if (!isQueueEnabled()) return;

  const supabase = getSupabaseServerClient();
  await supabase
    .from("tracking_queue")
    .update({
      status: "sent",
      last_error: null,
      next_attempt_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function scheduleTrackEventRetry(input: {
  id: string;
  attemptCount: number;
  reason: string;
  upstreamStatus: number | null;
}) {
  if (!isQueueEnabled()) return;

  const supabase = getSupabaseServerClient();
  const nextAttemptAt = computeNextAttemptIso(input.attemptCount + 1);
  await supabase
    .from("tracking_queue")
    .update({
      status: "retry",
      attempt_count: input.attemptCount + 1,
      next_attempt_at: nextAttemptAt,
      last_error: input.reason || null,
      last_status: input.upstreamStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
}
