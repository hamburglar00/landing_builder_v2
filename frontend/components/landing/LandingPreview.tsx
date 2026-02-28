"use client";

import type { LandingThemeConfig } from "@/lib/landing/types";
import { getColorHex } from "@/lib/landing/helpers";

interface LandingPreviewProps {
  config: LandingThemeConfig;
}

/**
 * Preview de la landing con plantilla fija: vertical, mobile-first, tipo casino.
 * Fondo a sangre sin overlay/máscara; estructura no editable (sin drag and drop).
 */
export function LandingPreview({ config }: LandingPreviewProps) {
  const bgImage =
    config.backgroundMode === "single"
      ? config.backgroundImages[0]
      : config.backgroundImages[0];
  const titleHex = getColorHex(config.titleColor);
  const subtitleHex = getColorHex(config.subtitleColor);
  const footerHex = getColorHex(config.footerBadgeColor);
  const ctaTextHex = getColorHex(config.ctaTextColor);
  const ctaBgHex = getColorHex(config.ctaBackgroundColor);
  const ctaGlowHex = getColorHex(config.ctaGlowColor);

  return (
    <div className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl border border-zinc-700 shadow-xl">
      {/* Contenedor fijo tipo mobile */}
      <div
        className="relative flex min-h-[640px] flex-col bg-zinc-900"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Badge rotación: solo si rotating y hay más de una imagen */}
        {config.backgroundMode === "rotating" &&
          config.backgroundImages.length > 0 && (
            <div className="absolute right-2 top-2 z-10 rounded-lg bg-black/70 px-2 py-1 text-xs text-white">
              {config.backgroundImages.length} imagen
              {config.backgroundImages.length !== 1 ? "es" : ""} · cada{" "}
              {config.rotateEveryHours}h
            </div>
          )}

        {/* Logo centrado arriba */}
        <div className="flex shrink-0 justify-center pt-8">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.logoUrl}
              alt="Logo"
              className="max-h-16 w-auto max-w-[180px] object-contain"
            />
          ) : (
            <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-zinc-600 text-xs text-zinc-500">
              Logo
            </div>
          )}
        </div>

        {/* Título en posición fija */}
        <div
          className="mt-6 flex shrink-0 flex-col items-center justify-center px-4 text-center"
          style={{ color: titleHex }}
        >
          <p className="text-xl font-bold leading-tight">
            {config.titleLine1 || " "}
          </p>
          <p className="text-xl font-bold leading-tight">
            {config.titleLine2 || " "}
          </p>
        </div>

        {/* CTA centrado */}
        <div className="mt-8 flex shrink-0 justify-center px-4">
          <span
            className="inline-block rounded-xl px-8 py-3 text-base font-semibold shadow-lg transition"
            style={{
              color: ctaTextHex,
              backgroundColor: ctaBgHex,
              boxShadow: `0 0 20px ${ctaGlowHex}`,
            }}
          >
            {config.ctaText || "CTA"}
          </span>
        </div>

        {/* 3 líneas de texto informativo */}
        <div
          className="mt-8 flex flex-1 flex-col justify-center px-4 text-center text-sm leading-relaxed"
          style={{ color: subtitleHex }}
        >
          <p>{config.subtitleLine1 || " "}</p>
          <p>{config.subtitleLine2 || " "}</p>
          <p>{config.subtitleLine3 || " "}</p>
        </div>

        {/* Texto final abajo */}
        <div className="shrink-0 pb-8 pt-4 text-center">
          <span
            className="rounded-full px-4 py-2 text-xs font-medium"
            style={{ color: footerHex, backgroundColor: "rgba(0,0,0,0.3)" }}
          >
            {config.footerBadgeText || " "}
          </span>
        </div>
      </div>
    </div>
  );
}
