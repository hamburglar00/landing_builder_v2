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
  subtitleLine1: string;
  subtitleLine2: string;
  subtitleLine3: string;
  footerBadgeText: string;
  ctaText: string;
  titleColor: ColorOption;
  subtitleColor: ColorOption;
  footerBadgeColor: ColorOption;
  ctaTextColor: ColorOption;
  ctaBackgroundColor: ColorOption;
  ctaGlowColor: ColorOption;
}

/**
 * Entidad landing: un cliente puede tener muchas.
 * Incluye nombre, comentario, pixel id y la config del tema.
 */
export interface Landing {
  id: string;
  name: string;
  pixelId: string;
  comment: string;
  config: LandingThemeConfig;
}
