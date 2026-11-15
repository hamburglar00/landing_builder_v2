import type { LandingThemeConfig } from "./types";
import { gatewayLandingBasePath } from "../gateway-landing-paths";
export function supportsGatewayLandingName(name: string): boolean {
  try { gatewayLandingBasePath("builder", name); return true; } catch { return false; }
}
export type GatewayOriginCatalog = Record<string, string>;
export type GatewayPublicationConfig = Pick<LandingThemeConfig, "template" | "ctaDestination" | "targetProvider" | "multiSkinCode">;
export function supportsGatewayPublication(config?: Partial<GatewayPublicationConfig> | null): boolean {
  return !!config && (config.template === "template7" || config.template === "template9") && config.ctaDestination === "atrio";
}
export function gatewayPublicationOrigin(config: Partial<GatewayPublicationConfig> | undefined, catalog: GatewayOriginCatalog): string | null {
  if (!supportsGatewayPublication(config)) return null;
  const provider = config?.targetProvider || "rey_de_ases";
  const key = provider === "multi_skin" ? `multi_skin:${config?.multiSkinCode || "ganamos_plus"}` : provider;
  return catalog[key] || null;
}
let pending: Promise<GatewayOriginCatalog> | undefined;
export function fetchGatewayOriginCatalog(): Promise<GatewayOriginCatalog> {
  if (!pending) pending = fetch("/api/gateway-origins", { credentials: "same-origin" }).then(async response => {
    if (!response.ok) throw new Error("No se pudieron obtener los dominios del gateway.");
    const value = await response.json();
    const out: GatewayOriginCatalog = {};
    for (const [key, raw] of Object.entries(value.origins || {})) {
      if (typeof raw !== "string") continue;
      try { const url = new URL(raw); if (url.protocol === "https:" && url.origin === raw) out[key] = raw; } catch { /* invalid origin */ }
    }
    return out;
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}
