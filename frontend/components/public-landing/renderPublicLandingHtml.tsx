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

const WHATSAPP_ICON_OUTER_PATH =
  "M723.993033,360 C710.762252,360 700,370.765287 700,383.999801 C700,389.248451 701.692661,394.116025 704.570026,398.066947 L701.579605,406.983798 L710.804449,404.035539 C714.598605,406.546975 719.126434,408 724.006967,408 C737.237748,408 748,397.234315 748,384.000199 C748,370.765685 737.237748,360.000398 724.006967,360.000398 L723.993033,360.000398 L723.993033,360 Z";

const WHATSAPP_ICON_PATH =
  `${WHATSAPP_ICON_OUTER_PATH} M717.29285,372.190836 C716.827488,371.07628 716.474784,371.034071 715.769774,371.005401 C715.529728,370.991464 715.262214,370.977527 714.96564,370.977527 C714.04845,370.977527 713.089462,371.245514 712.511043,371.838033 C711.806033,372.557577 710.056843,374.23638 710.056843,377.679202 C710.056843,381.122023 712.567571,384.451756 712.905944,384.917648 C713.258648,385.382743 717.800808,392.55031 724.853297,395.471492 C730.368379,397.757149 732.00491,397.545307 733.260074,397.27732 C735.093658,396.882308 737.393002,395.527239 737.971421,393.891043 C738.54984,392.25405 738.54984,390.857171 738.380255,390.560912 C738.211068,390.264652 737.745308,390.095816 737.040298,389.742615 C736.335288,389.389811 732.90737,387.696673 732.25849,387.470894 C731.623543,387.231179 731.017259,387.315995 730.537963,387.99333 C729.860819,388.938653 729.198006,389.89831 728.661785,390.476494 C728.238619,390.928051 727.547144,390.984595 726.969123,390.744481 C726.193254,390.420348 724.021298,389.657798 721.340985,387.273388 C719.267356,385.42535 717.856938,383.125756 717.448104,382.434484 C717.038871,381.729275 717.405907,381.319529 717.729948,380.938852 C718.082653,380.501232 718.421026,380.191036 718.77373,379.781688 C719.126434,379.372738 719.323884,379.160897 719.549599,378.681068 C719.789645,378.215575 719.62006,377.735746 719.450874,377.382942 C719.281687,377.030139 717.871269,373.587317 717.29285,372.190836 Z`;

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
  )}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g transform="translate(-700 -360)"><path fill="#ffffff" d="${WHATSAPP_ICON_OUTER_PATH}"/><path fill="#67C15E" fill-rule="evenodd" d="${WHATSAPP_ICON_PATH}"/></g></svg>`;
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
