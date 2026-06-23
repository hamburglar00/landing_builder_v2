import { NextRequest, NextResponse } from "next/server";

const MAX_ATTEMPTS = 2;
const TRACK_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 1500;

type TrackBody = {
  postUrl?: unknown;
  payload?: unknown;
};

function isValidPostUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "";
  return request.headers.get("x-real-ip") || "";
}

async function postWithTimeout(url: string, body: unknown, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  let body: TrackBody;

  try {
    body = (await request.json()) as TrackBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!isValidPostUrl(body.postUrl) || !body.payload || typeof body.payload !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const payload = {
    ...(body.payload as Record<string, unknown>),
    client_ip_address:
      (body.payload as Record<string, unknown>).client_ip_address || getClientIp(request) || undefined,
    client_user_agent:
      (body.payload as Record<string, unknown>).client_user_agent ||
      request.headers.get("user-agent") ||
      undefined,
    agentuser:
      (body.payload as Record<string, unknown>).agentuser ||
      (body.payload as Record<string, unknown>).client_user_agent ||
      request.headers.get("user-agent") ||
      undefined,
  };

  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await delay(RETRY_DELAY_MS);
    }

    try {
      const response = await postWithTimeout(body.postUrl, payload, TRACK_TIMEOUT_MS);
      lastStatus = response.status;

      if (response.ok) {
        return NextResponse.json({ ok: true, status: response.status });
      }

      if (response.status < 500 && response.status !== 429) {
        return NextResponse.json(
          { ok: false, status: response.status },
          { status: response.status },
        );
      }
    } catch {
      lastStatus = 0;
    }
  }

  return NextResponse.json(
    { ok: false, status: lastStatus || "timeout" },
    { status: 202 },
  );
}
