type InboundTrackingPayload = Record<string, unknown>;

function firstNonBlankString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return "";
}

export function inboundClientIpCandidates(
  payload: InboundTrackingPayload,
): string[] {
  const candidates = [
    payload.client_ip_address,
    payload.client_ip,
    payload.clientIP,
  ];
  const unique = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

export function inboundUserAgent(payload: InboundTrackingPayload): string {
  return firstNonBlankString([
    payload.client_user_agent,
    payload.agentuser,
    payload.user_agent,
  ]);
}

export function canonicalizeInboundTrackingPayload(
  payload: InboundTrackingPayload,
  canonical: {
    clientIpAddress: string;
    userAgent: string;
  },
): InboundTrackingPayload {
  const {
    clientIP,
    client_ip,
    client_ip_address,
    agentuser,
    client_user_agent,
    user_agent,
    ...rest
  } = payload;
  void clientIP;
  void client_ip;
  void client_ip_address;
  void agentuser;
  void client_user_agent;
  void user_agent;

  return {
    ...rest,
    ...(canonical.clientIpAddress
      ? { client_ip_address: canonical.clientIpAddress }
      : {}),
    ...(canonical.userAgent ? { client_user_agent: canonical.userAgent } : {}),
  };
}
