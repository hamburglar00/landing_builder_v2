import { createClient } from "@supabase/supabase-js";
import { isSameOriginRequest } from "@/lib/http/sameOrigin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Explicit global actions load their scope on the server, independently of
 * whichever directory page or filters the browser currently displays. */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return json({ error: "Origen no permitido." }, 403);
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return json({ error: "Sesión no válida." }, 401);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json({ error: "Solicitud no válida." }, 415);
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "Solicitud demasiado grande." }, 413);
    const input = JSON.parse(raw);
    if (!input || Object.keys(input).some(key => !["action", "workspace", "metric", "inventory"].includes(key)) ||
      !["gerencias", "reset_atrio", "delete_inactive"].includes(input.action) || !["ARS", "PYG"].includes(input.workspace) ||
      (input.action === "reset_atrio" && !["usage_count", "messages_received"].includes(input.metric))) return json({ error: "Solicitud no válida." }, 400);
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: (url, init) => fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) }) },
    });
    const auth = await db.auth.getUser(token);
    const actor = auth.data.user;
    if (auth.error || !actor || actor.is_anonymous) return json({ error: "Sesión no válida." }, 401);
    const profile = await db.from("profiles").select("role").eq("id", actor.id).maybeSingle();
    if (profile.error || !["admin", "client"].includes(profile.data?.role)) return json({ error: "Acceso no permitido." }, 403);
    if (input.action === "delete_inactive") {
      const deleted = await db.rpc("delete_inactive_workspace_phones", { p_workspace: input.workspace });
      if (deleted.error) throw deleted.error;
      return json({ deleted: deleted.data });
    }
    if (input.action === "gerencias") {
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        let query = db.from("gerencias").select(`id,user_id,nombre,gerencia_id,workspace_currency,source_type,fair_criterion${input.inventory === true ? ",pbadmin_bots,pbadmin_bots_synced_at" : ""}`).eq("workspace_currency", input.workspace).order("id").range(offset, offset + 499);
        if (profile.data?.role !== "admin") query = query.eq("user_id", actor.id);
        const result = await query;
        if (result.error) throw result.error;
        rows.push(...result.data);
        if (result.data.length < 500) break;
      }
      return json({ gerencias: rows });
    }
    const permissions = await db.from("client_module_permissions").select("show_atrio").eq("user_id", actor.id).maybeSingle();
    if (permissions.error || (profile.data?.role !== "admin" && permissions.data?.show_atrio !== true)) return json({ error: "Acceso no permitido." }, 403);
    const origin = new URL(process.env.INTERNAL_CHAT_ORIGIN || ""), key = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
    if (!key || origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) throw Error("unavailable");
    let completed = 0;
    for (let offset = 0; ; offset += 100) {
      let query = db.from("atrio_clients").select("id,user_id,atrio_id").eq("workspace_currency", input.workspace).order("user_id").order("id").range(offset, offset + 99);
      if (profile.data?.role !== "admin") query = query.eq("user_id", actor.id);
      const clients = await query;
      if (clients.error) throw clients.error;
      const owners = new Set(clients.data.map(client => client.user_id));
      for (const owner of owners) {
        const advisor_ids = [...new Set(clients.data.filter(client => client.user_id === owner).map(client => client.atrio_id))];
        const response = await fetch(new URL("/api/gateway/manager-destinations/reset", origin), {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ advisor_ids, metric: input.metric }), signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error",
        });
        if (!response.ok) throw Error("reset_unavailable");
        completed += advisor_ids.length;
      }
      if (clients.data.length < 100) break;
    }
    return json({ ok: true, completed });
  } catch {
    return json({ error: "No se pudo completar la acción. Actualizá los datos antes de reintentar." }, 503);
  }
}
