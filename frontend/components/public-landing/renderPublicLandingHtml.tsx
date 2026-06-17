import PhonePrewarmScript from "./PhonePrewarmScript";
import PublicLandingRuntimeScript from "./PublicLandingRuntimeScript";
import { PUBLIC_LANDING_CSS } from "./publicLandingCss";
import { resolveFontFamily } from "./resolveFontFamily";
import type { PublicLandingConfig, PublicLandingPhoneResponse } from "./types";

type RenderParams = {
  slug: string;
  config: PublicLandingConfig;
  cachedPhone?: PublicLandingPhoneResponse | null;
};

type ResponsiveImage = {
  mobile?: string;
  tablet?: string;
  desktop?: string;
};

type ScriptElement = {
  props?: {
    dangerouslySetInnerHTML?: {
      __html?: string;
    };
  };
};

const SOCIAL_PROOF_ITEMS = [
  { quote: "Muy buena atencion. Me respondieron rapido y sin vueltas.", name: "Nico R." },
  { quote: "Excelente servicio, todo claro desde el primer mensaje.", name: "Juan P." },
  { quote: "Siempre responden rapido y con muy buena predisposicion.", name: "Mica F." },
  { quote: "Atencion super amable. Me resolvieron todo en minutos.", name: "Seba L." },
  { quote: "Me ayudaron en todo el proceso, muy claros y confiables.", name: "Romi D." },
  { quote: "Atencion impecable. Responden al toque por WhatsApp.", name: "Lau T." },
  { quote: "Servicio muy confiable, siempre cumplen con lo que dicen.", name: "Dario C." },
  { quote: "Todo simple, rapido y bien explicado. Recomiendo.", name: "Cami V." },
  { quote: "Muy buena experiencia. La atencion fue rapida y cordial.", name: "Pablo M." },
  { quote: "Excelente trato, buena onda y respuesta inmediata.", name: "Gise A." },
];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    switch (character) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return character;
    }
  });
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

function renderScriptElement(element: unknown) {
  const script = (element as ScriptElement | null)?.props?.dangerouslySetInnerHTML?.__html;
  return script ? `<script>${script}</script>` : "";
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

function buildPreloadLinks(config: PublicLandingConfig) {
  const firstResponsiveBackground = config.background?.imagesResponsive?.[0];
  const firstBackground =
    firstResponsiveBackground?.mobile || config.background?.images?.[0] || "";
  const firstBackgroundSrcSet = buildImageSrcSet(firstResponsiveBackground);
  const firstBackgroundSizes =
    config.layout?.template === 2 ? "(max-width: 430px) 100vw, 430px" : "100vw";
  const logoUrl = config.content?.logoUrl || "";

  return [
    firstBackground
      ? `<link rel="preload" as="image" href="${escapeHtml(firstBackground)}"${
          firstBackgroundSrcSet
            ? ` imagesrcset="${escapeHtml(firstBackgroundSrcSet)}" imagesizes="${escapeHtml(firstBackgroundSizes)}"`
            : ""
        } fetchpriority="high">`
      : "",
    logoUrl ? `<link rel="preload" as="image" href="${escapeHtml(logoUrl)}" fetchpriority="high">` : "",
  ]
    .filter(Boolean)
    .join("");
}

function renderWhatsAppIcon(className: string) {
  return `<svg class="${escapeHtml(
    className,
  )}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.04 2.5a9.3 9.3 0 0 0-8.05 13.96L3 21l4.64-1.2a9.3 9.3 0 1 0 4.4-17.3Zm0 1.72a7.58 7.58 0 1 1-3.78 14.15l-.33-.2-2.75.72.74-2.68-.22-.35a7.58 7.58 0 0 1 6.34-11.64Zm-3.3 3.75c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15 0 1.27.93 2.5 1.06 2.67.13.17 1.8 2.87 4.5 3.9 2.24.88 2.7.7 3.18.66.49-.05 1.57-.64 1.8-1.26.22-.62.22-1.15.15-1.26-.07-.12-.25-.18-.53-.32-.28-.14-1.66-.82-1.92-.91-.26-.1-.45-.14-.64.14-.19.28-.73.91-.9 1.1-.16.18-.33.2-.61.07-.28-.14-1.18-.43-2.24-1.38-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.49.14-.16.19-.28.28-.47.1-.18.05-.35-.02-.49-.07-.14-.63-1.54-.88-2.1-.23-.54-.47-.46-.64-.47h-.55Z"/></svg>`;
}

function buildPixelInitScript(pixelId: string) {
  const safePixelId = pixelId.replace(/\D+/g, "");
  if (!safePixelId) return "";

  return `<script>
    (function () {
      !function(f,b,e,v,n,t,s){
        if(f.fbq) return;
        n=f.fbq=function(){
          n.callMethod
            ? n.callMethod.apply(n, arguments)
            : n.queue.push(arguments);
        };
        if(!f._fbq) f._fbq=n;
        n.push=n;
        n.loaded=!0;
        n.version='2.0';
        n.queue=[];
        t=b.createElement(e);
        t.async=!0;
        t.src=v;
        s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      try {
        var params = new URLSearchParams(window.location.search);

        function readMeta(key){
          try {
            return window.__META && window.__META[key] ? window.__META[key] : '';
          } catch (e) {
            return '';
          }
        }

        function readLocalStorage(key){
          try {
            return localStorage.getItem(key) || '';
          } catch (e) {
            return '';
          }
        }

        function firstNonEmpty(values){
          for (var i = 0; i < values.length; i += 1) {
            var value = values[i];
            if (value != null) {
              var text = String(value).trim();
              if (text) return text;
            }
          }
          return '';
        }

        function normEmail(v){
          v = (v || '').trim().toLowerCase();
          return v || undefined;
        }

        function normPhone(v){
          var d = String(v || '').replace(/\\D+/g, '');
          if (!d) return undefined;
          if (d.indexOf('54') === 0) return d;
          d = d.replace(/^0+/, '').replace(/^15/, '');
          if (d.length === 10) return '54' + d;
          return d || undefined;
        }

        function safeUUID(){
          if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
          }
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }

        function getOrCreateExternalId(){
          try {
            var existing = localStorage.getItem('external_id');
            if (existing) return existing;
            var created = safeUUID();
            localStorage.setItem('external_id', created);
            return created;
          } catch (e) {
            return safeUUID();
          }
        }

        var userEmail = normEmail(firstNonEmpty([
          params.get('email'),
          params.get('em'),
          readLocalStorage('em'),
          readMeta('userEmail')
        ]));

        var userPhone = normPhone(firstNonEmpty([
          params.get('phone'),
          params.get('ph'),
          readLocalStorage('ph'),
          readMeta('userPhone')
        ]));

        var userFn = firstNonEmpty([
          params.get('fn'),
          readMeta('userFn')
        ]) || undefined;

        var userLn = firstNonEmpty([
          params.get('ln'),
          readMeta('userLn')
        ]) || undefined;

        var externalId =
          firstNonEmpty([readMeta('externalId'), readLocalStorage('external_id')]) ||
          getOrCreateExternalId();

        try {
          localStorage.setItem('external_id', externalId);
        } catch (e) {}

        try {
          if (userEmail) localStorage.setItem('em', userEmail);
          if (userPhone) localStorage.setItem('ph', userPhone);
        } catch (e) {}

        fbq('init', ${escapeScriptJson(safePixelId)}, {
          em: userEmail,
          ph: userPhone,
          fn: userFn,
          ln: userLn,
          external_id: externalId
        });

        fbq('track', 'PageView');

        window.__META = {
          PIXEL_ID: ${escapeScriptJson(safePixelId)},
          userEmail: userEmail,
          userPhone: userPhone,
          userFn: userFn,
          userLn: userLn,
          externalId: externalId,
          safeUUID: safeUUID
        };
      } catch (e) {
        console.error('Meta Pixel init error', e);
      }
    })();
  </script>`;
}

function buildPixelNoscript(pixelId: string) {
  const safePixelId = pixelId.replace(/\D+/g, "");
  if (!safePixelId) return "";

  return `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${escapeHtml(
    safePixelId,
  )}&amp;ev=PageView&amp;noscript=1" alt=""></noscript>`;
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
  const firstResponsiveImage = responsiveImages[0];
  const currentImage = firstResponsiveImage?.mobile || safeImages[0] || "";
  const srcSet = buildImageSrcSet(firstResponsiveImage);

  return {
    currentImage,
    rotationImages,
    srcSet,
    rotateEveryHours: config.background?.rotateEveryHours ?? 24,
  };
}

function renderRotatingBackground(config: PublicLandingConfig, overlay = true) {
  const { currentImage, rotationImages, srcSet, rotateEveryHours } = getResponsiveBackgroundData(config);

  if (currentImage) {
    return `<img src="${escapeHtml(currentImage)}"${attr("srcset", srcSet)} sizes="100vw" alt="" class="background-layer background-layer__image" data-public-landing-rotating-image="true" data-public-landing-images="${escapeHtml(
      JSON.stringify(rotationImages),
    )}" data-public-landing-rotate-hours="${escapeHtml(rotateEveryHours)}" loading="eager" fetchpriority="high" decoding="async" width="1080" height="1920">${
      overlay ? '<div class="overlay"></div>' : ""
    }`;
  }

  return `<div class="background-layer">${overlay ? '<div class="overlay"></div>' : ""}</div>`;
}

function renderFrameBackgroundTemplate2(config: PublicLandingConfig) {
  const { currentImage, rotationImages, srcSet, rotateEveryHours } = getResponsiveBackgroundData(config);
  if (!currentImage) return "";

  return `<img src="${escapeHtml(currentImage)}"${attr(
    "srcset",
    srcSet,
  )} sizes="(max-width: 430px) 100vw, 430px" alt="" class="frame__bg"${attr(
    "data-public-landing-rotating-image",
    rotationImages.length > 0 ? "true" : "",
  )} data-public-landing-images="${escapeHtml(
    JSON.stringify(rotationImages),
  )}" data-public-landing-rotate-hours="${escapeHtml(
    rotateEveryHours,
  )}" loading="eager" fetchpriority="high" decoding="async" width="430" height="780">`;
}

function renderWhatsAppButton(
  config: PublicLandingConfig,
  templateVariant: "default" | "template2" | "template3" = "default",
  options: { autoStart?: boolean; hideButton?: boolean } = {},
) {
  const ctaText = config.content?.ctaText || "¡Contactar ya!";
  const isTemplate2Like =
    templateVariant === "template2" ||
    templateVariant === "template3";
  const buttonClass = isTemplate2Like ? "cta" : "whatsapp-button";
  const iconClass = isTemplate2Like ? "cta__icon" : "whatsapp-icon";
  const buttonStyle = {
    color: config.colors?.ctaText ?? "#FFFFFF",
    background: config.colors?.ctaBackground ?? "#25D366",
    "font-size": `${config.typography?.cta?.sizePx ?? 18}px`,
    "font-weight": config.typography?.cta?.weight ?? 700,
    display: options.hideButton ? "none" : undefined,
    "box-shadow": isTemplate2Like ? undefined : `0 0 30px 8px ${config.colors?.ctaGlow ?? "#FFD700"}`,
  };

  return `<button type="button" class="${buttonClass}"${styleAttr(buttonStyle)} data-public-landing-cta${attr(
    "data-public-landing-auto-start",
    options.autoStart ? "true" : "",
  )} aria-label="${escapeHtml(ctaText)}"><span${
    isTemplate2Like ? ' class="cta__fill"' : ""
  } data-public-landing-cta-label>${escapeHtml(ctaText)}</span>${
    options.hideButton
      ? ""
      : renderWhatsAppIcon(iconClass)
  }</button>`;
}

function normalizeCtaPosition(config: PublicLandingConfig) {
  const rawPosition = config.layout?.ctaPosition ?? "between_title_and_info";
  const value = rawPosition === "below_info" ? "between_info_and_badge" : rawPosition;
  const allowed = ["top", "between_title_and_info", "between_info_and_badge", "bottom"];
  return allowed.includes(value) ? value : "between_title_and_info";
}

function renderTemplate1({ config }: RenderParams) {
  const hasLogo = Boolean(config.content?.logoUrl);
  const titleLines = config.content?.title || [];
  const subtitleLines = config.content?.subtitle || [];
  const badgeText = config.content?.footerBadgeText || "";
  const ctaPosition = normalizeCtaPosition(config);
  const fontFamily = resolveFontFamily(config.typography?.fontFamily);
  const isBottomCta = ctaPosition === "bottom";

  return `<main class="public-landing landing-shell"><section class="container background-image${
    isBottomCta ? " template1-bottom-layout" : ""
  }">${renderRotatingBackground(
    config,
    false,
  )}<div class="content"${styleAttr({ "font-family": fontFamily })}>${
    hasLogo
      ? `<img src="${escapeHtml(config.content?.logoUrl)}" class="logo" alt="${escapeHtml(
          config.name,
        )}" decoding="async" fetchpriority="high" width="200" height="150" data-public-landing-trigger style="cursor:pointer">`
      : ""
  }${ctaPosition === "top" ? renderWhatsAppButton(config) : ""}<p class="title" data-public-landing-trigger${styleAttr(
    {
      color: config.colors?.title ?? "#FFFFFF",
      "font-size": `${config.typography?.title?.sizePx ?? 26}px`,
      "font-weight": config.typography?.title?.weight ?? 700,
      cursor: "pointer",
    },
  )}>${renderTextLines(titleLines)}</p>${
    ctaPosition === "between_title_and_info" ? renderWhatsAppButton(config) : ""
  }<p class="subtitle" data-public-landing-trigger${styleAttr({
    color: config.colors?.subtitle ?? "#FFFFFF",
    "font-size": `${config.typography?.subtitle?.sizePx ?? 16}px`,
    "font-weight": config.typography?.subtitle?.weight ?? 400,
    cursor: "pointer",
  })}>${renderTextLines(subtitleLines)}</p>${
    ctaPosition === "between_info_and_badge" ? renderWhatsAppButton(config) : ""
  }${
    badgeText
      ? `<p class="description" data-public-landing-trigger${styleAttr({
          color: config.colors?.badge ?? "#FFD700",
          "font-size": `${config.typography?.badge?.sizePx ?? 16}px`,
          "font-weight": config.typography?.badge?.weight ?? 700,
          cursor: "pointer",
        })}>-${escapeHtml(badgeText)}-</p>`
      : ""
  }</div>${
    isBottomCta
      ? `<div class="template1-bottom-cta-slot">${renderWhatsAppButton(config)}</div>`
      : ""
  }</section></main>`;
}

function renderTemplate2({ config }: RenderParams) {
  const hasLogo = Boolean(config.content?.logoUrl);
  const titleLines = config.content?.title || [];
  const subtitleLines = config.content?.subtitle || [];
  const badgeArray = config.content?.footerBadge || [];
  const badgeText =
    (badgeArray.find((line) => line && line.trim().length > 0) || config.content?.footerBadgeText || "").trim();
  const fontFamily = resolveFontFamily(config.typography?.fontFamily);
  const isSocialProofEnabled = config.socialProof?.enabled !== false;
  const activeSocialProof = SOCIAL_PROOF_ITEMS[0];

  return `<main class="public-landing lp"><section class="phone-view"><div class="artboard"${styleAttr({
    "font-family": fontFamily,
  })}><div class="frame">${renderFrameBackgroundTemplate2(config)}${
    hasLogo
      ? `<img src="${escapeHtml(config.content?.logoUrl)}" alt="${escapeHtml(
          config.name,
        )}" class="frame__logo" decoding="async" fetchpriority="high" width="220" height="160" data-public-landing-trigger style="cursor:pointer">`
      : ""
  }<div class="frame__copy">${
    badgeText
      ? `<p class="eyebrow"${styleAttr({
          color: config.colors?.badge ?? "#FFD700",
          "font-size": `${config.typography?.badge?.sizePx ?? 16}px`,
          "font-weight": config.typography?.badge?.weight ?? 700,
          cursor: "pointer",
        })} data-public-landing-trigger>${escapeHtml(badgeText)}</p>`
      : ""
  }<h1 class="title"${styleAttr({
    color: config.colors?.title ?? "#FFFFFF",
    "font-size": `${config.typography?.title?.sizePx ?? 26}px`,
    "font-weight": config.typography?.title?.weight ?? 700,
    cursor: "pointer",
  })} data-public-landing-trigger>${renderTextLines(titleLines)}</h1></div></div>${renderWhatsAppButton(
    config,
    "template2",
  )}${
    isSocialProofEnabled
      ? `<section class="social-proof" aria-label="Prueba social" data-public-landing-social-proof data-public-landing-trigger style="cursor:pointer"><p class="social-proof__quote" data-public-landing-social-quote>&quot;${escapeHtml(
          activeSocialProof.quote,
        )}&quot;</p><p class="social-proof__meta" data-public-landing-social-meta>${escapeHtml(
          activeSocialProof.name,
        )} <span aria-hidden="true">-</span> <span class="social-proof__stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span></p><div class="social-proof__progress" data-public-landing-social-progress aria-hidden="true"></div></section>`
      : ""
  }<div class="features" data-public-landing-trigger style="cursor:pointer">${subtitleLines
    .map(
      (line) =>
        `<p${styleAttr({
          color: config.colors?.subtitle ?? "#FFFFFF",
          "font-size": `${config.typography?.subtitle?.sizePx ?? 16}px`,
          "font-weight": config.typography?.subtitle?.weight ?? 400,
        })}>${escapeHtml(line)}</p>`,
    )
    .join("")}</div></div></section></main>`;
}

function renderTemplate3({ config }: RenderParams) {
  const fontFamily = resolveFontFamily(config.typography?.fontFamily);

  return `<main class="public-landing"${styleAttr({
    "min-height": "100dvh",
    display: "grid",
    "place-items": "center",
    background: "#000",
    color: "#fff",
    "font-family": fontFamily,
    "text-align": "center",
    padding: "24px",
  })}><p${styleAttr({
    margin: 0,
    "font-size": "clamp(20px, 5vw, 28px)",
    "font-weight": 700,
    "letter-spacing": "0.01em",
  })}>Redirigiendo a WhatsApp...</p>${renderWhatsAppButton(config, "template3", {
    autoStart: true,
    hideButton: true,
  })}</main>`;
}

function renderTemplate(params: RenderParams) {
  if (params.config.layout?.template === 3) return renderTemplate3(params);
  if (params.config.layout?.template === 2) return renderTemplate2(params);
  return renderTemplate1(params);
}

export function renderPublicLandingHtml(params: RenderParams) {
  const { slug, config, cachedPhone } = params;
  const pixelId = String(config.tracking?.pixelId || "").trim().replace(/\D+/g, "");
  const title = config.name || slug;
  const description = config.comment || config.content?.subtitle?.join(" ") || title;
  const supabaseOrigin = (() => {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    try {
      return raw ? new URL(raw).origin : "";
    } catch {
      return "";
    }
  })();
  const phonePrewarmScript = renderScriptElement(
    PhonePrewarmScript({ slug, initialPhone: cachedPhone }),
  );
  const runtimeScript = renderScriptElement(PublicLandingRuntimeScript({ slug, config }));

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escapeHtml(
    title,
  )}</title><meta name="description" content="${escapeHtml(
    description,
  )}"><meta name="theme-color" content="#000000">${
    supabaseOrigin
      ? `<link rel="preconnect" href="${escapeHtml(supabaseOrigin)}" crossorigin><link rel="dns-prefetch" href="${escapeHtml(supabaseOrigin)}">`
      : ""
  }${
    pixelId
      ? '<link rel="preconnect" href="https://www.facebook.com"><link rel="preconnect" href="https://connect.facebook.net">'
      : ""
  }${buildPreloadLinks(config)}<style>${PUBLIC_LANDING_CSS}</style>${phonePrewarmScript}${buildPixelInitScript(
    pixelId,
  )}</head><body>${buildPixelNoscript(pixelId)}${renderTemplate(params)}${runtimeScript}</body></html>`;
}
