import type { LandingThemeConfig } from "./types";

/**
 * Configuración por defecto de la landing.
 * Se usa cuando el usuario no tiene config guardada en localStorage.
 */
export const DEFAULT_CONFIG: LandingThemeConfig = {
  marketCountry: "AR",
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
  sendContactPixel: true,
  ctaDestination: "whatsapp",
  atrioRedirectUrl: "",
  atrioClientId: "",
  atrioId: "",
  atrioSlug: "",
  socialProofEnabled: false,
  interactionsEnabled: false,
  whatsappPrefillText: "",
  leadCapture: {
    enabled: false,
    title: "Desbloqueá atención personalizada",
    description: "Completá tus datos o seguí directo a WhatsApp.",
    fields: {
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
  template4Chat: {
    profileImageUrl: "",
    backgroundImageUrl: "",
    bubble1Text: "Hola, soy {{name}}, enviame un mensaje y comenzamos ya mismo.",
    bubble2Intro: "Te acompaño en todo el proceso",
    bubble2Item1: "💸 Cargas y retiros las 24hs",
    bubble2Item2: "👤 Atencion personalizada",
    bubble2Item3: "🛡️ Respaldo y mas de 5 anos de experiencia",
    bubble3Text: "Arrancamos? Toca abajo y comenzamos",
  },
  template5Live: {
    titleText: "ESTA PASANDO\nAHORA MISMO.",
    subtitleText:
      "Un asesor te abre la cuenta en 2 minutos por WhatsApp y te acompaña en todo el proceso...",
    profileImageUrl: "",
    backgroundImageUrl: "",
  },
};
