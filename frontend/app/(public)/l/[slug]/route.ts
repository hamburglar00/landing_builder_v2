import { getCachedLandingPhone } from "@/components/public-landing/getCachedLandingPhone";
import { getPublicLandingConfig } from "@/components/public-landing/getLandingConfig";
import { renderPublicLandingHtml } from "@/components/public-landing/renderPublicLandingHtml";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = 15;
export const dynamic = "force-static";

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const config = await getPublicLandingConfig(slug);

  if (!config) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=15",
      },
    });
  }

  const cachedPhone = await getCachedLandingPhone(slug);
  const html = renderPublicLandingHtml({ slug, config, cachedPhone });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
    },
  });
}
