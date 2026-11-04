import { createClient } from "@supabase/supabase-js";
import {
  importDirectory,
  parseImportDirectory,
  visibleImportDirectory,
  type ImportScope,
} from "@/lib/bots/directory";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return json({ error: "Origen no permitido." }, 403);
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return json({ error: "Volvé a iniciar sesión." }, 401);
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: { Authorization: `Bearer ${token}` },
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(10000),
            }),
        },
      },
    );
    const auth = await db.auth.getUser(token);
    if (auth.error || !auth.data.user || auth.data.user.is_anonymous)
      return json({ error: "Sesión no válida." }, 401);
    let uid = auth.data.user.id;
    const profile = await db
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();
    if (profile.error || !["admin", "client"].includes(profile.data?.role))
      return json({ error: "Acceso no permitido." }, 403);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 2048)
      return json({ error: "Solicitud demasiado grande." }, 413);
    const input = JSON.parse(raw);
    if (
      !input ||
      Object.keys(input).some(
        (k) =>
          ![
            "action",
            "kind",
            "id",
            "workspaceCurrency",
            "targetUserId",
          ].includes(k),
      ) ||
      !["preview", "import", "refresh"].includes(input.action) ||
      !["agency", "owner"].includes(input.kind) ||
      !Number.isSafeInteger(input.id) ||
      input.id < 1 ||
      !["ARS", "PYG"].includes(input.workspaceCurrency)
    )
      return json(
        { error: "Revisá el tipo de importación, ID y workspace." },
        400,
      );
    if (input.targetUserId !== undefined) {
      if (
        input.action !== "refresh" ||
        profile.data?.role !== "admin" ||
        typeof input.targetUserId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          input.targetUserId,
        )
      )
        return json({ error: "Acceso no permitido." }, 403);
      uid = input.targetUserId;
    }
    const scope: ImportScope = { kind: input.kind, id: input.id };
    const permissions = await db
      .from("client_module_permissions")
      .select("show_atrio")
      .eq("user_id", uid)
      .maybeSingle();
    if (permissions.error)
      throw Error("No se pudieron comprobar los módulos habilitados.");
    const canAtrio =
      profile.data?.role === "admin" || permissions.data?.show_atrio === true;
    const origin = new URL(process.env.INTERNAL_CHAT_ORIGIN || ""),
      key = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
    if (
      !key ||
      origin.protocol !== "https:" ||
      origin.pathname !== "/" ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    )
      throw Error("La integración de Atrio no está disponible.");
    const upstream = await fetch(
      new URL("/api/gateway/bot-directory", origin),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...scope,
          refresh: input.action === "import" && canAtrio,
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(input.action === "import" ? 45000 : 15000),
      },
    );
    const payload = await upstream.json();
    if (!upstream.ok)
      return json(
        {
          error:
            typeof payload.error === "string"
              ? payload.error
              : "No se pudo consultar PBAdmin.",
        },
        503,
      );
    const data = visibleImportDirectory(
      parseImportDirectory(payload, scope),
      canAtrio,
    );
    if (input.action === "preview") return json(data);
    // Re-read authoritative inventory for every import. Never accept rows or owners supplied by the browser.
    const [existingGroups, existingAdvisors] = await Promise.all([
      db
        .from("gerencias")
        .select("id,gerencia_id,source_type")
        .eq("user_id", uid)
        .eq("workspace_currency", input.workspaceCurrency),
      db
        .from("atrio_clients")
        .select("atrio_id")
        .eq("user_id", uid)
        .eq("workspace_currency", input.workspaceCurrency),
    ]);
    if (existingGroups.error || existingAdvisors.error)
      throw Error("No se pudo comprobar el workspace.");
    const groups = new Map(
        existingGroups.data
          .filter((g) => g.source_type !== "manual")
          .map((g) => [g.gerencia_id, g.id]),
      ),
      advisors = new Set(existingAdvisors.data.map((a) => a.atrio_id));
    const result = await importDirectory(data, {
      async agency(group) {
        const snapshot = {
          pbadmin_bots: group.bots
            .filter((bot) => bot.channel === "whatsapp")
            .map((bot) => ({
              manager_id: bot.manager_id,
              name: bot.name,
              agency_id: bot.agency_id,
              owner_id: bot.owner_id,
              channel: bot.channel,
              role: bot.role,
              active: bot.active,
              phone: bot.phone,
              advisor_id: null,
              advisor_slug: null,
            })),
          pbadmin_bots_synced_at: new Date().toISOString(),
        };
        const existingId = groups.get(group.agency_id);
        if (existingId !== undefined) {
          const result = await db
            .from("gerencias")
            .update(snapshot)
            .eq("id", existingId)
            .eq("user_id", uid)
            .eq("workspace_currency", input.workspaceCurrency);
          if (result.error) throw result.error;
          return "existing";
        }
        if (input.action === "refresh") return "existing";
        const result = await db.from("gerencias").insert({
          id: group.agency_id,
          gerencia_id: group.agency_id,
          nombre: group.name,
          user_id: uid,
          workspace_currency: input.workspaceCurrency,
          source_type: "pbadmin",
          ...snapshot,
        });
        if (result.error) throw result.error;
        groups.set(group.agency_id, group.agency_id);
        return "created";
      },
      async advisor(advisor) {
        const all = [
          ...data.agencies.flatMap((group) =>
            group.bots.map((bot) => ({
              ...bot,
              agency_name: group.name,
              platform: group.platform,
            })),
          ),
          ...data.unassigned,
        ];
        const snapshot = {
          pbadmin_bots: all.filter(
            (bot) => bot.channel === "atrio" && bot.advisor_id === advisor.id,
          ),
          pbadmin_bots_synced_at: new Date().toISOString(),
        };
        if (advisors.has(advisor.id)) {
          const result = await db
            .from("atrio_clients")
            .update(snapshot)
            .eq("atrio_id", advisor.id)
            .eq("user_id", uid)
            .eq("workspace_currency", input.workspaceCurrency);
          if (result.error) throw result.error;
          return "existing";
        }
        if (input.action === "refresh") return "existing";
        const result = await db.from("atrio_clients").insert({
          atrio_id: advisor.id,
          slug: advisor.slug,
          user_id: uid,
          workspace_currency: input.workspaceCurrency,
          ...snapshot,
        });
        if (result.error) throw result.error;
        advisors.add(advisor.id);
        return "created";
      },
    });
    if (canAtrio && Array.isArray(payload.warnings))
      result.warnings.push(
        ...payload.warnings.filter(
          (value: unknown) => typeof value === "string",
        ),
      );
    return json(result);
  } catch (error) {
    return json(
      {
        error:
          error instanceof SyntaxError
            ? "Solicitud no válida."
            : "No se pudo completar la importación. Los registros existentes se conservan.",
      },
      error instanceof SyntaxError ? 400 : 503,
    );
  }
}
