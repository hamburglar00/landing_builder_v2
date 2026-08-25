type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export const dynamic = "force-dynamic";

function redirectBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
}

function isValidToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const cleanToken = String(token ?? "").trim();
  const supabaseUrl = redirectBaseUrl();

  if (!supabaseUrl || !isValidToken(cleanToken)) {
    return new Response("Redirect not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const target = new URL("/functions/v1/whatsapp-cloud-redirect", `${supabaseUrl}/`);
  target.searchParams.set("t", cleanToken);

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
    },
  });
}
