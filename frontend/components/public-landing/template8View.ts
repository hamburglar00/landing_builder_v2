/** Pure Builder Template 8 view. No authentication, storage, tracking or API calls. */
import { optimizeTemplate7Images, template8Image, publicImageOriginalUrl } from "../../lib/landing/template7Images";
import { gatewayOriginFor } from "../../lib/reyDeAses/gatewayOrigins";
import { renderGatewayEntryTransition } from "../../lib/gateway-entry-transition";
import { isMultiSkinCode } from "../../lib/multi-skin-catalog";
import { getMultiSkinBrand } from "../../lib/skin-branding";
import type { PublicLandingConfig, PublicLandingPhoneResponse } from "./types";
import { WHATSAPP_GREEN_PATH, WHATSAPP_WHITE_PATH } from "./whatsAppBrandIcon";

type RenderParams = {
  slug: string;
  config: PublicLandingConfig;
  cachedPhone?: PublicLandingPhoneResponse | null;
  canonicalUrl?: string;
  legalBasePath?: string;
  engine?: 'classic' | 'constructor';
};

type ResponsiveImage = {
  mobile?: string;
  tablet?: string;
  desktop?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(name: string, value: unknown) {
  if (value === undefined || value === null || value === false || value === "") return "";
  return ` ${name}="${escapeHtml(value)}"`;
}

function styleAttr(styles: Record<string, string | number | undefined | null | false>) {
  const css = Object.entries(styles)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== "")
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(";");

  return css ? attr("style", css) : "";
}

function buildImageSrcSet(image?: ResponsiveImage) {
  if (!image) return "";

  return [
    image.mobile ? `${image.mobile} 640w` : "",
    image.tablet ? `${image.tablet} 1024w` : "",
    image.desktop ? `${image.desktop} 1600w` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function template7GatewayOrigin(config: PublicLandingConfig): string {
  if (config.layout?.template !== 7 && config.layout?.template !== 9) return "";
  const raw = gatewayOriginFor(config.tracking?.target_provider, config.tracking?.skin_code);
  try {
    const url = new URL(raw || "");
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

function renderWhatsAppIcon(className: string) {
  return `<svg class="${escapeHtml(
    className,
  )}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="#25D366" d="${WHATSAPP_GREEN_PATH}"/><path fill="#FFFFFF" d="${WHATSAPP_WHITE_PATH}"/></svg>`;
}

function template5Lines(value: string | undefined, fallback: string, maxLines: number) {
  const lines = String(value || fallback)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);

  return lines.length > 0 ? lines : fallback.split(/\r?\n/).slice(0, maxLines);
}

function renderTextLines(lines: string[]) {
  return lines
    .map((line, index) => `${escapeHtml(line)}${index < lines.length - 1 ? "<br>" : ""}`)
    .join("");
}

function getResponsiveBackgroundData(config: PublicLandingConfig) {
  const images = config.background?.images || [];
  const responsiveImages = config.background?.imagesResponsive || [];
  const safeImages = images.filter(Boolean);
  const mobileImages = responsiveImages
    .map((image) => image.mobile)
    .filter((image): image is string => Boolean(image));
  const rotationImages = mobileImages.length ? mobileImages : safeImages;
  const interval = Math.max(1, Number(config.background?.rotateEveryHours) || 24) * 3600000;
  const index = rotationImages.length > 1 ? Math.floor(Date.now() / interval) % rotationImages.length : 0;
  const firstResponsiveImage = responsiveImages[index];
  const currentImage = firstResponsiveImage?.mobile || safeImages[index] || "";
  const srcSet = buildImageSrcSet(firstResponsiveImage);

  return {
    currentImage,
    rotationImages,
    srcSet,
    rotateEveryHours: config.background?.rotateEveryHours ?? 24,
    index,
  };
}

function imageFallbackAttributes(source: string) {
  const original = publicImageOriginalUrl(source);
  return source === original ? '' : attr('data-image-fallback', original)
    + ` onerror="this.onerror=null;this.removeAttribute('srcset');this.src=this.dataset.imageFallback"`;
}

function renderFrameBackgroundTemplate7(config: PublicLandingConfig) {
  const { currentImage, rotationImages, srcSet, rotateEveryHours } = getResponsiveBackgroundData(config);
  if (!currentImage) return "";

  const selectedIndex = getResponsiveBackgroundData(config).index;
  const mobile = config.background?.imagesResponsive?.[selectedIndex]?.mobile;
  const variants = (config.background?.imagesResponsive || []).map((image, index) => ({
    srcSet: buildImageSrcSet(image), original: config.background?.imagesOriginal?.[index] || "",
  }));
  return `<picture>${mobile ? `<source data-template7-mobile-background media="(max-width: 640px)" srcset="${escapeHtml(mobile)}">` : ""}<img src="${escapeHtml(currentImage)}"${attr("data-image-fallback", config.background?.imagesOriginal?.[selectedIndex])} onerror="this.onerror=null;this.removeAttribute('srcset');var s=this.parentElement.querySelector('source');if(s)s.remove();if(this.dataset.imageFallback)this.src=this.dataset.imageFallback"${attr(
    "srcset",
    srcSet,
  )} sizes="100vw" alt="" class="template7__background-image"${attr(
    "data-public-landing-rotating-image",
    rotationImages.length > 0 ? "true" : "",
  )}${attr("data-template7-background-variants", variants.length ? JSON.stringify(variants) : "")} data-public-landing-images="${escapeHtml(
    JSON.stringify(rotationImages),
  )}" data-public-landing-rotate-hours="${escapeHtml(
    rotateEveryHours,
  )}" loading="eager" fetchpriority="low" decoding="async" width="1600" height="900"></picture>`;
}

function renderTemplate7({ config }: RenderParams) {
  const code = config.tracking?.skin_code;
  const skinBrand = config.tracking?.target_provider === 'multi_skin' && isMultiSkinCode(code)
    ? getMultiSkinBrand(code) : undefined;
  const hasLogo = Boolean(config.content?.logoUrl);
  const titleLines = (config.content?.title || []).map((line) => line.trim()).filter(Boolean);
  const subtitleLines = (config.content?.subtitle || []).map((line) => line.trim()).filter(Boolean);
  const ctaText = config.content?.ctaText || "Continuar";
  const captureWhatsapp = config.template7Capture?.whatsapp === true;

  return `<main class="public-landing template7">${renderFrameBackgroundTemplate7(config)}<div class="template7__veil"></div><section class="template7__card">${
    hasLogo
      ? `<img src="${escapeHtml(config.content?.logoUrl)}"${attr("srcset", config.content?.logoSrcSet)}${attr("data-image-fallback", config.content?.logoOriginalUrl)} onerror="this.onerror=null;this.removeAttribute('srcset');if(this.dataset.imageFallback)this.src=this.dataset.imageFallback" alt="${escapeHtml(config.name)}" class="template7__logo" width="170" height="138" decoding="async" fetchpriority="high">`
      : ""
  }<h1 class="template7__title"${styleAttr({
    color: config.colors?.title ?? "#FFFFFF",
    "--template7-title-size": `${config.typography?.title?.sizePx ?? 26}px`,
    "font-weight": config.typography?.title?.weight ?? 700,
  })}>${renderTextLines(titleLines)}</h1>${subtitleLines.length ? `<p class="template7__subtitle"${styleAttr({
    color: config.colors?.subtitle ?? "#FFFFFF",
    "--template7-subtitle-size": `${config.typography?.subtitle?.sizePx ?? 16}px`,
    "font-weight": config.typography?.subtitle?.weight ?? 400,
  })}>${renderTextLines(subtitleLines)}</p>` : ""}<form class="template7__form" data-template7-form><label class="template7__label" for="template7-name">Tu nombre</label><input id="template7-name" class="template7__input" data-template7-name type="text" name="firstName" autocomplete="given-name" maxlength="80" required placeholder="Ej.: Martín">${captureWhatsapp ? '<label class="template7__label" for="template7-whatsapp">WhatsApp <span>(opcional)</span></label><input id="template7-whatsapp" class="template7__input" data-template7-whatsapp type="tel" name="phone" autocomplete="tel" inputmode="tel" maxlength="32" placeholder="Ej.: 11 0000-0000"><p class="template7__phone-warning" data-template7-phone-warning role="status" hidden></p>' : ""}<button type="button" class="template7__cta" data-public-landing-cta data-public-landing-rest-label="${escapeHtml(ctaText)}" data-public-landing-loading-label="Abriendo..." data-public-landing-disabled-label="No disponible"${styleAttr({
    color: config.colors?.ctaText ?? "#111111",
    background: config.colors?.ctaBackground ?? "#FFD700",
    "--template7-cta-size": `${config.typography?.cta?.sizePx ?? 18}px`,
    "font-weight": config.typography?.cta?.weight ?? 700,
  })} disabled><span data-public-landing-cta-label>${escapeHtml(ctaText)}</span></button><p class="template7__error" data-template7-error role="alert" hidden></p></form></section></main>${renderGatewayEntryTransition(config.tracking?.target_provider || "rey_de_ases", { stage: "creating", gatewayOrigin: template7GatewayOrigin(config), brand: skinBrand })}`;
}

function renderTemplate6({ config }: RenderParams) {
  const isTemplate8 = config.layout?.template === 8;
  const cover = { ...config.content?.template6, ...(isTemplate8 ? { ...config.content?.template8, showWhatsAppLogo: false } : {}) };
  const backgroundImageUrl = cover?.backgroundImageUrl?.trim() || "";
  const grid = cover?.grid === "2x1" || cover?.grid === "2x3" ? cover.grid : "2x2";
  const cardCount = isTemplate8 ? Math.min(6, Math.max(1, config.content?.template8?.cardCount || 4)) : grid === "2x1" ? 2 : grid === "2x3" ? 6 : 4;
  const title = template5Lines(cover?.headerText, "Elegí tu opción", 2);
  const footer = template5Lines(cover?.footerText, "Estamos para ayudarte", 2);
  const cards = Array.from({ length: cardCount }, (_, index) => {
    const card = cover?.cards?.[index];
    const label = String(card?.ctaText || config.content?.ctaText || "Abrir WhatsApp").trim();
    const image = String(card?.imageUrl || "").trim();
    const responsive = template8Image(image);
    const caption = String(card?.text || `Opción ${index + 1}`).trim();
    return `<article class="template6__card"><div class="template6__image">${
      image
        ? `<img src="${escapeHtml(image)}"${imageFallbackAttributes(image)}${responsive ? attr("srcset", responsive.srcSet) + attr("sizes", responsive.srcSet ? responsive.sizes : "") : ""} alt="${escapeHtml(caption)}" width="480" height="480" loading="${index < 2 ? "eager" : "lazy"}" decoding="async"${index === 0 && !backgroundImageUrl ? ' fetchpriority="high"' : ""}>`
        : `<span>Imagen ${index + 1}</span>`
    }</div><p class="template6__caption">${escapeHtml(caption)}</p><button type="button" class="template6__cta" ${isTemplate8 ? `data-template8-card-index="${index + 1}" ` : "data-public-landing-cta"} data-template6-card-index="${index + 1}" data-public-landing-rest-label="${escapeHtml(label)}" data-public-landing-loading-label="Abriendo..." data-public-landing-disabled-label="Sin número disponible" aria-label="${escapeHtml(label)}"><span data-public-landing-cta-label>${escapeHtml(label)}</span>${cover?.showWhatsAppLogo === false ? "" : renderWhatsAppIcon("template6__cta-icon")}</button></article>`;
  }).join("");
  const styles = styleAttr({
    ...(isTemplate8 ? {
      "--template8-rows": Math.ceil(cardCount / 2),
      "--template8-extra-copy": `${Math.max(0, title.length - 1) * 28 + Math.max(0, footer.length - 1) * 18}px`,
    } : {}),
    "--template6-title": config.colors?.title || "#FFFFFF",
    "--template6-caption": config.colors?.subtitle || "#FFFFFF",
    "--template6-footer": config.colors?.badge || "#FFD700",
    "--template6-cta-text": config.colors?.ctaText || "#000000",
    "--template6-cta-background": config.colors?.ctaBackground || "#FFD700",
    "--template6-cta-glow": config.colors?.ctaGlow || "#FFD700",
    "--template6-cta-size": `${Math.min(22, Math.max(11, config.typography?.cta?.sizePx || 14))}px`,
    "--template6-cta-weight": config.typography?.cta?.weight || 700,
  });
  const backgroundResponsive = template8Image(backgroundImageUrl, true);
  const background = backgroundImageUrl
    ? `<div class="template6__background" aria-hidden="true"><img src="${escapeHtml(backgroundImageUrl)}"${imageFallbackAttributes(backgroundImageUrl)}${backgroundResponsive ? attr("srcset", backgroundResponsive.srcSet) + attr("sizes", backgroundResponsive.srcSet ? backgroundResponsive.sizes : "") : ""} alt="" loading="eager" decoding="async" fetchpriority="high"></div>`
    : "";
  return `<main class="public-landing template6${isTemplate8 ? " template8" : ""}${backgroundImageUrl ? " has-background" : ""}"${styles}>${background}<div class="template6__shell"><header class="template6__header"><h1>${title.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</h1></header><section class="template6__grid" aria-label="Opciones disponibles">${cards}</section><footer class="template6__footer">${footer.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</footer></div></main>`;
}

export function renderTemplate8View(params: RenderParams) {
  const entryConfig = { ...params.config,
    content: params.config.content ? { ...params.config.content, logoUrl: "" } : undefined,
    background: undefined,
  };
  const entry = renderTemplate7({ ...params, config: entryConfig })
    .replace('</form>', '</form><p style="text-align:center;margin-top:16px"><a data-template8-login href="#" style="color:inherit;text-underline-offset:3px">Ya tengo cuenta · Ingresar</a></p>')
    .replace('<h1 class="template7__title"', '<h1 data-template8-selected-page class="template7__title"');
  return `<section data-template8-grid>${renderTemplate6(params)}<p data-template8-status role="status" class="template8__status"></p></section><section data-template8-entry hidden><button type="button" data-template8-back class="template8__back">← Cambiar página</button>${entry}</section>`;
}

export { renderTemplate7 as renderTemplate7View, renderTemplate6 as renderTemplate6View };
