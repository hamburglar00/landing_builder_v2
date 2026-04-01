import { NextResponse } from "next/server";

type SyncBody = {
  name: string;
  kommo_api_base_url: string;
  kommo_access_token: string;
  active?: boolean;
};

function isValidName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}

async function getAuthUserIdFromBearer(
  bearer: string,
): Promise<{ userId: string | null; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnon) {
    return { userId: null, error: "Faltan variables Supabase en servidor." };
  }

  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
  });

  if (!authRes.ok) {
    return { userId: null, error: "Sesion invalida." };
  }
  const authJson = (await authRes.json()) as { id?: string };
  return { userId: authJson.id ?? null };
}

async function getProfileName(
  userId: string,
  bearer: string,
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=nombre`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{ nombre?: string }>;
  return String(arr?.[0]?.nombre ?? "").trim() || null;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!bearer) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const body = (await req.json()) as SyncBody;
    const name = String(body?.name ?? "").trim();
    const baseUrl = String(body?.kommo_api_base_url ?? "").trim();
    const token = String(body?.kommo_access_token ?? "").trim();
    const active = body?.active !== false;

    if (!name || !isValidName(name)) {
      return NextResponse.json({ error: "Name invalido." }, { status: 400 });
    }
    if (!baseUrl || !isValidHttpsUrl(baseUrl)) {
      return NextResponse.json({ error: "kommo_api_base_url invalido." }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: "kommo_access_token requerido." }, { status: 400 });
    }

    const { userId, error } = await getAuthUserIdFromBearer(bearer);
    if (error || !userId) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const profileName = await getProfileName(userId, bearer);
    if (!profileName || profileName !== name) {
      return NextResponse.json({ error: "Name no coincide con el cliente autenticado." }, { status: 403 });
    }

    const intermediaryBase =
      process.env.KOMMO_INTERMEDIARY_BASE_URL ?? "https://intermediario-kommo.vercel.app";
    const adminSecret = process.env.KOMMO_INTERMEDIARY_ADMIN_SECRET ?? "";
    if (!adminSecret) {
      return NextResponse.json({ error: "Falta KOMMO_INTERMEDIARY_ADMIN_SECRET." }, { status: 500 });
    }

    const upstream = await fetch(`${intermediaryBase}/api/client-config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({
        name,
        kommo_api_base_url: baseUrl,
        kommo_access_token: token,
        active,
      }),
      cache: "no-store",
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: `Intermediario respondio ${upstream.status}.`,
          detail: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    return NextResponse.json({ ok: true, upstream: parsed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
