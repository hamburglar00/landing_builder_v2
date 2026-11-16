import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import type { GatewayLandingDependencies, GatewayLandingRow } from "./gatewayLanding.server";

/** Keep rendering and unrelated business handlers out of each API's startup graph. */
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
    // The private invoker RPC includes the current is_client_access_blocked result.
    async blocked() { return false; },
    async render(row, claims) { return (await import("./gatewayLanding.render")).renderGatewayLanding(row, claims); },
    async dispatch(operation, request) {
      const input = new NextRequest(request);
      switch (operation) {
        case "client-identity/bootstrap": return (await import("../../app/api/client-identity/bootstrap/route")).POST(input);
        case "template7/destination": return (await import("../../app/api/template7/destination/route")).POST(input);
        case "template7/warm": return (await import("../../app/api/template7/warm/route")).POST(input);
        case "template7/prepare": return (await import("../../app/api/template7/prepare/route")).POST(input);
        case "track": return (await import("../../app/api/track/route")).POST(input);
        case "journey-start": return (await import("../../app/api/journey-start/route")).POST(input);
        case "entry-funnel": return (await import("../../app/api/entry-funnel/route")).POST(input);
        default: throw new Error("Unsupported gateway landing operation");
      }
    },
  };
}
