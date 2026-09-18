import type { PublishTarget } from "./types";
import { buildLandingPublicUrl } from "./publicUrls";
import { requestRevalidation } from "@/lib/revalidation/client";

type PublishLandingParams = {
  landingId: string;
  name: string;
  publishTarget: PublishTarget;
  classicBaseUrl?: string | null;
};

export async function publishLandingChanges({ landingId, name, publishTarget, classicBaseUrl }: PublishLandingParams) {
  // Editable URL settings are used only for public links, never credential transport.
  const publicUrl = buildLandingPublicUrl(name, publishTarget, classicBaseUrl);
  try {
    await requestRevalidation({ action: "publish", landingId, publishTarget });
    return { publicUrl, revalidated: true };
  } catch {
    if (publishTarget === "constructor") {
      throw new Error("La landing se guardó, pero no se pudo publicar al instante. Probá guardar de nuevo o esperá unos segundos.");
    }
    return { publicUrl, revalidated: false };
  }
}
