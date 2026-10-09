import type { PublicLandingConfig } from "@/components/public-landing/types";
import { getPublicLandingConfig } from "@/components/public-landing/getLandingConfig";
import { renderPublicLandingHtml } from "@/components/public-landing/renderPublicLandingHtml";
import { createDemoSession, demoSessionCookie, isDemoLandingAllowed, loadDemoLanding, readDemoConfig, readDemoCookie, verifyDemoSession, type DemoConfig, type DemoLanding } from "./demo.server";

export type DemoPageDependencies = {
  config(): DemoConfig | null;
  landing(slug: string): Promise<DemoLanding | null>;
  publicConfig(slug: string): Promise<PublicLandingConfig | null>;
};

const productionDependencies: DemoPageDependencies = {
  config: readDemoConfig,
  landing: loadDemoLanding,
  publicConfig: getPublicLandingConfig,
};

function headers(contentType = "text/html; charset=utf-8"): Headers {
  return new Headers({
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: headers("text/plain; charset=utf-8") });
}

export async function handleDemoPage(request: Request, slug: string, deps: DemoPageDependencies = productionDependencies): Promise<Response> {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: headers("text/plain; charset=utf-8") });
  const config = deps.config();
  if (!config) return notFound();
  let landing: DemoLanding | null;
  try { landing = await deps.landing(slug); }
  catch { return new Response("Service unavailable", { status: 503, headers: headers("text/plain; charset=utf-8") }); }
  if (!landing || landing.name !== slug || !isDemoLandingAllowed(landing, config)) return notFound();
  const url = new URL(request.url);
  if (url.search) return new Response(null, { status: 303, headers: new Headers([...headers(), ["Location", url.pathname]]) });

  try {
    const published = await deps.publicConfig(slug);
    if (!published || published.id !== landing.id || published.layout?.template !== 7) return notFound();
    const response = new Response(renderPublicLandingHtml({ slug, config: published, demoMode: true }), { status: 200, headers: headers() });
    const cookie = readDemoCookie(request);
    if (cookie === null || !verifyDemoSession(cookie, landing.id, slug, config)) {
      response.headers.append("Set-Cookie", demoSessionCookie(createDemoSession(landing.id, slug, config)));
    }
    return response;
  } catch { return new Response("Service unavailable", { status: 503, headers: headers("text/plain; charset=utf-8") }); }
}
