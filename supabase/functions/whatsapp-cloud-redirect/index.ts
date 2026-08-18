import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

function getDb() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function redirectResponse(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
    },
  });
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return textResponse("ok");

  try {
    const url = new URL(req.url);
    const token = firstString(
      url.searchParams.get("t"),
      url.searchParams.get("token"),
    );
    if (!token) return textResponse("Missing redirect token", 400);

    const db = getDb();
    const ip = firstString(
      req.headers.get("cf-connecting-ip"),
      req.headers.get("x-forwarded-for")?.split(",")[0],
      req.headers.get("x-real-ip"),
    );
    const userAgent = firstString(req.headers.get("user-agent"));

    const { data, error } = await db.rpc(
      "record_whatsapp_cloud_api_redirect_click",
      {
        p_token: token,
        p_ip: ip,
        p_user_agent: userAgent,
      },
    );
    if (error) {
      console.error("[whatsapp-cloud-redirect] click record failed", {
        token,
        error: error.message,
      });
      return textResponse("Redirect unavailable", 500);
    }

    const rows = Array.isArray(data) ? data as Json[] : [];
    const target = firstString(rows[0]?.wa_link);
    if (!target) return textResponse("Redirect not found", 404);
    if (!target.startsWith("https://wa.me/")) {
      console.error("[whatsapp-cloud-redirect] blocked unsafe target", {
        token,
        target,
      });
      return textResponse("Redirect target blocked", 400);
    }

    return redirectResponse(target);
  } catch (error) {
    console.error("[whatsapp-cloud-redirect] unexpected error", error);
    return textResponse("Redirect error", 500);
  }
});
