/** Canonical public subdomains. Never derive a skin from an arbitrary Host prefix. */
export const MULTI_SKIN_SUBDOMAINS = {
  ganamos_plus: "ganamosplus", jugamos: "jugamos", casino_zeus: "casinozeus", bet30: "bet30",
  gana_en_casa: "ganaencasa", celu_apuestas: "celuapuestas", casino_zeta: "casinozeta",
  oro_puro: "oropuro", fortu_bet: "fortubet", gran_poseidon: "granposeidon", kona_bet: "konabet",
  mega_faraon: "megafaraon", camel_bet: "camelbet", rhino_play: "rhinoplay",
} as const;
export type GatewaySkin = keyof typeof MULTI_SKIN_SUBDOMAINS;

/** A domain only, without protocol, port, wildcard, path, credentials or IP address. */
export function multiSkinBaseDomain(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const domain = value.trim().toLowerCase();
  if (domain.length > 230 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain))
    throw new Error("MULTI_SKIN_GATEWAY_BASE_DOMAIN debe ser un dominio sin protocolo ni ruta.");
  return domain;
}
export function multiSkinGatewayOrigin(skin: unknown, domain?: string | null): string | null {
  const base = multiSkinBaseDomain(domain);
  return base && typeof skin === "string" && Object.hasOwn(MULTI_SKIN_SUBDOMAINS, skin)
    ? `https://${MULTI_SKIN_SUBDOMAINS[skin as GatewaySkin]}.${base}` : null;
}
export function multiSkinGatewayOrigins(domain?: string | null): string[] {
  return Object.keys(MULTI_SKIN_SUBDOMAINS).flatMap(skin => {
    const origin = multiSkinGatewayOrigin(skin, domain);
    return origin ? [origin] : [];
  });
}
export function gatewaySkinForOrigin(origin: string, domain?: string | null): GatewaySkin | null {
  return (Object.keys(MULTI_SKIN_SUBDOMAINS) as GatewaySkin[]).find(skin => multiSkinGatewayOrigin(skin, domain) === origin) ?? null;
}
