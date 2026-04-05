/**
 * Lista cerrada de nombres de color para el constructor de landing.
 * No se usa color picker libre ni input hex manual.
 */
export type ColorOption =
  | "white"
  | "black"
  | "gold"
  | "yellow"
  | "red"
  | "green"
  | "whatsapp_green"
  | "blue"
  | "cyan"
  | "orange"
  | "pink"
  | "purple"
  | "gray_light"
  | "gray_dark";

/**
 * Familia tipogrfica seleccionable desde el constructor.
 * La landing pblica debe mapear estos tokens a font-family reales.
 */
export type FontFamilyOption =
  | "pp_mori"
  | "roboto"
  | "poppins"
  | "montserrat"
  | "bebas"
  | "alpha"
  | "anton"
  | "system";

/**
 * Posicin del CTA dentro del layout fijo de la landing.
 *
 * top: inmediatamente despus del logo.
 * between_title_and_info: despus del ttulo (posicin actual por defecto).
 * between_info_and_badge: entre el bloque informativo y el badge final.
 * bottom: al final, debajo del badge.
 */
export type CtaPositionOption =
  | "top"
  | "between_title_and_info"
  | "between_info_and_badge"
  | "bottom";

/**
 * Plantilla de layout disponible en el constructor.
 * template1: layout actual (CTA + multimedia + textos).
 * template2: variante visual 2.
 * template3: sin UI visual (redirect directo).
 */
export type TemplateOption = "template1" | "template2" | "template3";

/**
 * Modo de fondo: una sola imagen o rotacin entre varias.
 */
export type BackgroundMode = "single" | "rotating";

/**
 * Configuracin completa del tema de la landing (plantilla fija).
 * El usuario solo puede editar estos campos; no puede mover elementos ni cambiar layout.
 */
export interface LandingThemeConfig {
  backgroundMode: BackgroundMode;
  backgroundImages: string[];
  rotateEveryHours: number;
  logoUrl: string;
  titleLine1: string;
  titleLine2: string;
  titleLine3: string;
  subtitleLine1: string;
  subtitleLine2: string;
  subtitleLine3: string;
  footerBadgeLine1: string;
  footerBadgeLine2: string;
  footerBadgeLine3: string;
  ctaText: string;
  /**
   * Plantilla visual de la landing.
   */
  template: TemplateOption;
  /**
   * Tipografa y estilos de texto.
   * Se guardan en pixeles/booleanos para que la landing pblica pueda aplicarlos 1:1.
   */
  fontFamily: FontFamilyOption;
  titleFontSize: number;
  subtitleFontSize: number;
  ctaFontSize: number;
  badgeFontSize: number;
  titleBold: boolean;
  subtitleBold: boolean;
  ctaBold: boolean;
  badgeBold: boolean;
  /**
   * Posicin del CTA dentro del layout fijo.
   */
  ctaPosition: CtaPositionOption;
  titleColor: ColorOption;
  subtitleColor: ColorOption;
  footerBadgeColor: ColorOption;
  ctaTextColor: ColorOption;
  ctaBackgroundColor: ColorOption;
  ctaGlowColor: ColorOption;
  /**
   * Si es true, la landing publica envia Contact via Pixel (browser).
   * Si es false, solo envia al endpoint de conversiones/CAPI.
   */
  sendContactPixel: boolean;
}

/**
 * Entidad landing: un cliente puede tener muchas.
 * Incluye nombre, comentario, tracking y la config del tema.
 */
export interface Landing {
  id: string;
  landingType: "internal" | "external";
  externalDomain: string;
  name: string;
  pixelId: string;
  /** Modo de seleccin de gerencias: 'weighted_random' (aleatorio por peso) o 'fair' (equitativo). */
  gerenciaSelectionMode: "weighted_random" | "fair";
  /** Criterio para reparto equitativo de gerencias: por contador o por mensajes recibidos. */
  gerenciaFairCriterion: "usage_count" | "messages_received";
  /** Modo de seleccion de tel?fono: 'random' (aleatorio) o 'fair' (equitativo). */
  phoneMode: "random" | "fair";
  /** Tipo de nmero de telfono a usar: 'carga', 'ads' o 'mkt'. */
  phoneKind: "carga" | "ads" | "mkt";
  /** Hora de inicio (0-23) del intervalo horario en el que esta landing puede mostrar telfonos. null = sin intervalo. */
  phoneIntervalStartHour: number | null;
  /** Hora de fin (0-23) del intervalo horario en el que esta landing puede mostrar telfonos. null = sin intervalo. */
  phoneIntervalEndHour: number | null;
  postUrl: string;
  landingTag: string;
  comment: string;
  config: LandingThemeConfig;
}


