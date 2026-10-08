import type { PublicLandingConfig } from "@/components/public-landing/types";
import { getPublicLandingConfig } from "@/components/public-landing/getLandingConfig";
import { renderPublicLandingHtml } from "@/components/public-landing/renderPublicLandingHtml";
import { allowDemoKeyAttempt } from "./rateLimit.server";
import { createDemoSession, demoSessionCookie, isDemoLandingAllowed, loadDemoLanding, readDemoConfig, readDemoCookie, verifyDemoAccessKey, verifyDemoSession, type DemoConfig, type DemoLanding } from "./demo.server";

export type DemoPageDependencies = {
  config(): DemoConfig | null;
  landing(slug: string): Promise<DemoLanding | null>;
  publicConfig(slug: string): Promise<PublicLandingConfig | null>;
  allowKey(request: Request, landingId: string): Promise<boolean>;
};

const productionDependencies: DemoPageDependencies = {
  config: readDemoConfig,
  landing: loadDemoLanding,
  publicConfig: getPublicLandingConfig,
  allowKey: allowDemoKeyAttempt,
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function keyPage(path: string, message = ""): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demostración · Template 7</title></head><body><main><h1>Acceso a la demostración</h1><p>Ingresá la clave para ver esta landing de prueba.</p>${message ? `<p role="alert">${escapeHtml(message)}</p>` : ""}<form method="post" action="${escapeHtml(path)}"><label for="access-key">Clave de demostración</label><input id="access-key" name="access_key" type="password" autocomplete="off" required><button type="submit">Ingresar</button></form></main></body></html>`;
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: headers("text/plain; charset=utf-8") });
}

export async function handleDemoPage(request: Request, slug: string, deps: DemoPageDependencies = productionDependencies): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: headers("text/plain; charset=utf-8") });
  const config = deps.config();
  if (!config) return notFound();
  let landing: DemoLanding | null;
  try { landing = await deps.landing(slug); }
  catch { return new Response("Service unavailable", { status: 503, headers: headers("text/plain; charset=utf-8") }); }
  if (!landing || landing.name !== slug || !isDemoLandingAllowed(landing, config)) return notFound();
  const url = new URL(request.url);
  if (request.method === "GET" && url.search) return new Response(null, { status: 303, headers: new Headers([...headers(), ["Location", url.pathname]]) });
  if (request.method === "POST") {
    if (url.search || (request.headers.get("origin") && request.headers.get("origin") !== url.origin)) {
      return new Response("Invalid request", { status: 403, headers: headers("text/plain; charset=utf-8") });
    }
    const contentType = request.headers.get("content-type") || "";
    if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType) || Number(request.headers.get("content-length") || 0) > 1024) {
      return new Response("Invalid request", { status: 400, headers: headers("text/plain; charset=utf-8") });
    }
    try {
      if (!await deps.allowKey(request, landing.id)) {
        const limited = new Response(keyPage(url.pathname, "Demasiados intentos. Probá más tarde."), { status: 429, headers: headers() });
        limited.headers.set("Retry-After", "900");
        return limited;
      }
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 1024) return new Response("Invalid request", { status: 413, headers: headers("text/plain; charset=utf-8") });
      const form = new URLSearchParams(raw);
      const candidate = form.get("access_key") || "";
      if (!verifyDemoAccessKey(candidate, config)) {
        return new Response(keyPage(url.pathname, "Clave incorrecta."), { status: 401, headers: headers() });
      }
      const response = new Response(null, { status: 303, headers: headers() });
      response.headers.set("Location", url.pathname);
      response.headers.append("Set-Cookie", demoSessionCookie(createDemoSession(landing.id, slug, config)));
      return response;
    } catch { return new Response("Service unavailable", { status: 503, headers: headers("text/plain; charset=utf-8") }); }
  }

  const cookie = readDemoCookie(request);
  if (cookie !== null && !verifyDemoSession(cookie, landing.id, slug, config)) {
    return new Response(keyPage(url.pathname, "La autorización venció o no es válida."), { status: 401, headers: headers() });
  }
  if (cookie === null) return new Response(keyPage(url.pathname), { status: 200, headers: headers() });
  try {
    const published = await deps.publicConfig(slug);
    if (!published || published.id !== landing.id || published.layout?.template !== 7) return notFound();
    return new Response(renderPublicLandingHtml({ slug, config: published, demoMode: true }), { status: 200, headers: headers() });
  } catch { return new Response("Service unavailable", { status: 503, headers: headers("text/plain; charset=utf-8") }); }
}
