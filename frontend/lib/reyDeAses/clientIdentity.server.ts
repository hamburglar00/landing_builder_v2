export const CLIENT_ID_COOKIE_NAME = "lb_cid";
export const CLIENT_ID_MAX_AGE_SECONDS = 63_072_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDeviceId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export type ClientIdentity = { deviceId: string; needsCookie: boolean };

/** Solo código servidor: el UUID nunca se incluye en el JSON ni en el HTML. */
export function getOrCreateClientIdentity(request: Request): ClientIdentity {
  const matches = (request.headers.get("cookie") || "").split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${CLIENT_ID_COOKIE_NAME}=`))
    .map((part) => part.slice(CLIENT_ID_COOKIE_NAME.length + 1));
  // Una cookie duplicada se considera ambigua; no confiar en el orden del header.
  if (matches.length === 1 && isDeviceId(matches[0])) {
    return { deviceId: matches[0], needsCookie: false };
  }
  return { deviceId: crypto.randomUUID(), needsCookie: true };
}

export function withClientIdentityCookie(
  response: Response,
  identity: ClientIdentity,
  production = process.env.NODE_ENV === "production",
): Response {
  response.headers.set("Cache-Control", "no-store");
  if (identity.needsCookie) {
    const secure = production ? "; Secure" : "";
    response.headers.append("Set-Cookie",
      `${CLIENT_ID_COOKIE_NAME}=${identity.deviceId}; Max-Age=${CLIENT_ID_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}; Priority=High`);
  }
  return response;
}
