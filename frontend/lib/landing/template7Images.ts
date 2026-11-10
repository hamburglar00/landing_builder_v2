/** Public derivatives only. The editor's original URL is never overwritten. */
type ImageConfig = {
  layout?: { template?: number };
  content?: {
    logoUrl?: string; logoSrcSet?: string; logoOriginalUrl?: string;
    template4?: { profileImageUrl?: string; backgroundImageUrl?: string };
    template5?: { profileImageUrl?: string; backgroundImageUrl?: string };
    template6?: { backgroundImageUrl?: string; cards?: Array<{ imageUrl: string }> };
    template8?: { backgroundImageUrl?: string; cards?: Array<{ imageUrl: string }> };
  };
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
    url.searchParams.set("quality", height ? "75" : "65");
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

export { originalUrl as publicImageOriginalUrl };

export function template7Logo(raw: string) {
  const variants = [1, 2].map(scale => template7ImageUrl(raw, 170 * scale, 138 * scale));
  return {
    src: variants[1],
    srcSet: variants[0] === raw ? "" : variants.map((url, index) => `${url} ${index + 1}x`).join(", "),
    variants: [...new Set(variants)],
  };
}

export function template8Image(raw: string, background = false) {
  const widths = background ? [640, 1024, 1600] : [240, 480, 720];
  const variants = widths.map(width => template7ImageUrl(raw, width));
  return {
    src: variants[background ? 0 : 1],
    srcSet: variants.every(url => url === raw) ? "" : variants.map((url, index) => `${url} ${widths[index]}w`).join(", "),
    sizes: background ? "100vw" : "(max-width: 540px) calc((100vw - 42px) / 2), 240px",
  };
}

/** Also covers already-published landings without rewriting their saved config. */
export function optimizeTemplate7Images<T extends ImageConfig>(config: T): T {
  if (config.layout?.template === 8 && config.content?.template8) {
    const cover = config.content.template8;
    return { ...config, content: { ...config.content, template8: {
      ...cover,
      backgroundImageUrl: template8Image(cover.backgroundImageUrl || "", true).src,
      cards: (cover.cards || []).map(card => ({ ...card, imageUrl: template8Image(card.imageUrl).src })),
    } } };
  }
  if (config.layout?.template === 9) return config;
  const logo = template7Logo(config.content?.logoUrl || "");
  const images = config.background?.images || [];
  return {
    ...config,
    ...(config.content ? { content: { ...config.content, logoUrl: logo.src, logoSrcSet: logo.srcSet, logoOriginalUrl: originalUrl(config.content.logoUrl || ""),
      ...Object.fromEntries(([4, 5] as const).flatMap(template => {
        const key = `template${template}` as 'template4' | 'template5', section = config.content?.[key];
        return section ? [[key, { ...section,
          profileImageUrl: template7ImageUrl(section.profileImageUrl || '', 192, 192),
          backgroundImageUrl: template7ImageUrl(section.backgroundImageUrl || '', 1024),
        }]] : [];
      })),
      ...(config.content.template6 ? { template6: { ...config.content.template6,
        backgroundImageUrl: template8Image(config.content.template6.backgroundImageUrl || '', true).src,
        cards: (config.content.template6.cards || []).map(card => ({ ...card, imageUrl: template8Image(card.imageUrl).src })),
      } } : {}),
    } } : {}),
    ...(config.background ? { background: {
      ...config.background,
      images: images.map(url => template7ImageUrl(url, 640)),
      imagesOriginal: images.map(originalUrl),
      imagesResponsive: images.map((url, index) => template7ImageUrl(url, 640) === url && config.background?.imagesResponsive?.[index] ? config.background.imagesResponsive[index] : ({
        mobile: template7ImageUrl(url, 640),
        tablet: template7ImageUrl(url, 1024),
        desktop: template7ImageUrl(url, 1600),
      })),
    } } : {}),
  };
}

export function template7ImageWarmUrls(config: ImageConfig): string[] {
  if (config.layout?.template === 9) return [];
  const urls = [
    ...template7Logo(config.content?.logoUrl || "").variants,
    ...(config.background?.images || []).slice(0, 6).flatMap(url => [640, 1024, 1600].map(width => template7ImageUrl(url, width))),
    ...([config.content?.template6, config.content?.template8].flatMap(cover => !cover ? [] : [template8Image(cover.backgroundImageUrl || '', true).src, ...(cover.cards || []).map(card => template8Image(card.imageUrl).src)])),
    ...([config.content?.template4, config.content?.template5].flatMap(section => !section ? [] : [template7ImageUrl(section.profileImageUrl || '', 192, 192), template7ImageUrl(section.backgroundImageUrl || '', 1024)])),
  ];
  return [...new Set(urls)].filter(url => {
    try { return new URL(url).pathname.startsWith(RENDER_PATH) && template7ImageUrl(url, 1) !== url; }
    catch { return false; }
  });
}
