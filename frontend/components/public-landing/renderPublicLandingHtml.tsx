import PhonePrewarmScript from "./PhonePrewarmScript";
import PublicLandingRuntimeScript from "./PublicLandingRuntimeScript";
import {
  buildPixelInitScript,
  buildPixelNoscript,
} from "./metaPixelHtml";
import { PUBLIC_LANDING_CSS } from "./publicLandingCss";
import type { PublicLandingConfig, PublicLandingPhoneResponse } from "./types";

type RenderParams = {
  slug: string;
  config: PublicLandingConfig;
  cachedPhone?: PublicLandingPhoneResponse | null;
  canonicalUrl?: string;
};

type ResponsiveImage = {
  mobile?: string;
  tablet?: string;
  desktop?: string;
};

const WHATSAPP_ICON_PATH =
  "M723.993033,360 C710.762252,360 700,370.765287 700,383.999801 C700,389.248451 701.692661,394.116025 704.570026,398.066947 L701.579605,406.983798 L710.804449,404.035539 C714.598605,406.546975 719.126434,408 724.006967,408 C737.237748,408 748,397.234315 748,384.000199 C748,370.765685 737.237748,360.000398 724.006967,360.000398 L723.993033,360.000398 L723.993033,360 Z M717.29285,372.190836 C716.827488,371.07628 716.474784,371.034071 715.769774,371.005401 C715.529728,370.991464 715.262214,370.977527 714.96564,370.977527 C714.04845,370.977527 713.089462,371.245514 712.511043,371.838033 C711.806033,372.557577 710.056843,374.23638 710.056843,377.679202 C710.056843,381.122023 712.567571,384.451756 712.905944,384.917648 C713.258648,385.382743 717.800808,392.55031 724.853297,395.471492 C730.368379,397.757149 732.00491,397.545307 733.260074,397.27732 C735.093658,396.882308 737.393002,395.527239 737.971421,393.891043 C738.54984,392.25405 738.54984,390.857171 738.380255,390.560912 C738.211068,390.264652 737.745308,390.095816 737.040298,389.742615 C736.335288,389.389811 732.90737,387.696673 732.25849,387.470894 C731.623543,387.231179 731.017259,387.315995 730.537963,387.99333 C729.860819,388.938653 729.198006,389.89831 728.661785,390.476494 C728.238619,390.928051 727.547144,390.984595 726.969123,390.744481 C726.193254,390.420348 724.021298,389.657798 721.340985,387.273388 C719.267356,385.42535 717.856938,383.125756 717.448104,382.434484 C717.038871,381.729275 717.405907,381.319529 717.729948,380.938852 C718.082653,380.501232 718.421026,380.191036 718.77373,379.781688 C719.126434,379.372738 719.323884,379.160897 719.549599,378.681068 C719.789645,378.215575 719.62006,377.735746 719.450874,377.382942 C719.281687,377.030139 717.871269,373.587317 717.29285,372.190836 Z";

type ScriptElement = {
  props?: {
    dangerouslySetInnerHTML?: {
      __html?: string;
    };
  };
};

const SOCIAL_PROOF_ITEMS = [
  { quote: "Muy buena atencion, me respondieron al toque 🙌", name: "Nico R." },
  { quote: "Me guiaron con paciencia y buena onda ✅", name: "Juan P." },
  { quote: "Todo super claro, sin vueltas y rapido 💬", name: "Mica F." },
  { quote: "Atencion de diez, se nota que estan atentos 🤝", name: "Seba L." },
  { quote: "Respondieron enseguida y me ayudaron con todo ⚡", name: "Romi D." },
  { quote: "Muy buena predisposicion desde el primer mensaje 🙏", name: "Lau T." },
  { quote: "Me explicaron todo facil y con mucha claridad ✨", name: "Dario C." },
  { quote: "Da confianza cuando te responden tan rapido 📲", name: "Cami V." },
  { quote: "Excelente trato, muy humanos para atender 😊", name: "Pablo M." },
  { quote: "Me senti bien acompañado en todo momento 🙌", name: "Gise A." },
  { quote: "Rapidos, claros y muy atentos ✅", name: "Fede L." },
  { quote: "La atencion fue simple y re amable 💬", name: "Sofi B." },
  { quote: "Siempre contestan con buena onda 🤝", name: "Tomi A." },
  { quote: "Me resolvieron la consulta en minutos ⚡", name: "Vale M." },
  { quote: "Muy prolijos para explicar cada paso ✨", name: "Leo C." },
  { quote: "Atencion cercana, nada robotica 😊", name: "Flor G." },
  { quote: "Te responden rapido y van al punto 📲", name: "Maxi N." },
  { quote: "Buena energia y mucha predisposicion 🙏", name: "Agus R." },
  { quote: "Todo facil desde el primer WhatsApp ✅", name: "Dani P." },
  { quote: "Me gusto la claridad con la que atienden 💬", name: "Juli S." },
  { quote: "Super atentos, se nota el compromiso 🙌", name: "Mati V." },
  { quote: "Muy buena respuesta, cero vueltas ⚡", name: "Carla D." },
  { quote: "Atencion amable y bien organizada 🤝", name: "Lucas E." },
  { quote: "Me ayudaron rapido y con paciencia 😊", name: "Meli Q." },
  { quote: "Siempre atentos a cada mensaje 📲", name: "Nacho T." },
  { quote: "Muy claro todo, excelente predisposicion ✨", name: "Ana K." },
  { quote: "Se nota que hay equipo atras respondiendo 🙌", name: "Bruno F." },
  { quote: "Buena atencion y seguimiento constante ✅", name: "Rocio L." },
  { quote: "Responden rapido y con trato cordial 💬", name: "Marcos H." },
  { quote: "Todo ordenado, claro y muy humano 🤝", name: "Pau M." },
];

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

function publicMetadata(config: PublicLandingConfig, slug: string) {
  const contentTitle = (config.content?.title ?? [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const contentDescription = (config.content?.subtitle ?? [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const title = contentTitle || config.name || slug;
  const description =
    contentDescription || "Contactanos por WhatsApp para recibir atención inmediata.";
  const responsiveImage = config.background?.imagesResponsive?.[0];
  const image =
    responsiveImage?.desktop ||
    responsiveImage?.tablet ||
    responsiveImage?.mobile ||
    config.background?.images?.[0] ||
    config.content?.logoUrl ||
    "";

  return { title, description, image };
}

function buildPublicMetadataTags(
  config: PublicLandingConfig,
  slug: string,
  canonicalUrl?: string,
) {
  const metadata = publicMetadata(config, slug);
  const canonical = String(canonicalUrl ?? "").trim();

  return [
    `<meta name="description" content="${escapeHtml(metadata.description)}">`,
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}">`,
    canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : "",
    metadata.image
      ? `<meta property="og:image" content="${escapeHtml(metadata.image)}">`
      : "",
    `<meta name="twitter:card" content="${
      metadata.image ? "summary_large_image" : "summary"
    }">`,
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}">`,
    metadata.image
      ? `<meta name="twitter:image" content="${escapeHtml(metadata.image)}">`
      : "",
  ]
    .filter(Boolean)
    .join("");
}

function renderWhatsAppIcon(className: string) {
  return `<svg class="${escapeHtml(
    className,
  )}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g transform="translate(-700 -360)"><path fill="currentColor" fill-rule="evenodd" d="${WHATSAPP_ICON_PATH}"/></g></svg>`;
}

function renderPrivacyFooter(config: PublicLandingConfig) {
  const businessName = config.name || "el responsable de esta landing";

  return `<footer class="public-privacy-footer"><button type="button" class="public-privacy-link" data-public-privacy-open aria-haspopup="dialog">Política de privacidad</button></footer><dialog class="public-privacy-dialog" data-public-privacy-dialog aria-labelledby="public-privacy-title"><div class="public-privacy-dialog__header"><h2 id="public-privacy-title">Política de privacidad</h2><button type="button" class="public-privacy-dialog__close" data-public-privacy-close aria-label="Cerrar política de privacidad">×</button></div><div class="public-privacy-dialog__content"><p><strong>Responsable.</strong> Esta landing es gestionada por ${escapeHtml(
    businessName,
  )}.</p><p><strong>Datos tratados.</strong> Al navegar o utilizar el botón de contacto pueden procesarse datos técnicos del dispositivo y la conexión, cookies e identificadores publicitarios, la procedencia de la visita y los datos que usted proporcione voluntariamente.</p><p><strong>Finalidades.</strong> Los datos se utilizan para atender consultas por WhatsApp, operar el servicio, medir resultados y atribuir conversiones publicitarias.</p><p><strong>Meta.</strong> Esta landing puede utilizar Meta Pixel y Conversions API. En consecuencia, cierta información puede compartirse con Meta Platforms para medición, atribución y publicidad, de acuerdo con sus políticas.</p><p><strong>Derechos y contacto.</strong> Puede solicitar información, actualización o supresión de sus datos mediante el canal de WhatsApp ofrecido en esta landing.</p><p>También puede administrar las cookies desde su navegador y revisar sus preferencias publicitarias en Meta.</p><div class="public-privacy-dialog__links"><a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer noopener">Política de privacidad de Meta</a><a href="https://www.facebook.com/adpreferences/ad_settings" target="_blank" rel="noreferrer noopener">Preferencias de anuncios de Meta</a></div></div></dialog>`;
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
  if (templateVariant === "template3") {
    return `<button type="button" class="template3__retry"${styleAttr({
      display: options.hideButton ? "none" : undefined,
    })} data-public-landing-cta${attr(
      "data-public-landing-auto-start",
      options.autoStart ? "true" : "",
    )} data-public-landing-rest-label="haz clic aquí." data-public-landing-loading-label="conectando..." data-public-landing-disabled-label="reintenta en un momento" aria-label="Reintentar redirección a WhatsApp"><span data-public-landing-cta-label>haz clic aquí.</span></button>`;
  }

  const isTemplate2Like =
    templateVariant === "template2";
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
  const isBottomCta = ctaPosition === "bottom";

  return `<main class="public-landing landing-shell"><section class="container background-image${
    isBottomCta ? " template1-bottom-layout" : ""
  }">${renderRotatingBackground(
    config,
    false,
  )}<div class="content">${
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
  const isSocialProofEnabled = config.socialProof?.enabled !== false;
  const activeSocialProof = SOCIAL_PROOF_ITEMS[0];

  return `<main class="public-landing lp"><section class="phone-view"><div class="artboard"><div class="frame">${renderFrameBackgroundTemplate2(config)}${
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
  return `<main class="public-landing template3"><section class="template3__card" aria-live="polite"><svg class="template3__whatsapp" viewBox="0 0 32 32" role="img" aria-label="WhatsApp"><path fill="currentColor" d="M16.04 3A12.82 12.82 0 0 0 5.08 22.47L3 30l7.72-2.02A12.88 12.88 0 1 0 16.04 3Zm0 23.58a10.66 10.66 0 0 1-5.43-1.49l-.39-.23-4.58 1.2 1.22-4.46-.25-.4a10.68 10.68 0 1 1 9.43 5.38Zm5.85-7.99c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.72.16-.21.32-.82 1.05-1.01 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59a9.63 9.63 0 0 1-1.78-2.22c-.19-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.06-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.67s1.15 3.1 1.31 3.31c.16.21 2.26 3.45 5.47 4.84.77.33 1.36.53 1.83.68.77.24 1.46.21 2.01.13.61-.09 1.9-.78 2.17-1.52.27-.75.27-1.39.19-1.52-.08-.14-.29-.22-.61-.38Z"></path></svg><h1 class="template3__title">Conectando...</h1><p class="template3__copy">Te estamos redirigiendo a nuestro chat de<br>WhatsApp para atenderte enseguida.</p><span class="template3__spinner" aria-hidden="true"></span><div class="template3__fallback"><span>Si no eres redirigido en unos segundos,</span>${renderWhatsAppButton(config, "template3", {
    autoStart: true,
  })}</div></section></main>`;
}

function renderTemplate4({ config }: RenderParams) {
  const name = escapeHtml(config.name || "tu asesor");

  return `<main class="public-landing template4"><section class="template4__phone" aria-label="Chat en vivo"><div class="template4__intro"><div class="template4__spinner"><div class="template4__photo template4__photo--large">foto<br>asesora</div></div><div class="template4__intro-copy"><span>Abriendo sala</span><strong>Abriendo tu chat con ${name}</strong><p>Atencion abierta ahora</p></div></div><header class="template4__header"><div class="template4__avatar-wrap"><div class="template4__photo">foto</div><i class="template4__online-dot"></i></div><div class="template4__who"><b>${name} · Asesora</b><span>escribiendo...</span></div><time class="template4__time">Ahora<br><i>24/7</i></time></header><div class="template4__thread" data-public-landing-trigger><div class="template4__stack"><div class="template4__live-pill"><i></i><span><b>14</b> personas en chat ahora mismo</span></div><div class="template4__bubble template4__bubble--in"><p>Hola, soy ${name}. Estoy en linea ahora, no es un bot.</p><span>12:04</span></div><div class="template4__bubble template4__bubble--in"><p>Te acompano en todo: registro, primer deposito y tu primer retiro.</p><ul><li>Retiros rapidos, verificados por mi</li><li>Asesor personal 24/7</li><li>Te aviso cuando el pago sale</li></ul><span>12:05</span></div><div class="template4__bubble template4__bubble--in"><p>Arrancamos? Toca abajo y te contesto de una.</p><span>12:06</span></div><div class="template4__typing" aria-label="Escribiendo"><i></i><i></i><i></i></div><div class="template4__draft"><p>Hola, vengo del anuncio y quiero empezar ahora.</p><span>sin enviar<i></i></span></div></div></div><footer class="template4__footer"><button type="button" class="template4__cta" data-public-landing-cta data-public-landing-rest-label="Enviar mensaje" data-public-landing-loading-label="Abriendo..." data-public-landing-disabled-label="Sin numero disponible" aria-label="Enviar mensaje"><span data-public-landing-cta-label>Enviar mensaje</span><b aria-hidden="true">&gt;</b></button><div class="template4__cta-sub"><i></i>Te responde una persona real, ahora mismo</div><small>+18 · Juego responsable · Jugar puede causar adiccion</small></footer></section></main>`;
}

function renderTemplate5({ config }: RenderParams) {
  const name = escapeHtml(config.name || "asesor");

  return `<main class="public-landing template5"><section class="template5__phone" aria-label="Atencion en vivo"><div class="template5__curtain"><span>EN VIVO</span><strong>Entrando...</strong></div><div class="template5__topbar"><span class="template5__live-dot"></span><span>EN VIVO</span><time>Ahora</time></div><section class="template5__hero" data-public-landing-trigger><p class="template5__kicker">Atencion personalizada</p><h1>Esta pasando ahora mismo.</h1><p>Un asesor esta disponible para ayudarte por el canal asignado.</p></section><section class="template5__advisor"><div class="template5__avatar" aria-hidden="true">PB</div><div><strong>${name}</strong><span>Disponible para responder</span></div></section><div class="template5__progress" aria-hidden="true"><span></span></div><section class="template5__feed" aria-label="Actividad reciente"><div><strong>RETIROS PAGADOS</strong><span>EN VIVO</span></div><p><b>12:02</b> Solicitud recibida y atendida</p><p><b>12:04</b> Asesor asignado correctamente</p><p><b>12:06</b> Seguimiento activo por WhatsApp</p></section><footer class="template5__footer"><button type="button" class="template5__cta" data-public-landing-cta data-public-landing-rest-label="Hablar ahora" data-public-landing-loading-label="Abriendo..." data-public-landing-disabled-label="Sin numero disponible" aria-label="Hablar ahora"><span data-public-landing-cta-label>Hablar ahora</span>${renderWhatsAppIcon("template5__cta-icon")}</button><small>Continuas con un asesor asignado segun disponibilidad.</small></footer></section></main>`;
}

function renderTemplate(params: RenderParams) {
  if (params.config.layout?.template === 5) return renderTemplate5(params);
  if (params.config.layout?.template === 4) return renderTemplate4(params);
  if (params.config.layout?.template === 3) return renderTemplate3(params);
  if (params.config.layout?.template === 2) return renderTemplate2(params);
  return renderTemplate1(params);
}

export function renderPublicLandingHtml(params: RenderParams) {
  const { slug, config, cachedPhone, canonicalUrl } = params;
  const pixelId = String(config.tracking?.pixelId || "").trim().replace(/\D+/g, "");
  const metadata = publicMetadata(config, slug);
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
    metadata.title,
  )}</title>${buildPublicMetadataTags(
    config,
    slug,
    canonicalUrl,
  )}<meta name="theme-color" content="#000000">${
    supabaseOrigin
      ? `<link rel="preconnect" href="${escapeHtml(supabaseOrigin)}" crossorigin><link rel="dns-prefetch" href="${escapeHtml(supabaseOrigin)}">`
      : ""
  }${
    pixelId
      ? '<link rel="preconnect" href="https://www.facebook.com"><link rel="preconnect" href="https://connect.facebook.net">'
      : ""
  }${buildPreloadLinks(config)}<style>${PUBLIC_LANDING_CSS}</style>${phonePrewarmScript}${buildPixelInitScript(
    pixelId,
    slug,
    config.tracking?.phoneCountryCode || "54",
  )}</head><body>${buildPixelNoscript(pixelId)}${renderTemplate(params)}${renderPrivacyFooter(
    config,
  )}${runtimeScript}</body></html>`;
}
