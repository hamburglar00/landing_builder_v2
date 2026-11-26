import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHmac } from "node:crypto";
import { recordMktWhatsAppUsername } from "./mkt_whatsapp_username.ts";

const secret = "fixture-username-milestone-secret";
const name = "fixture";
const action = "MKT_WHATSAPP_USERNAME";
const time = Math.floor(Date.now() / 1000);

function signed(kind: "requested" | "sent", occurredAt = time) {
  const fields = [
    action,
    name,
    "381",
    "24",
    "71",
    "5491100000000",
    "FX-4abc",
    kind,
    occurredAt,
  ];
  return {
    lead_action_event_id: fields[2],
    manager_id: fields[3],
    agency_id: fields[4],
    phone: fields[5],
    promo_code: fields[6],
    milestone: kind,
    occurred_at: occurredAt,
    observation_proof: createHmac("sha256", secret).update(
      JSON.stringify(fields),
    ).digest("hex"),
  };
}

function fixture() {
  const profile = { id: "owner", nombre: name };
  const lead = {
    id: "original",
    action: "LEAD",
    action_event_id: "381",
    user_id: profile.id,
    phone: "5491100000000",
    status: "processed",
    conversion_id: "conversion",
    payload_raw: JSON.stringify({
      manager_id: 24,
      agency_id: 71,
      promo_code: "FX-4abc",
    }),
    mkt_username_requested_at: null,
    mkt_username_sent_at: null,
  };
  const other = { ...lead, id: "other", user_id: "other-owner" };
  const rows: Record<string, unknown>[] = [lead, other];
  const interfaceFor = (table: string) => {
    let selected = table === "profiles"
      ? [profile] as Record<string, unknown>[]
      : rows;
    let patch: Record<string, unknown> | null = null;
    const query = {
      select: () => query,
      update: (value: Record<string, unknown>) => {
        patch = value;
        return query;
      },
      eq: (field: string, value: unknown) => {
        selected = selected.filter((row) => row[field] === value);
        return query;
      },
      is: (field: string, value: unknown) => query.eq(field, value),
      maybeSingle: () =>
        Promise.resolve({ data: selected[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => void) => {
        if (patch) selected.forEach((row) => Object.assign(row, patch));
        resolve({ data: selected, error: null });
      },
    };
    return query;
  };
  const db = { from: interfaceFor } as unknown as Parameters<
    typeof recordMktWhatsAppUsername
  >[0];
  return { db, lead, other };
}

Deno.test("records independent milestones once on the exact existing lead", async () => {
  const { db, lead, other } = fixture();
  assertEquals(
    (await recordMktWhatsAppUsername(db, name, signed("requested"), secret))
      .status,
    200,
  );
  assertEquals(
    (await recordMktWhatsAppUsername(
      db,
      name,
      signed("sent", time + 1),
      secret,
    )).status,
    200,
  );
  assertEquals(
    (await recordMktWhatsAppUsername(
      db,
      name,
      signed("sent", time + 10),
      secret,
    )).status,
    200,
  );
  assertEquals(
    lead.mkt_username_requested_at,
    new Date(time * 1000).toISOString(),
  );
  assertEquals(
    lead.mkt_username_sent_at,
    new Date((time + 1) * 1000).toISOString(),
  );
  assertEquals(other.mkt_username_sent_at, null);
});

Deno.test("rejects modified signed data and waits for the exact processed promo lead", async () => {
  const { db, lead } = fixture();
  assertEquals(
    (await recordMktWhatsAppUsername(db, name, {
      ...signed("sent"),
      manager_id: "25",
    }, secret)).status,
    401,
  );
  lead.status = "received";
  assertEquals(
    (await recordMktWhatsAppUsername(db, name, signed("sent"), secret)).status,
    503,
  );
  lead.status = "processed";
  lead.payload_raw = JSON.stringify({
    manager_id: 24,
    agency_id: 71,
    promo_code: "OTHER-code",
  });
  assertEquals(
    (await recordMktWhatsAppUsername(db, name, signed("sent"), secret)).status,
    503,
  );
  assertEquals(lead.mkt_username_sent_at, null);
});

Deno.test("queues the external event only for credential delivery", async () => {
  const { db } = fixture();
  const delivered: string[] = [];
  const send = async (lead: { leadId: string; promo: string }) => {
    delivered.push(lead.leadId + ":" + lead.promo);
  };
  await recordMktWhatsAppUsername(db, name, signed("requested"), secret, send);
  assertEquals(delivered, []);
  await recordMktWhatsAppUsername(db, name, signed("sent"), secret, send);
  assertEquals(delivered, ["original:FX-4abc"]);
});
