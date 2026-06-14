import type { CSSProperties } from "react";
import type { PublicLandingConfig } from "./types";

type Props = {
  config: PublicLandingConfig;
  templateVariant?: "default" | "template1" | "template2" | "template3";
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
    templateVariant === "template2" || templateVariant === "template3";
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/whatsapp-icon.png"
          alt=""
          className={isTemplate2Like ? "cta__icon" : "whatsapp-icon"}
          width={24}
          height={24}
          decoding="async"
        />
      )}
    </button>
  );
}
