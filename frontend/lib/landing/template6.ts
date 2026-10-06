import type { LandingTemplate6CoverConfig, LandingTemplate6Grid } from "./types";

export const TEMPLATE6_CARD_COUNT: Record<LandingTemplate6Grid, number> = {
  "2x1": 2,
  "2x2": 4,
  "2x3": 6,
};

export const DEFAULT_TEMPLATE6_COVER: LandingTemplate6CoverConfig = {
  grid: "2x2",
  backgroundImageUrl: "",
  headerText: "Elegí tu opción",
  footerText: "Estamos para ayudarte",
  cards: Array.from({ length: 6 }, () => ({ imageUrl: "", text: "", ctaText: "" })),
};

export function normalizeTemplate6Cover(
  value: LandingTemplate6CoverConfig | undefined,
): LandingTemplate6CoverConfig {
  const grid = value?.grid && value.grid in TEMPLATE6_CARD_COUNT ? value.grid : "2x2";
  return {
    grid,
    backgroundImageUrl: value?.backgroundImageUrl ?? "",
    headerText: value?.headerText ?? DEFAULT_TEMPLATE6_COVER.headerText,
    footerText: value?.footerText ?? DEFAULT_TEMPLATE6_COVER.footerText,
    cards: Array.from({ length: 6 }, (_, index) => ({
      imageUrl: value?.cards?.[index]?.imageUrl ?? "",
      text: value?.cards?.[index]?.text ?? "",
      ctaText: value?.cards?.[index]?.ctaText ?? "",
    })),
  };
}

export function template6Lines(value: string): string[] {
  return value.split(/\r?\n/).slice(0, 2);
}
