export type GatewayLandingBackend = "builder" | "nexobet";
export function isGatewayLandingSlug(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
}
export function gatewayLandingBasePath(backend: GatewayLandingBackend, slug: string): string {
  if (!isGatewayLandingSlug(slug) || (backend !== "builder" && backend !== "nexobet") || (backend === "builder" && slug.toLowerCase() === "nexobet"))
    throw new Error("Invalid gateway landing namespace");
  return backend === "nexobet" ? `/l/nexobet/${slug}` : `/l/${slug}`;
}
export function gatewayLandingCookiePath(backend: GatewayLandingBackend, slug: string): string {
  const base = gatewayLandingBasePath(backend, slug);
  return backend === "nexobet" ? base : base + "/";
}
export function gatewayLandingTelemetryPath(backend: GatewayLandingBackend, slug: string): string {
  return gatewayLandingBasePath(backend, slug) + "/_api/entry-funnel";
}
export function parseGatewayLandingTelemetryPath(path: unknown): { backend: GatewayLandingBackend; slug: string } | null {
  if (typeof path !== "string") return null;
  const match = /^\/l\/(?:(nexobet)\/)?([A-Za-z0-9][A-Za-z0-9_-]{0,79})\/_api\/entry-funnel$/.exec(path);
  if (!match) return null;
  const backend = match[1] ? "nexobet" : "builder", slug = match[2];
  try { return gatewayLandingTelemetryPath(backend, slug) === path ? { backend, slug } : null; } catch { return null; }
}
