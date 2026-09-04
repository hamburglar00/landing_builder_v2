import { DEFAULT_CONFIG } from "./mocks";
import type {
  LandingLeadCaptureConfig,
  LandingTemplate4ChatConfig,
  LandingTemplate5LiveConfig,
  LandingTemplateVariantConfig,
  LandingThemeConfig,
  TemplateOption,
} from "./types";

function cloneLeadCapture(
  value: LandingLeadCaptureConfig,
): LandingLeadCaptureConfig {
  return {
    ...value,
    fields: { ...value.fields },
  };
}

function cloneTemplate4Chat(
  value: LandingTemplate4ChatConfig | undefined,
): LandingTemplate4ChatConfig | undefined {
  return value ? { ...value } : undefined;
}

function cloneTemplate5Live(
  value: LandingTemplate5LiveConfig | undefined,
): LandingTemplate5LiveConfig | undefined {
  return value ? { ...value } : undefined;
}

export function snapshotTemplateVariant(
  config: LandingThemeConfig,
): LandingTemplateVariantConfig {
  return {
    backgroundMode: config.backgroundMode,
    backgroundImages: [...config.backgroundImages],
    rotateEveryHours: config.rotateEveryHours,
    logoUrl: config.logoUrl,
    titleLine1: config.titleLine1,
    titleLine2: config.titleLine2,
    titleLine3: config.titleLine3,
    subtitleLine1: config.subtitleLine1,
    subtitleLine2: config.subtitleLine2,
    subtitleLine3: config.subtitleLine3,
    footerBadgeLine1: config.footerBadgeLine1,
    footerBadgeLine2: config.footerBadgeLine2,
    footerBadgeLine3: config.footerBadgeLine3,
    ctaText: config.ctaText,
    fontFamily: config.fontFamily,
    titleFontSize: config.titleFontSize,
    subtitleFontSize: config.subtitleFontSize,
    ctaFontSize: config.ctaFontSize,
    badgeFontSize: config.badgeFontSize,
    titleBold: config.titleBold,
    subtitleBold: config.subtitleBold,
    ctaBold: config.ctaBold,
    badgeBold: config.badgeBold,
    ctaPosition: config.ctaPosition,
    titleColor: config.titleColor,
    subtitleColor: config.subtitleColor,
    footerBadgeColor: config.footerBadgeColor,
    ctaTextColor: config.ctaTextColor,
    ctaBackgroundColor: config.ctaBackgroundColor,
    ctaGlowColor: config.ctaGlowColor,
    socialProofEnabled: config.socialProofEnabled,
    interactionsEnabled: config.interactionsEnabled,
    whatsappPrefillText: config.whatsappPrefillText,
    leadCapture: cloneLeadCapture(config.leadCapture),
    template4Chat: cloneTemplate4Chat(config.template4Chat),
    template5Live: cloneTemplate5Live(config.template5Live),
  };
}

function globalConfig(config: LandingThemeConfig) {
  return {
    marketCountry: config.marketCountry,
    sendContactPixel: config.sendContactPixel,
    ctaDestination: config.ctaDestination,
    atrioRedirectUrl: config.atrioRedirectUrl,
    atrioClientId: config.atrioClientId,
    atrioId: config.atrioId,
    atrioSlug: config.atrioSlug,
  } satisfies Partial<LandingThemeConfig>;
}

function withTemplate4Defaults(config: LandingThemeConfig): LandingThemeConfig {
  if (config.template !== "template4") return config;

  return {
    ...config,
    ...(!config.ctaText.trim() || config.ctaText === "Acceder"
      ? { ctaText: "ABRIR WHATSAPP" }
      : {}),
    ...(config.ctaTextColor === "black"
      ? { ctaTextColor: "white" as const }
      : {}),
    ...(config.ctaBackgroundColor === "gold"
      ? { ctaBackgroundColor: "whatsapp_green" as const }
      : {}),
  };
}

export function withCurrentTemplateSnapshot(
  config: LandingThemeConfig,
): LandingThemeConfig {
  return {
    ...config,
    templateConfigs: {
      ...(config.templateConfigs ?? {}),
      [config.template]: snapshotTemplateVariant(config),
    },
  };
}

export function switchLandingTemplate(
  config: LandingThemeConfig,
  nextTemplate: TemplateOption,
): LandingThemeConfig {
  if (config.template === nextTemplate) {
    return withCurrentTemplateSnapshot(config);
  }

  const withCurrentSnapshot = withCurrentTemplateSnapshot(config);
  const savedNextVariant = withCurrentSnapshot.templateConfigs?.[nextTemplate];
  const nextConfig: LandingThemeConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    ...(savedNextVariant ?? {}),
    ...globalConfig(config),
    template: nextTemplate,
    templateConfigs: withCurrentSnapshot.templateConfigs,
  };

  return withTemplate4Defaults(nextConfig);
}
