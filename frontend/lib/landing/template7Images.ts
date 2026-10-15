/** Public derivatives only. The editor's original URL is never overwritten. */
type ImageConfig = {
  layout?: { template?: number };
  content?: { logoUrl?: string; logoSrcSet?: string; logoOriginalUrl?: string };
  background?: {
    images?: string[];
    imagesResponsive?: Array<{ mobile: string; tablet: string; desktop: string }>;
    imagesOriginal?: string[];
  };
};

const OBJECT_PATH = "/storage/v1/object/public/landing-images/";
const RENDER_PATH = "/storage/v1/render/image/public/landing-images/";

export function template7ImageUrl(raw: string, width: number, height?: number): string {
  try {
    const url = new URL(raw);
    if (!Number.isInteger(width) || width < 1 || width > 2500
      || (height !== undefined && (!Number.isInteger(height) || height < 1 || height > 2500))
      || url.protocol !== "https:" || url.username || url.password || url.hash
      || !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)
      || (!url.pathname.startsWith(OBJECT_PATH) && !url.pathname.startsWith(RENDER_PATH))) return raw;
    // Do not change signed/private URLs or arbitrary third-party query parameters.
    if ([...url.searchParams.keys()].some(key => !["width", "height", "quality", "resize", "format"].includes(key))) return raw;
    url.pathname = url.pathname.replace(OBJECT_PATH, RENDER_PATH);
    url.search = "";
    url.searchParams.set("width", String(width));
    if (height) url.searchParams.set("height", String(height));
    url.searchParams.set("resize", "contain");
    url.searchParams.set("quality", height ? "80" : "65");
    return url.toString();
  } catch { return raw; }
}

function originalUrl(raw: string): string {
  if (template7ImageUrl(raw, 1) === raw) return raw;
  const url = new URL(raw);
  url.pathname = url.pathname.replace(RENDER_PATH, OBJECT_PATH);
  url.search = "";
  return url.toString();
}

export function template7Logo(raw: string) {
  const variants = [1, 2, 3].map(scale => template7ImageUrl(raw, 170 * scale, 138 * scale));
  return {
    src: variants[1],
    srcSet: variants[0] === raw ? "" : variants.map((url, index) => `${url} ${index + 1}x`).join(", "),
    variants: [...new Set(variants)],
  };
}

/** Also covers already-published landings without rewriting their saved config. */
export function optimizeTemplate7Images<T extends ImageConfig>(config: T): T {
  if (config.layout?.template !== 7) return config;
  const logo = template7Logo(config.content?.logoUrl || "");
  const images = config.background?.images || [];
  return {
    ...config,
    ...(config.content ? { content: { ...config.content, logoUrl: logo.src, logoSrcSet: logo.srcSet, logoOriginalUrl: originalUrl(config.content.logoUrl || "") } } : {}),
    ...(config.background ? { background: {
      ...config.background,
      images: images.map(url => template7ImageUrl(url, 640)),
      imagesOriginal: images.map(originalUrl),
      imagesResponsive: images.map(url => ({
        mobile: template7ImageUrl(url, 640),
        tablet: template7ImageUrl(url, 1024),
        desktop: template7ImageUrl(url, 1600),
      })),
    } } : {}),
  };
}

export function template7ImageWarmUrls(config: ImageConfig): string[] {
  if (config.layout?.template !== 7) return [];
  const urls = [
    ...template7Logo(config.content?.logoUrl || "").variants,
    ...(config.background?.images || []).slice(0, 6).flatMap(url => [640, 1024, 1600].map(width => template7ImageUrl(url, width))),
  ];
  return [...new Set(urls)].filter(url => {
    try { return new URL(url).pathname.startsWith(RENDER_PATH) && template7ImageUrl(url, 1) !== url; }
    catch { return false; }
  });
}
