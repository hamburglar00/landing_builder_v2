"use client";

import type { LandingThemeConfig } from "@/lib/landing/types";
import { getColorHex, getFontFamilyCss } from "@/lib/landing/helpers";
import { buildResponsiveImageSet } from "@/lib/landing/imageUrl";

const WHATSAPP_ICON_PATH =
  "M723.993033,360 C710.762252,360 700,370.765287 700,383.999801 C700,389.248451 701.692661,394.116025 704.570026,398.066947 L701.579605,406.983798 L710.804449,404.035539 C714.598605,406.546975 719.126434,408 724.006967,408 C737.237748,408 748,397.234315 748,384.000199 C748,370.765685 737.237748,360.000398 724.006967,360.000398 L723.993033,360.000398 L723.993033,360 Z M717.29285,372.190836 C716.827488,371.07628 716.474784,371.034071 715.769774,371.005401 C715.529728,370.991464 715.262214,370.977527 714.96564,370.977527 C714.04845,370.977527 713.089462,371.245514 712.511043,371.838033 C711.806033,372.557577 710.056843,374.23638 710.056843,377.679202 C710.056843,381.122023 712.567571,384.451756 712.905944,384.917648 C713.258648,385.382743 717.800808,392.55031 724.853297,395.471492 C730.368379,397.757149 732.00491,397.545307 733.260074,397.27732 C735.093658,396.882308 737.393002,395.527239 737.971421,393.891043 C738.54984,392.25405 738.54984,390.857171 738.380255,390.560912 C738.211068,390.264652 737.745308,390.095816 737.040298,389.742615 C736.335288,389.389811 732.90737,387.696673 732.25849,387.470894 C731.623543,387.231179 731.017259,387.315995 730.537963,387.99333 C729.860819,388.938653 729.198006,389.89831 728.661785,390.476494 C728.238619,390.928051 727.547144,390.984595 726.969123,390.744481 C726.193254,390.420348 724.021298,389.657798 721.340985,387.273388 C719.267356,385.42535 717.856938,383.125756 717.448104,382.434484 C717.038871,381.729275 717.405907,381.319529 717.729948,380.938852 C718.082653,380.501232 718.421026,380.191036 718.77373,379.781688 C719.126434,379.372738 719.323884,379.160897 719.549599,378.681068 C719.789645,378.215575 719.62006,377.735746 719.450874,377.382942 C719.281687,377.030139 717.871269,373.587317 717.29285,372.190836 Z";

const TEMPLATE3_WHATSAPP_ICON_PATH =
  "M16.04 3A12.82 12.82 0 0 0 5.08 22.47L3 30l7.72-2.02A12.88 12.88 0 1 0 16.04 3Zm0 23.58a10.66 10.66 0 0 1-5.43-1.49l-.39-.23-4.58 1.2 1.22-4.46-.25-.4a10.68 10.68 0 1 1 9.43 5.38Zm5.85-7.99c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.72.16-.21.32-.82 1.05-1.01 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59a9.63 9.63 0 0 1-1.78-2.22c-.19-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.06-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.67s1.15 3.1 1.31 3.31c.16.21 2.26 3.45 5.47 4.84.77.33 1.36.53 1.83.68.77.24 1.46.21 2.01.13.61-.09 1.9-.78 2.17-1.52.27-.75.27-1.39.19-1.52-.08-.14-.29-.22-.61-.38Z";

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
  const fontFamily = getFontFamilyCss(config.fontFamily);
  const template =
    config.template === "template2"
      ? 2
      : config.template === "template3"
        ? 3
        : 1;
  const ctaPosition = config.ctaPosition ?? "between_title_and_info";

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
      ? "mx-auto mt-4 block h-9 w-9 shrink-0 animate-spin rounded-full border-[3px] border-[#eef0f0] border-r-[#00cf70] border-t-[#00cf70]"
      : "mx-auto mt-[23px] block h-12 w-12 shrink-0 animate-spin rounded-full border-4 border-[#eef0f0] border-r-[#00cf70] border-t-[#00cf70]";
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
              style={{ animationDuration: "850ms" }}
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
  return renderTemplate1();
}
