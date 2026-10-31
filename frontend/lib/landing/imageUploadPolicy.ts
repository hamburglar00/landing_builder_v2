export const MAX_LANDING_IMAGE_INPUT_BYTES = 4 * 1024 * 1024;
export const LANDING_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif";

export function validateLandingImageInput(file: Pick<File, "name" | "size">): void {
  if (!/\.(jpe?g|png|webp|avif)$/i.test(file.name)) {
    throw new Error("Elegí una imagen JPG, PNG, WebP o AVIF estática.");
  }
  if (!file.size || file.size > MAX_LANDING_IMAGE_INPUT_BYTES) {
    throw new Error("La imagen debe pesar hasta 4 MB.");
  }
}
