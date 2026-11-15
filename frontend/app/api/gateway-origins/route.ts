import { gatewayOriginFor } from "@/lib/reyDeAses/gatewayOrigins";
import { MULTI_SKIN_CODES } from "@/lib/multi-skin-catalog";
export function GET() {
  const origins: Record<string, string> = {};
  for (const provider of ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"]) {
    for (const skin of provider === "multi_skin" ? MULTI_SKIN_CODES : [null]) {
      // A generic host has one default skin. Other skins need their explicit host map.
      if (provider === "multi_skin" && skin !== "ganamos_plus" && !process.env.MULTI_SKIN_GATEWAY_BASE_DOMAIN) continue;
      const raw = gatewayOriginFor(provider, skin);
      if (!raw) continue;
      try { const url = new URL(raw); if (url.protocol === "https:" && !url.username && !url.password) origins[skin ? `${provider}:${skin}` : provider] = url.origin; } catch { /* unconfigured */ }
    }
  }
  return Response.json({ origins }, { headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
