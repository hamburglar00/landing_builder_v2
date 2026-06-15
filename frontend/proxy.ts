import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_PROMOTIONS_PUBLIC_HOST = "sorteosgolden.vercel.app";
const DEFAULT_CLASSIC_LANDING_PUBLIC_HOST = "landing.panelbotadmin.com";

function getPromotionsPublicHost(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_PROMOTIONS_PUBLIC_BASE_URL || "";
  try {
    return configuredUrl ? new URL(configuredUrl).host.toLowerCase() : DEFAULT_PROMOTIONS_PUBLIC_HOST;
  } catch {
    return DEFAULT_PROMOTIONS_PUBLIC_HOST;
  }
}

function getClassicLandingPublicHost(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_CLASSIC_LANDING_BASE_URL ||
    process.env.NEXT_PUBLIC_PUBLIC_LANDING_BASE_URL ||
    process.env.NEXT_PUBLIC_LANDING_PUBLIC_BASE_URL ||
    "";

  try {
    return configuredUrl
      ? new URL(configuredUrl).host.toLowerCase()
      : DEFAULT_CLASSIC_LANDING_PUBLIC_HOST;
  } catch {
    return DEFAULT_CLASSIC_LANDING_PUBLIC_HOST;
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

function isAllowedClassicLandingApiPath(pathname: string): boolean {
  return pathname === "/api/track" || pathname === "/api/revalidate";
}

function handleClassicLandingHost(request: NextRequest, pathname: string) {
  if (isAllowedAssetPath(pathname) || isAllowedClassicLandingApiPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/l/")) {
    return NextResponse.next();
  }

  const slug = pathname.replace(/^\/+|\/+$/g, "");
  if (!slug || slug.includes("/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const internalUrl = request.nextUrl.clone();
  internalUrl.pathname = `/l/${slug}`;
  return NextResponse.rewrite(internalUrl);
}

export async function proxy(request: NextRequest) {
  const promotionsHost = getPromotionsPublicHost();
  const classicLandingHost = getClassicLandingPublicHost();
  const requestHost = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

  if (requestHost === classicLandingHost) {
    return handleClassicLandingHost(request, pathname);
  }

  if (requestHost === promotionsHost && !pathname.startsWith("/promo/") && !isAllowedAssetPath(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
