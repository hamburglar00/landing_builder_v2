const STORAGE_OBJECT_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const STORAGE_RENDER_PUBLIC_SEGMENT = "/storage/v1/render/image/public/";

interface TransformOptions {
  width?: number;
  quality?: number;
}

function isSupabaseStoragePublicUrl(url: string): boolean {
  return (
    url.includes(STORAGE_OBJECT_PUBLIC_SEGMENT) ||
    url.includes(STORAGE_RENDER_PUBLIC_SEGMENT)
  );
}

export function buildOptimizedImageUrl(
  rawUrl: string,
  options: TransformOptions = {},
): string {
  if (!rawUrl) return rawUrl;
  if (!isSupabaseStoragePublicUrl(rawUrl)) return rawUrl;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  parsed.pathname = parsed.pathname.replace(
    STORAGE_OBJECT_PUBLIC_SEGMENT,
    STORAGE_RENDER_PUBLIC_SEGMENT,
  );

  const width = options.width ?? 1280;
  const quality = options.quality ?? 65;

  if (Number.isFinite(width) && width > 0) {
    parsed.searchParams.set("width", String(Math.round(width)));
  }
  if (Number.isFinite(quality) && quality > 0) {
    parsed.searchParams.set("quality", String(Math.round(quality)));
  }

  return parsed.toString();
}

export function buildResponsiveImageSet(rawUrl: string): {
  mobile: string;
  tablet: string;
  desktop: string;
} {
  return {
    mobile: buildOptimizedImageUrl(rawUrl, { width: 640, quality: 55 }),
    tablet: buildOptimizedImageUrl(rawUrl, { width: 960, quality: 58 }),
    desktop: buildOptimizedImageUrl(rawUrl, { width: 1280, quality: 60 }),
  };
}
