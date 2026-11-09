/** Next can normalize request.url to localhost behind its server/proxy. The HTTP
 * Host is the browser-facing authority; never trust a forwarded host supplied by a client. */
export function isSameOriginRequest(request: Request): boolean {
  const value = request.headers.get("origin");
  if (value === null) return true;
  try {
    const origin = new URL(value);
    if (!["http:", "https:"].includes(origin.protocol) || value !== origin.origin) return false;
    const url = new URL(request.url);
    const host = request.headers.get("host");
    if (host !== null) {
      if (!/^[a-z\d.:[\]-]+$/i.test(host)) return false;
      return origin.origin === new URL(`${url.protocol}//${host}`).origin;
    }
    return origin.origin === url.origin;
  } catch {
    return false;
  }
}
