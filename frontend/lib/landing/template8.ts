import type { LandingTemplate8CoverConfig, TargetProvider } from "./types";
import { isMultiSkinCode, MULTI_SKIN_CATALOG, type MultiSkinCode } from "../multi-skin-catalog";

export const TEMPLATE8_PROVIDERS: readonly TargetProvider[] = ["ganamos_net", "multi_skin", "rey_de_ases", "ases_del_norte"];
export const TEMPLATE8_PROVIDER_NAMES: Record<TargetProvider, string> = {
  ganamos_net: "Ganamos NET", multi_skin: "Multi Skin", rey_de_ases: "Rey de Ases", ases_del_norte: "Ases del Norte",
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
      const skin = isMultiSkinCode(card?.multiSkinCode) ? card.multiSkinCode : "ganamos_plus";
      return { imageUrl: card?.imageUrl || "", text: card?.text ?? (provider === "multi_skin" ? MULTI_SKIN_CATALOG[skin].name : TEMPLATE8_PROVIDER_NAMES[provider]), ctaText: card?.ctaText || "", targetProvider: provider,
        ...(provider === "multi_skin" ? { multiSkinCode: skin } : {}),
      };
    }),
  };
}

/** Only the saved card chooses its skin. Legacy cards always meant Ganamos+. */
export function template8SkinCode(config: unknown, cardIndex: unknown): MultiSkinCode | null {
  if (template8Provider(config, cardIndex) !== "multi_skin") return null;
  const card = (config as { template8Cover: LandingTemplate8CoverConfig }).template8Cover.cards[Number(cardIndex) - 1];
  if (card.multiSkinCode === undefined) return "ganamos_plus";
  return isMultiSkinCode(card.multiSkinCode) ? card.multiSkinCode : null;
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
