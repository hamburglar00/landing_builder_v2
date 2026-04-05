import type { LandingThemeConfig } from "./types";
import { COLOR_MAP } from "./constants";

export interface LandingConfigPayload {
  schemaVersion: number;
  updatedAt: string;
  id: string;
  name: string;
  comment: string;
  tracking: {
    pixelId: string;
    postUrl: string;
    landingTag: string;
    sendContactPixel: boolean;
  };
  background?: {
    mode: LandingThemeConfig["backgroundMode"];
    images: string[];
    rotateEveryHours: number;
  };
  content?: {
    logoUrl: string;
    title: [string, string, string];
    subtitle: [string, string, string];
    footerBadge: [string, string, string];
    ctaText: string;
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
}

interface BuildArgs {
  id: string;
  name: string;
  comment: string;
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
  pixelId,
  postUrl,
  landingTag,
  config,
  phoneMode,
  updatedAt,
}: BuildArgs): LandingConfigPayload {
  if (config.template === "template3") {
    return {
      schemaVersion: 1,
      updatedAt: updatedAt ?? new Date().toISOString(),
      id,
      name,
      comment,
      tracking: {
        pixelId,
        postUrl,
        landingTag,
        sendContactPixel: config.sendContactPixel,
      },
      layout: {
        template: 3,
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

  return {
    schemaVersion: 1,
    updatedAt: updatedAt ?? new Date().toISOString(),
    id,
    name,
    comment,
    tracking: {
      pixelId,
      postUrl,
      landingTag,
      sendContactPixel: config.sendContactPixel,
    },
    background: {
      mode: themeWithHex.backgroundMode,
      images: themeWithHex.backgroundImages,
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
      ctaText: themeWithHex.ctaText,
    },
    typography: {
      fontFamily: themeWithHex.fontFamily,
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
      ctaText: themeWithHex.ctaTextColor,
      ctaBackground: themeWithHex.ctaBackgroundColor,
      ctaGlow: themeWithHex.ctaGlowColor,
    },
    ...(phoneMode && {
      phoneSelection: {
        mode: phoneMode,
      } as const,
    }),
    layout: {
      ctaPosition: themeWithHex.ctaPosition,
      template:
        themeWithHex.template === "template2"
          ? 2
          : themeWithHex.template === "template3"
            ? 3
            : 1,
    },
  };
}

