import { getMultiSkinBrand } from "../skin-branding";
import { isMultiSkinCode } from "../multi-skin-catalog";

export const TEMPLATE9_DEFAULTS = {
  titleLine1: "Creá tu cuenta gratis", titleLine2: "", titleLine3: "",
  subtitleLine1: "Estamos Online 24hs!", subtitleLine2: "", subtitleLine3: "",
  ctaText: "CREAR MI CUENTA · +18",
} as const;

export type Template9Brand = { name: string; logo: string; primary: string; secondary: string; highlight: string; deep: string; neutralSurface?: boolean };
const violet = { primary: "#7c34e8", secondary: "#b02cf0", highlight: "#e6a3ff", deep: "#0d0618" };
const providers: Record<string, Template9Brand> = {
  rey_de_ases: { name: "Rey de Ases", logo: "/public-assets/template9/rey_de_ases_logo.webp", primary: "#c49a32", secondary: "#efd27b", highlight: "#fff0b8", deep: "#080808", neutralSurface: true },
  ases_del_norte: { name: "Ases del Norte", logo: "/public-assets/template9/ases_del_norte_logo.webp", primary: "#36a8eb", secondary: "#36a8eb", highlight: "#cbeaff", deep: "#071b2c" },
  ganamos_net: { name: "Ganamos NET", logo: "/public-assets/template9/ganamos_net_logo.webp", ...violet },
  multi_skin: { name: "Ganamos+", logo: "/public-assets/template9/ganamos_plus_logo.webp", ...violet },
};

/** Presentation only. The saved provider/skin remains the authority for entry. */
export function getTemplate9Brand(provider: string, skin?: unknown): Template9Brand {
  if (provider === "multi_skin" && isMultiSkinCode(skin) && skin !== "ganamos_plus") {
    const brand = getMultiSkinBrand(skin);
    return { name: brand.name, logo: `/public-assets/template9/${skin}_logo.webp`, primary: brand.primary, secondary: brand.secondary, highlight: brand.secondary, deep: brand.background };
  }
  return providers[provider] || providers.rey_de_ases;
}

export function template9Style(brand: Template9Brand) {
  const reference = brand.primary === violet.primary
    ? ";--t9-card-top:rgba(30,16,54,.92);--t9-card-bottom:rgba(18,9,34,.94);--t9-background-mid:#2a0a4a;--t9-background-low:#150829;--t9-surface:#1a0e2e" : "";
  const neutral = brand.neutralSurface
    ? ";--t9-card-top:#1b1b1b;--t9-card-bottom:#101010;--t9-background-glow:#171717;--t9-overlay-glow:#ffffff05;--t9-background-mid:#111111;--t9-background-low:#0c0c0c;--t9-surface:#171717;--t9-input:#090909;--t9-muted:#a6a6a6;--t9-placeholder:#858585;--t9-link:#d0d0d0;--t9-subtitle:#d5d5d5;--t9-cta-foreground:#121212" : "";
  const north = brand.primary === providers.ases_del_norte.primary
    ? ";--t9-card-top:#0d2132;--t9-card-bottom:#0d2132;--t9-background-glow:transparent;--t9-overlay-glow:transparent;--t9-background-mid:#071b2c;--t9-background-low:#071b2c;--t9-surface:#0d2132;--t9-input:#051420;--t9-muted:#a4bacd;--t9-placeholder:#91a5b6;--t9-link:#b9d9ee;--t9-subtitle:#c2c2cc;--t9-cta-foreground:#08080b" : "";
  return `--t9-primary:${brand.primary};--t9-secondary:${brand.secondary};--t9-highlight:${brand.highlight};--t9-deep:${brand.deep}${reference}${neutral}${north}`;
}
