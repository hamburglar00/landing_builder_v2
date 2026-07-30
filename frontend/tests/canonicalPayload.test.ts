import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalTrackingPayload } from "../lib/tracking/canonicalPayload";

test("emite una sola IP y un solo user agent con nombres canónicos", () => {
  const payload = buildCanonicalTrackingPayload({
    payloadFromClient: {
      event_name: "Contact",
      clientIP: "181.1.1.1",
      client_ip: "181.1.1.2",
      client_ip_address: "181.1.1.3",
      client_ip_issued_at: 123,
      client_ip_proof: "proof",
      agentuser: "Legacy UA",
      user_agent: "Other UA",
      client_user_agent: "Canonical UA",
    },
    clientIpAddress: "2800:810:abcd::1",
    clientIpSource: "signed_dual_stack",
    clientIpVersion: "ipv6",
    observedUserAgent: "Header UA",
    timestamp: "2026-07-30T00:00:00.000Z",
    eventTime: 1_785_432_000,
  });

  assert.equal(payload.client_ip_address, "2800:810:abcd::1");
  assert.equal(payload.client_user_agent, "Canonical UA");
  assert.equal(payload.client_ip_source, "signed_dual_stack");
  assert.equal(payload.client_ip_version, "ipv6");
  assert.equal(Object.hasOwn(payload, "clientIP"), false);
  assert.equal(Object.hasOwn(payload, "client_ip"), false);
  assert.equal(Object.hasOwn(payload, "agentuser"), false);
  assert.equal(Object.hasOwn(payload, "user_agent"), false);
  assert.equal(Object.hasOwn(payload, "client_ip_proof"), false);
});

test("acepta aliases históricos como fallback sin volver a emitirlos", () => {
  const payload = buildCanonicalTrackingPayload({
    payloadFromClient: {
      event_name: "Contact",
      agentuser: "Legacy UA",
    },
    clientIpAddress: "181.10.20.30",
    clientIpSource: "vercel_forwarded",
    clientIpVersion: "ipv4",
    observedUserAgent: "Header UA",
    timestamp: "2026-07-30T00:00:00.000Z",
    eventTime: 1_785_432_000,
  });

  assert.equal(payload.client_user_agent, "Legacy UA");
  assert.equal(Object.hasOwn(payload, "agentuser"), false);
});
