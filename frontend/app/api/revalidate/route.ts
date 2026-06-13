import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

type RevalidateBody = {
  name?: unknown;
  secret?: unknown;
};

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

export async function POST(request: NextRequest) {
  let body: RevalidateBody;

  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = normalizeLandingName(body.name);
  const secret = String(body.secret || "");

  if (!name || name.includes("/") || /\s/.test(name)) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }

  const isValidSecret = await verifySecret(secret);
  if (!isValidSecret) {
    return NextResponse.json({ ok: false, error: "invalid_secret" }, { status: 401 });
  }

  revalidatePath(`/l/${name}`);
  revalidatePath(`/${name}`);
  revalidateTag(`landing-config:${name}`, "max");

  return NextResponse.json({
    ok: true,
    revalidated: [`/l/${name}`, `/${name}`],
  });
}
