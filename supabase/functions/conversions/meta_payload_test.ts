import { buildFakeConversionRow, buildMetaRequest, buildUserData, normalizePublicClientIp, type ConversionsConfig } from "./shared.ts";
import { normalizeMetaFbc, normalizeMetaFbp } from "./meta_cookies.ts";
import { resolveMetaActionSource } from "./meta_action_source.ts";
import { sanitizeMetaEventSourceUrl } from "./meta_source_url.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const now = 1_794_700_000_000;
const captured = now - 3_600_000;
const config: ConversionsConfig = { user_id: "fixture", pixel_id: "1234", meta_access_token: "fixture-only",
  meta_currency: "ARS", meta_api_version: "v25.0", send_contact_capi: true, send_geo_capi: false,
  geo_use_ipapi: false, geo_fill_only_when_missing: true };

Deno.test("cookie delivery preserves first capture, case, subdomain and SDK appendix across retries", () => {
  for (const index of [0, 1, 2, 3]) {
    const fbc = `fb.${index}.${captured}.AbCd_CASE_123.AQYBAQAA`;
    const fbp = `fb.${index}.${captured}.123456789.AQYBAQAA`;
    assert(normalizeMetaFbc(fbc, now) === fbc, "Full fbc must retain its bytes");
    assert(normalizeMetaFbc(fbc, now + 86400_000) === fbc, "Retry cannot renew the click");
    assert(normalizeMetaFbp(fbp, now + 86400_000) === fbp, "Retry cannot renew browser identity");
  }
});

Deno.test("partial cookie identifiers never acquire a fabricated timestamp", () => {
  for (const value of ["123456789", "BareFbclidCase", "fb.1.123.bad", "fb.1.bad.timestamp", "", null, {}, "fb.1.0.foo"]) {
    assert(!normalizeMetaFbc(value, now), "Malformed fbc must be omitted");
    assert(!normalizeMetaFbp(value, now), "Malformed fbp must be omitted");
  }
  assert(!normalizeMetaFbp(`fb.1.${captured}.not-a-random-number`, now), "FBP cannot be a substituted fbclid");
});

Deno.test("legacy complete cookies preserve the same instant, not the retry time", () => {
  const seconds = Math.floor(captured / 1000);
  assert(normalizeMetaFbc(`fb.2.${seconds}.AbCd`, now) === `fb.2.${seconds * 1000}.AbCd`, "Original seconds are converted exactly");
  assert(normalizeMetaFbp(`fb.2.${seconds}.123`, now) === `fb.2.${seconds * 1000}.123`, "FBP creation remains original");
});

Deno.test("expired or future FBC is omitted without changing the stored original", () => {
  const old = `fb.1.${now - 91 * 86400_000}.OldClick`;
  assert(!normalizeMetaFbc(old, now), "Existing freshness policy is retained");
  assert(!normalizeMetaFbc(`fb.1.${now + 300_001}.FutureClick`, now), "Future click is invalid");
  assert(!normalizeMetaFbp(`fb.1.${now + 300_001}.123`, now), "Future browser identity is invalid");
});

Deno.test("API2 legacy WhatsApp Lead/Purchase classify chat from event envelope, not acquisition label", () => {
  for (const eventName of ["Lead", "Purchase"]) for (const source_platform of ["", "landing"]) {
    const raw = JSON.stringify({ action: eventName.toUpperCase(), bot_phone: "5491160000000", phone: "5491170000000" });
    assert(resolveMetaActionSource({ source_platform, lead_payload_raw: raw, purchase_payload_raw: raw }, eventName) === "chat", "Recognized API2 envelope must use chat");
  }
});

Deno.test("Atrio confirmed Purchase is chat while landing Lead/Registration remain website", () => {
  const raw = JSON.stringify({ action: "PURCHASE", source_platform: "atrio", emitter_platform: "atrio", atrio_id: "fixture-advisor" });
  assert(resolveMetaActionSource({ source_platform: "landing", purchase_payload_raw: raw }, "Purchase") === "chat", "Acquisition label must not mask Atrio Purchase");
  const cta = JSON.stringify({ action: "CONTACT", source_platform: "landing", cta_destination: "atrio" });
  for (const event of ["Contact", "Lead", "CompleteRegistration"]) {
    assert(resolveMetaActionSource({ source_platform: "landing", lead_payload_raw: cta }, event) === "website", "CTA remains website");
  }
});

Deno.test("unknown, truncated and secondary integration envelopes do not become chat", () => {
  const raw = JSON.stringify({ action: "PURCHASE", bot_phone: "5491160000000" });
  for (const source_platform of ["chatrace", "whatsapp_cloud_api", "other_provider"]) {
    assert(resolveMetaActionSource({ source_platform, purchase_payload_raw: raw }, "Purchase") === "website", "Secondary route remains independent");
  }
  for (const purchase_payload_raw of ["{broken", "[]", JSON.stringify({ action: "PURCHASE", phone: "5491160000000" }),
    JSON.stringify({ action: "PURCHASE", source_platform: "foreign", bot_phone: "5491160000000" }),
    JSON.stringify({ action: "PURCHASE", source_platform: "foreign", emitter_platform: "atrio" }),
    JSON.stringify({ action: "PURCHASE", source_platform: "atrio", emitter_platform: "foreign" })]) {
    assert(resolveMetaActionSource({ source_platform: "landing", purchase_payload_raw }, "Purchase") === "website", "Insufficient/conflicting provenance remains unchanged");
  }
});

Deno.test("chat CAPI retains identity, time and value but omits the acquisition URL", async () => {
  for (const eventName of ["Lead", "Purchase"] as const) {
    const row = buildFakeConversionRow(eventName);
    const raw = JSON.stringify({ action: eventName.toUpperCase(), bot_phone: "5491160000000" });
    row.source_platform = "landing"; row.lead_payload_raw = raw; row.purchase_payload_raw = raw;
    const before = JSON.stringify(row);
    const request = await buildMetaRequest(config, row, eventName, "stable-id", now / 1000, { currency: "ARS", value: 100 });
    assert(request.eventPayload.action_source === "chat", "Known chat source must be sent");
    assert(!("event_source_url" in request.eventPayload), "Acquisition landing is not the chat location");
    assert(request.eventPayload.event_id === "stable-id" && request.eventPayload.event_time === now / 1000, "Event identity/time stay stable");
    assert(JSON.stringify(row) === before, "Internal acquisition data must not mutate");
  }
});

Deno.test("website CAPI sends the page route without PII or access parameters", async () => {
  const row = buildFakeConversionRow("Contact");
  row.event_source_url = "https://example.test/gast?landing=diana&email=private%40example.test&phone=5491&token=secret#private";
  const request = await buildMetaRequest(config, row, "Contact", "contact-id", now / 1000);
  assert(request.eventPayload.action_source === "website", "CTA remains website");
  assert(request.eventPayload.event_source_url === "https://example.test/gast?landing=diana", "Only routing query survives");
  assert(row.event_source_url.includes("email="), "Captured raw URL remains available internally");
});

Deno.test("URL sanitizer rejects credentials, embedded emails and non-web routes", () => {
  for (const url of ["https://user:pass@example.test/path", "https://example.test/person%40example.test", "javascript:alert(1)", "/relative"]) {
    assert(!sanitizeMetaEventSourceUrl(url), "Unsafe URL must not be sent");
  }
  assert(sanitizeMetaEventSourceUrl("https://example.test/path?unknown=private#private") === "https://example.test/path", "Unknown query data is removed");
});

Deno.test("IP matching keeps real literals, IPv6 and mapped public IPv4", () => {
  for (const ip of ["201.213.0.10", "2606:4700:4700::1111", "::ffff:201.213.0.10", "::ffff:c9d5:a"]) {
    assert(normalizePublicClientIp(ip) === ip, `Valid public address must survive: ${ip}`);
  }
  assert(normalizePublicClientIp("201.213.0.10, 10.0.0.1") === "201.213.0.10", "Observed header form remains compatible");
  assert(normalizePublicClientIp("[2606:4700:4700::1111]:443") === "2606:4700:4700::1111", "Bracket form remains compatible");
});

Deno.test("IP matching never fabricates a literal from digits/text or accepts invalid/private IPv6", () => {
  for (const ip of ["201213000010", "garbage201.213.0.10", "201.213.0.", "201.213.000.10", "1:2:3", "1::2::3", "::ffff:10.0.0.1", "::ffff:a00:1", "fe81::1", "::1", "2001:db8::1", "999.213.0.10"]) {
    assert(!normalizePublicClientIp(ip), `Invalid/nonpublic address must be omitted: ${ip}`);
  }
});

Deno.test("matching normalizes UTF8 names and emails without removing identity accents", async () => {
  const row = buildFakeConversionRow("Contact"); row.fn = " Valéry "; row.ln = "O’Ñeil"; row.email = " Éxample@Test.COM ";
  const data = await buildUserData(row, false);
  assert(data.fn === "08e1996b5dd49e62a4b4c010d44e4345592a863bb9f8e3976219bac29417149c", "Official Meta Valéry example must match");
  const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(n => n.toString(16).padStart(2, "0")).join("");
  assert(data.em === await hash("éxample@test.com"), "Email only lowercases and trims edges");
  assert(data.ln === await hash("oñeil"), "Name punctuation removed, UTF8 retained");
});

Deno.test("opaque advertiser identity remains distinct across case and accents", async () => {
  const a = buildFakeConversionRow("Contact"), b = buildFakeConversionRow("Contact");
  a.external_id = "Customer É 7"; b.external_id = "customer e7";
  assert((await buildUserData(a, false)).external_id !== (await buildUserData(b, false)).external_id, "Different opaque IDs cannot collapse");
});
