import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  canUsePromoForJourney,
  evaluatePromoGerenciaCoherence,
} from "./event_attribution.ts";
import { metaOriginPatch } from "./meta_origin.ts";

type Row = Record<string, unknown>;
const text = (v: unknown) => String(v ?? "").trim();
const phone = (v: unknown) => text(v).replace(/\D/g, "");
export const INTERNAL_CONVERSATION_ACTION = "INTERNAL_CONVERSATION_STARTED";
export async function verifyInternalConversationSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  nowSeconds = Date.now() / 1000,
): Promise<boolean> {
  const timestamp = headers.get("x-atrio-internal-timestamp") || "";
  const signature = headers.get("x-atrio-internal-signature") || "";
  if (
    !secret || !/^\d{10}$/.test(timestamp) ||
    Math.abs(nowSeconds - Number(timestamp)) > 300 ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(
    signature.match(/../g)!,
    (pair) => parseInt(pair, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
}

export function internalConversationConflict(
  candidate: Row,
  payload: Row,
  eventGerenciaId?: unknown,
): boolean {
  const coherence = evaluatePromoGerenciaCoherence({
    promoFound: true,
    promoPlayerPhone: candidate.phone,
    eventPlayerPhone: payload.phone,
    promoGerenciaId: candidate.assigned_gerencia_id ||
      candidate.lead_gerencia_id || candidate.registration_gerencia_id ||
      candidate.purchase_gerencia_id,
    eventGerenciaId,
  });
  return !canUsePromoForJourney(coherence) ||
    Boolean(
      text(candidate.atrio_id) &&
        text(candidate.atrio_id) !== text(payload.atrio_id),
    ) ||
    Boolean(
      text(candidate.atrio_players_id) &&
        text(candidate.atrio_players_id) !==
          text(payload.players_id || payload.atrio_players_id),
    );
}

/** Dedicated, signed internal endpoint. It cannot call or enqueue Meta delivery. */
export async function recordInternalConversation(
  db: SupabaseClient,
  userId: string,
  payload: Row,
  eventGerenciaId?: unknown,
): Promise<Response> {
  const eventId = text(payload.action_event_id),
    advisor = text(payload.atrio_id),
    player = text(payload.players_id || payload.atrio_players_id);
  const promo = text(payload.promo_code), time = Number(payload.event_time);
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const json = (body: Row, status = 200) => Response.json(body, { status });
  if (
    payload.internal_event_name !== "conversation_started" ||
    text(payload.source_platform).toLowerCase() !== "atrio" ||
    !uuid.test(advisor) || !uuid.test(player) ||
    !/^atrio-conversation:[0-9a-f-]{36}$/i.test(eventId) ||
    !uuid.test(text(payload.conversation_id)) ||
    !uuid.test(text(payload.message_id)) ||
    !Number.isSafeInteger(time) || time <= 0 ||
    time > Date.now() / 1000 + 300 || promo.length > 128
  ) {
    return json({ ok: false, error: "invalid_internal_conversation" }, 422);
  }
  const acknowledged = (row: Row, duplicate: boolean) =>
    json({
      ok: true,
      internal_event_name: "conversation_started",
      action_event_id: eventId,
      conversion_id: row.id,
      duplicate,
    });
  // A valid Atrio signature alone does not bind the URL's ?name to an owner.
  // Availability (disponible/ausente/null) is informational, not ownership.
  const { data: directory, error: directoryError } = await db.from(
    "atrio_clients",
  ).select("user_id")
    .eq("atrio_id", advisor).maybeSingle();
  if (directoryError || !directory) {
    return json({ ok: false, error: "advisor_directory_unavailable" }, 503);
  }
  if (text(directory.user_id) !== userId) {
    return json({ ok: false, error: "advisor_owner_conflict" }, 422);
  }
  const duplicateReceipt = (row: Row): Response => {
    let snapshot: Row = {};
    try {
      snapshot = JSON.parse(text(row.conversation_started_payload_raw));
    } catch { /* Never acknowledge an unreadable receipt. */ }
    const exactEvent = text(row.conversation_started_event_id) === eventId;
    const sameJourney = text(row.atrio_id) === advisor &&
      text(row.atrio_players_id) === player &&
      text(row.promo_code) === promo &&
      !internalConversationConflict(row, payload, eventGerenciaId) &&
      (Boolean(promo) ||
        text(snapshot.conversation_id) === text(payload.conversation_id));
    const sameReceipt = Number(row.conversation_started_event_time) === time &&
      text(snapshot.message_id) === text(payload.message_id) &&
      text(snapshot.conversation_id) === text(payload.conversation_id) &&
      text(snapshot.player_provider_account_id) ===
        text(payload.player_provider_account_id) &&
      text(snapshot.agency_id) === text(payload.agency_id);
    if (
      !sameJourney || (exactEvent && !sameReceipt) ||
      (text(snapshot.player_provider_account_id) &&
        text(snapshot.player_provider_account_id) !==
          text(payload.player_provider_account_id))
    ) {
      return json(
        { ok: false, error: "internal_event_identity_conflict" },
        422,
      );
    }
    return acknowledged(row, true);
  };
  const { data: existing, error: existingError } = await db.from("conversions")
    .select("*")
    .eq("user_id", userId).eq("conversation_started_event_id", eventId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return duplicateReceipt(existing);
  let target: Row | null = null;
  if (promo) {
    const { data, error } = await db.from("conversions").select("*").eq(
      "user_id",
      userId,
    ).eq("promo_code", promo)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) {
      return json({ ok: false, error: "journey_not_received_yet" }, 503);
    }
    if (internalConversationConflict(data, payload, eventGerenciaId)) {
      return json({ ok: false, error: "journey_identity_conflict" }, 422);
    }
    target = data;
  } else {
    // No promo does not authorize borrowing the latest campaign of this player.
    // Only a prior no-promo internal conversation with this exact stable identity can deduplicate it.
    const { data, error } = await db.from("conversions").select("*").eq(
      "user_id",
      userId,
    ).eq("atrio_id", advisor)
      .eq("atrio_players_id", player).eq("promo_code", "").not(
        "conversation_started_event_id",
        "is",
        null,
      )
      .order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    target = (data || []).find((row: Row) => {
      try {
        return JSON.parse(text(row.conversation_started_payload_raw))
          .conversation_id === payload.conversation_id;
      } catch {
        return false;
      }
    }) || null;
  }
  if (target?.conversation_started_event_id) return duplicateReceipt(target);
  const snapshot = JSON.stringify({
    action: INTERNAL_CONVERSATION_ACTION,
    internal_event_name: "conversation_started",
    action_event_id: eventId,
    source_platform: "atrio",
    promo_code: promo,
    atrio_id: advisor,
    players_id: player,
    conversation_id: payload.conversation_id,
    message_id: payload.message_id,
    event_time: time,
    agency_id: payload.agency_id,
    player_provider_account_id: payload.player_provider_account_id,
    cta_destination: "atrio",
    journey_context_ambiguous: payload.journey_context_ambiguous === true,
    journey_attribution_source: text(payload.journey_attribution_source),
  });
  const patch: Row = {
    internal_events_version: 1,
    conversation_started_event_id: eventId,
    conversation_started_event_time: time,
    conversation_started_payload_raw: snapshot,
    atrio_id: advisor,
    atrio_players_id: player,
  };
  if (target) {
    if (!text(target.phone) && phone(payload.phone)) {
      patch.phone = phone(payload.phone);
    }
    if (!target.assigned_gerencia_id && eventGerenciaId) {
      patch.assigned_gerencia_id = eventGerenciaId;
    }
    let update = db.from("conversions").update(patch).eq("id", target.id).eq(
      "user_id",
      userId,
    )
      .is("conversation_started_event_id", null);
    // A concurrent Purchase/Lead can identify this CTA after our read. Never
    // overwrite that identity, even when its message milestone is still empty.
    for (
      const field of [
        "promo_code",
        "phone",
        "atrio_id",
        "atrio_players_id",
        "assigned_gerencia_id",
        "lead_gerencia_id",
        "registration_gerencia_id",
        "purchase_gerencia_id",
      ]
    ) {
      update = target[field] == null
        ? update.is(field, null)
        : update.eq(field, target[field]);
    }
    const { data, error } = await update.select("id").maybeSingle();
    if (error) throw error;
    if (data) return acknowledged(data, false);
    // A concurrent message may have persisted the first milestone. Never overwrite it.
    const { data: saved, error: savedError } = await db.from("conversions")
      .select("*")
      .eq("id", target.id).eq("user_id", userId).maybeSingle();
    if (savedError) throw savedError;
    if (saved?.conversation_started_event_id) return duplicateReceipt(saved);
    if (
      saved &&
      (text(saved.promo_code) !== promo ||
        internalConversationConflict(saved, payload, eventGerenciaId))
    ) {
      return json({ ok: false, error: "journey_identity_conflict" }, 422);
    }
    return json(
      { ok: false, error: "internal_conversation_not_persisted" },
      503,
    );
  }
  const { data, error } = await db.from("conversions").insert({
    ...patch,
    user_id: userId,
    phone: phone(payload.phone),
    promo_code: "",
    source_platform: "atrio",
    estado: "lead",
    assigned_gerencia_id: eventGerenciaId || null,
    ...metaOriginPatch({ source_platform: "atrio", event_time: time }),
  }).select("id").single();
  if (error) {
    if (error.code === "23505") {
      const { data: duplicate, error: readError } = await db.from("conversions")
        .select("*").eq("user_id", userId).eq(
          "conversation_started_event_id",
          eventId,
        ).maybeSingle();
      if (readError) throw readError;
      if (duplicate) return duplicateReceipt(duplicate);
    }
    throw error;
  }
  return acknowledged(data, false);
}
