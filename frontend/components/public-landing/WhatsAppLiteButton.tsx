import type { CSSProperties } from "react";
import type { PublicLandingConfig } from "./types";

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
  const isTemplate2Like =
    templateVariant === "template2" ||
    templateVariant === "template3";
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
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M12.04 2.5a9.3 9.3 0 0 0-8.05 13.96L3 21l4.64-1.2a9.3 9.3 0 1 0 4.4-17.3Zm0 1.72a7.58 7.58 0 1 1-3.78 14.15l-.33-.2-2.75.72.74-2.68-.22-.35a7.58 7.58 0 0 1 6.34-11.64Zm-3.3 3.75c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15 0 1.27.93 2.5 1.06 2.67.13.17 1.8 2.87 4.5 3.9 2.24.88 2.7.7 3.18.66.49-.05 1.57-.64 1.8-1.26.22-.62.22-1.15.15-1.26-.07-.12-.25-.18-.53-.32-.28-.14-1.66-.82-1.92-.91-.26-.1-.45-.14-.64.14-.19.28-.73.91-.9 1.1-.16.18-.33.2-.61.07-.28-.14-1.18-.43-2.24-1.38-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.49.14-.16.19-.28.28-.47.1-.18.05-.35-.02-.49-.07-.14-.63-1.54-.88-2.1-.23-.54-.47-.46-.64-.47h-.55Z"
          />
        </svg>
      )}
    </button>
  );
}
