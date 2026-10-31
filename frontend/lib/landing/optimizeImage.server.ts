import sharp from "sharp";
import { MAX_LANDING_IMAGE_INPUT_BYTES } from "./imageUploadPolicy";

export const MAX_LANDING_IMAGE_OUTPUT_BYTES = 700 * 1024;
const MAX_PIXELS = 25_000_000;
const MAX_DIMENSION = 1920;
const FORMATS = { jpeg: ["image/jpeg", "jpg"], png: ["image/png", "png"], webp: ["image/webp", "webp"], heif: ["image/avif", "avif"] } as const;

export class ImageOptimizationError extends Error {}

function validateRasterSignature(input: Buffer) {
  const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
  const webp = input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
  const avif = input.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(input.toString("ascii", 8, Math.min(input.readUInt32BE(0), 128)));
  if (!png && !jpeg && !webp && !avif) throw new ImageOptimizationError("Elegí una imagen JPG, PNG, WebP o AVIF estática.");
  // libvips can decode APNG's first frame as a PNG. Never silently flatten it.
  if (png) {
    for (let offset = 8; offset + 12 <= input.length;) {
      const length = input.readUInt32BE(offset);
      if (input.toString("ascii", offset + 4, offset + 8) === "acTL") throw new ImageOptimizationError("Las imágenes animadas no se comprimen automáticamente. Elegí una imagen estática.");
      offset += length + 12;
    }
  }
}

/** Decode only bounded, static raster files. Keep the caller's original separately. */
export async function optimizeLandingImage(input: Buffer) {
  if (!input.length || input.length > MAX_LANDING_IMAGE_INPUT_BYTES) {
    throw new ImageOptimizationError("La imagen debe pesar hasta 4 MB.");
  }
  try {
    validateRasterSignature(input);
    const image = sharp(input, { limitInputPixels: MAX_PIXELS, animated: true, failOn: "warning" });
    const metadata = await image.metadata();
    const format = metadata.format as keyof typeof FORMATS;
    if (!(format in FORMATS) || (format === "heif" && metadata.compression !== "av1")) {
      throw new ImageOptimizationError("Elegí una imagen JPG, PNG, WebP o AVIF estática.");
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new ImageOptimizationError("Las imágenes animadas no se comprimen automáticamente. Elegí una imagen estática.");
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) {
      throw new ImageOptimizationError("La imagen supera los 25 megapíxeles permitidos.");
    }
    const normalized = image.autoOrient().resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true }).toColourspace("srgb");
    let output = await normalized.clone().webp({ quality: 82, alphaQuality: 100, effort: 4 }).toBuffer();
    if (output.length > MAX_LANDING_IMAGE_OUTPUT_BYTES) {
      output = await normalized.clone().webp({ quality: 72, alphaQuality: 100, effort: 4 }).toBuffer();
    }
    if (output.length > MAX_LANDING_IMAGE_OUTPUT_BYTES) {
      throw new ImageOptimizationError("La imagen tiene demasiado detalle para optimizarla. Probá con una versión más pequeña.");
    }
    const [originalType, originalExtension] = FORMATS[format];
    // AVIF needs a WebP derivative for older iPhones. Keep smaller compatible files
    // only if orientation and color conversion do not need applying.
    const keepInput = format !== "heif" && input.length <= output.length
      && metadata.width <= MAX_DIMENSION && metadata.height <= MAX_DIMENSION
      && !metadata.orientation && !metadata.icc && !metadata.exif && !metadata.xmp && !metadata.iptc;
    return {
      body: keepInput ? input : output,
      contentType: keepInput ? originalType : "image/webp",
      extension: keepInput ? originalExtension : "webp",
      originalType, originalExtension,
    };
  } catch (error) {
    if (error instanceof ImageOptimizationError) throw error;
    throw new ImageOptimizationError("No pudimos leer la imagen. Elegí un archivo estático válido de hasta 25 megapíxeles.");
  }
}
