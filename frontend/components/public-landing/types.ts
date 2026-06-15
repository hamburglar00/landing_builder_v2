export type PublicLandingConfig = {
  schemaVersion: number;
  updatedAt: string;
  id: string;
  name: string;
  comment: string;
  tracking: {
    pixelId: string;
    postUrl: string;
    landingTag: string;
    sendContactPixel?: boolean;
  };
  phoneSelection?: {
    mode: "random" | "fixed" | "fair" | string;
  };
  background?: {
    mode: "single" | "rotating";
    images: string[];
    imagesResponsive?: Array<{
      mobile: string;
      tablet: string;
      desktop: string;
    }>;
    rotateEveryHours: number;
  };
  content?: {
    logoUrl: string;
    title: string[];
    subtitle: string[];
    footerBadgeText?: string;
    footerBadge?: string[];
    ctaText: string;
  };
  typography?: {
    fontFamily: "system" | string;
    title: { sizePx: number; weight: number };
    subtitle: { sizePx: number; weight: number };
    cta: { sizePx: number; weight: number };
    badge: { sizePx: number; weight: number };
  };
  colors?: {
    title: string;
    subtitle: string;
    badge: string;
    ctaText: string;
    ctaBackground: string;
    ctaGlow: string;
  };
  socialProof?: {
    enabled?: boolean;
  };
  interactions?: {
    enabled?: boolean;
    whatsappPrefillText?: string;
  };
  layout: {
    ctaPosition:
      | "top"
      | "between_title_and_info"
      | "between_info_and_badge"
      | "bottom"
      | "below_info"
      | string;
    template?: number;
  };
};

export type PublicLandingPhoneResponse = {
  phone: string;
  landingId: string;
  landingName: string;
  cacheRefreshedAt?: string;
  cacheSource?: string;
  phoneId?: number;
  phoneMode: string;
  fairCriterion?: string;
  phoneKind: string;
  phoneSelection?: {
    mode?: string;
    criterion?: string;
  };
  gerenciaSelection?: {
    mode?: string;
    criterion?: string;
  };
  gerencia?: {
    id: number;
    externalId: number;
    weight: number;
  };
};
