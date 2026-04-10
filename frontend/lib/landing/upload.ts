import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "landing-images";
const MAX_FILE_SIZE_BYTES = 700 * 1024; // 700 KB
const MAX_IMAGE_DIMENSION = 1920; // px

async function validateImageFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".avif")) {
    throw new Error("Formato inválido. Solo se permite .avif.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("La imagen supera el máximo de 700 KB.");
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width > MAX_IMAGE_DIMENSION || bitmap.height > MAX_IMAGE_DIMENSION) {
      throw new Error("La imagen supera el máximo de 1920x1920 px.");
    }
  } finally {
    bitmap?.close();
  }
}

/**
 * Sube un archivo al bucket landing-images en la carpeta del usuario.
 * Devuelve la URL pública para guardarla en la config.
 */
export async function uploadLandingImage(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  await validateImageFile(file);
  const ext = "avif";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "86400",
      upsert: false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}
