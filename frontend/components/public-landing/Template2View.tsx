import FrameBackgroundTemplate2 from "./FrameBackgroundTemplate2";
import WhatsAppLiteButton from "./WhatsAppLiteButton";
import { resolveFontFamily } from "./resolveFontFamily";
import type { PublicLandingConfig } from "./types";

type Props = {
  slug: string;
  config: PublicLandingConfig;
};

const SOCIAL_PROOF_ITEMS = [
  { quote: "Muy buena atencion. Me respondieron rapido y sin vueltas.", name: "Nico R." },
  { quote: "Excelente servicio, todo claro desde el primer mensaje.", name: "Juan P." },
  { quote: "Siempre responden rapido y con muy buena predisposicion.", name: "Mica F." },
  { quote: "Atencion super amable. Me resolvieron todo en minutos.", name: "Seba L." },
  { quote: "Me ayudaron en todo el proceso, muy claros y confiables.", name: "Romi D." },
  { quote: "Atencion impecable. Responden al toque por WhatsApp.", name: "Lau T." },
  { quote: "Servicio muy confiable, siempre cumplen con lo que dicen.", name: "Dario C." },
  { quote: "Todo simple, rapido y bien explicado. Recomiendo.", name: "Cami V." },
  { quote: "Muy buena experiencia. La atencion fue rapida y cordial.", name: "Pablo M." },
  { quote: "Excelente trato, buena onda y respuesta inmediata.", name: "Gise A." },
];

export default function Template2View({ slug, config }: Props) {
  const images = config.background?.images || [];
  const hasLogo = Boolean(config.content?.logoUrl);
  const titleLines = config.content?.title || [];
  const subtitleLines = config.content?.subtitle || [];
  const badgeArray = config.content?.footerBadge || [];
  const badgeText =
    (badgeArray.find((line) => line && line.trim().length > 0) || config.content?.footerBadgeText || "").trim();
  const fontFamily = resolveFontFamily(config.typography?.fontFamily);
  const isSocialProofEnabled = config.socialProof?.enabled !== false;
  const activeSocialProof = SOCIAL_PROOF_ITEMS[0];

  return (
    <main className="public-landing lp">
      <section className="phone-view">
        <div className="artboard" style={fontFamily ? { fontFamily } : undefined}>
          <div className="frame">
            <FrameBackgroundTemplate2
              images={images}
              rotateEveryHours={config.background?.rotateEveryHours}
            />
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.content?.logoUrl}
                alt={config.name}
                className="frame__logo"
                decoding="async"
                fetchPriority="high"
                width={220}
                height={160}
                data-public-landing-trigger
                style={{ cursor: "pointer" }}
              />
            ) : null}

            <div className="frame__copy">
              {badgeText ? (
                <p
                  className="eyebrow"
                  style={{
                    color: config.colors?.badge ?? "#FFD700",
                    fontSize: `${config.typography?.badge?.sizePx ?? 16}px`,
                    fontWeight: config.typography?.badge?.weight ?? 700,
                    cursor: "pointer",
                  }}
                  data-public-landing-trigger
                >
                  {badgeText}
                </p>
              ) : null}
              <h1
                className="title"
                style={{
                  color: config.colors?.title ?? "#FFFFFF",
                  fontSize: `${config.typography?.title?.sizePx ?? 26}px`,
                  fontWeight: config.typography?.title?.weight ?? 700,
                  cursor: "pointer",
                }}
                data-public-landing-trigger
              >
                {titleLines.map((line, index) => (
                  <span key={`${slug}-t2-title-${index}`}>
                    {line}
                    {index < titleLines.length - 1 ? <br /> : null}
                  </span>
                ))}
              </h1>
            </div>
          </div>

          <WhatsAppLiteButton
            config={config}
            templateVariant="template2"
          />

          {isSocialProofEnabled ? (
            <section
              className="social-proof"
              aria-label="Prueba social"
              data-public-landing-social-proof
              data-public-landing-trigger
              style={{ cursor: "pointer" }}
            >
              <p className="social-proof__quote" data-public-landing-social-quote>
                &quot;{activeSocialProof.quote}&quot;
              </p>
              <p className="social-proof__meta" data-public-landing-social-meta>
                {activeSocialProof.name} <span aria-hidden="true">-</span>{" "}
                <span className="social-proof__stars">{"\u2605".repeat(5)}</span>
              </p>
              <div
                className="social-proof__progress"
                data-public-landing-social-progress
                aria-hidden="true"
              />
            </section>
          ) : null}

          <div className="features" data-public-landing-trigger style={{ cursor: "pointer" }}>
            {subtitleLines.map((line, index) => (
              <p
                key={`${slug}-t2-sub-${index}`}
                style={{
                  color: config.colors?.subtitle ?? "#FFFFFF",
                  fontSize: `${config.typography?.subtitle?.sizePx ?? 16}px`,
                  fontWeight: config.typography?.subtitle?.weight ?? 400,
                }}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
