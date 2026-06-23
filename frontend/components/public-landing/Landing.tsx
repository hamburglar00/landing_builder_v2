import PixelInit from "./PixelInit";
import MetaTrackingBootstrap from "./MetaTrackingBootstrap";
import PhonePrewarmScript from "./PhonePrewarmScript";
import PublicLandingRuntimeScript from "./PublicLandingRuntimeScript";
import Template1View from "./Template1View";
import Template2View from "./Template2View";
import Template3View from "./Template3View";
import type { PublicLandingConfig, PublicLandingPhoneResponse } from "./types";

type Props = {
  slug: string;
  config: PublicLandingConfig;
  cachedPhone?: PublicLandingPhoneResponse | null;
};

export default function PublicLanding({ slug, config, cachedPhone }: Props) {
  const isTemplate2 = config.layout?.template === 2;
  const isTemplate3 = config.layout?.template === 3;

  const pixelId = String(config.tracking?.pixelId || "").trim().replace(/\D+/g, "");
  const pixelBlock = pixelId ? (
    <>
      <PixelInit pixelId={pixelId} />
      <MetaTrackingBootstrap />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  ) : null;

  if (isTemplate3) {
    return (
      <>
        {pixelBlock}
        <PhonePrewarmScript slug={slug} initialPhone={cachedPhone} />
        <Template3View slug={slug} config={config} />
        <PublicLandingRuntimeScript slug={slug} config={config} />
      </>
    );
  }

  if (isTemplate2) {
    return (
      <>
        {pixelBlock}
        <PhonePrewarmScript slug={slug} initialPhone={cachedPhone} />
        <Template2View slug={slug} config={config} />
        <PublicLandingRuntimeScript slug={slug} config={config} />
      </>
    );
  }

  return (
    <>
      {pixelBlock}
      <PhonePrewarmScript slug={slug} initialPhone={cachedPhone} />
      <Template1View slug={slug} config={config} />
      <PublicLandingRuntimeScript slug={slug} config={config} />
    </>
  );
}
