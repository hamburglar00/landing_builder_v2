import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderPublicLandingHtml } from "../../components/public-landing/renderPublicLandingHtml";
import { getPublicLandingConfig } from "../../components/public-landing/getLandingConfig";
import { renderTemplate9LegalHtml } from "../../components/public-landing/template9Legal";
import { getTemplate9Brand } from "./template9";
import runtimeAssets from "../../components/public-landing/template7RuntimeNames.generated.json";
import favicon from "../../components/public-landing/publicLandingFavicon.generated.json";
import { META_EBP_COLLECTOR_URL } from "../meta/ebpAssetManifest";
import type { GatewayLandingRow } from "./gatewayLanding.server";
import { gatewayLandingBasePath } from "../gateway-landing-paths";

import type { GatewayLandingClaims } from "../gateway-landing-contract";

export async function renderGatewayLanding(row: GatewayLandingRow, claims: GatewayLandingClaims): Promise<Response> {
      const base = gatewayLandingBasePath("builder", row.name);
      const assetBase = base + "/_assets";
      // Static files contain no tenant or identity data. Share the publisher CDN across gateways/slugs.
      const publicAssetBase = "https://constructor.panelbotadmin.com";
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
        ? renderTemplate9LegalHtml(config, claims.operation, base, publicAssetBase)
        : renderPublicLandingHtml({ slug: row.name, config, canonicalUrl: claims.origin + base, legalBasePath: base,
          engine: "gateway", apiBase: base + "/_api", assetBase, publicAssetBase, recoveryNamespace: "template7:gateway:builder:identity-recovery:v1" });
      if (!html) return new Response(null, { status: 404 });
      return new Response(claims.method === "HEAD" ? null : html, { headers: {
        "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=15, must-revalidate", "X-Content-Type-Options": "nosniff",
      } });
}
