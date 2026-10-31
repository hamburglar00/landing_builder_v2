import type { SupabaseClient } from "@supabase/supabase-js";
import { validateLandingImageInput } from "./imageUploadPolicy";

const BUCKET = "landing-images";

/**
 * Sube un archivo al bucket landing-images en la carpeta del usuario.
 * Devuelve la URL pública para guardarla en la config.
 */
export async function uploadLandingImage(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  validateLandingImageInput(file);
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session || session.user.id !== userId) throw new Error("Volvé a iniciar sesión para subir la imagen.");
  const response = await fetch("/api/landing-images/optimize", {
    method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/octet-stream" },
    body: file, cache: "no-store", signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(typeof result?.error === "string" ? result.error : "No pudimos optimizar la imagen.");
  }
  const optimized = await response.blob();
  const extension = response.headers.get("x-image-extension") || "";
  const originalExtension = response.headers.get("x-original-extension") || "";
  if (!/^(jpg|png|webp)$/.test(extension) || !/^(jpg|png|webp|avif)$/.test(originalExtension)) throw new Error("No pudimos optimizar la imagen.");
  const id = crypto.randomUUID();
  const originalPath = `${userId}/originals/${id}.${originalExtension}`;
  const path = `${userId}/${id}.${extension}`;
  const storage = supabase.storage.from(BUCKET);
  const original = await storage.upload(originalPath, file, {
    cacheControl: "31536000", upsert: false, contentType: response.headers.get("x-original-type")!,
  });
  if (original.error) throw new Error("No pudimos guardar el original. Volvé a intentar.");
  const saved = await storage.upload(path, optimized, { cacheControl: "31536000", upsert: false, contentType: optimized.type });
  if (saved.error) {
    await storage.remove([originalPath]).catch(() => undefined);
    throw new Error("No pudimos guardar la imagen optimizada. Volvé a intentar.");
  }
  return storage.getPublicUrl(path).data.publicUrl;
}
