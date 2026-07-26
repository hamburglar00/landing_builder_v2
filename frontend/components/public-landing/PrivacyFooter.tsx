import type { PublicLandingConfig } from "./types";

type Props = {
  config: PublicLandingConfig;
};

export default function PrivacyFooter({ config }: Props) {
  const businessName = config.name || "el responsable de esta landing";

  return (
    <>
      <footer className="public-privacy-footer">
        <button
          type="button"
          className="public-privacy-link"
          data-public-privacy-open
          aria-haspopup="dialog"
        >
          Política de privacidad
        </button>
      </footer>

      <dialog
        className="public-privacy-dialog"
        data-public-privacy-dialog
        aria-labelledby="public-privacy-title"
      >
        <div className="public-privacy-dialog__header">
          <h2 id="public-privacy-title">Política de privacidad</h2>
          <button
            type="button"
            className="public-privacy-dialog__close"
            data-public-privacy-close
            aria-label="Cerrar política de privacidad"
          >
            ×
          </button>
        </div>

        <div className="public-privacy-dialog__content">
          <p>
            <strong>Responsable.</strong> Esta landing es gestionada por {businessName}.
          </p>
          <p>
            <strong>Datos tratados.</strong> Al navegar o utilizar el botón de contacto
            pueden procesarse datos técnicos del dispositivo y la conexión, cookies e
            identificadores publicitarios, la procedencia de la visita y los datos que
            usted proporcione voluntariamente.
          </p>
          <p>
            <strong>Finalidades.</strong> Los datos se utilizan para atender consultas
            por WhatsApp, operar el servicio, medir resultados y atribuir conversiones
            publicitarias.
          </p>
          <p>
            <strong>Meta.</strong> Esta landing puede utilizar Meta Pixel y Conversions
            API. En consecuencia, cierta información puede compartirse con Meta
            Platforms para medición, atribución y publicidad, de acuerdo con sus
            políticas.
          </p>
          <p>
            <strong>Derechos y contacto.</strong> Puede solicitar información,
            actualización o supresión de sus datos mediante el canal de WhatsApp
            ofrecido en esta landing.
          </p>
          <p>
            También puede administrar las cookies desde su navegador y revisar sus
            preferencias publicitarias en Meta.
          </p>
          <div className="public-privacy-dialog__links">
            <a
              href="https://www.facebook.com/privacy/policy/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Política de privacidad de Meta
            </a>
            <a
              href="https://www.facebook.com/adpreferences/ad_settings"
              target="_blank"
              rel="noreferrer noopener"
            >
              Preferencias de anuncios de Meta
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
