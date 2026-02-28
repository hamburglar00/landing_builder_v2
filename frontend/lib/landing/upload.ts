import type { SupabaseClient } from "@supabase/supabase-js";

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
  const ext = "avif";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}
