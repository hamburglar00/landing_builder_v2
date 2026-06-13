import PixelInit from "./PixelInit";
import Template1View from "./Template1View";
import Template2View from "./Template2View";
import Template3View from "./Template3View";
import type { PublicLandingConfig } from "./types";

type Props = {
  slug: string;
  config: PublicLandingConfig;
};

export default function PublicLanding({ slug, config }: Props) {
  const isTemplate2 = config.layout?.template === 2;
  const isTemplate3 = config.layout?.template === 3;

  const pixelId = String(config.tracking?.pixelId || "").trim().replace(/\D+/g, "");
  const pixelBlock = pixelId ? (
    <>
      <PixelInit pixelId={pixelId} />
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
        <Template3View slug={slug} config={config} />
      </>
    );
  }

  if (isTemplate2) {
    return (
      <>
        {pixelBlock}
        <Template2View slug={slug} config={config} />
      </>
    );
  }

  return (
    <>
      {pixelBlock}
      <Template1View slug={slug} config={config} />
    </>
  );
}
