/** Trusted skins of the same provider. Authentication and the agent API are shared. */
export const MULTI_SKIN_AUTH_ORIGIN = "https://jugamos1.lat";
export const MULTI_SKIN_AGENT_ENDPOINT = "https://agentes.plus/api.php";
export const MULTI_SKIN_CATALOG = {
  ganamos_plus: { name: "Ganamos+", origin: "https://ganamosbet.plus" },
  jugamos: { name: "Jugamos", origin: "https://jugamos1.lat" },
  casino_zeus: { name: "Casino Zeus", origin: "https://casinozeus1.plus" },
  bet30: { name: "Bet30", origin: "https://bet30e.lat" },
  gana_en_casa: { name: "Gana En Casa", origin: "https://ganaencasabet.lat" },
  celu_apuestas: { name: "CeluApuestas", origin: "https://celuapuestas1.lat" },
  casino_zeta: { name: "CasinoZeta", origin: "https://casinozeta1.lat" },
  oro_puro: { name: "OroPuro", origin: "https://oropuro.bet" },
  fortu_bet: { name: "FortuBet", origin: "https://fortubet.cc" },
  gran_poseidon: { name: "Gran Poseidon", origin: "https://granposeidon.plus" },
  kona_bet: { name: "Konabet", origin: "https://konabet.plus" },
  mega_faraon: { name: "MegaFaraon", origin: "https://megafaraon.plus" },
  camel_bet: { name: "CamelBet", origin: "https://camelbet.icu" },
  rhino_play: { name: "RhinoPlay", origin: "https://rhinoplay.xyz" },
} as const;
export type MultiSkinCode = keyof typeof MULTI_SKIN_CATALOG;
export const MULTI_SKIN_CODES = Object.keys(MULTI_SKIN_CATALOG) as [MultiSkinCode, ...MultiSkinCode[]];
export function isMultiSkinCode(value: unknown): value is MultiSkinCode {
  return typeof value === "string" && Object.hasOwn(MULTI_SKIN_CATALOG, value);
}
