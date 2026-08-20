import type { LandingThemeConfig, LandingWorkspaceCurrency } from "./types";
import { COLOR_MAP } from "./constants";
import { buildOptimizedImageUrl, buildResponsiveImageSet } from "./imageUrl";

function phoneCountryCodeForWorkspace(
  workspaceCurrency: LandingWorkspaceCurrency,
): "54" | "595" {
  return workspaceCurrency === "PYG" ? "595" : "54";
}

function templateNumberForOption(template: LandingThemeConfig["template"]) {
  if (template === "template2") return 2;
  if (template === "template3") return 3;
  if (template === "template4") return 4;
  if (template === "template5") return 5;
  return 1;
}

function isFixedVisualTemplate(template: LandingThemeConfig["template"]) {
  return template === "template4" || template === "template5";
}

export interface LandingConfigPayload {
  schemaVersion: number;
  updatedAt: string;
  id: string;
  name: string;
  comment: string;
  workspaceCurrency?: LandingWorkspaceCurrency;
  tracking: {
    pixelId: string;
    postUrl: string;
    landingTag: string;
    sendContactPixel: boolean;
    ctaDestination?: "whatsapp" | "atrio";
    atrioRedirectUrl?: string;
    atrioClientId?: string;
    atrioId?: string;
    atrioSlug?: string;
    phoneCountryCode?: string;
    currency?: LandingWorkspaceCurrency;
    workspaceCurrency?: LandingWorkspaceCurrency;
  };
  background?: {
    mode: LandingThemeConfig["backgroundMode"];
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
    title: [string, string, string];
    subtitle: [string, string, string];
    footerBadge: [string, string, string];
    ctaText: string;
    template4?: {
      profileImageUrl: string;
      bubble1Text: string;
      bubble2Intro: string;
      bubble2Items: string[];
      bubble3Text: string;
    };
  };
  typography?: {
    fontFamily: LandingThemeConfig["fontFamily"];
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
  phoneSelection?: {
    mode: "random" | "fair";
  };
  layout: {
    ctaPosition?: LandingThemeConfig["ctaPosition"];
    template: number;
  };
  socialProof?: {
    enabled: boolean;
  };
  interactions?: {
    enabled: boolean;
    whatsappPrefillText: string;
  };
  leadCapture?: {
    enabled: boolean;
    title: string;
    description: string;
    fields: {
      firstName: boolean;
      lastName: boolean;
      phone: boolean;
      email: boolean;
    };
  };
}

interface BuildArgs {
  id: string;
  name: string;
  comment: string;
  workspaceCurrency?: LandingWorkspaceCurrency;
  pixelId: string;
  postUrl: string;
  landingTag: string;
  config: LandingThemeConfig;
  phoneMode?: "random" | "fair";
  updatedAt?: string;
}

export function buildLandingConfig({
  id,
  name,
  comment,
  workspaceCurrency = "ARS",
  pixelId,
  postUrl,
  landingTag,
  config,
  phoneMode,
  updatedAt,
}: BuildArgs): LandingConfigPayload {
  const phoneCountryCode = phoneCountryCodeForWorkspace(workspaceCurrency);

  if (config.template === "template3") {
    return {
      schemaVersion: 1,
      updatedAt: updatedAt ?? new Date().toISOString(),
      id,
      name,
      comment,
      workspaceCurrency,
      tracking: {
        pixelId,
        postUrl,
        landingTag,
        sendContactPixel: config.sendContactPixel,
        ctaDestination: config.ctaDestination === "atrio" ? "atrio" : "whatsapp",
        atrioRedirectUrl: config.atrioRedirectUrl.trim(),
        atrioClientId: (config.atrioClientId ?? "").trim(),
        atrioId: (config.atrioId ?? "").trim(),
        atrioSlug: (config.atrioSlug ?? "").trim(),
        phoneCountryCode,
        currency: workspaceCurrency,
        workspaceCurrency,
      },
      layout: {
        template: templateNumberForOption(config.template),
      },
      socialProof: {
        enabled: config.socialProofEnabled,
      },
      interactions: {
        enabled: config.interactionsEnabled,
        whatsappPrefillText: config.whatsappPrefillText.trim(),
      },
      leadCapture: {
        enabled: config.leadCapture?.enabled === true,
        title: config.leadCapture?.title?.trim() || "",
        description: config.leadCapture?.description?.trim() || "",
        fields: {
          firstName: config.leadCapture?.fields?.firstName === true,
          lastName: config.leadCapture?.fields?.lastName === true,
          phone: config.leadCapture?.fields?.phone === true,
          email: config.leadCapture?.fields?.email === true,
        },
      },
    };
  }

  const themeWithHex = {
    ...config,
    titleColor: COLOR_MAP[config.titleColor],
    subtitleColor: COLOR_MAP[config.subtitleColor],
    footerBadgeColor: COLOR_MAP[config.footerBadgeColor],
    ctaTextColor: COLOR_MAP[config.ctaTextColor],
    ctaBackgroundColor: COLOR_MAP[config.ctaBackgroundColor],
    ctaGlowColor: COLOR_MAP[config.ctaGlowColor],
  };
  const fixedVisualTemplate = isFixedVisualTemplate(themeWithHex.template);
  const isTemplate4 = themeWithHex.template === "template4";
  const effectiveCtaText =
    isTemplate4 && (!themeWithHex.ctaText.trim() || themeWithHex.ctaText === "Acceder")
      ? "ABRIR WHATSAPP"
      : themeWithHex.ctaText;
  const effectiveCtaTextColor =
    isTemplate4 && themeWithHex.ctaTextColor === "#000000"
      ? "#FFFFFF"
      : themeWithHex.ctaTextColor;
  const effectiveCtaBackgroundColor =
    isTemplate4 && themeWithHex.ctaBackgroundColor === "#FFD700"
      ? "#25D366"
      : themeWithHex.ctaBackgroundColor;

  return {
    schemaVersion: 1,
    updatedAt: updatedAt ?? new Date().toISOString(),
    id,
    name,
    comment,
    workspaceCurrency,
    tracking: {
      pixelId,
      postUrl,
      landingTag,
      sendContactPixel: config.sendContactPixel,
      ctaDestination: config.ctaDestination === "atrio" ? "atrio" : "whatsapp",
      atrioRedirectUrl: config.atrioRedirectUrl.trim(),
      atrioClientId: (config.atrioClientId ?? "").trim(),
      atrioId: (config.atrioId ?? "").trim(),
      atrioSlug: (config.atrioSlug ?? "").trim(),
      phoneCountryCode,
      currency: workspaceCurrency,
      workspaceCurrency,
    },
    background: {
      mode: themeWithHex.backgroundMode,
      images: themeWithHex.backgroundImages.map((url) =>
        buildOptimizedImageUrl(url, { width: 1280, quality: 65 }),
      ),
      imagesResponsive: themeWithHex.backgroundImages.map((url) =>
        buildResponsiveImageSet(url),
      ),
      rotateEveryHours: themeWithHex.rotateEveryHours,
    },
    content: {
      logoUrl: themeWithHex.logoUrl,
      title: [
        themeWithHex.titleLine1,
        themeWithHex.titleLine2,
        themeWithHex.titleLine3,
      ],
      subtitle: [
        themeWithHex.subtitleLine1,
        themeWithHex.subtitleLine2,
        themeWithHex.subtitleLine3,
      ],
      footerBadge: [
        themeWithHex.footerBadgeLine1,
        themeWithHex.footerBadgeLine2,
        themeWithHex.footerBadgeLine3,
      ],
      ctaText: effectiveCtaText,
      template4: {
        profileImageUrl: themeWithHex.template4Chat?.profileImageUrl || "",
        bubble1Text:
          themeWithHex.template4Chat?.bubble1Text ||
          "Hola, soy {{name}}, enviame un mensaje y comenzamos ya mismo.",
        bubble2Intro:
          themeWithHex.template4Chat?.bubble2Intro ||
          "Te acompano en todo el proceso",
        bubble2Items: [
          themeWithHex.template4Chat?.bubble2Item1 ||
            "💸 Cargas y retiros las 24hs",
          themeWithHex.template4Chat?.bubble2Item2 ||
            "👤 Atencion personalizada",
          themeWithHex.template4Chat?.bubble2Item3 ||
            "🛡️ Respaldo y mas de 5 anos de experiencia",
        ].filter((item) => item.trim().length > 0),
        bubble3Text:
          themeWithHex.template4Chat?.bubble3Text ||
          "Arrancamos? Toca abajo y comenzamos",
      },
    },
    typography: {
      fontFamily: "system",
      title: {
        sizePx: themeWithHex.titleFontSize,
        weight: themeWithHex.titleBold ? 700 : 500,
      },
      subtitle: {
        sizePx: themeWithHex.subtitleFontSize,
        weight: themeWithHex.subtitleBold ? 600 : 400,
      },
      cta: {
        sizePx: themeWithHex.ctaFontSize,
        weight: themeWithHex.ctaBold ? 700 : 500,
      },
      badge: {
        sizePx: themeWithHex.badgeFontSize,
        weight: themeWithHex.badgeBold ? 700 : 400,
      },
    },
    colors: {
      title: themeWithHex.titleColor,
      subtitle: themeWithHex.subtitleColor,
      badge: themeWithHex.footerBadgeColor,
      ctaText: effectiveCtaTextColor,
      ctaBackground: effectiveCtaBackgroundColor,
      ctaGlow: themeWithHex.ctaGlowColor,
    },
    ...(phoneMode && {
      phoneSelection: {
        mode: phoneMode,
      } as const,
    }),
    layout: {
      ctaPosition: themeWithHex.ctaPosition,
      template: templateNumberForOption(themeWithHex.template),
    },
    socialProof: {
      enabled: themeWithHex.socialProofEnabled,
    },
    interactions: {
      enabled: fixedVisualTemplate ? false : themeWithHex.interactionsEnabled,
      whatsappPrefillText: fixedVisualTemplate
        ? ""
        : themeWithHex.whatsappPrefillText.trim(),
    },
    leadCapture: {
      enabled: fixedVisualTemplate ? false : themeWithHex.leadCapture?.enabled === true,
      title: themeWithHex.leadCapture?.title?.trim() || "",
      description: themeWithHex.leadCapture?.description?.trim() || "",
      fields: {
        firstName: themeWithHex.leadCapture?.fields?.firstName === true,
        lastName: themeWithHex.leadCapture?.fields?.lastName === true,
        phone: themeWithHex.leadCapture?.fields?.phone === true,
        email: themeWithHex.leadCapture?.fields?.email === true,
      },
    },
  };
}

