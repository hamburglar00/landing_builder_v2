import type { LandingTemplate8CoverConfig, TargetProvider } from "./types";

export const TEMPLATE8_PROVIDERS: readonly TargetProvider[] = ["ganamos_net", "multi_skin", "rey_de_ases", "ases_del_norte"];
export const TEMPLATE8_PROVIDER_NAMES: Record<TargetProvider, string> = {
  ganamos_net: "Ganamos NET", multi_skin: "Ganamos+", rey_de_ases: "Rey de Ases", ases_del_norte: "Ases del Norte",
};
export function normalizeTemplate8Cover(value?: Partial<LandingTemplate8CoverConfig> | null): LandingTemplate8CoverConfig {
  const count = Number(value?.cardCount ?? 4);
  return {
    cardCount: Number.isInteger(count) ? Math.max(1, Math.min(6, count)) : 4,
    backgroundImageUrl: typeof value?.backgroundImageUrl === "string" ? value.backgroundImageUrl : "",
    headerText: typeof value?.headerText === "string" ? value.headerText : "Elegí tu página",
    footerText: typeof value?.footerText === "string" ? value.footerText : "Te acompañamos en tu chat",
    cards: Array.from({ length: 6 }, (_, i) => {
      const card = value?.cards?.[i];
      const provider = TEMPLATE8_PROVIDERS.includes(card?.targetProvider as TargetProvider) ? card!.targetProvider : TEMPLATE8_PROVIDERS[i % 4];
      return { imageUrl: card?.imageUrl || "", text: card?.text ?? TEMPLATE8_PROVIDER_NAMES[provider], ctaText: card?.ctaText || "", targetProvider: provider };
    }),
  };
}

/** Strict server selector: never infer a page from an untrusted provider or a default card. */
export function template8Provider(config: unknown, cardIndex: unknown): TargetProvider | null {
  if (!config || typeof config !== "object" || !Number.isInteger(cardIndex)) return null;
  const raw = config as { template?: string; template8Cover?: LandingTemplate8CoverConfig };
  const cover = raw.template8Cover;
  if (raw.template !== "template8" || !cover || !Number.isInteger(cover.cardCount) || cover.cardCount < 1 || cover.cardCount > 6 ||
      Number(cardIndex) < 1 || Number(cardIndex) > cover.cardCount) return null;
  const provider = cover.cards?.[Number(cardIndex) - 1]?.targetProvider;
  return TEMPLATE8_PROVIDERS.includes(provider) ? provider : null;
}
