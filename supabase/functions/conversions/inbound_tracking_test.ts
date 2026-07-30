import {
  canonicalizeInboundTrackingPayload,
  inboundClientIpCandidates,
  inboundUserAgent,
} from "./inbound_tracking.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("prioriza nombres canónicos y conserva aliases como fallback", () => {
  const payload = {
    client_ip_address: "2800:810:abcd::1",
    client_ip: "181.10.20.30",
    clientIP: "190.20.30.40",
    client_user_agent: "Canonical UA",
    agentuser: "Legacy UA",
    user_agent: "Other UA",
  };

  const candidates = inboundClientIpCandidates(payload);
  assert(candidates[0] === "2800:810:abcd::1", "Canonical IP must win");
  assert(candidates[1] === "181.10.20.30", "Secondary alias must be retained");
  assert(candidates[2] === "190.20.30.40", "Legacy alias must be retained");
  assert(inboundUserAgent(payload) === "Canonical UA", "Canonical UA must win");
});

Deno.test("acepta payloads históricos y omite valores vacíos", () => {
  const payload = {
    client_ip_address: "",
    clientIP: "181.10.20.30",
    client_user_agent: " ",
    agentuser: "Legacy UA",
  };

  const candidates = inboundClientIpCandidates(payload);
  assert(candidates.length === 1, "Only one usable IP is expected");
  assert(candidates[0] === "181.10.20.30", "Legacy IP must remain supported");
  assert(
    inboundUserAgent(payload) === "Legacy UA",
    "Legacy UA must remain supported",
  );
});

Deno.test("normaliza aliases sin conservar claves duplicadas", () => {
  const normalized = canonicalizeInboundTrackingPayload(
    {
      event_name: "Contact",
      client_ip_address: "2800:810:abcd::1",
      clientIP: "181.10.20.30",
      client_ip: "190.20.30.40",
      client_user_agent: "Canonical UA",
      agentuser: "Legacy UA",
      user_agent: "Other UA",
    },
    {
      clientIpAddress: "2800:810:abcd::1",
      userAgent: "Canonical UA",
    },
  );

  assert(
    normalized.client_ip_address === "2800:810:abcd::1",
    "Canonical IP must be preserved",
  );
  assert(
    normalized.client_user_agent === "Canonical UA",
    "Canonical UA must be preserved",
  );
  assert(!Object.hasOwn(normalized, "clientIP"), "Legacy IP must be removed");
  assert(!Object.hasOwn(normalized, "client_ip"), "IP alias must be removed");
  assert(!Object.hasOwn(normalized, "agentuser"), "Legacy UA must be removed");
  assert(!Object.hasOwn(normalized, "user_agent"), "UA alias must be removed");
});
