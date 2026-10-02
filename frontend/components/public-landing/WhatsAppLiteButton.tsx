import type { CSSProperties } from "react";
import type { PublicLandingConfig } from "./types";
import { WHATSAPP_GREEN_PATH, WHATSAPP_WHITE_PATH } from "./whatsAppBrandIcon";

type Props = {
  config: PublicLandingConfig;
  templateVariant?: "default" | "template2" | "template3";
  autoStart?: boolean;
  hideButton?: boolean;
};

export default function WhatsAppLiteButton({
  config,
  templateVariant = "default",
  autoStart = false,
  hideButton = false,
}: Props) {
  const ctaText = config.content?.ctaText || "¡Contactar ya!";
  if (templateVariant === "template3") {
    return (
      <button
        type="button"
        className="template3__retry"
        style={hideButton ? { display: "none" } : undefined}
        data-public-landing-cta
        data-public-landing-auto-start={autoStart ? "true" : undefined}
        data-public-landing-rest-label="haz clic aquí."
        data-public-landing-loading-label="conectando..."
        data-public-landing-disabled-label="reintenta en un momento"
        aria-label="Reintentar redirección a WhatsApp"
      >
        <span data-public-landing-cta-label>haz clic aquí.</span>
      </button>
    );
  }

  const isTemplate2Like =
    templateVariant === "template2";
  const ctaStyle: CSSProperties = {
    color: config.colors?.ctaText ?? "#FFFFFF",
    background: config.colors?.ctaBackground ?? "#25D366",
    fontSize: `${config.typography?.cta?.sizePx ?? 18}px`,
    fontWeight: config.typography?.cta?.weight ?? 700,
    ...(hideButton ? { display: "none" } : null),
  };

  if (!isTemplate2Like) {
    ctaStyle.boxShadow = `0 0 30px 8px ${config.colors?.ctaGlow ?? "#FFD700"}`;
  }

  return (
    <button
      type="button"
      className={isTemplate2Like ? "cta" : "whatsapp-button"}
      style={ctaStyle}
      data-public-landing-cta
      data-public-landing-auto-start={autoStart ? "true" : undefined}
      aria-label={ctaText}
    >
      <span
        className={isTemplate2Like ? "cta__fill" : undefined}
        data-public-landing-cta-label
      >
        {ctaText}
      </span>
      {hideButton ? null : (
        <svg
          className={isTemplate2Like ? "cta__icon" : "whatsapp-icon"}
          viewBox="0 0 32 32"
          aria-hidden="true"
          focusable="false"
        >
          <path fill="#25D366" d={WHATSAPP_GREEN_PATH} />
          <path fill="#FFFFFF" d={WHATSAPP_WHITE_PATH} />
        </svg>
      )}
    </button>
  );
}
