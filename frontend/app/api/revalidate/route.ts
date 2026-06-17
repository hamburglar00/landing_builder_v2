import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

type RevalidateBody = {
  name?: unknown;
  secret?: unknown;
};

const WARM_TIMEOUT_MS = 8000;
const DEFAULT_ALLOWED_ORIGINS = [
  "https://constructor.panelbotadmin.com",
  "https://mkt.panelbotadmin.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3017",
];

function getAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonWithCors(
  request: NextRequest,
  body: Record<string, unknown>,
  init?: ResponseInit,
) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...getCorsHeaders(request),
      ...(init?.headers || {}),
    },
  });
}

async function verifySecret(secret: string) {
  const fallbackSecret = process.env.REVALIDATE_SECRET || "";
  if (fallbackSecret && secret === fallbackSecret) return true;

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey || !secret) return false;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/rest/v1/rpc/verify_revalidate_secret`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ p_secret: secret }),
        cache: "no-store",
      },
    );

    if (!response.ok) return false;
    return Boolean(await response.json());
  } catch {
    return false;
  }
}

function normalizeLandingName(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

async function warmConstructorLanding(request: NextRequest, name: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WARM_TIMEOUT_MS);
  const warmUrl = new URL(`/l/${encodeURIComponent(name)}`, request.nextUrl.origin);

  try {
    const response = await fetch(warmUrl.toString(), {
      cache: "no-store",
      headers: {
        "x-landing-revalidate-warm": "1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        url: warmUrl.toString(),
        status: response.status,
        error: `warm_failed_${response.status}`,
      };
    }

    return {
      ok: true,
      url: warmUrl.toString(),
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      url: warmUrl.toString(),
      status: 0,
      error: error instanceof Error ? error.message : "warm_failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  let body: RevalidateBody;

  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return jsonWithCors(request, { ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = normalizeLandingName(body.name);
  const secret = String(body.secret || "");

  if (!name || name.includes("/") || /\s/.test(name)) {
    return jsonWithCors(request, { ok: false, error: "invalid_name" }, { status: 400 });
  }

  const isValidSecret = await verifySecret(secret);
  if (!isValidSecret) {
    return jsonWithCors(request, { ok: false, error: "invalid_secret" }, { status: 401 });
  }

  revalidatePath(`/l/${name}`);
  revalidatePath(`/${name}`);
  revalidateTag(`landing-config:${name}`, "max");
  const warmed = await warmConstructorLanding(request, name);

  if (!warmed.ok) {
    return jsonWithCors(
      request,
      {
        ok: false,
        error: "warm_failed",
        revalidated: [`/l/${name}`, `/${name}`],
        warmed,
      },
      { status: 502 },
    );
  }

  return jsonWithCors(request, {
    ok: true,
    revalidated: [`/l/${name}`, `/${name}`],
    warmed,
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}
