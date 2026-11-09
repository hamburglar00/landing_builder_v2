import { createClient } from "@supabase/supabase-js";
import { handleManagerDestinations, type DestinationBackend } from "@/lib/atrio/managerDestinations.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function backend(): DestinationBackend {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  let actor: { id: string; role: string } | null = null;
  const scoped = (token: string) => createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) }) },
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
    async clients(token, ids) {
      if (!actor || !ids.length) return [];
      let query = scoped(token).from("atrio_clients").select("id,user_id,workspace_currency,atrio_id,bot_directory").in("id", ids);
      if (actor.role !== "admin") query = query.eq("user_id", actor.id);
      const result = await query;
      if (result.error) throw result.error;
      return result.data || [];
    },
    async cacheDirectory(token,clients,result){
      const rows=(result as {advisors?:{id:string;connections:Record<string,unknown>[]}[]})?.advisors;
      if(!Array.isArray(rows))throw Error("Invalid directory");
      const fields=["connection_id","advisor_id","advisor_slug","advisor_name","manager_id","agency_id","agency_name","target_provider","manager_type","active","verified_at"];
      const metadata=(values:Record<string,unknown>[])=>values.map(row=>Object.fromEntries(fields.map(key=>[key,row[key]??null])))
        .sort((a,b)=>String(a.connection_id).localeCompare(String(b.connection_id)));
      let changed=false;
      for(const client of clients){
        const advisor=rows.find(row=>row.id===client.atrio_id);
        if(!advisor)continue;
        const next=metadata(advisor.connections),previous=Array.isArray(client.bot_directory)?metadata(client.bot_directory):null;
        if(JSON.stringify(next)===JSON.stringify(previous))continue;
        const update=await scoped(token).from("atrio_clients").update({bot_directory:next}).eq("id",client.id);
        if(update.error)throw update.error;
        changed=true;
      }
      return changed;
    },
    async landing(token, id) {
      if (!actor) return null;
      const db = scoped(token);
      let query = db.from("landings").select("id,user_id,workspace_currency,config").eq("id", id);
      if (actor.role !== "admin") query = query.eq("user_id", actor.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      const blocked = await db.rpc("is_client_access_blocked", { p_user_id: data.user_id });
      return blocked.error || blocked.data !== false ? null : data;
    },
    async workspaceClients(token, owner, workspace) {
      if (!actor || (actor.role !== "admin" && actor.id !== owner)) return [];
      const result = await scoped(token).from("atrio_clients").select("id,user_id,workspace_currency,atrio_id").eq("user_id", owner).eq("workspace_currency", workspace);
      if (result.error) throw result.error;
      return result.data || [];
    },
    async assign(token, landingId, clientIds) {
      const { error } = await scoped(token).from("landings_atrio_clients").upsert(
        clientIds.map(id => ({ landing_id: landingId, atrio_client_id: id, weight: 1 })),
        { onConflict: "landing_id,atrio_client_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    },
    async call(action, input) {
      const origin = new URL(process.env.INTERNAL_CHAT_ORIGIN || "");
      const key = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
      if (!key || origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) throw new Error("unavailable");
      const response = await fetch(new URL(`/api/gateway/manager-destinations/${action}`, origin), {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(input), signal: AbortSignal.timeout(15000), redirect: "error", cache: "no-store",
      });
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    },
  };
}
export async function POST(request: Request) {
  try { return await handleManagerDestinations(request, backend()); }
  catch { return Response.json({ error: "Integración no disponible." }, { status: 503 }); }
}
