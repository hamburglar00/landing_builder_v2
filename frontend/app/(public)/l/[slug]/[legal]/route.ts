import { getPublicLandingConfig } from "@/components/public-landing/getLandingConfig";
import { renderTemplate9LegalHtml, TEMPLATE9_LEGAL_PAGES } from "@/components/public-landing/template9Legal";
import { PUBLIC_LANDING_FAVICON_LINK } from "@/components/public-landing/publicLandingFavicon";

export const revalidate = 60;
export const dynamic = "force-static";

export async function GET(_request: Request, context: { params: Promise<{ slug: string; legal: string }> }) {
  const { slug, legal } = await context.params;
  if (!Object.hasOwn(TEMPLATE9_LEGAL_PAGES, legal)) return new Response("Not found", { status: 404 });
  const config = await getPublicLandingConfig(slug);
  const html = config && renderTemplate9LegalHtml(config, legal, `/l/${encodeURIComponent(slug)}`)?.replace('</head>', `${PUBLIC_LANDING_FAVICON_LINK}</head>`);
  return new Response(html || "Not found", {
    status: html ? 200 : 404,
    headers: {
      "Content-Type": html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
