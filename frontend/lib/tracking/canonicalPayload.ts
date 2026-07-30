type CanonicalTrackingPayloadInput = {
  payloadFromClient: Record<string, unknown>;
  clientIpAddress: string;
  clientIpSource: string;
  clientIpVersion: string;
  observedUserAgent: string;
  timestamp?: string;
  eventTime?: number;
};

function firstNonBlankString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return "";
}

export function buildCanonicalTrackingPayload({
  payloadFromClient,
  clientIpAddress,
  clientIpSource,
  clientIpVersion,
  observedUserAgent,
  timestamp = new Date().toISOString(),
  eventTime = Math.floor(Date.now() / 1000),
}: CanonicalTrackingPayloadInput): Record<string, unknown> {
  const {
    clientIP,
    client_ip,
    client_ip_address,
    client_ip_source,
    client_ip_version,
    client_ipv4,
    client_ipv6,
    client_ip_issued_at,
    client_ip_proof,
    agentuser,
    client_user_agent,
    user_agent,
    ...payload
  } = payloadFromClient;
  void clientIP;
  void client_ip;
  void client_ip_address;
  void client_ip_source;
  void client_ip_version;
  void client_ipv4;
  void client_ipv6;
  void client_ip_issued_at;
  void client_ip_proof;

  return {
    ...payload,
    client_ip_source: clientIpSource,
    client_ip_version: clientIpVersion,
    client_ip_address: clientIpAddress,
    client_user_agent: firstNonBlankString([
      client_user_agent,
      agentuser,
      user_agent,
      observedUserAgent,
    ]),
    timestamp: payloadFromClient.timestamp ?? timestamp,
    event_time: payloadFromClient.event_time ?? eventTime,
  };
}
