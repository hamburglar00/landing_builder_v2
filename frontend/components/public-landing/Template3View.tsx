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
      className="public-landing template3"
      style={{
        fontFamily,
      }}
    >
      <section className="template3__card" aria-live="polite">
        <svg
          className="template3__whatsapp"
          viewBox="0 0 32 32"
          role="img"
          aria-label="WhatsApp"
        >
          <path
            fill="currentColor"
            d="M16.04 3A12.82 12.82 0 0 0 5.08 22.47L3 30l7.72-2.02A12.88 12.88 0 1 0 16.04 3Zm0 23.58a10.66 10.66 0 0 1-5.43-1.49l-.39-.23-4.58 1.2 1.22-4.46-.25-.4a10.68 10.68 0 1 1 9.43 5.38Zm5.85-7.99c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.72.16-.21.32-.82 1.05-1.01 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59a9.63 9.63 0 0 1-1.78-2.22c-.19-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.06-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.67s1.15 3.1 1.31 3.31c.16.21 2.26 3.45 5.47 4.84.77.33 1.36.53 1.83.68.77.24 1.46.21 2.01.13.61-.09 1.9-.78 2.17-1.52.27-.75.27-1.39.19-1.52-.08-.14-.29-.22-.61-.38Z"
          />
        </svg>

        <h1 className="template3__title">Conectando...</h1>
        <p className="template3__copy">
          Te estamos redirigiendo a nuestro chat de
          <br />
          WhatsApp para atenderte enseguida.
        </p>

        <span className="template3__spinner" aria-hidden="true" />

        <div className="template3__fallback">
          <span>Si no eres redirigido en unos segundos,</span>
          <WhatsAppLiteButton
            config={config}
            templateVariant="template3"
            autoStart
          />
        </div>
      </section>
    </main>
  );
}
