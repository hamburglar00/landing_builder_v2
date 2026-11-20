import { isMultiSkinCode } from "../multi-skin-catalog";
import { getMultiSkinBrand } from "../skin-branding";

/** Landing-only artwork. The gateway origin, provider and skin stay with the published page. */
export function landingEntryBrand(provider: unknown, skin: unknown, template: unknown) {
  if (provider !== "multi_skin") return undefined;
  if ((template === 7 || template === 9) && (!skin || skin === "ganamos_plus")) {
    return { name: "Ganamos+", logo: "/ganamos-wordmark.webp" };
  }
  return isMultiSkinCode(skin) ? getMultiSkinBrand(skin) : undefined;
}
