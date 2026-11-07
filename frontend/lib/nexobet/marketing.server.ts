import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { adminDb } from "../pbadmin/provider.server";
import { persistImport } from "../bots/persist-import.server";
import {
  NexoBridgeError,
  uuid,
  type NexoBuilderIdentity,
} from "./protocol.server";
import { DEFAULT_CONFIG } from "../landing/mocks";
import { TEMPLATE9_DEFAULTS, getTemplate9Brand } from "../landing/template9";
import { buildLandingConfig } from "../landing/buildLandingConfig";
import { buildLandingPublicUrl } from "../landing/publicUrls";
import { isMultiSkinCode, MULTI_SKIN_CATALOG } from "../multi-skin-catalog";
import type { TargetProvider } from "../landing/types";

const providers: Record<number, TargetProvider> = {
  1: "ases_del_norte",
  2: "ganamos_net",
  5: "rey_de_ases",
  7: "multi_skin",
};
function assert(
  condition: unknown,
  code = "invalid_request",
): asserts condition {
  if (!condition) throw new NexoBridgeError(code);
}
export async function marketingOperation(
  operation: string,
  payload: Record<string, unknown>,
  identity: NexoBuilderIdentity,
) {
  const db = adminDb(),
    account = String(payload.accountId),
    client = identity.builderId!;
  const binding = await db.rpc("nexobet_bind_builder", {
    account,
    owner: identity.ownerId,
    client,
  });
  if (binding.error) throw new NexoBridgeError("account_unavailable", 403);
  const blocked = await db.rpc("is_client_access_blocked", {
    p_user_id: client,
  });
  if (blocked.error || blocked.data !== false)
    throw new NexoBridgeError("account_unavailable", 403);

  async function syncDirectory() {
    const advisor = payload.advisor as {
      id: string;
      name: string;
      slug: string;
      status: string;
      revision: string;
    };
    assert(
      advisor &&
        advisor.id === identity.advisorId &&
        typeof advisor.name === "string" &&
        advisor.name.length <= 200 &&
        typeof advisor.slug === "string" &&
        /^[a-z0-9][a-z0-9_-]{0,80}$/.test(advisor.slug) &&
        ["disponible", "ausente"].includes(advisor.status) &&
        typeof advisor.revision === "string" &&
        Number.isFinite(Date.parse(advisor.revision)),
      "advisor_unavailable",
    );
    const result = await persistImport(
      db,
      client,
      "ARS",
      "import",
      {
        scope: { kind: "owner", id: identity.ownerId },
        agencies: [],
        advisors: [advisor],
        unassigned: identity.connections.map((c) => ({
          manager_id: c.managerId,
          name: `Full Carga #${c.managerId}`,
          agency_id: c.agencyId,
          owner_id: identity.ownerId,
          platform: c.platform,
          channel: "atrio",
          role: "carga",
          active: true,
          phone: null,
          advisor_id: advisor.id,
          advisor_slug: advisor.slug,
        })),
      },
      true,
    );
    if (result.warnings.length)
      throw new NexoBridgeError("directory_unavailable", 503);
    const revision = new Date(advisor.revision).toISOString();
    const updated = await db
      .from("atrio_clients")
      .update({
        display_name: advisor.name,
        slug: advisor.slug,
        atrio_status: advisor.status,
        directory_revision: revision,
        directory_synced_at: new Date().toISOString(),
      })
      .eq("user_id", client)
      .eq("atrio_id", advisor.id)
      .eq("workspace_currency", "ARS")
      .or(`directory_revision.is.null,directory_revision.lte.${revision}`);
    if (updated.error) throw new NexoBridgeError("directory_unavailable", 503);
  }

  if (operation === "initialize" || operation === "directory_changed") {
    await syncDirectory();
    return { ready: true, synced: true, builderId: client };
  }
  if (operation === "overview") {
    const page = Math.max(1, Math.min(100000, Number(payload.page) || 1));
    assert(Number.isInteger(page));
    const days = [1, 7, 30, 90].includes(Number(payload.days))
      ? Number(payload.days)
      : 30;
    const [managed, pixels, stats, conversions] = await Promise.all([
      db
        .from("nexobet_builder_landings")
        .select("landing_id,state")
        .eq("account_id", account)
        .order("created_at", { ascending: false }),
      db
        .from("conversions_pixel_configs")
        .select("pixel_id,comment")
        .eq("user_id", client)
        .order("created_at"),
      db.rpc("nexobet_marketing_stats", { client, days }),
      db
        .from("conversions")
        .select(
          "id,created_at,landing_name,lead_player_username,registration_player_username,purchase_player_username,lead_event_time,registration_event_time,purchase_event_time,valor,utm_campaign",
          { count: "exact" },
        )
        .eq("user_id", client)
        .eq("currency", "ARS")
        .order("created_at", { ascending: false })
        .order("id")
        .range((page - 1) * 20, page * 20 - 1),
    ]);
    if (managed.error || pixels.error || stats.error || conversions.error)
      throw new NexoBridgeError("service_unavailable", 503);
    const landings = managed.data.length
      ? await db
          .from("landings")
          .select("id,name,comment,config,pixel_id")
          .eq("user_id", client)
          .in(
            "id",
            managed.data.map((l) => l.landing_id),
          )
      : { data: [], error: null };
    if (landings.error) throw new NexoBridgeError("service_unavailable", 503);
    return {
      builderId: client,
      platforms: identity.connections.map((c) => ({
        ...c,
        provider: providers[c.platform],
        name:
          c.platform === 7
            ? "Multi Skin"
            : getTemplate9Brand(providers[c.platform]).name,
      })),
      skins: Object.entries(MULTI_SKIN_CATALOG).map(([code, skin]) => ({
        code,
        name: skin.name,
      })),
      pixels: pixels.data,
      stats: stats.data,
      days,
      conversions: {
        items: conversions.data,
        total: conversions.count,
        page,
        limit: 20,
      },
      landings: (landings.data || []).map((l) => ({
        id: l.id,
        name: l.comment || l.name,
        slug: l.name,
        platform: Object.entries(providers).find(
          ([, p]) => p === l.config?.targetProvider,
        )?.[0],
        skin: l.config?.multiSkinCode || "ganamos_plus",
        pixelId: l.pixel_id || "",
        capturePhone: l.config?.template7WhatsappEnabled === true,
        logo: getTemplate9Brand(
          l.config?.targetProvider,
          l.config?.multiSkinCode,
        ).logo,
        state:
          managed.data.find((m) => m.landing_id === l.id)?.state || "pending",
        url: buildLandingPublicUrl(l.name, "constructor"),
      })),
    };
  }
  if (operation === "save_pixel") {
    const pixel =
        typeof payload.pixelId === "string" ? payload.pixelId.trim() : "",
      token = typeof payload.token === "string" ? payload.token.trim() : "";
    assert(/^\d{5,25}$/.test(pixel) && token.length <= 5000);
    const previous = await db
      .from("conversions_pixel_configs")
      .select("id")
      .eq("user_id", client)
      .eq("pixel_id", pixel)
      .maybeSingle();
    if (previous.error) throw new NexoBridgeError("service_unavailable", 503);
    assert(previous.data || token, "pixel_token_required");
    const result = await db.from("conversions_pixel_configs").upsert(
      {
        user_id: client,
        pixel_id: pixel,
        meta_currency: "ARS",
        comment: String(payload.name || "")
          .trim()
          .slice(0, 100),
        ...(token ? { meta_access_token: token } : {}),
      },
      { onConflict: "user_id,pixel_id" },
    );
    if (result.error) throw new NexoBridgeError("save_failed", 503);
    return { saved: true };
  }
  if (operation === "save_landing") {
    const id = payload.landingId,
      platform = Number(payload.platform),
      provider = providers[platform],
      skin = payload.skin || "ganamos_plus";
    assert(
      uuid(id) &&
        provider &&
        identity.connections.some((c) => c.platform === platform) &&
        typeof payload.name === "string" &&
        payload.name.trim().length > 0 &&
        payload.name.length <= 100,
    );
    assert(platform !== 7 || isMultiSkinCode(skin));
    const pixel =
      typeof payload.pixelId === "string" ? payload.pixelId.trim() : "";
    if (pixel) {
      const ownPixel = await db
        .from("conversions_pixel_configs")
        .select("id")
        .eq("user_id", client)
        .eq("pixel_id", pixel)
        .maybeSingle();
      assert(!ownPixel.error && ownPixel.data, "pixel_unavailable");
    }
    await syncDirectory();
    const advisor = await db
      .from("atrio_clients")
      .select("id,slug,atrio_id")
      .eq("user_id", client)
      .eq("workspace_currency", "ARS")
      .eq("atrio_id", identity.advisorId!)
      .single();
    if (advisor.error || !advisor.data)
      throw new NexoBridgeError("advisor_unavailable", 503);
    const profile = await db
      .from("profiles")
      .select("nombre")
      .eq("id", client)
      .single();
    assert(!profile.error && profile.data?.nombre, "tracking_unavailable");
    const previous = await db
      .from("landings")
      .select("name,user_id")
      .eq("id", id)
      .maybeSingle();
    assert(
      !previous.error && (!previous.data || previous.data.user_id === client),
      "landing_unavailable",
    );
    const name = previous.data?.name || `nx-${id}`,
      comment = payload.name.trim();
    const post = new URL(
      "/functions/v1/conversions",
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
    );
    post.searchParams.set("name", profile.data.nombre);
    const config = {
      ...DEFAULT_CONFIG,
      ...TEMPLATE9_DEFAULTS,
      template: "template9" as const,
      ctaDestination: "atrio" as const,
      targetProvider: provider,
      multiSkinCode: isMultiSkinCode(skin) ? skin : ("ganamos_plus" as const),
      template7WhatsappEnabled: payload.capturePhone === true,
      atrioId: advisor.data.atrio_id,
      atrioClientId: advisor.data.id,
      atrioSlug: advisor.data.slug,
      atrioRedirectUrl: `https://www.atrio.website/${encodeURIComponent(advisor.data.slug)}`,
    };
    const save = await db.rpc("nexobet_save_landing", {
      account,
      client,
      landing: id,
      advisor: advisor.data.id,
      payload: {
        name,
        comment,
        pixel_id: pixel,
        post_url: post.toString(),
        config,
        landing_config: buildLandingConfig({
          id,
          name,
          comment,
          pixelId: pixel,
          postUrl: post.toString(),
          landingTag: "",
          config,
          workspaceCurrency: "ARS",
        }),
      },
    });
    if (save.error) throw new NexoBridgeError("save_failed", 409);
    const origin = new URL(process.env.INTERNAL_CHAT_ORIGIN || ""),
      secret = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
    if (origin.protocol !== "https:" || !secret)
      throw new NexoBridgeError("integration_pending", 503);
    const routed = await fetch(new URL("/api/gateway/manager-routes", origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        advisor_id: identity.advisorId,
        landing_id: id,
        target_provider: provider,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const route = routed.ok ? await routed.json() : null;
    const expected = identity.connections.find((c) => c.platform === platform)!;
    assert(
      route?.connection_id &&
        route.connections?.some(
          (c: { id: string; manager_id: number; agency_id: number }) =>
            c.id === route.connection_id &&
            Number(c.manager_id) === expected.managerId &&
            Number(c.agency_id) === expected.agencyId,
        ),
      "route_pending",
    );
    const ready = await db
      .from("nexobet_builder_landings")
      .update({ state: "ready" })
      .eq("landing_id", id)
      .eq("account_id", account);
    if (ready.error) throw new NexoBridgeError("save_failed", 503);
    revalidatePath(`/l/${name}`);
    revalidatePath(`/${name}`);
    revalidateTag(`landing-config:${name}`, "max");
    return {
      saved: true,
      landingId: id,
      url: buildLandingPublicUrl(name, "constructor"),
    };
  }
  throw new NexoBridgeError("invalid_operation", 422);
}
