import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { renderPublicLandingHtml } from "../../components/public-landing/renderPublicLandingHtml";
import { getPublicLandingConfig } from "../../components/public-landing/getLandingConfig";
import { renderTemplate9LegalHtml } from "../../components/public-landing/template9Legal";
import { getTemplate9Brand } from "./template9";
import runtimeAssets from "../../components/public-landing/template7RuntimeNames.generated.json";
import favicon from "../../components/public-landing/publicLandingFavicon.generated.json";
import { META_EBP_COLLECTOR_URL } from "../meta/ebpAssetManifest";
import type { GatewayLandingDependencies, GatewayLandingRow } from "./gatewayLanding.server";
import { gatewayLandingBasePath } from "../gateway-landing-paths";
import { POST as identity } from "../../app/api/client-identity/bootstrap/route";
import { POST as destination } from "../../app/api/template7/destination/route";
import { POST as warm } from "../../app/api/template7/warm/route";
import { POST as prepare } from "../../app/api/template7/prepare/route";
import { POST as track } from "../../app/api/track/route";
import { POST as journey } from "../../app/api/journey-start/route";
import { POST as funnel } from "../../app/api/entry-funnel/route";

export function productionGatewayLandingDependencies(): GatewayLandingDependencies {
  const env = process.env;
  const db = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "", env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || "", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) }) },
  });
  return {
    env,
    async landing(slug) {
      const { data, error } = await db.rpc("gateway_landing_context", { p_slug: slug });
      if (error) throw error;
      return data as GatewayLandingRow | null;
    },
    // The private invoker RPC above includes the current is_client_access_blocked result.
    async blocked() { return false; },
    async render(row, claims) {
      const base = gatewayLandingBasePath("builder", row.name);
      const assetBase = base + "/_assets";
      if (claims.resource === "asset") {
        const allowed = new Set([
          ...Object.values(runtimeAssets).map(asset => `public-assets/template-entry/${asset.name}`),
          `public-assets/template-entry/${favicon.name}`,
          "vendor/meta-capi-param-builder/1.3.1/clientParamBuilder.bundle.js", META_EBP_COLLECTOR_URL.slice(1),
          getTemplate9Brand(claims.provider, claims.skin).logo.slice(1),
        ]);
        if (!allowed.has(claims.operation)) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
        const bytes = await readFile(path.join(process.cwd(), "public", ...claims.operation.split("/")));
        const type = claims.operation.endsWith(".js") ? "application/javascript; charset=utf-8" : claims.operation.endsWith(".svg") ? "image/svg+xml" : "image/webp";
        return new Response(claims.method === "HEAD" ? null : bytes, { headers: { "Content-Type": type, "Cache-Control": claims.operation.startsWith("public-assets/template9/") ? "public, max-age=300" : "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
      }
      // Same canonical public payload as classic/constructor. No alternate draft/published model.
      const config = await getPublicLandingConfig(row.name, { fresh: true });
      if (!config || config.id !== row.id || ![7, 9].includes(config.layout?.template || 0)
        || config.tracking.target_provider !== claims.provider
        || (claims.provider === "multi_skin" ? config.tracking.skin_code || "ganamos_plus" : null) !== claims.skin) return new Response(null, { status: 404 });
      const html = claims.resource === "legal"
        ? renderTemplate9LegalHtml(config, claims.operation, base, assetBase)
        : renderPublicLandingHtml({ slug: row.name, config, canonicalUrl: claims.origin + base, legalBasePath: base,
          engine: "gateway", apiBase: base + "/_api", assetBase, recoveryNamespace: "template7:gateway:builder:identity-recovery:v1" });
      if (!html) return new Response(null, { status: 404 });
      return new Response(claims.method === "HEAD" ? null : html, { headers: {
        "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=15, must-revalidate", "X-Content-Type-Options": "nosniff",
      } });
    },
    dispatch(operation, request) {
      const handlers = { "client-identity/bootstrap": identity, "template7/destination": destination, "template7/warm": warm,
        "template7/prepare": prepare, track, "journey-start": journey, "entry-funnel": funnel };
      return handlers[operation as keyof typeof handlers](new NextRequest(request));
    },
  };
}
