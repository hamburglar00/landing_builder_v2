import type { LandingThemeConfig } from "./types";

/**
 * Configuración por defecto de la landing.
 * Se usa cuando el usuario no tiene config guardada en localStorage.
 */
export const DEFAULT_CONFIG: LandingThemeConfig = {
  backgroundMode: "single",
  backgroundImages: [],
  rotateEveryHours: 24,
  logoUrl: "",
  titleLine1: "Bienvenido",
  titleLine2: "a la experiencia",
  subtitleLine1: "Información importante línea 1.",
  subtitleLine2: "Información importante línea 2.",
  subtitleLine3: "Información importante línea 3.",
  footerBadgeText: "Texto final",
  ctaText: "Acceder",
  titleColor: "white",
  subtitleColor: "white",
  footerBadgeColor: "gold",
  ctaTextColor: "black",
  ctaBackgroundColor: "gold",
  ctaGlowColor: "gold",
};
