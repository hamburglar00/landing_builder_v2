import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Participant = {
  id: string;
  phone: string;
  email: string;
  matched_conversion_ids: string[] | null;
};

type ConversionRow = {
  id: string;
  email: string | null;
};

type MatchResult = {
  participantId: string;
  matchedCount: number;
  updatedCount: number;
};

const DEFAULT_BATCH_SIZE = 1000;
const MAX_BATCH_SIZE = 5000;
const MAX_BACKFILL_ITERATIONS = 200;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().slice(0, 254);
}

function clampBatchSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(parsed)));
}

async function assertCronAccess(db: any, body: Record<string, unknown>): Promise<boolean> {
  const { data: cronSecret } = await db
    .from("cron_config")
    .select("value")
    .eq("key", "sync_phones_cron_secret")
    .maybeSingle();
  const expectedBootstrap = Deno.env.get("BOOTSTRAP_SECRET") || "";
  const cronOk = !!cronSecret?.value && body?.cron_secret === cronSecret.value;
  const bootstrapOk = !!expectedBootstrap && body?.bootstrap_secret === expectedBootstrap;
  return cronOk || bootstrapOk;
}

async function fetchParticipantsToMatch(
  db: any,
  batchSize: number,
  onlyNeverAttempted: boolean,
): Promise<Participant[]> {
  let query = db
    .from("promotion_participants")
    .select("id, phone, email, matched_conversion_ids")
    .eq("matched_conversion_count", 0)
    .neq("phone", "")
    .order("last_match_attempt_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (onlyNeverAttempted) {
    query = query.is("last_match_attempt_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Participant[];
}

async function matchParticipant(db: any, participant: Participant, nowIso: string): Promise<MatchResult> {
  const email = normalizeEmail(participant.email);
  const { data: conversions, error: fetchError } = await db
    .from("conversions")
    .select("id, email")
    .eq("phone", participant.phone);

  if (fetchError) throw fetchError;

  const rows = (conversions ?? []) as ConversionRow[];
  const matchedIds = rows.map((row) => String(row.id)).filter(Boolean);
  const idsToUpdate = email
    ? rows
        .filter((row) => !String(row.email ?? "").trim())
        .map((row) => String(row.id))
        .filter(Boolean)
    : [];

  if (idsToUpdate.length) {
    const { error: updateConversionsError } = await db
      .from("conversions")
      .update({ email })
      .in("id", idsToUpdate);
    if (updateConversionsError) throw updateConversionsError;
  }

  const mergedIds = Array.from(new Set([...(participant.matched_conversion_ids ?? []), ...matchedIds]));
  const participantUpdate =
    mergedIds.length > 0
      ? {
          matched_conversion_count: mergedIds.length,
          matched_conversion_ids: mergedIds,
          last_match_attempt_at: nowIso,
        }
      : {
          last_match_attempt_at: nowIso,
        };

  const { error: updateParticipantError } = await db
    .from("promotion_participants")
    .update(participantUpdate)
    .eq("id", participant.id);
  if (updateParticipantError) throw updateParticipantError;

  return {
    participantId: participant.id,
    matchedCount: mergedIds.length,
    updatedCount: idsToUpdate.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Solo se permite POST." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuracion del servidor incompleta." }, 500);
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!(await assertCronAccess(db, body))) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const mode = String(body.mode ?? "cron");
    const isBackfill = mode === "backfill";
    const batchSize = clampBatchSize(body.batch_size);
    const nowIso = new Date().toISOString();
    const results: MatchResult[] = [];
    let iterations = 0;

    for (;;) {
      iterations += 1;
      const participants = await fetchParticipantsToMatch(db, batchSize, isBackfill);
      if (!participants.length) break;

      for (const participant of participants) {
        results.push(await matchParticipant(db, participant, nowIso));
      }

      if (!isBackfill || participants.length < batchSize || iterations >= MAX_BACKFILL_ITERATIONS) break;
    }

    const matchedParticipants = results.filter((result) => result.matchedCount > 0).length;
    const updatedConversions = results.reduce((sum, result) => sum + result.updatedCount, 0);

    return jsonResponse({
      ok: true,
      mode,
      iterations,
      processed_participants: results.length,
      matched_participants: matchedParticipants,
      updated_conversions: updatedConversions,
    });
  } catch (err) {
    console.error("promotion-match-backfill error:", err);
    return jsonResponse({ error: "Error al matchear participantes de promociones." }, 500);
  }
});
