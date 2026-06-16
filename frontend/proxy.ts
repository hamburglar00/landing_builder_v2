import { NextResponse, type NextRequest } from "next/server";

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
  const requestHost = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

  if (requestHost === promotionsHost && !pathname.startsWith("/promo/") && !isAllowedAssetPath(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
