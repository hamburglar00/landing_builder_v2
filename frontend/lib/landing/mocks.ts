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
  titleLine3: "",
  subtitleLine1: "Información importante línea 1.",
  subtitleLine2: "Información importante línea 2.",
  subtitleLine3: "Información importante línea 3.",
  footerBadgeLine1: "Texto final",
  footerBadgeLine2: "",
  footerBadgeLine3: "",
  ctaText: "Acceder",
   // Plantilla por defecto: layout actual.
  template: "template1",
  fontFamily: "system",
  // Tamaños pensados para mobile (px).
  titleFontSize: 28,
  subtitleFontSize: 16,
  ctaFontSize: 18,
  badgeFontSize: 12,
  // Estilos de negrita por defecto.
  titleBold: true,
  subtitleBold: false,
  ctaBold: true,
  badgeBold: true,
  // Posición por defecto: entre título e info (layout actual).
  ctaPosition: "between_title_and_info",
  titleColor: "white",
  subtitleColor: "white",
  footerBadgeColor: "gold",
  ctaTextColor: "black",
  ctaBackgroundColor: "gold",
  ctaGlowColor: "gold",
};
