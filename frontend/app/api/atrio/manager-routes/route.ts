import { createClient } from "@supabase/supabase-js";
import { handleManagerRoute, type ManagerRouteBackend } from "@/lib/atrio/managerRoute.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backend(): ManagerRouteBackend {
  const address = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!address || !anon) throw new Error("unavailable");
  let actor: { id: string; role: string } | null = null;
  const scoped = (token: string) => createClient(address, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (url, options) => fetch(url, {
      ...options, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    }) },
  });
  return {
    async authenticate(token) {
      const db = scoped(token);
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous) return false;
      const profile = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (profile.error || !profile.data || !["admin", "client"].includes(profile.data.role)) return false;
      actor = { id: data.user.id, role: profile.data.role };
      return true;
    },
    async landing(token, id) {
      if (!actor) return null;
      const db = scoped(token);
      let query = db.from("landings").select("id,user_id,workspace_currency").eq("id", id);
      if (actor.role !== "admin") query = query.eq("user_id", actor.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      const blocked = await db.rpc("is_client_access_blocked", { p_user_id: data.user_id });
      return blocked.error || blocked.data !== false ? null : data;
    },
    async advisor(token, id) {
      const { data, error } = await scoped(token).from("atrio_clients").select("id,user_id,workspace_currency,atrio_id").eq("id", id).maybeSingle();
      return error ? null : data;
    },
    async configure(input) {
      const origin = new URL(process.env.INTERNAL_CHAT_ORIGIN || "");
      const secret = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
      if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash || !secret) throw new Error("unavailable");
      const response = await fetch(new URL("/api/gateway/manager-routes", origin), {
        method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify(input), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    },
  };
}
export async function POST(request: Request) {
  try { return await handleManagerRoute(request, backend()); }
  catch { return Response.json({ error: "Integración no disponible." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
