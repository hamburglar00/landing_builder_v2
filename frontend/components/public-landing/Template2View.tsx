import FrameBackgroundTemplate2 from "./FrameBackgroundTemplate2";
import WhatsAppLiteButton from "./WhatsAppLiteButton";
import type { PublicLandingConfig } from "./types";

type Props = {
  slug: string;
  config: PublicLandingConfig;
};

const SOCIAL_PROOF_ITEMS = [
  { quote: "Muy buena atencion, me respondieron al toque 🙌", name: "Nico R." },
  { quote: "Me guiaron con paciencia y buena onda ✅", name: "Juan P." },
  { quote: "Todo super claro, sin vueltas y rapido 💬", name: "Mica F." },
  { quote: "Atencion de diez, se nota que estan atentos 🤝", name: "Seba L." },
  { quote: "Respondieron enseguida y me ayudaron con todo ⚡", name: "Romi D." },
  { quote: "Muy buena predisposicion desde el primer mensaje 🙏", name: "Lau T." },
  { quote: "Me explicaron todo facil y con mucha claridad ✨", name: "Dario C." },
  { quote: "Da confianza cuando te responden tan rapido 📲", name: "Cami V." },
  { quote: "Excelente trato, muy humanos para atender 😊", name: "Pablo M." },
  { quote: "Me senti bien acompañado en todo momento 🙌", name: "Gise A." },
  { quote: "Rapidos, claros y muy atentos ✅", name: "Fede L." },
  { quote: "La atencion fue simple y re amable 💬", name: "Sofi B." },
  { quote: "Siempre contestan con buena onda 🤝", name: "Tomi A." },
  { quote: "Me resolvieron la consulta en minutos ⚡", name: "Vale M." },
  { quote: "Muy prolijos para explicar cada paso ✨", name: "Leo C." },
  { quote: "Atencion cercana, nada robotica 😊", name: "Flor G." },
  { quote: "Te responden rapido y van al punto 📲", name: "Maxi N." },
  { quote: "Buena energia y mucha predisposicion 🙏", name: "Agus R." },
  { quote: "Todo facil desde el primer WhatsApp ✅", name: "Dani P." },
  { quote: "Me gusto la claridad con la que atienden 💬", name: "Juli S." },
  { quote: "Super atentos, se nota el compromiso 🙌", name: "Mati V." },
  { quote: "Muy buena respuesta, cero vueltas ⚡", name: "Carla D." },
  { quote: "Atencion amable y bien organizada 🤝", name: "Lucas E." },
  { quote: "Me ayudaron rapido y con paciencia 😊", name: "Meli Q." },
  { quote: "Siempre atentos a cada mensaje 📲", name: "Nacho T." },
  { quote: "Muy claro todo, excelente predisposicion ✨", name: "Ana K." },
  { quote: "Se nota que hay equipo atras respondiendo 🙌", name: "Bruno F." },
  { quote: "Buena atencion y seguimiento constante ✅", name: "Rocio L." },
  { quote: "Responden rapido y con trato cordial 💬", name: "Marcos H." },
  { quote: "Todo ordenado, claro y muy humano 🤝", name: "Pau M." },
];

export default function Template2View({ slug, config }: Props) {
  const images = config.background?.images || [];
  const hasLogo = Boolean(config.content?.logoUrl);
  const titleLines = config.content?.title || [];
  const subtitleLines = config.content?.subtitle || [];
  const badgeArray = config.content?.footerBadge || [];
  const badgeText =
    (badgeArray.find((line) => line && line.trim().length > 0) || config.content?.footerBadgeText || "").trim();
  const isSocialProofEnabled = config.socialProof?.enabled !== false;
  const activeSocialProof = SOCIAL_PROOF_ITEMS[0];

  return (
    <main className="public-landing lp">
      <section className="phone-view">
        <div className="artboard">
          <div className="frame">
            <FrameBackgroundTemplate2
              images={images}
              responsiveImages={config.background?.imagesResponsive}
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
