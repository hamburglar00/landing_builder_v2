import { buildPublicLandingRuntimeSource } from "@/components/public-landing/PublicLandingRuntimeScript";

export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
  return new Response(buildPublicLandingRuntimeSource(), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
