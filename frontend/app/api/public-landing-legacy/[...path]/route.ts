import { NextRequest, NextResponse } from "next/server";
import { getPublicLandingRoutingSettings } from "@/lib/publicLandingRouting";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function buildProxyHeaders(request: NextRequest, targetHost: string) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedKey)) return;
    headers.set(key, value);
  });

  headers.set("host", targetHost);
  headers.set("x-forwarded-host", request.headers.get("host") || "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  return headers;
}

function buildResponseHeaders(response: Response, publicHost: string) {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedKey)) return;

    if (normalizedKey === "location") {
      try {
        const location = new URL(value);
        location.host = publicHost;
        headers.set(key, location.toString());
        return;
      } catch {
        headers.set(key, value);
        return;
      }
    }

    headers.set(key, value);
  });

  return headers;
}

async function proxyLegacy(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const { legacyBaseUrl } = await getPublicLandingRoutingSettings();
  const legacyBase = new URL(legacyBaseUrl);
  const targetUrl = new URL(`/${path.join("/")}`, legacyBase);
  targetUrl.search = request.nextUrl.search;

  const requestBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: buildProxyHeaders(request, legacyBase.host),
    body: requestBody,
    redirect: "manual",
    cache: "no-store",
  });

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: buildResponseHeaders(
      response,
      request.headers.get("host") || request.nextUrl.host,
    ),
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyLegacy(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyLegacy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyLegacy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyLegacy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyLegacy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyLegacy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyLegacy(request, context);
}
