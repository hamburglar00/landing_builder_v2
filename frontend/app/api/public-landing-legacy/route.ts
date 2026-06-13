import { NextRequest, NextResponse } from "next/server";
import { getPublicLandingRoutingSettings } from "@/lib/publicLandingRouting";

export async function GET(request: NextRequest) {
  const { legacyBaseUrl } = await getPublicLandingRoutingSettings();
  const targetUrl = new URL(legacyBaseUrl);
  targetUrl.search = request.nextUrl.search;

  const response = await fetch(targetUrl, {
    headers: {
      "user-agent": request.headers.get("user-agent") || "",
      accept: request.headers.get("accept") || "*/*",
    },
    redirect: "manual",
    cache: "no-store",
  });

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function HEAD(request: NextRequest) {
  const response = await GET(request);
  return new NextResponse(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
