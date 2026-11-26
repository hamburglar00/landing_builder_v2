import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const MKT_WHATSAPP_USERNAME_ACTION = "MKT_WHATSAPP_USERNAME";
export const PLAYER_USERNAME_ACTION = "PLAYER_USERNAME";

type Payload = Record<string, unknown>;
type Lead = {
  id: string;
  status: string;
  conversion_id: string | null;
  payload_raw: string;
};

export type MktUsernameDelivery = {
  leadId: string;
  userId: string;
  conversionId: string;
  phone: string;
  promo: string;
  occurredAt: number;
  milestone?: "first_message" | "requested" | "sent";
};

const text = (value: unknown) => String(value ?? "").trim();
const id = /^[1-9]\d{0,17}$/;
const promoCode = /^[a-z][a-z0-9]*-[a-z0-9]+$/i;
const hexSignature = /^[0-9a-f]{64}$/;
const reply = (status: number, body: string) => new Response(body, { status });

function sameLead(
  row: Lead,
  expected: { promo: string; managerId: string; agencyId: string },
) {
  try {
    const original = JSON.parse(row.payload_raw) as Payload;
    return text(original.promo_code) === expected.promo &&
      text(original.manager_id) === expected.managerId &&
      text(original.agency_id) === expected.agencyId;
  } catch {
    return false;
  }
}

export async function recordMktWhatsAppUsername(
  db: SupabaseClient,
  name: string,
  payload: Payload,
  secret: string | undefined,
  sendMeta?: (lead: MktUsernameDelivery) => Promise<void>,
): Promise<Response> {
  if (!secret || secret.length < 32) {
    return reply(503, "Observación no disponible");
  }
  const action = text(payload.action) || MKT_WHATSAPP_USERNAME_ACTION;
  if (action !== MKT_WHATSAPP_USERNAME_ACTION && action !== PLAYER_USERNAME_ACTION) {
    return reply(422, "Observación inválida");
  }
  const leadId = text(action === PLAYER_USERNAME_ACTION
    ? payload.first_customer_message_action_event_id
    : payload.lead_action_event_id);
  const managerId = text(payload.manager_id);
  const agencyId = text(payload.agency_id);
  const phone = text(payload.phone);
  const promo = text(payload.promo_code);
  const kind = payload.milestone;
  const occurredAt = payload.occurred_at;
  const proof = text(payload.observation_proof);
  if (
    !id.test(leadId) || !id.test(managerId) ||
    (agencyId !== "" && !id.test(agencyId)) ||
    !/^\d{7,15}$/.test(phone) || promo.length > 100 || !promoCode.test(promo) ||
    (kind !== "requested" && kind !== "sent") || !hexSignature.test(proof) ||
    typeof occurredAt !== "number" || !Number.isSafeInteger(occurredAt) ||
    occurredAt <= 0 ||
    occurredAt > Math.floor(Date.now() / 1000) + 300
  ) return reply(422, "Observación inválida");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );
  const signature = Uint8Array.from(
    proof.match(/../g)!,
    (byte) => Number.parseInt(byte, 16),
  );
  const signedFields = JSON.stringify([
    action,
    name,
    leadId,
    managerId,
    agencyId,
    phone,
    promo,
    kind,
    occurredAt,
  ]);
  if (
    !await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(signedFields),
    )
  ) {
    return reply(401, "Observación no autorizada");
  }

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("id")
    .eq("nombre", name).maybeSingle();
  if (profileError || !profile) {
    return reply(503, "Cliente receptor no disponible");
  }

  // The existing inbox keeps the identity of each LEAD even if several
  // events eventually resolve to the same conversion row.
  const { data, error } = await db.from("conversion_inbox")
    .select("id,status,conversion_id,payload_raw")
    .eq("user_id", profile.id).eq("action", "LEAD").eq(
      "action_event_id",
      leadId,
    ).eq("phone", phone);
  if (error) return reply(503, "No se pudo consultar el lead");
  const matches = (data as Lead[] | null ?? []).filter((lead) =>
    sameLead(lead, { promo, managerId, agencyId })
  );
  if (
    matches.length !== 1 || matches[0].status !== "processed" ||
    !matches[0].conversion_id
  ) {
    return reply(503, "Lead con código pendiente de confirmar");
  }

  const field = kind === "requested"
    ? "mkt_username_requested_at"
    : "mkt_username_sent_at";
  const { error: updateError } = await db.from("conversion_inbox")
    .update({ [field]: new Date(occurredAt * 1000).toISOString() })
    .eq("id", matches[0].id).eq("user_id", profile.id).eq("status", "processed")
    .is(field, null);
  if (updateError) return reply(503, "No se pudo guardar la observación");
  if (sendMeta && (kind === "sent" || action === PLAYER_USERNAME_ACTION)) {
    try {
      await sendMeta({
        leadId: matches[0].id,
        userId: profile.id,
        conversionId: matches[0].conversion_id,
        phone,
        promo,
        occurredAt,
        milestone: kind,
      });
    } catch {
      return reply(503, "No se pudo registrar el envío a Meta");
    }
  }
  return reply(200, "Observación registrada");
}
