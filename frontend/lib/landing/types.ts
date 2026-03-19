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
 * Familia tipográfica seleccionable desde el constructor.
 * La landing pública debe mapear estos tokens a font-family reales.
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
 * Posición del CTA dentro del layout fijo de la landing.
 *
 * top: inmediatamente después del logo.
 * between_title_and_info: después del título (posición actual por defecto).
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
 * template2: futuras variantes.
 */
export type TemplateOption = "template1" | "template2";

/**
 * Modo de fondo: una sola imagen o rotación entre varias.
 */
export type BackgroundMode = "single" | "rotating";

/**
 * Configuración completa del tema de la landing (plantilla fija).
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
   * Tipografía y estilos de texto.
   * Se guardan en pixeles/booleanos para que la landing pública pueda aplicarlos 1:1.
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
   * Posición del CTA dentro del layout fijo.
   */
  ctaPosition: CtaPositionOption;
  titleColor: ColorOption;
  subtitleColor: ColorOption;
  footerBadgeColor: ColorOption;
  ctaTextColor: ColorOption;
  ctaBackgroundColor: ColorOption;
  ctaGlowColor: ColorOption;
}

/**
 * Entidad landing: un cliente puede tener muchas.
 * Incluye nombre, comentario, tracking y la config del tema.
 */
export interface Landing {
  id: string;
  name: string;
  pixelId: string;
  /** Modo de selecci�n de gerencias: 'weighted_random' (aleatorio por peso) o 'fair' (equitativo). */
  gerenciaSelectionMode: "weighted_random" | "fair";
  /** Criterio para reparto equitativo de gerencias: por contador o por mensajes recibidos. */
  gerenciaFairCriterion: "usage_count" | "messages_received";
  /** Modo de selecci?n de tel?fono: 'random' (aleatorio) o 'fair' (equitativo). */
  phoneMode: "random" | "fair";
  /** Tipo de número de teléfono a usar: 'carga', 'ads' o 'mkt'. */
  phoneKind: "carga" | "ads" | "mkt";
  /** Hora de inicio (0-23) del intervalo horario en el que esta landing puede mostrar teléfonos. null = sin intervalo. */
  phoneIntervalStartHour: number | null;
  /** Hora de fin (0-23) del intervalo horario en el que esta landing puede mostrar teléfonos. null = sin intervalo. */
  phoneIntervalEndHour: number | null;
  postUrl: string;
  landingTag: string;
  comment: string;
  config: LandingThemeConfig;
}


