import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";
import type { RevalidationEnvironment } from "./catalog.server";
import type { Actor, RevalidationBackend } from "./service.server";

export function revalidationBackend(environment: RevalidationEnvironment, env: NodeJS.ProcessEnv): RevalidationBackend {
  const address = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!address || !anon || !service) throw new Error("unavailable");
  const url = new URL(address);
  if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("unavailable");
  if (environment === "local") {
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || url.port !== "54321") throw new Error("unavailable");
  } else if (environment !== "production" || url.protocol !== "https:"
    || isIP(url.hostname.replace(/^\[|\]$/g, "")) || url.hostname === "localhost"
    || !url.hostname.endsWith(".supabase.co")) throw new Error("unavailable");

  const fixedFetch: typeof fetch = (input, init) => fetch(input, {
    ...init, redirect: "error", cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(10000),
  });
  const client = (key: string, token?: string) => createClient(url.origin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fixedFetch, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) },
  });
  return {
    async authenticate(token) {
      const scoped = client(anon, token);
      const { data, error } = await scoped.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous) return null;
      const profile = await scoped.from("profiles").select("id, role").eq("id", data.user.id).maybeSingle();
      if (profile.error || profile.data?.id !== data.user.id
        || !["admin", "client"].includes(profile.data?.role)) return null;
      return { id: data.user.id, role: profile.data.role } as Actor;
    },
    async landing(actor, token, id) {
      let query = client(anon, token).from("landings")
        .select("id, user_id, name, publish_target").eq("id", id);
      if (actor.role !== "admin") query = query.eq("user_id", actor.id);
      const { data, error } = await query.maybeSingle();
      if (error || !data || typeof data.id !== "string" || typeof data.user_id !== "string"
        || typeof data.name !== "string" || !["classic", "constructor"].includes(data.publish_target)) return null;
      return { id: data.id, user_id: data.user_id, name: data.name, publish_target: data.publish_target };
    },
    async secret() {
      const { data, error } = await client(service).from("settings")
        .select("revalidate_secret").eq("id", 1).maybeSingle();
      if (error || !data || typeof data.revalidate_secret !== "string") throw new Error("unavailable");
      return data.revalidate_secret;
    },
  };
}
