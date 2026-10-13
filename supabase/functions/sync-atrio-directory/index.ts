import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DirectoryAdvisor = {
  id: string;
  name: string;
  slug: string;
  status: "disponible" | "ausente";
  revision: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validAdvisor(value: unknown): value is DirectoryAdvisor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return UUID_PATTERN.test(String(row.id ?? "")) &&
    typeof row.name === "string" && row.name.trim().length > 0 &&
    typeof row.slug === "string" && /^[a-z0-9][a-z0-9_-]{0,80}$/.test(row.slug) &&
    (row.status === "disponible" || row.status === "ausente") &&
    typeof row.revision === "string" && Number.isFinite(Date.parse(row.revision));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  const atrioOrigin = Deno.env.get("ATRIO_DIRECTORY_ORIGIN")?.replace(/\/+$/, "");
  const atrioKey = Deno.env.get("ATRIO_DIRECTORY_SYNC_KEY");
  if (!supabaseUrl || !serviceRoleKey || !atrioOrigin || !atrioKey || new TextEncoder().encode(atrioKey).length < 32) {
    return json({ error: "server_not_configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const body = await request.json().catch(() => null) as {
    advisor_id?: string;
    cron_secret?: string;
  } | null;
  const authorization = request.headers.get("authorization") ?? "";
  const immediateSync = authorization === `Bearer ${atrioKey}`;

  if (immediateSync && !UUID_PATTERN.test(body?.advisor_id ?? "")) {
    return json({ error: "invalid_request" }, 400);
  }

  if (!immediateSync) {
    const { data: secretRow } = await supabase.from("cron_config").select("value")
      .eq("key", "sync_phones_cron_secret").maybeSingle();
    const expectedCronSecret = Deno.env.get("CRON_SECRET") || secretRow?.value || "";
    if (!expectedCronSecret || body?.cron_secret !== expectedCronSecret) {
      return json({ error: "unauthorized" }, 401);
    }
  }

  let clientsQuery = supabase
    .from("atrio_clients")
    .select("atrio_id");
  if (immediateSync) clientsQuery = clientsQuery.eq("atrio_id", body!.advisor_id!);
  const { data: clients, error: clientsError } = await clientsQuery
    .order("atrio_id", { ascending: true });
  if (clientsError) return json({ error: "directory_sync_unavailable" }, 503);

  const linkedIds = new Set(
    (clients ?? []).map((row) => String(row.atrio_id)).filter((id) => UUID_PATTERN.test(id)),
  );
  const ids = immediateSync
    ? linkedIds.has(body!.advisor_id!) ? [body!.advisor_id!] : []
    : [...linkedIds];
  let updated = 0;
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const url = new URL("/api/internal/advisors/directory", atrioOrigin);
    url.searchParams.set("ids", batch.join(","));
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${atrioKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return json({ error: "atrio_directory_unavailable" }, 503);
    const payload = await upstream.json().catch(() => null) as { advisors?: unknown[] } | null;
    const advisors = (payload?.advisors ?? []).filter(validAdvisor);
    if (advisors.length !== (payload?.advisors ?? []).length) {
      return json({ error: "invalid_atrio_directory_response" }, 503);
    }
    const { data: applied, error: applyError } = await supabase.rpc(
      "apply_atrio_advisor_directory_snapshot",
      { p_advisors: advisors },
    );
    if (applyError) return json({ error: "directory_sync_unavailable" }, 503);
    updated += Number(applied ?? 0);
  }

  return json({
    ok: true,
    mode: immediateSync ? "immediate" : "reconciliation",
    scanned: ids.length,
    updated,
  });
});
