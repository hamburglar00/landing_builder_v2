import RotatingBackground from "./RotatingBackground";
import WhatsAppLiteButton from "./WhatsAppLiteButton";
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

  const rawCtaPosition = config.layout?.ctaPosition ?? "between_title_and_info";
  const normalizedCtaPosition = (() => {
    const value = rawCtaPosition === "below_info" ? "between_info_and_badge" : rawCtaPosition;
    const allowed = ["top", "between_title_and_info", "between_info_and_badge", "bottom"] as const;
    return allowed.includes(value as (typeof allowed)[number]) ? value : "between_title_and_info";
  })();

  const resolvedFontFamily = resolveFontFamily(config.typography?.fontFamily);
  const isBottomCta = normalizedCtaPosition === "bottom";

  return (
    <main className="public-landing landing-shell">
      <section className={`container background-image${isBottomCta ? " template1-bottom-layout" : ""}`}>
        <RotatingBackground
          images={images}
          responsiveImages={config.background?.imagesResponsive}
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
              width={200}
              height={150}
              data-public-landing-trigger
              style={{ cursor: "pointer" }}
            />
          ) : null}

          {normalizedCtaPosition === "top" ? (
            <WhatsAppLiteButton config={config} />
          ) : null}

          <p
            className="title"
            data-public-landing-trigger
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
            <WhatsAppLiteButton config={config} />
          ) : null}

          <p
            className="subtitle"
            data-public-landing-trigger
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
            <WhatsAppLiteButton config={config} />
          ) : null}

          {badgeText ? (
            <p
              className="description"
              data-public-landing-trigger
              style={{
                color: config.colors?.badge ?? "#FFD700",
                fontSize: `${config.typography?.badge?.sizePx ?? 16}px`,
                fontWeight: config.typography?.badge?.weight ?? 700,
                cursor: "pointer",
              }}
            >
              -{badgeText}-
            </p>
          ) : null}

        </div>

        {isBottomCta ? (
          <div className="template1-bottom-cta-slot">
            <WhatsAppLiteButton config={config} templateVariant="template1" />
          </div>
        ) : null}
      </section>
    </main>
  );
}
