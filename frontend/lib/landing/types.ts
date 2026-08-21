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

/** Las landings públicas usan exclusivamente la fuente nativa del sistema. */
export type FontFamilyOption = "system";

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
 * template4: chat visual fijo.
 * template5: live/urgencia visual fijo.
 */
export type TemplateOption =
  | "template1"
  | "template2"
  | "template3"
  | "template4"
  | "template5";

/**
 * Motor que sirve la URL publica de una landing creada en el constructor.
 *
 * classic: dominio historico landing.panelbotadmin.com/<name>.
 * constructor: dominio del constructor con ruta /l/<name>.
 */
export type PublishTarget = "classic" | "constructor";

/** Mercado principal de la landing, usado para interpretar teléfonos locales. */
export type LandingMarketCountry = "AR" | "PY";

/** Workspace operativo donde vive la landing dentro del panel. */
export type LandingWorkspaceCurrency = "ARS" | "PYG";

/**
 * Modo de fondo: una sola imagen o rotacin entre varias.
 */
export type BackgroundMode = "single" | "rotating";

export type PhoneKind = "carga" | "ads" | "mkt" | "assistant";

export type LandingCtaDestination = "whatsapp" | "atrio";

export interface LandingLeadCaptureConfig {
  enabled: boolean;
  title: string;
  description: string;
  fields: {
    firstName: boolean;
    lastName: boolean;
    phone: boolean;
    email: boolean;
  };
}

export interface LandingTemplate4ChatConfig {
  profileImageUrl: string;
  backgroundImageUrl: string;
  bubble1Text: string;
  bubble2Intro: string;
  bubble2Item1: string;
  bubble2Item2: string;
  bubble2Item3: string;
  bubble3Text: string;
}

export interface LandingTemplate5LiveConfig {
  titleText: string;
  subtitleText: string;
  profileImageUrl: string;
  backgroundImageUrl: string;
}

/**
 * Configuracin completa del tema de la landing (plantilla fija).
 * El usuario solo puede editar estos campos; no puede mover elementos ni cambiar layout.
 */
export interface LandingThemeConfig {
  marketCountry: LandingMarketCountry;
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
   * Campo conservado por compatibilidad con configuraciones históricas.
   * Los motores públicos siempre renderizan con la fuente del sistema.
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
  /**
   * Canal final del CTA. WhatsApp mantiene el flujo actual con phone ganador;
   * Atrio conserva el tracking de Contact y redirige a un webchat con promo_code.
   */
  ctaDestination: LandingCtaDestination;
  atrioRedirectUrl: string;
  atrioClientId: string;
  atrioId: string;
  atrioSlug: string;
  /**
   * Activa o desactiva el bloque de prueba social de la landing publica.
   */
  socialProofEnabled: boolean;
  /**
   * Activa un texto adicional para el mensaje prellenado de WhatsApp.
   */
  interactionsEnabled: boolean;
  whatsappPrefillText: string;
  /**
   * Formulario opcional que aparece al tocar el CTA antes de redirigir a WhatsApp.
   * Apagado por defecto para no agregar friccion.
   */
  leadCapture: LandingLeadCaptureConfig;
  template4Chat?: LandingTemplate4ChatConfig;
  template5Live?: LandingTemplate5LiveConfig;
}

/**
 * Entidad landing: un cliente puede tener muchas.
 * Incluye nombre, comentario, tracking y la config del tema.
 */
export interface Landing {
  id: string;
  userId?: string;
  workspaceCurrency: LandingWorkspaceCurrency;
  landingType: "internal" | "external";
  publishTarget: PublishTarget;
  externalDomain: string;
  name: string;
  pixelId: string;
  /** Modo de seleccin de gerencias: 'weighted_random' (aleatorio por peso) o 'fair' (equitativo). */
  gerenciaSelectionMode: "weighted_random" | "fair";
  /** Criterio para reparto equitativo de gerencias: por contador o por mensajes recibidos. */
  gerenciaFairCriterion: "usage_count" | "messages_received";
  /** Modo de seleccion de tel?fono: 'random' (aleatorio) o 'fair' (equitativo). */
  phoneMode: "random" | "fair";
  /** Tipo de nmero de telfono a usar. */
  phoneKind: PhoneKind;
  /** Hora de inicio (0-23) del intervalo horario en el que esta landing puede mostrar telfonos. null = sin intervalo. */
  phoneIntervalStartHour: number | null;
  /** Hora de fin (0-23) del intervalo horario en el que esta landing puede mostrar telfonos. null = sin intervalo. */
  phoneIntervalEndHour: number | null;
  postUrl: string;
  landingTag: string;
  comment: string;
  config: LandingThemeConfig;
}
