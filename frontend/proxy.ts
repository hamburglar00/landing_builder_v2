import { NextResponse, type NextRequest } from "next/server";
import {
  getPublicLandingHost,
  getPublicLandingRoutingSettings,
} from "@/lib/publicLandingRouting";

const DEFAULT_PROMOTIONS_PUBLIC_HOST = "sorteosgolden.vercel.app";

function getPromotionsPublicHost(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_PROMOTIONS_PUBLIC_BASE_URL || "";
  try {
    return configuredUrl ? new URL(configuredUrl).host.toLowerCase() : DEFAULT_PROMOTIONS_PUBLIC_HOST;
  } catch {
    return DEFAULT_PROMOTIONS_PUBLIC_HOST;
  }
}

function isAllowedAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    /\.(avif|css|gif|ico|jpeg|jpg|js|json|png|svg|webp|woff2?)$/i.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const promotionsHost = getPromotionsPublicHost();
  const publicLandingHost = getPublicLandingHost();
  const requestHost = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

  if (requestHost === publicLandingHost) {
    return handlePublicLandingHost(request, pathname);
  }

  if (requestHost === promotionsHost && !pathname.startsWith("/promo/") && !isAllowedAssetPath(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.next();
}

async function handlePublicLandingHost(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/public-landing-legacy/")) {
    return NextResponse.next();
  }

  const routing = await getPublicLandingRoutingSettings();

  if (routing.runtime === "legacy") {
    const proxyUrl = request.nextUrl.clone();
    proxyUrl.pathname = `/api/public-landing-legacy${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(proxyUrl);
  }

  if (
    pathname.startsWith("/l/") ||
    pathname.startsWith("/api/") ||
    isAllowedAssetPath(pathname)
  ) {
    return NextResponse.next();
  }

  const slug = pathname.replace(/^\/+|\/+$/g, "");
  if (!slug) {
    return new NextResponse("Not found", { status: 404 });
  }

  const internalUrl = request.nextUrl.clone();
  internalUrl.pathname = `/l/${slug}`;
  return NextResponse.rewrite(internalUrl);
}

export const config = {
  matcher: ["/:path*"],
};
