import { PUBLIC_LANDING_CSS } from "@/components/public-landing/publicLandingCss";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(PUBLIC_LANDING_CSS, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
      "Vercel-CDN-Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
