import { resolveFontFamily } from "./resolveFontFamily";
import type { PublicLandingConfig } from "./types";
import WhatsAppLiteButton from "./WhatsAppLiteButton";

type Props = {
  slug: string;
  config: PublicLandingConfig;
};

export default function Template3View({ config }: Props) {
  const fontFamily = resolveFontFamily(config.typography?.fontFamily);

  return (
    <main
      className="public-landing"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#000",
        color: "#fff",
        fontFamily,
        textAlign: "center",
        padding: "24px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "clamp(20px, 5vw, 28px)",
          fontWeight: 700,
          letterSpacing: "0.01em",
        }}
      >
        Redirigiendo a WhatsApp...
      </p>

      <WhatsAppLiteButton config={config} templateVariant="template3" autoStart hideButton />
    </main>
  );
}
