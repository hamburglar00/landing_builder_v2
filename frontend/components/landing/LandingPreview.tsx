"use client";

import { useEffect, useRef, useState } from "react";
import type { LandingThemeConfig } from "@/lib/landing/types";
import { getColorHex, SYSTEM_FONT_FAMILY } from "@/lib/landing/helpers";
import { buildResponsiveImageSet } from "@/lib/landing/imageUrl";

const WHATSAPP_ICON_PATH =
  "M723.993033,360 C710.762252,360 700,370.765287 700,383.999801 C700,389.248451 701.692661,394.116025 704.570026,398.066947 L701.579605,406.983798 L710.804449,404.035539 C714.598605,406.546975 719.126434,408 724.006967,408 C737.237748,408 748,397.234315 748,384.000199 C748,370.765685 737.237748,360.000398 724.006967,360.000398 L723.993033,360.000398 L723.993033,360 Z M717.29285,372.190836 C716.827488,371.07628 716.474784,371.034071 715.769774,371.005401 C715.529728,370.991464 715.262214,370.977527 714.96564,370.977527 C714.04845,370.977527 713.089462,371.245514 712.511043,371.838033 C711.806033,372.557577 710.056843,374.23638 710.056843,377.679202 C710.056843,381.122023 712.567571,384.451756 712.905944,384.917648 C713.258648,385.382743 717.800808,392.55031 724.853297,395.471492 C730.368379,397.757149 732.00491,397.545307 733.260074,397.27732 C735.093658,396.882308 737.393002,395.527239 737.971421,393.891043 C738.54984,392.25405 738.54984,390.857171 738.380255,390.560912 C738.211068,390.264652 737.745308,390.095816 737.040298,389.742615 C736.335288,389.389811 732.90737,387.696673 732.25849,387.470894 C731.623543,387.231179 731.017259,387.315995 730.537963,387.99333 C729.860819,388.938653 729.198006,389.89831 728.661785,390.476494 C728.238619,390.928051 727.547144,390.984595 726.969123,390.744481 C726.193254,390.420348 724.021298,389.657798 721.340985,387.273388 C719.267356,385.42535 717.856938,383.125756 717.448104,382.434484 C717.038871,381.729275 717.405907,381.319529 717.729948,380.938852 C718.082653,380.501232 718.421026,380.191036 718.77373,379.781688 C719.126434,379.372738 719.323884,379.160897 719.549599,378.681068 C719.789645,378.215575 719.62006,377.735746 719.450874,377.382942 C719.281687,377.030139 717.871269,373.587317 717.29285,372.190836 Z";

const TEMPLATE3_WHATSAPP_ICON_PATH =
  "M16.04 3A12.82 12.82 0 0 0 5.08 22.47L3 30l7.72-2.02A12.88 12.88 0 1 0 16.04 3Zm0 23.58a10.66 10.66 0 0 1-5.43-1.49l-.39-.23-4.58 1.2 1.22-4.46-.25-.4a10.68 10.68 0 1 1 9.43 5.38Zm5.85-7.99c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.72.16-.21.32-.82 1.05-1.01 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59a9.63 9.63 0 0 1-1.78-2.22c-.19-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.06-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.67s1.15 3.1 1.31 3.31c.16.21 2.26 3.45 5.47 4.84.77.33 1.36.53 1.83.68.77.24 1.46.21 2.01.13.61-.09 1.9-.78 2.17-1.52.27-.75.27-1.39.19-1.52-.08-.14-.29-.22-.61-.38Z";

const TEMPLATE4_CHAT_DEFAULTS = {
  profileImageUrl: "",
  backgroundImageUrl: "",
  bubble1Text: "Hola, soy {{name}}, enviame un mensaje y comenzamos ya mismo.",
  bubble2Intro: "Te acompaño en todo el proceso",
  bubble2Item1: "💸 Cargas y retiros las 24hs",
  bubble2Item2: "👤 Atencion personalizada",
  bubble2Item3: "🛡️ Respaldo y mas de 5 anos de experiencia",
  bubble3Text: "Arrancamos? Toca abajo y comenzamos",
};

const TEMPLATE5_LIVE_DEFAULTS = {
  titleText: "ESTA PASANDO\nAHORA MISMO.",
  subtitleText:
    "Un asesor te abre la cuenta en 2 minutos por WhatsApp y te acompaña en todo el proceso...",
  profileImageUrl: "",
  backgroundImageUrl: "",
};

const TEMPLATE5_FEED_ITEMS = [
  ["Camilo A.", "hace 5 s", "$ 1.150.000"],
  ["Sebastian G.", "hace 17 s", "$ 260.000"],
  ["Laura P.", "hace 29 s", "$ 780.000"],
  ["Mica R.", "hace 34 s", "$ 540.000"],
  ["Tomas D.", "hace 42 s", "$ 1.320.000"],
  ["Rocio M.", "hace 51 s", "$ 690.000"],
  ["Daniela T.", "hace 8 s", "$ 980.000"],
  ["Lucas F.", "hace 14 s", "$ 420.000"],
  ["Valen S.", "hace 23 s", "$ 1.760.000"],
  ["Nico P.", "hace 31 s", "$ 315.000"],
  ["Flor V.", "hace 38 s", "$ 890.000"],
  ["Agus M.", "hace 46 s", "$ 2.100.000"],
  ["Sofi L.", "hace 57 s", "$ 610.000"],
  ["Juan C.", "hace 12 s", "$ 1.480.000"],
  ["Pablo R.", "hace 19 s", "$ 730.000"],
  ["Lau G.", "hace 27 s", "$ 560.000"],
  ["Dario B.", "hace 36 s", "$ 1.250.000"],
  ["Cami N.", "hace 44 s", "$ 340.000"],
  ["Fede H.", "hace 52 s", "$ 1.690.000"],
  ["Maru D.", "hace 9 s", "$ 770.000"],
  ["Eze Q.", "hace 16 s", "$ 450.000"],
  ["Juli A.", "hace 24 s", "$ 1.030.000"],
  ["Bruno K.", "hace 33 s", "$ 640.000"],
  ["Meli F.", "hace 41 s", "$ 1.870.000"],
  ["Lean T.", "hace 49 s", "$ 520.000"],
  ["Ari B.", "hace 55 s", "$ 930.000"],
  ["Belen C.", "hace 11 s", "$ 1.410.000"],
  ["Rama J.", "hace 21 s", "$ 680.000"],
  ["Luli P.", "hace 30 s", "$ 2.350.000"],
  ["Gonza V.", "hace 39 s", "$ 810.000"],
] as const;

function template4Text(value: string, name: string) {
  return value.replace(/\{\{\s*name\s*\}\}/gi, name);
}

function template5Lines(value: string | undefined, fallback: string, maxLines: number) {
  const lines = String(value || fallback)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);

  return lines.length > 0 ? lines : fallback.split(/\r?\n/).slice(0, maxLines);
}

function formatPreviewTime() {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

interface LandingPreviewProps {
  config: LandingThemeConfig;
  /** Modo compacto para miniaturas (sin borde externo, ocupa todo el alto disponible). */
  compact?: boolean;
  /** En galería: solo imagen de fondo y logo, sin textos ni CTA. En editor se ignora. */
  gallery?: boolean;
}

/**
 * Preview de la landing en el editor / galería.
 *
 * Plantilla 1: fondo completo con columna centrada.
 * Plantilla 2: marco tipo teléfono con frame superior y CTA + textos debajo.
 * Plantilla 3: redirect directo con card de conexión a WhatsApp.
 */
export function LandingPreview({
  config,
  compact = false,
  gallery = false,
}: LandingPreviewProps) {
  const bgImage = config.backgroundImages[0];
  const bgResponsive = bgImage ? buildResponsiveImageSet(bgImage) : null;
  const titleHex = getColorHex(config.titleColor);
  const subtitleHex = getColorHex(config.subtitleColor);
  const footerHex = getColorHex(config.footerBadgeColor);
  const ctaTextHex = getColorHex(config.ctaTextColor);
  const ctaBgHex = getColorHex(config.ctaBackgroundColor);
  const ctaGlowHex = getColorHex(config.ctaGlowColor);
  const fontFamily = SYSTEM_FONT_FAMILY;
  const [template4LiveCount, setTemplate4LiveCount] = useState(14);
  const template5NextFeedIndex = useRef(3);
  const [template5VisibleFeed, setTemplate5VisibleFeed] = useState(() =>
    TEMPLATE5_FEED_ITEMS.slice(0, 3),
  );
  const [template4Now, setTemplate4Now] = useState(() => formatPreviewTime());
  const template =
    config.template === "template2"
      ? 2
      : config.template === "template3"
        ? 3
        : config.template === "template4"
          ? 4
          : config.template === "template5"
            ? 5
            : 1;
  const ctaPosition = config.ctaPosition ?? "between_title_and_info";

  useEffect(() => {
    const timeTimer = window.setInterval(() => setTemplate4Now(formatPreviewTime()), 30000);
    const countTimer = window.setInterval(() => {
      setTemplate4LiveCount((current) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(9, Math.min(24, current + delta));
      });
    }, 3200);
    const feedTimer = window.setInterval(() => {
      setTemplate5VisibleFeed((currentRows) => {
        const nextItem =
          TEMPLATE5_FEED_ITEMS[template5NextFeedIndex.current % TEMPLATE5_FEED_ITEMS.length];
        template5NextFeedIndex.current =
          (template5NextFeedIndex.current + 1) % TEMPLATE5_FEED_ITEMS.length;
        return [nextItem, ...currentRows].slice(0, 3);
      });
    }, 3600);

    return () => {
      window.clearInterval(timeTimer);
      window.clearInterval(countTimer);
      window.clearInterval(feedTimer);
    };
  }, []);

  // CTA común a ambas plantillas (botón con icono WhatsApp)
  const CtaButton = ({ template2Like = false }: { template2Like?: boolean } = {}) => {
    const text = config.ctaText?.trim() || "¡Contactar ya!";
    return (
      <div className="flex justify-center">
        <button
          type="button"
          className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-[10px] px-5 py-2.5 shadow-md"
          style={{
            backgroundColor: ctaBgHex,
            color: ctaTextHex,
            fontFamily,
            fontSize: config.ctaFontSize,
            fontWeight: config.ctaBold ? 700 : 500,
            boxShadow:
              template === 2 || template2Like
                ? "inset 0 1px 0 rgba(255,255,255,.1), 0 10px 24px rgba(0,0,0,.26)"
                : `0 0 18px ${ctaGlowHex}`,
          }}
        >
          <span className="truncate">{text}</span>
          <svg
            className="h-[29px] w-[29px] shrink-0"
            viewBox="0 0 48 48"
            aria-hidden="true"
            focusable="false"
          >
            <g transform="translate(-700 -360)">
              <path fill="currentColor" fillRule="evenodd" d={WHATSAPP_ICON_PATH} />
            </g>
          </svg>
        </button>
      </div>
    );
  };

  const renderTemplate1 = () => {
    // Tarjeta vertical con fondo a sangre y columna centrada
    const outerClass = compact
      ? "relative h-full w-full overflow-hidden rounded-3xl bg-black shadow-[0_14px_32px_rgba(0,0,0,0.8)]"
      : "relative mx-auto w-full max-w-[380px] aspect-[9/16] overflow-hidden rounded-3xl bg-black shadow-[0_18px_40px_rgba(0,0,0,0.9)]";
    const usesThumbAlignedBottomCta = ctaPosition === "bottom";

    return (
      <div className={outerClass}>
        {bgImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgResponsive?.desktop ?? bgImage}
            srcSet={
              bgResponsive
                ? `${bgResponsive.mobile} 640w, ${bgResponsive.tablet} 1024w, ${bgResponsive.desktop} 1600w`
                : undefined
            }
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 380px"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Oscurecer levemente para legibilidad */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />

        <div className="relative flex h-full flex-col items-center px-6 pt-8 pb-8">
          {/* Logo a ~10–15% desde arriba */}
          <div className="mb-4 mt-[6%] flex justify-center">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logoUrl}
                alt="Logo"
                className="max-h-[120px] w-1/2 max-w-[190px] object-contain drop-shadow-md"
              />
            ) : (
              <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-zinc-400/70 bg-black/40 text-xs text-zinc-200/80">
                Logo
              </div>
            )}
          </div>

          {/* En modo galería solo mostramos fondo + logo */}
          {gallery ? null : (
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-3">
              {/* CTA arriba del todo */}
              {ctaPosition === "top" && (
                <div className="mb-4">
                  <CtaButton />
                </div>
              )}

              {/* Título */}
              <div
                className="mb-4 flex w-[85%] max-w-[620px] flex-col items-center text-center"
                style={{
                  color: titleHex,
                  fontFamily,
                  fontSize: config.titleFontSize,
                  fontWeight: config.titleBold ? 700 : 500,
                }}
              >
                <p className="leading-tight">{config.titleLine1 || " "}</p>
                <p className="leading-tight">{config.titleLine2 || " "}</p>
                <p className="leading-tight">{config.titleLine3 || " "}</p>
              </div>

              {/* CTA entre título e info */}
              {ctaPosition === "between_title_and_info" && (
                <div className="mb-4">
                  <CtaButton />
                </div>
              )}

              {/* Info / subtítulos */}
              <div
                className="mb-4 flex w-[85%] max-w-[620px] flex-col items-center text-center"
                style={{
                  color: subtitleHex,
                  fontFamily,
                  fontSize: config.subtitleFontSize,
                  fontWeight: config.subtitleBold ? 600 : 400,
                }}
              >
                <p>{config.subtitleLine1 || " "}</p>
                <p>{config.subtitleLine2 || " "}</p>
                <p>{config.subtitleLine3 || " "}</p>
              </div>

              {/* CTA entre info y badge */}
              {ctaPosition === "between_info_and_badge" && (
                <div className="mb-4">
                  <CtaButton />
                </div>
              )}

              {/* Badge final (solo texto, sin fondo) */}
              <div
                className="mt-2 flex w-[85%] max-w-[620px] flex-col items-center text-center"
                style={{
                  color: footerHex,
                  fontFamily,
                  fontSize: config.badgeFontSize,
                  fontWeight: config.badgeBold ? 700 : 500,
                }}
              >
                <p className="leading-tight">
                  {config.footerBadgeLine1 || " "}
                </p>
                <p className="leading-tight">
                  {config.footerBadgeLine2 || " "}
                </p>
                <p className="leading-tight">
                  {config.footerBadgeLine3 || " "}
                </p>
              </div>
            </div>
          )}
        </div>

        {!gallery && usesThumbAlignedBottomCta ? (
          <div className="absolute left-1/2 top-[calc(74%+10px)] z-20 flex w-full max-w-[380px] -translate-x-1/2 justify-center px-3">
            <CtaButton />
          </div>
        ) : null}
      </div>
    );
  };

  const renderTemplate2 = () => {
    // Marco tipo teléfono: fondo negro, frame superior con imagen y textos, CTA y subtítulos debajo
    const outerClass = compact
      ? "relative h-full w-full overflow-hidden rounded-3xl bg-black shadow-[0_14px_32px_rgba(0,0,0,0.9)]"
      : "relative mx-auto w-full max-w-[380px] aspect-[9/16] overflow-hidden rounded-3xl bg-black shadow-[0_18px_40px_rgba(0,0,0,1)]";

    const frameMinHeight = "";

    return (
      <div className={outerClass}>
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-full w-full max-w-[380px] flex-col px-3">
            {/* Frame con imagen de fondo */}
            <div
              className={`relative h-[74%] w-full flex-none ${frameMinHeight} max-h-[840px] overflow-hidden rounded-b-[28px] rounded-t-[8px] bg-black`}
            >
              {bgImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bgResponsive?.desktop ?? bgImage}
                  srcSet={
                    bgResponsive
                      ? `${bgResponsive.mobile} 640w, ${bgResponsive.tablet} 1024w, ${bgResponsive.desktop} 1600w`
                      : undefined
                  }
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 380px"
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-[50%_25%]"
                />
              )}
              {/* Gradiente oscuro desde abajo para legibilidad */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

              {/* Logo en tercio superior */}
              <div className="pointer-events-none absolute left-1/2 top-[9%] z-20 -translate-x-1/2">
                {config.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={config.logoUrl}
                    alt="Logo"
                    className="w-[54%] max-w-[220px] min-w-[170px] object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]"
                  />
                ) : (
                  <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-dashed border-zinc-300/80 bg-black/40 text-xs text-zinc-100">
                    Logo
                  </div>
                )}
              </div>

              {/* Zona de texto en la parte baja del frame: badge + título */}
              {!gallery && (
                <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 mx-auto w-[85%] max-w-[365px] px-0 text-center">
                  {/* Badge (solo texto, sin fondo) */}
                  <div
                    className="mb-2 text-xs tracking-wide"
                    style={{
                      color: footerHex,
                      fontFamily,
                      fontSize: config.badgeFontSize,
                      fontWeight: config.badgeBold ? 800 : 600,
                    }}
                  >
                    {config.footerBadgeLine1 ||
                      config.footerBadgeLine2 ||
                      config.footerBadgeLine3 || "-BADGE-"}
                  </div>

                  {/* Título */}
                  <div
                    style={{
                      color: titleHex,
                      fontFamily,
                      fontSize: config.titleFontSize,
                      fontWeight: config.titleBold ? 800 : 600,
                    }}
                    className="space-y-1 text-center leading-tight text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]"
                  >
                    <p>{config.titleLine1 || " "}</p>
                    <p>{config.titleLine2 || " "}</p>
                    <p>{config.titleLine3 || " "}</p>
                  </div>
                </div>
              )}
            </div>

            {/* CTA bajo el frame */}
            {!gallery && (
              <>
                <div className="mt-3 flex justify-center">
                  <div className="w-[80%] max-w-[360px]">
                    <CtaButton template2Like />
                  </div>
                </div>

                {/* Subtítulos debajo del CTA */}
                <div
                  className="mx-auto mt-6 w-[85%] max-w-[365px] px-0 text-center"
                  style={{
                    color: subtitleHex,
                    fontFamily,
                    fontSize: config.subtitleFontSize,
                    fontWeight: config.subtitleBold ? 600 : 400,
                  }}
                >
                  <p>{config.subtitleLine1 || " "}</p>
                  <p>{config.subtitleLine2 || " "}</p>
                  <p>{config.subtitleLine3 || " "}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTemplate4 = () => {
    const outerClass = compact
      ? "relative h-full w-full overflow-hidden rounded-3xl bg-[#182629] shadow-[0_14px_32px_rgba(0,0,0,0.9)]"
      : "relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-3xl bg-[#182629] shadow-[0_18px_40px_rgba(0,0,0,1)]";
    const name = config.titleLine1?.trim() || "Asesor";
    const messageTime = template4Now === "--:--" ? "19:36" : template4Now;
    const chat = {
      ...TEMPLATE4_CHAT_DEFAULTS,
      ...(config.template4Chat ?? {}),
    };
    const profileImageUrl = chat.profileImageUrl;
    const backgroundImageUrl = chat.backgroundImageUrl;
    const backgroundLayerStyle = backgroundImageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(7, 16, 19, 0.42), rgba(7, 16, 19, 0.42)), url("${backgroundImageUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cg fill='none' stroke='%236ee7b7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='.72'%3E%3Ccircle cx='24' cy='24' r='16'/%3E%3Ccircle cx='24' cy='24' r='8'/%3E%3Cpath d='M24 8v7M24 33v7M8 24h7M33 24h7M14 14l5 5M34 14l-5 5M14 34l5-5M34 34l-5-5'/%3E%3Crect x='60' y='10' width='34' height='46' rx='5' transform='rotate(-10 77 33)'/%3E%3Cpath d='M77 22c-6 8-13 16 0 23 13-7 6-15 0-23zM72 45h10'/%3E%3Crect x='122' y='14' width='38' height='31' rx='5'/%3E%3Cpath d='M131 24h20M131 35h20M129 30h.5M153 30h.5'/%3E%3Cpath d='M28 76c8-11 20-1 10 10 10-11 22-1 10 10-8 8-20 4-20-4 0 8-12 12-20 4-12-11 0-21 10-10-10-11 2-21 10-10zM28 96v12'/%3E%3Cpath d='M82 72l16 16-16 16-16-16zM82 80v16M74 88h16'/%3E%3Crect x='124' y='70' width='34' height='34' rx='7'/%3E%3Ccircle cx='134' cy='80' r='1.5'/%3E%3Ccircle cx='148' cy='80' r='1.5'/%3E%3Ccircle cx='141' cy='87' r='1.5'/%3E%3Ccircle cx='134' cy='94' r='1.5'/%3E%3Ccircle cx='148' cy='94' r='1.5'/%3E%3Cpath d='M25 124c-8 10-16 18 0 28 16-10 8-18 0-28zM18 152h14'/%3E%3Crect x='62' y='122' width='48' height='30' rx='6'/%3E%3Cpath d='M73 132l6 10 6-10M92 132l6 10 6-10'/%3E%3Cpath d='M130 130c0-9 8-16 17-16s17 7 17 16-8 16-17 16-17-7-17-16zM139 128l8-8 8 8M139 136l8 8 8-8'/%3E%3C/g%3E%3Cg fill='%23e5bd42' opacity='.58'%3E%3Ccircle cx='48' cy='54' r='2'/%3E%3Ccircle cx='112' cy='58' r='2'/%3E%3Ccircle cx='164' cy='60' r='2'/%3E%3Ccircle cx='52' cy='112' r='2'/%3E%3Ccircle cx='112' cy='112' r='2'/%3E%3Ccircle cx='166' cy='162' r='2'/%3E%3Cpath d='M48 150l3 6 6 3-6 3-3 6-3-6-6-3 6-3zM114 20l2 4 4 2-4 2-2 4-2-4-4-2 4-2z'/%3E%3C/g%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
          backgroundPosition: "-18px 2px",
        };
    const bubble2Items = [
      chat.bubble2Item1,
      chat.bubble2Item2,
      chat.bubble2Item3,
    ].filter((item) => item.trim().length > 0);
    const template4CtaText =
      config.ctaText.trim() && config.ctaText !== "Acceder"
        ? config.ctaText
        : "ABRIR WHATSAPP";
    const template4CtaTextColor = getColorHex(
      config.ctaTextColor === "black" ? "white" : config.ctaTextColor,
    );
    const template4CtaBackgroundColor = getColorHex(
      config.ctaBackgroundColor === "gold" ? "whatsapp_green" : config.ctaBackgroundColor,
    );

    if (gallery) {
      return (
        <div className={outerClass} style={{ fontFamily }}>
          <div
            className={`pointer-events-none absolute inset-0 ${backgroundImageUrl ? "opacity-100" : "opacity-[0.2]"}`}
            style={backgroundLayerStyle}
          />
          <div className="relative z-[1] flex h-full flex-col">
            <div className="flex min-h-[54px] items-center gap-2 border-b border-slate-400/15 bg-[#102326] px-3">
              <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-white/10 bg-black text-[7px] font-bold text-slate-300/70">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  "foto"
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-extrabold text-white">{name} · Asesora</p>
                <p className="truncate text-[10px] font-bold text-[#25d366]">En linea · responde en ~40 seg</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 px-3 pt-5">
              <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-[#25d366]/30 bg-[#25d366]/10 px-2.5 py-1.5 text-[9px] font-bold text-slate-100">
                <span className="h-1.5 w-1.5 rounded-full bg-[#25d366]" />
                <span><b>{template4LiveCount}</b> personas en chat</span>
              </div>
              <div className="max-w-[82%] rounded-[12px] rounded-bl bg-[#223237] px-2.5 py-2 text-[10px] font-semibold leading-snug text-white shadow-[0_3px_12px_rgba(0,0,0,0.34)]">
                {template4Text(chat.bubble1Text, name)}
              </div>
              <div className="max-w-[82%] rounded-[12px] rounded-bl bg-[#223237] px-2.5 py-2 text-[10px] font-semibold leading-snug text-white shadow-[0_3px_12px_rgba(0,0,0,0.34)]">
                {template4Text(chat.bubble2Intro, name)}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={outerClass} style={{ fontFamily }}>
        <div
          className={`pointer-events-none absolute inset-0 ${backgroundImageUrl ? "opacity-100" : "opacity-[0.2]"}`}
          style={backgroundLayerStyle}
        />
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#11191b] opacity-0">
          <div className="text-center">
            <div className="mx-auto grid h-[74px] w-[74px] place-items-center overflow-hidden rounded-full border border-white/10 bg-black text-[9px] font-bold leading-tight text-slate-300/70">
              {profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <>
                  foto
                  <br />
                  asesora
                </>
              )}
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#25d366]">
              Abriendo sala
            </p>
            <p className="mt-2 text-[20px] font-black leading-tight text-white">
              Abriendo tu chat con {name}
            </p>
          </div>
        </div>
        <div className="flex h-full flex-col">
          <div className="flex min-h-[66px] items-center gap-3 border-b border-slate-400/15 bg-[#102326] px-4 pt-2.5">
            <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-black text-[8px] font-bold text-slate-300/70">
              {profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                "foto"
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#263639] bg-[#25d366]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold leading-tight text-white">
                {name} · Asesora
              </p>
              <p className="mt-1 text-[11px] font-bold text-[#25d366]">
                En linea · responde en ~40 seg
              </p>
            </div>
            <span className="text-right text-[10px] font-bold leading-snug text-slate-300/70">
              {messageTime}
              <br />
              <i className="not-italic text-[#e5bd42]">24/7</i>
            </span>
          </div>
          <div className="relative z-[1] flex flex-1 flex-col justify-start gap-[7px] overflow-hidden px-4 pb-3 pt-[clamp(26px,8vh,78px)]">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#25d366]/30 bg-[#25d366]/10 px-3 py-2 text-[10px] font-bold text-slate-100">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25d366]" />
              <span>
                <b>{template4LiveCount}</b> personas en chat ahora mismo
              </span>
            </div>
            <div className="max-w-[84%] rounded-[14px] rounded-bl rounded-tl bg-[#223237] px-3 py-2 pb-5 text-[13px] font-semibold leading-snug text-white shadow-[0_3px_12px_rgba(0,0,0,0.34)]">
              {template4Text(chat.bubble1Text, name)}
              <span className="float-right -mb-3 mt-1 text-[9px] text-slate-200/80">
                {messageTime}
              </span>
            </div>
            <div className="max-w-[84%] rounded-[14px] rounded-bl rounded-tl bg-[#223237] px-3 py-2 pb-5 text-[13px] font-semibold leading-snug text-white shadow-[0_3px_12px_rgba(0,0,0,0.34)]">
              {template4Text(chat.bubble2Intro, name)}
              <ul className="mt-2 space-y-0.5 text-[12px] font-semibold text-slate-50">
                {bubble2Items.map((item) => (
                  <li key={item}>{template4Text(item, name)}</li>
                ))}
              </ul>
              <span className="float-right -mb-3 mt-1 text-[9px] text-slate-200/80">
                {messageTime}
              </span>
            </div>
            <div className="max-w-[84%] rounded-[14px] rounded-bl rounded-tl bg-[#223237] px-3 py-2 pb-5 text-[13px] font-semibold leading-snug text-white shadow-[0_3px_12px_rgba(0,0,0,0.34)]">
              {template4Text(chat.bubble3Text, name)}
              <span className="float-right -mb-3 mt-1 text-[9px] text-slate-200/80">
                {messageTime}
              </span>
            </div>
          </div>
          {!gallery && (
            <div className="relative z-[1] border-t border-slate-400/15 bg-[#102326] px-4 pb-6 pt-2.5">
              <button
                className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-center text-[15px] font-black shadow-[0_0_0_0_rgba(37,211,102,.5)]"
                style={{
                  color: template4CtaTextColor,
                  backgroundColor: template4CtaBackgroundColor,
                }}
              >
                <svg className="h-6 w-6" viewBox="0 0 48 48" aria-hidden="true">
                  <g transform="translate(-700 -360)">
                    <path fill="currentColor" fillRule="evenodd" d={WHATSAPP_ICON_PATH} />
                  </g>
                </svg>
                <span>{template4CtaText}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderTemplate5 = () => {
    const outerClass = compact
      ? "relative h-full w-full overflow-hidden rounded-3xl bg-[#071013] shadow-[0_14px_32px_rgba(0,0,0,0.9)]"
      : "relative mx-auto aspect-[9/16] w-full max-w-[380px] overflow-hidden rounded-3xl bg-[#071013] shadow-[0_18px_40px_rgba(0,0,0,1)]";
    const name = config.titleLine1?.trim() || "Asesor";
    const now = template4Now === "--:--" ? "23:11" : template4Now;
    const viewers = (1278 + template4LiveCount * 3).toLocaleString("es-AR");
    const live = {
      ...TEMPLATE5_LIVE_DEFAULTS,
      ...(config.template5Live ?? {}),
    };
    const titleLines = template5Lines(
      live.titleText,
      TEMPLATE5_LIVE_DEFAULTS.titleText,
      3,
    );
    const backgroundImage = live.backgroundImageUrl;

    return (
      <div className={outerClass} style={{ fontFamily }}>
        <div
          className="absolute -inset-7 animate-[template5AmbientDrift_18s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_12%,rgba(229,189,66,0.16),transparent_28%),radial-gradient(circle_at_92%_16%,rgba(245,29,56,0.11),transparent_30%),linear-gradient(180deg,#120806_0%,#070302_100%)] opacity-100"
          style={{
            backgroundImage: backgroundImage
              ? `linear-gradient(rgba(7,3,2,.58),rgba(7,3,2,.76)), url("${backgroundImage}")`
              : "radial-gradient(circle at 20px 20px, transparent 0 11px, rgba(229,189,66,.52) 12px, transparent 14px), radial-gradient(circle at 118px 76px, transparent 0 14px, rgba(37,211,102,.32) 15px, transparent 17px), linear-gradient(45deg, transparent 0 43%, rgba(229,189,66,.34) 44% 56%, transparent 57%), linear-gradient(135deg, transparent 0 43%, rgba(245,29,56,.24) 44% 56%, transparent 57%)",
            backgroundSize: backgroundImage
              ? "cover"
              : "118px 118px, 156px 156px, 92px 92px, 138px 138px",
            backgroundPosition: backgroundImage ? "center" : undefined,
          }}
        />
        <div className="relative z-10 h-full overflow-y-auto pb-[122px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative z-10 flex animate-[template5EnterUp_.7s_cubic-bezier(.16,1,.3,1)_forwards] items-center justify-between gap-3 px-[18px] pt-4">
          <div className="inline-flex min-h-7 items-center gap-2 rounded-full bg-[#f51d38] px-3 text-[10px] font-black tracking-[0.08em] text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            <strong>EN VIVO</strong>
            <time className="font-mono">{now}</time>
          </div>
          <span className="whitespace-nowrap font-mono text-[10px] font-bold text-slate-200/80">
            {viewers} viendo
          </span>
        </div>
        <div className="relative z-10 px-[18px] pt-6">
          <h1 className="text-[42px] font-black uppercase leading-[0.86] tracking-[-0.055em] text-white">
            {titleLines.map((line, index) => (
              <span
                key={`${line}-${index}`}
                className={index === 0 ? "block" : "block text-[#e5bd42]"}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-4 text-[14px] leading-snug text-zinc-100/80">
            Un asesor te abre la cuenta en 2 minutos por WhatsApp y te acompaña en todo el proceso...
          </p>
        </div>
        <div className="relative z-10 mx-[18px] mt-5 flex items-center gap-3 rounded-[18px] border border-[#e5bd42]/20 bg-black/85 p-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-full border border-lime-300/20 bg-[#14282d] text-[8px] font-black leading-tight text-lime-300">
            foto<br />asesor
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[14px] font-black text-white">{name} · tu asesora designada</strong>
            <span className="mt-1 block truncate text-[11px] font-extrabold text-[#25d366]">
              En linea · responde en ~40 seg
            </span>
          </div>
          <i className="h-3 w-3 animate-pulse rounded-full bg-[#25d366] shadow-[0_0_0_6px_rgba(37,211,102,.12)]" />
        </div>
        <div className="relative z-10 mx-[18px] mt-4 h-1 overflow-hidden rounded-full bg-[#f51d38]/25">
          <span className="block h-full w-full origin-left animate-[template5ProgressLoop_5.2s_linear_infinite] rounded-full bg-gradient-to-r from-[#f3ce58] to-[#ff2b44]" />
        </div>
        <div className="relative z-10 mx-[18px] mt-5 overflow-hidden rounded-[18px] border border-[#e5bd42]/20 bg-black/85">
          <div className="flex items-center border-b border-[#e5bd42]/15 px-3.5 py-3">
            <strong className="text-[10px] font-extrabold tracking-[0.16em] text-white">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#25d366]" />
              EN VIVO
            </strong>
          </div>
          {[
            ["Camilo A.", "hace 5 s", "$ 1.150.000"],
            ["Sebastian G.", "hace 17 s", "$ 260.000"],
            ["Laura P.", "hace 29 s", "$ 780.000"],
          ].map(([who, when, amount]) => (
            <p key={who} className="mx-3.5 flex items-center justify-between gap-3 border-b border-[#e5bd42]/10 py-2.5">
              <span>
                <b className="block text-[13px] font-black text-white">{who}</b>
                <small className="mt-0.5 block text-[10px] font-bold text-slate-300/60">{when}</small>
              </span>
              <strong className="whitespace-nowrap font-mono text-[13px] font-black text-[#25d366]">{amount}</strong>
            </p>
          ))}
        </div>
        </div>
        {!gallery && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#071013] via-[#071013]/95 to-transparent px-4 pb-5 pt-12">
            <button className="flex h-[66px] w-full items-center justify-center gap-3 rounded-full bg-[#25d366] text-[18px] font-black tracking-[-0.02em] text-[#04130a] shadow-[0_0_0_12px_rgba(37,211,102,.14),0_18px_34px_rgba(37,211,102,.22)]">
              <span className="text-xl">●</span>
              ENTRAR POR WHATSAPP
            </button>
            <small className="mt-3 block text-center text-[11px] text-slate-300/60">
              {name} te contesta en persona, ahora mismo
            </small>
          </div>
        )}
      </div>
    );
  };

  const renderTemplate5Configured = () => {
    const outerClass = compact
      ? "relative h-full w-full overflow-hidden rounded-3xl bg-[#071013] shadow-[0_14px_32px_rgba(0,0,0,0.9)]"
      : "relative mx-auto aspect-[9/16] w-full max-w-[380px] overflow-hidden rounded-3xl bg-[#071013] shadow-[0_18px_40px_rgba(0,0,0,1)]";
    const name = config.titleLine1?.trim() || "Asesor";
    const now = template4Now === "--:--" ? "23:11" : template4Now;
    const viewers = (1278 + template4LiveCount * 3).toLocaleString("es-AR");
    const live = {
      ...TEMPLATE5_LIVE_DEFAULTS,
      ...(config.template5Live ?? {}),
    };
    const titleLines = template5Lines(
      live.titleText,
      TEMPLATE5_LIVE_DEFAULTS.titleText,
      3,
    );
    const subtitleLines = template5Lines(
      live.subtitleText,
      TEMPLATE5_LIVE_DEFAULTS.subtitleText,
      2,
    );
    const advisorCount = 2 + (template4LiveCount % 9);
    const createdCount = (1323 + template4LiveCount).toLocaleString("es-AR");
    const galleryScaleClass = gallery ? "scale-[0.82] origin-top" : "";
    const scrollClass = gallery
      ? "relative z-10 h-full overflow-hidden pb-[96px]"
      : "relative z-10 h-full overflow-y-auto pb-[122px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

    return (
      <div className={outerClass} style={{ fontFamily }}>
        <div
          className="absolute -inset-7 animate-[template5AmbientDrift_18s_ease-in-out_infinite] opacity-100"
          style={{
            backgroundImage: live.backgroundImageUrl
              ? `linear-gradient(rgba(7,3,2,.58),rgba(7,3,2,.76)), url("${live.backgroundImageUrl}")`
              : "radial-gradient(circle at 20px 20px, transparent 0 11px, rgba(229,189,66,.52) 12px, transparent 14px), radial-gradient(circle at 118px 76px, transparent 0 14px, rgba(37,211,102,.32) 15px, transparent 17px), linear-gradient(45deg, transparent 0 43%, rgba(229,189,66,.34) 44% 56%, transparent 57%), linear-gradient(135deg, transparent 0 43%, rgba(245,29,56,.24) 44% 56%, transparent 57%)",
            backgroundSize: live.backgroundImageUrl
              ? "cover"
              : "118px 118px, 156px 156px, 92px 92px, 138px 138px",
            backgroundPosition: live.backgroundImageUrl ? "center" : undefined,
          }}
        />
        <div className={`${scrollClass} ${galleryScaleClass}`}>
          <div className="relative z-10 flex animate-[template5EnterUp_.7s_cubic-bezier(.16,1,.3,1)_forwards] items-center justify-between gap-3 px-[18px] pt-4">
            <div className="inline-flex min-h-7 items-center gap-2 rounded-full bg-[#f51d38] px-3 text-[10px] font-black tracking-[0.08em] text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              <strong>EN VIVO</strong>
              <time className="font-mono">{now}</time>
            </div>
            <span className="whitespace-nowrap font-mono text-[10px] font-bold text-slate-200/80">
              {viewers} viendo
            </span>
          </div>
          <div className="relative z-10 px-[18px] pt-6">
            <h1 className="text-[42px] font-black uppercase leading-[0.86] tracking-[-0.055em] text-white">
              {titleLines.map((line, index) => (
                <span
                  key={`${line}-${index}`}
                  className={index === 0 ? "block" : "block text-[#e5bd42]"}
                >
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-4 text-[14px] font-extrabold leading-snug text-zinc-100/85">
              {subtitleLines.map((line, index) => (
                <span key={`${line}-${index}`} className="block">
                  {line}
                </span>
              ))}
            </p>
          </div>
          <div className="relative z-10 mx-[18px] mt-5 flex items-center gap-3 rounded-[18px] border border-[#e5bd42]/20 bg-black/85 p-3.5">
            <div className="relative h-11 w-11 shrink-0">
              {live.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={live.profileImageUrl}
                  alt=""
                  className="h-11 w-11 rounded-full border border-lime-300/20 bg-black object-cover"
                />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-full border border-lime-300/20 bg-black text-[8px] font-black leading-tight text-lime-300">
                  foto<br />asesor
                </div>
              )}
              <span className="absolute bottom-0 right-0 h-3 w-3 animate-pulse rounded-full border-2 border-[#160f09] bg-[#25d366] shadow-[0_0_0_4px_rgba(37,211,102,.12)]" />
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[14px] font-black text-white">{name} · tu asesora designada</strong>
              <span className="mt-1 block truncate text-[11px] font-extrabold text-[#25d366]">
                En linea · responde en ~40 seg
              </span>
            </div>
          </div>
          <div className="relative z-10 mx-[18px] mt-4 h-1 overflow-hidden rounded-full bg-[#f51d38]/25">
            <span className="block h-full w-full origin-left animate-[template5ProgressLoop_5.2s_linear_infinite] rounded-full bg-gradient-to-r from-[#f3ce58] to-[#ff2b44]" />
          </div>
          <div className="relative z-10 mx-[18px] mt-5 overflow-hidden rounded-[18px] border border-[#e5bd42]/20 bg-black/85">
            <div className="flex items-center border-b border-[#e5bd42]/15 px-3.5 py-3">
              <strong className="text-[10px] font-extrabold tracking-[0.16em] text-white">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#25d366]" />
                EN VIVO
              </strong>
            </div>
            {template5VisibleFeed.map(([who, when, amount]) => (
              <p key={`${who}-${when}`} className="mx-3.5 flex items-center justify-between gap-3 border-b border-[#e5bd42]/10 py-2.5">
                <span>
                  <b className="block text-[13px] font-black text-white">{who}</b>
                  <small className="mt-0.5 block text-[10px] font-bold text-slate-300/60">{when}</small>
                </span>
                <strong className="whitespace-nowrap font-mono text-[13px] font-black text-[#25d366]">{amount}</strong>
              </p>
            ))}
          </div>
          <div className="relative z-10 mx-[18px] mt-4 grid grid-cols-2 gap-2.5">
            <article className="rounded-2xl border border-[#e5bd42]/20 bg-black/85 p-3">
              <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-200/70">Cuentas creadas</span>
              <strong className="mt-1 block text-[14px] font-black text-[#e5bd42]">{createdCount}</strong>
            </article>
            <article className="rounded-2xl border border-[#e5bd42]/20 bg-black/85 p-3">
              <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-200/70">Asesores disponibles</span>
              <strong className="mt-1 block text-[14px] font-black text-[#e5bd42]">{advisorCount} en vivo</strong>
            </article>
          </div>
        </div>
        {!gallery && (
          <div className="absolute inset-x-0 bottom-9 z-20 bg-gradient-to-t from-[#071013] via-[#071013]/95 to-transparent px-4 pb-5 pt-12">
            <button className="flex h-[66px] w-full items-center justify-center gap-3 rounded-full bg-[#25d366] text-[18px] font-black tracking-[-0.02em] text-white shadow-[0_0_0_12px_rgba(37,211,102,.14),0_18px_34px_rgba(37,211,102,.22)]">
              <svg className="h-7 w-7" viewBox="0 0 48 48" aria-hidden="true">
                <g transform="translate(-700 -360)">
                  <path fill="currentColor" fillRule="evenodd" d={WHATSAPP_ICON_PATH} />
                </g>
              </svg>
              ENTRAR POR WHATSAPP
            </button>
          </div>
        )}
      </div>
    );
  };

  if (template === 3) {
    const outerClass = compact
      ? "relative h-full w-full overflow-hidden rounded-3xl bg-[#f2f4f5] shadow-[0_14px_32px_rgba(0,0,0,0.55)]"
      : "relative mx-auto flex aspect-[9/16] w-full max-w-[380px] items-center justify-center overflow-hidden rounded-3xl bg-[#f2f4f5] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)]";
    const cardClass = gallery
      ? "w-[78%] max-w-[295px] -translate-y-11 rounded-[17px] bg-white px-5 py-6 text-center shadow-[0_8px_18px_rgba(16,33,58,0.13)]"
      : "w-full max-w-[384px] min-h-[396px] rounded-[17px] bg-white px-8 pb-[26px] pt-[31px] text-center shadow-[0_8px_18px_rgba(16,33,58,0.13)]";
    const iconClass = gallery
      ? "mx-auto h-16 w-16 text-[#00cf70] drop-shadow-[0_3px_2px_rgba(0,207,112,0.18)]"
      : "mx-auto h-[82px] w-[82px] text-[#00cf70] drop-shadow-[0_3px_2px_rgba(0,207,112,0.18)]";
    const titleClass = gallery
      ? "mt-4 text-[18px] font-extrabold leading-tight tracking-[-0.025em] text-[#10213a]"
      : "mt-5 text-2xl font-extrabold leading-tight tracking-[-0.025em] text-[#10213a]";
    const copyClass = gallery
      ? "mt-1 text-[11px] leading-snug text-[#586577]"
      : "mt-1.5 text-sm leading-normal text-[#586577]";
    const spinnerClass = gallery
      ? "mx-auto mt-4 block h-9 w-9 shrink-0 rounded-full border-[3px] border-[#eef0f0] border-r-[#00cf70] border-t-[#00cf70]"
      : "mx-auto mt-[23px] block h-12 w-12 shrink-0 rounded-full border-4 border-[#eef0f0] border-r-[#00cf70] border-t-[#00cf70]";
    const fallbackClass = gallery
      ? "mt-5 border-t border-[#dde1e4] pt-3 text-[10px] leading-tight text-[#8a94a3]"
      : "mt-[31px] border-t border-[#dde1e4] pt-4 text-xs leading-snug text-[#8a94a3]";

    return (
      <div className={outerClass} style={{ fontFamily }}>
        <div className="flex h-full w-full items-center justify-center p-3">
          <div className={cardClass}>
            <svg
              className={iconClass}
              viewBox="0 0 48 48"
              role="img"
              aria-label="WhatsApp"
            >
              <path fill="currentColor" d={TEMPLATE3_WHATSAPP_ICON_PATH} />
            </svg>

            <h1 className={titleClass}>Conectando...</h1>
            <p className={copyClass}>
              Te estamos redirigiendo a nuestro chat de
              <br />
              WhatsApp para atenderte enseguida.
            </p>

            <span
              className={spinnerClass}
              aria-hidden="true"
            />

            <div className={fallbackClass}>
              <span>Si no eres redirigido en unos segundos,</span>
              <br />
              <span className="font-bold text-[#00ba66]">conectando...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // En modo galería y sin template especial, priorizamos la vista simple
  if (template === 2) {
    return renderTemplate2();
  }
  if (template === 4) {
    return renderTemplate4();
  }
  if (template === 5) {
    return renderTemplate5Configured();
  }
  return renderTemplate1();
}
