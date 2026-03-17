import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mapa de colores name -> hex, alineado con el frontend.
const COLOR_MAP: Record<string, string> = {
  white: "#FFFFFF",
  black: "#000000",
  gold: "#FFD700",
  yellow: "#FFF000",
  red: "#FF3B30",
  green: "#1FAF38",
  whatsapp_green: "#25D366",
  blue: "#007BFF",
  cyan: "#00D8FF",
  orange: "#FF8C00",
  pink: "#FF4FC3",
  purple: "#9B59B6",
  gray_light: "#D9D9D9",
  gray_dark: "#4A4A4A",
};

function toHex(color: unknown, fallback: string): string {
  if (typeof color !== "string") return fallback;
  if (color.startsWith("#")) return color;
  return COLOR_MAP[color] ?? fallback;
}

/**
 * API público: devuelve toda la configuración de una landing por su nombre.
 * Uso: GET /functions/v1/builder-config?name=MiLanding
 * Pensado para consumir desde el dominio base al estilo https://url_base/name
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Solo se permiten GET y POST" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    let name: string | undefined;

    if (req.method === "GET") {
      const url = new URL(req.url);
      name = url.searchParams.get("name")?.trim() || undefined;
    } else {
      const body = await req.json().catch(() => null) as
        | { name?: string | null }
        | null;
      name = body?.name?.trim() || undefined;
    }

    if (!name) {
      return new Response(
        JSON.stringify({
          error: "Falta el nombre de la landing (parámetro 'name').",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error: "Configuración del servidor incompleta.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("landings")
      .select(
        "id, name, pixel_id, phone_mode, phone_kind, phone_interval_start_hour, phone_interval_end_hour, post_url, landing_tag, comment, config, landing_config, updated_at",
      )
      .eq("name", name)
      .maybeSingle();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Error al obtener la landing." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Landing no encontrada." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const asAny = data as {
      landing_config?: unknown;
      updated_at?: string;
      phone_mode?: "random" | "fair" | null;
    };

    // Si ya existe landing_config persistido, lo devolvemos pero SIEMPRE inyectamos
    // post_url desde landings.post_url (fuente de verdad). Así evitamos que la landing
    // pública use una URL obsoleta (ej. Google Sheet) guardada en landing_config.
    if (asAny.landing_config != null) {
      const cfg = asAny.landing_config as Record<string, unknown>;
      const tracking = (cfg.tracking as Record<string, unknown>) ?? {};
      const merged = {
        ...cfg,
        tracking: {
          ...tracking,
          postUrl: data.post_url ?? tracking.postUrl ?? "",
        },
      };
      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    const rawConfig = (data.config ?? {}) as Record<string, unknown>;

    const themeWithHex = {
      ...rawConfig,
      titleColor: toHex(rawConfig.titleColor, "#FFFFFF"),
      subtitleColor: toHex(rawConfig.subtitleColor, "#FFFFFF"),
      footerBadgeColor: toHex(rawConfig.footerBadgeColor, "#FFD700"),
      ctaTextColor: toHex(rawConfig.ctaTextColor, "#000000"),
      ctaBackgroundColor: toHex(rawConfig.ctaBackgroundColor, "#25D366"),
      ctaGlowColor: toHex(rawConfig.ctaGlowColor, "#000000"),
    } as Record<string, unknown>;

    const payload = {
      schemaVersion: 1,
      updatedAt:
        asAny.updated_at ??
        new Date().toISOString(),
      id: data.id,
      name: data.name,
      comment: data.comment ?? "",
      tracking: {
        pixelId: data.pixel_id ?? "",
        postUrl: data.post_url ?? "",
        landingTag: data.landing_tag ?? "",
      },
      background: {
        mode: (themeWithHex.backgroundMode as string) ?? "single",
        images: (themeWithHex.backgroundImages as string[]) ?? [],
        rotateEveryHours: (themeWithHex.rotateEveryHours as number) ?? 24,
      },
      content: {
        logoUrl: (themeWithHex.logoUrl as string) ?? "",
        title: [
          (themeWithHex.titleLine1 as string) ?? "",
          (themeWithHex.titleLine2 as string) ?? "",
          (themeWithHex.titleLine3 as string) ?? "",
        ],
        subtitle: [
          (themeWithHex.subtitleLine1 as string) ?? "",
          (themeWithHex.subtitleLine2 as string) ?? "",
          (themeWithHex.subtitleLine3 as string) ?? "",
        ],
        footerBadge: [
          (themeWithHex.footerBadgeLine1 as string) ?? "",
          (themeWithHex.footerBadgeLine2 as string) ?? "",
          (themeWithHex.footerBadgeLine3 as string) ?? "",
        ],
        ctaText: (themeWithHex.ctaText as string) ?? "",
      },
      typography: {
        fontFamily: (themeWithHex.fontFamily as string) ?? "system",
        title: {
          sizePx: (themeWithHex.titleFontSize as number) ?? 28,
          weight: (themeWithHex.titleBold as boolean | undefined) ? 700 : 500,
        },
        subtitle: {
          sizePx: (themeWithHex.subtitleFontSize as number) ?? 16,
          weight: (themeWithHex.subtitleBold as boolean | undefined)
            ? 600
            : 400,
        },
        cta: {
          sizePx: (themeWithHex.ctaFontSize as number) ?? 18,
          weight: (themeWithHex.ctaBold as boolean | undefined) ? 700 : 500,
        },
        badge: {
          sizePx: (themeWithHex.badgeFontSize as number) ?? 12,
          weight: (themeWithHex.badgeBold as boolean | undefined) ? 700 : 400,
        },
      },
      colors: {
        title: themeWithHex.titleColor,
        subtitle: themeWithHex.subtitleColor,
        badge: themeWithHex.footerBadgeColor,
        ctaText: themeWithHex.ctaTextColor,
        ctaBackground: themeWithHex.ctaBackgroundColor,
        ctaGlow: themeWithHex.ctaGlowColor,
      },
      phoneSelection: {
        mode:
          (data.phone_mode as "random" | "fair" | null) ??
          "random",
      },
      layout: {
        ctaPosition:
          (themeWithHex.ctaPosition as
            | "top"
            | "between_title_and_info"
            | "between_info_and_badge"
            | "bottom") ?? "between_title_and_info",
        template:
          ((themeWithHex.template as string) === "template2" ? 2 : 1),
      },
    };

    // TODO(backfill): persistir este payload en landing_config para esta fila
    // mediante un script de backfill o migración dedicada.

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error inesperado." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
