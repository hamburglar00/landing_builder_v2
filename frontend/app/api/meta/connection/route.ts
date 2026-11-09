import { createClient } from "@supabase/supabase-js";
import { checkMetaConnection, MetaConnectionError } from "@/lib/meta/connection.server";
export const runtime = "nodejs";
export const maxDuration = 20;
const attempts = new Map<string, { count: number; until: number }>();
const json = (value: object, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return json({ message: "Origen no permitido." }, 403);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return json({ message: "Solicitud no válida." }, 415);
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return json({ message: "Volvé a iniciar sesión." }, 401);
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const user = await db.auth.getUser(token);
    if (user.error || !user.data.user || user.data.user.is_anonymous) return json({ message: "Sesión no válida." }, 401);
    const profile = await db.from("profiles").select("role").eq("id", user.data.user.id).maybeSingle();
    if (profile.error || !["admin", "client"].includes(profile.data?.role)) return json({ message: "Acceso no permitido." }, 403);
    const now = Date.now(), uid = user.data.user.id;
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    if (attempts.size > 4096) attempts.delete(attempts.keys().next().value!);
    const current = attempts.get(uid) ?? { count: 0, until: now + 300000 };
    if (current.count >= 8) return json({ message: "Esperá unos minutos antes de repetir la prueba." }, 429);
    attempts.set(uid, { ...current, count: current.count + 1 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 8000) return json({ message: "Solicitud demasiado grande." }, 413);
    const input = JSON.parse(raw);
    return json(await checkMetaConnection({ pixelId: typeof input.pixelId === "string" ? input.pixelId : "",
      token: typeof input.token === "string" ? input.token : "", testEventCode: typeof input.testEventCode === "string" ? input.testEventCode : "", scope: uid }));
  } catch (error) {
    if (error instanceof MetaConnectionError) return json({ code: error.reason, message: error.message }, error.status);
    return json({ message: "No pudimos comprobar la conexión. Volvé a intentar." }, 400);
  }
}
