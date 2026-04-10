"use client";

import type { LandingThemeConfig } from "@/lib/landing/types";
import { getColorHex, getFontFamilyCss } from "@/lib/landing/helpers";
import { buildResponsiveImageSet } from "@/lib/landing/imageUrl";

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
 * Plantilla 3: redirect directo (sin UI visual).
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
  const CtaButton = () => {
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
            boxShadow: template === 2 ? "none" : `0 0 18px ${ctaGlowHex}`,
          }}
        >
          <span className="truncate">{text}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/whatsapp-icon.png"
            alt=""
            className="h-6 w-6 shrink-0 object-contain"
          />
        </button>
      </div>
    );
  };

  const renderTemplate1 = () => {
    // Tarjeta vertical con fondo a sangre y columna centrada
    const outerClass = compact
      ? "relative h-full w-full overflow-hidden rounded-3xl bg-black shadow-[0_14px_32px_rgba(0,0,0,0.8)]"
      : "relative mx-auto w-full max-w-[380px] aspect-[9/16] overflow-hidden rounded-3xl bg-black shadow-[0_18px_40px_rgba(0,0,0,0.9)]";

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
                className="mb-4 flex w-full flex-col items-center text-center"
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
                className="mb-4 flex w-full flex-col items-center text-center"
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
                className="flex w-full flex-col items-center text-center mt-2"
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

              {/* CTA abajo de todo */}
              {ctaPosition === "bottom" && (
                <div className="mt-4">
                  <CtaButton />
                </div>
              )}
            </div>
          )}
        </div>
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
              className={`relative w-full flex-[2] ${frameMinHeight} max-h-[640px] overflow-hidden rounded-b-[28px] rounded-t-[8px] bg-black`}
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
                <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 px-4 text-center">
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
                    <CtaButton />
                  </div>
                </div>

                {/* Subtítulos debajo del CTA */}
                <div
                  className="mt-6 px-4 text-center"
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
    return (
      <div className="relative mx-auto flex h-full min-h-[280px] w-full max-w-[380px] items-center justify-center overflow-hidden rounded-3xl bg-black shadow-[0_18px_40px_rgba(0,0,0,0.9)]">
        <p className="px-6 text-center text-sm text-zinc-300">
          Redirigiendo a WhatsApp
        </p>
      </div>
    );
  }

  // En modo galería y sin template especial, priorizamos la vista simple
  if (template === 2) {
    return renderTemplate2();
  }
  return renderTemplate1();
}
