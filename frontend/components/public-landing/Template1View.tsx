"use client";

import RotatingBackground from "./RotatingBackground";
import WhatsAppButton from "./WhatsAppButton";
import { resolveFontFamily } from "./resolveFontFamily";
import type { PublicLandingConfig } from "./types";

type Props = {
  slug: string;
  config: PublicLandingConfig;
};

export default function Template1View({ slug, config }: Props) {
  const images = config.background?.images || [];
  const hasLogo = Boolean(config.content?.logoUrl);
  const titleLines = config.content?.title || [];
  const subtitleLines = config.content?.subtitle || [];
  const badgeText = config.content?.footerBadgeText || "";
  const sharedTriggerEvent = `lp:cta-trigger:${slug}`;
  const triggerWhatsApp = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(sharedTriggerEvent));
  };

  const rawCtaPosition = config.layout?.ctaPosition ?? "between_title_and_info";
  const normalizedCtaPosition = (() => {
    const value = rawCtaPosition === "below_info" ? "between_info_and_badge" : rawCtaPosition;
    const allowed = ["top", "between_title_and_info", "between_info_and_badge", "bottom"] as const;
    return allowed.includes(value as (typeof allowed)[number]) ? value : "between_title_and_info";
  })();

  const resolvedFontFamily = resolveFontFamily(config.typography?.fontFamily);

  return (
    <main className="public-landing landing-shell">
      <section className="container background-image">
        <RotatingBackground
          images={images}
          rotateEveryHours={config.background?.rotateEveryHours}
          overlay={false}
        />

        <div className="content" style={{ fontFamily: resolvedFontFamily }}>
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.content?.logoUrl}
              className="logo"
              alt={config.name}
              decoding="async"
              fetchPriority="high"
              onClick={triggerWhatsApp}
              style={{ cursor: "pointer" }}
            />
          ) : null}

          {normalizedCtaPosition === "top" ? (
            <WhatsAppButton slug={slug} config={config} externalTriggerEvent={sharedTriggerEvent} />
          ) : null}

          <p
            className="title"
            onClick={triggerWhatsApp}
            style={{
              color: config.colors?.title ?? "#FFFFFF",
              fontSize: `${config.typography?.title?.sizePx ?? 26}px`,
              fontWeight: config.typography?.title?.weight ?? 700,
              cursor: "pointer",
            }}
          >
            {titleLines.map((line, index) => (
              <span key={`${slug}-title-${index}`}>
                {line}
                {index < titleLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>

          {normalizedCtaPosition === "between_title_and_info" ? (
            <WhatsAppButton slug={slug} config={config} externalTriggerEvent={sharedTriggerEvent} />
          ) : null}

          <p
            className="subtitle"
            onClick={triggerWhatsApp}
            style={{
              color: config.colors?.subtitle ?? "#FFFFFF",
              fontSize: `${config.typography?.subtitle?.sizePx ?? 16}px`,
              fontWeight: config.typography?.subtitle?.weight ?? 400,
              cursor: "pointer",
            }}
          >
            {subtitleLines.map((line, index) => (
              <span key={`${slug}-subtitle-${index}`}>
                {line}
                {index < subtitleLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>

          {normalizedCtaPosition === "between_info_and_badge" ? (
            <WhatsAppButton slug={slug} config={config} externalTriggerEvent={sharedTriggerEvent} />
          ) : null}

          {badgeText ? (
            <p
              className="description"
              style={{
                color: config.colors?.badge ?? "#FFD700",
                fontSize: `${config.typography?.badge?.sizePx ?? 16}px`,
                fontWeight: config.typography?.badge?.weight ?? 700,
                cursor: "pointer",
              }}
              onClick={triggerWhatsApp}
            >
              -{badgeText}-
            </p>
          ) : null}

          {normalizedCtaPosition === "bottom" ? (
            <WhatsAppButton slug={slug} config={config} externalTriggerEvent={sharedTriggerEvent} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
