import { MAX_LANDING_IMAGE_INPUT_BYTES } from "./imageUploadPolicy";
import { ImageOptimizationError, optimizeLandingImage } from "./optimizeImage.server";

type Dependencies = { authenticate: (token: string) => Promise<boolean>; optimize?: typeof optimizeLandingImage };
let active = 0;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const failure = (error: string, status: number) => Response.json({ error }, { status, headers });

export async function handleLandingImageOptimization(request: Request, deps: Dependencies): Promise<Response> {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [^\s]+$/.test(authorization)) return failure("Volvé a iniciar sesión para subir la imagen.", 401);
  try {
    if (!await deps.authenticate(authorization.slice(7))) return failure("Volvé a iniciar sesión para subir la imagen.", 401);
  } catch { return failure("No pudimos verificar tu sesión. Volvé a intentar.", 503); }
  if (active >= 2) return failure("Hay otras imágenes procesándose. Volvé a intentar en unos segundos.", 429);
  if (Number(request.headers.get("content-length") || 0) > MAX_LANDING_IMAGE_INPUT_BYTES) return failure("La imagen debe pesar hasta 4 MB.", 413);
  const reader = request.body?.getReader();
  if (!reader) return failure("Elegí una imagen.", 400);
  active++;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_LANDING_IMAGE_INPUT_BYTES) {
        await reader.cancel();
        return failure("La imagen debe pesar hasta 4 MB.", 413);
      }
      chunks.push(value);
    }
    const result = await (deps.optimize ?? optimizeLandingImage)(Buffer.concat(chunks));
    return new Response(new Uint8Array(result.body), { headers: {
      ...headers, "Content-Type": result.contentType,
      "X-Image-Extension": result.extension, "X-Original-Type": result.originalType,
      "X-Original-Extension": result.originalExtension,
    } });
  } catch (error) {
    return failure(error instanceof ImageOptimizationError ? error.message : "No pudimos procesar la imagen. Volvé a intentar.", 400);
  } finally { active--; reader.releaseLock(); }
}
