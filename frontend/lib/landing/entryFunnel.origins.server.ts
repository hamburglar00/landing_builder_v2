import { MULTI_SKIN_SUBDOMAINS } from "../multi-skin-origins";
import { gatewayOriginFor } from "../reyDeAses/gatewayOrigins";

/** Deployment configuration, never a Host header or browser-provided origin. */
export function entryFunnelGatewayOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const values = [
    ...["rey_de_ases", "ases_del_norte", "ganamos_net"].map(provider => gatewayOriginFor(provider, undefined, env)),
    ...Object.keys(MULTI_SKIN_SUBDOMAINS).map(skin => gatewayOriginFor("multi_skin", skin, env)),
  ];
  return [...new Set(values.filter((value): value is string => {
    if (!value) return false;
    try { const url = new URL(value); return url.protocol === "https:" && url.origin === value; }
    catch { return false; }
  }))];
}
