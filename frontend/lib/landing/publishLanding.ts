import type { PublishTarget } from "./types";
import { buildLandingPublicUrl } from "./publicUrls";
import { requestRevalidation } from "@/lib/revalidation/client";
import { fetchGatewayOriginCatalog, gatewayPublicationOrigin, type GatewayPublicationConfig } from "./gatewayPublication";

type PublishLandingParams = {
  landingId: string;
  name: string;
  publishTarget: PublishTarget;
  classicBaseUrl?: string | null;
  config?: Partial<GatewayPublicationConfig>;
};

export async function publishLandingChanges({ landingId, name, publishTarget, classicBaseUrl, config }: PublishLandingParams) {
  // Editable URL settings are used only for public links, never credential transport.
  const gatewayOrigin = publishTarget === "gateway" ? gatewayPublicationOrigin(config, await fetchGatewayOriginCatalog()) : undefined;
  if (publishTarget === "gateway" && !gatewayOrigin) throw new Error("Elegí una Template 7 o 9 con destino Atrio y un gateway configurado.");
  const publicUrl = buildLandingPublicUrl(name, publishTarget, classicBaseUrl, gatewayOrigin);
  try {
    await requestRevalidation({ action: "publish", landingId, publishTarget });
    return { publicUrl, revalidated: true };
  } catch {
    if (publishTarget !== "classic") {
      throw new Error("La landing se guardó, pero no se pudo publicar al instante. Probá guardar de nuevo o esperá unos segundos.");
    }
    return { publicUrl, revalidated: false };
  }
}
