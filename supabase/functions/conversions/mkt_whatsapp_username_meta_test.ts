import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sendMktWhatsAppUsernameMeta } from "./mkt_whatsapp_username_meta.ts";

Deno.test("WhatsApp delivery respects the pixel and workspace and reserves the event once", async () => {
  const lead = {
    leadId: "inbox-row", userId: "owner", conversionId: "conversion",
    phone: "5491100000000", promo: "FX-4abc", occurredAt: Math.floor(Date.now() / 1000),
  };
  const tables: Record<string, Record<string, unknown>[]> = {
    conversions: [{
      id: lead.conversionId, user_id: lead.userId, landing_id: "landing", promo_code: lead.promo,
      pixel_id: "123456789", from_meta_ads: false, workspace_currency: "ARS",
    }],
    conversions_pixel_configs: [{
      user_id: lead.userId, pixel_id: "123456789", meta_access_token: "fixture",
      meta_ads_only_capi: true, whatsapp_username_meta_event: "off",
    }],
    conversions_config: [{ user_id: lead.userId, capi_workspace_settings: { ARS: false } }],
    atrio_meta_journey_events: [],
  };
  const db = {
    from(table: string) {
      let rows = tables[table];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        upsert: (row: Record<string, unknown>) => {
          if (rows.some((current) => current.event_id === row.event_id)) rows = [];
          else { rows.push(row); rows = [row]; }
          return query;
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (key: string, value: unknown) => {
            for (const row of rows.filter((record) => record[key] === value)) Object.assign(row, patch);
            return { error: null };
          },
        }),
      };
      return query;
    },
  } as unknown as Parameters<typeof sendMktWhatsAppUsernameMeta>[0];

  const sent: { url: string; body: Record<string, any> }[] = [];
  const send: typeof fetch = async (url, options) => {
    sent.push({ url: String(url), body: JSON.parse(String((options as { body?: string } | undefined)?.body)) });
    return Response.json({ events_received: 1 });
  };

  await sendMktWhatsAppUsernameMeta(db, lead, send);
  tables.conversions_pixel_configs[0].whatsapp_username_meta_event = "InitiateCheckout";
  await sendMktWhatsAppUsernameMeta(db, lead, send);
  tables.conversions_config[0].capi_workspace_settings = { ARS: true };
  await sendMktWhatsAppUsernameMeta(db, lead, send);
  assertEquals(sent.length, 0);

  tables.conversions[0].from_meta_ads = true;
  await Promise.all([sendMktWhatsAppUsernameMeta(db, lead, send), sendMktWhatsAppUsernameMeta(db, lead, send)]);
  tables.conversions_pixel_configs[0].whatsapp_username_meta_event = "CompleteRegistration";
  await sendMktWhatsAppUsernameMeta(db, lead, send);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].url, "https://graph.facebook.com/v25.0/123456789/events");
  const [event] = sent[0].body.data;
  assertEquals(event.event_name, "InitiateCheckout");
  assertEquals(event.event_id, tables.atrio_meta_journey_events[0].event_id);
  assertMatch(event.user_data.ph[0], /^[a-f0-9]{64}$/);
  assertEquals(tables.atrio_meta_journey_events[0].delivery_status, "sent");

  await sendMktWhatsAppUsernameMeta(db, { ...lead, leadId: "second-inbox-row" }, send);
  assertEquals(sent[1].body.data[0].event_name, "CompleteRegistration");
});
