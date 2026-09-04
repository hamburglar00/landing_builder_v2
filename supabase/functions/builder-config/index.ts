import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { phoneCountryCodeForWorkspace } from "./market.ts";

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

const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/";

function isSupabaseStoragePublicUrl(url: string): boolean {
  return url.includes(STORAGE_PUBLIC_SEGMENT);
}

function buildOptimizedImageUrl(
  rawUrl: string,
  width = 1280,
  quality = 65,
): string {
  if (!rawUrl) return rawUrl;
  if (!isSupabaseStoragePublicUrl(rawUrl)) return rawUrl;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (Number.isFinite(width) && width > 0) {
    parsed.searchParams.set("width", String(Math.round(width)));
  }
  if (Number.isFinite(quality) && quality > 0) {
    parsed.searchParams.set("quality", String(Math.round(quality)));
  }
  return parsed.toString();
}

function buildResponsiveImageSet(rawUrl: string): {
  mobile: string;
  tablet: string;
  desktop: string;
} {
  return {
    mobile: buildOptimizedImageUrl(rawUrl, 640, 60),
    tablet: buildOptimizedImageUrl(rawUrl, 1024, 65),
    desktop: buildOptimizedImageUrl(rawUrl, 1600, 70),
  };
}

function templateNumberForOption(template: unknown): number {
  const value = String(template || "").trim().toLowerCase();
  if (value === "template2") return 2;
  if (value === "template3") return 3;
  if (value === "template4") return 4;
  if (value === "template5") return 5;
  return 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const GLOBAL_CONFIG_KEYS = [
  "marketCountry",
  "sendContactPixel",
  "ctaDestination",
  "atrioRedirectUrl",
  "atrioClientId",
  "atrioId",
  "atrioSlug",
];

function resolveActiveTemplateRawConfig(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  const template = String(rawConfig.template || "template1").trim();
  const templateConfigs = isRecord(rawConfig.templateConfigs)
    ? rawConfig.templateConfigs
    : null;
  const activeVariant = templateConfigs && isRecord(templateConfigs[template])
    ? templateConfigs[template] as Record<string, unknown>
    : null;

  if (!activeVariant) return rawConfig;

  const merged = {
    ...rawConfig,
    ...activeVariant,
    template,
  };

  for (const key of GLOBAL_CONFIG_KEYS) {
    if (rawConfig[key] !== undefined) merged[key] = rawConfig[key];
  }

  return merged;
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
        "id, user_id, workspace_currency, name, pixel_id, phone_mode, phone_kind, phone_interval_start_hour, phone_interval_end_hour, post_url, landing_tag, comment, config, landing_config, updated_at",
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

    // Asegurar que post_url sea SIEMPRE el endpoint de conversiones (nunca Sheet u otra URL).
    const supabaseBase = (Deno.env.get("SUPABASE_URL") ?? "").replace(
      /\/$/,
      "",
    );
    const isWrongUrl = (url: string) =>
      !url ||
      url.includes("script.google.com") ||
      url.includes("docs.google.com") ||
      !url.includes("/conversions?name=");
    let effectivePostUrl = (data.post_url ?? "").trim();
    if (isWrongUrl(effectivePostUrl) && supabaseBase) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nombre")
        .eq("id", data.user_id)
        .maybeSingle();
      const nombre = (profile?.nombre ?? "").trim();
      if (nombre) {
        effectivePostUrl = `${supabaseBase}/functions/v1/conversions?name=${
          encodeURIComponent(nombre)
        }`;
      }
    }

    const asAny = data as {
      landing_config?: unknown;
      updated_at?: string;
      phone_mode?: "random" | "fair" | null;
    };

    const rawConfig = resolveActiveTemplateRawConfig(
      (data.config ?? {}) as Record<string, unknown>,
    );
    const workspaceCurrency = String(data.workspace_currency ?? "ARS").trim().toUpperCase() === "PYG"
      ? "PYG"
      : "ARS";
    const phoneCountryCode = phoneCountryCodeForWorkspace(workspaceCurrency);

    // Si ya existe landing_config persistido, lo devolvemos pero SIEMPRE inyectamos
    // post_url (effectivePostUrl = conversiones, nunca Sheet) y refrescamos
    // algunos campos desde config para evitar drift de versiones viejas.
    if (asAny.landing_config != null) {
      const cfg = asAny.landing_config as Record<string, unknown>;
      const tracking = (cfg.tracking as Record<string, unknown>) ?? {};
      const typography = (cfg.typography as Record<string, unknown>) ?? {};
      const ctaTypography = (typography.cta as Record<string, unknown>) ?? {};
      const rawBackground = (cfg.background as Record<string, unknown>) ?? {};
      const rawInteractions = (cfg.interactions as Record<string, unknown>) ??
        {};
      const rawLeadCapture = (cfg.leadCapture as Record<string, unknown>) ?? {};
      const rawLeadCaptureFields =
        (rawLeadCapture.fields as Record<string, unknown>) ?? {};
      const rawConfigLeadCapture =
        (rawConfig.leadCapture as Record<string, unknown>) ?? {};
      const rawConfigLeadCaptureFields =
        (rawConfigLeadCapture.fields as Record<string, unknown>) ?? {};
      const rawImages = Array.isArray(rawBackground.images)
        ? (rawBackground.images as string[])
        : [];
      const merged = {
        ...cfg,
        workspaceCurrency,
        tracking: {
          ...tracking,
          postUrl: effectivePostUrl,
          phoneCountryCode,
          currency: workspaceCurrency,
          workspaceCurrency,
          sendContactPixel: typeof tracking.sendContactPixel === "boolean"
            ? tracking.sendContactPixel
            : ((rawConfig.sendContactPixel as boolean | undefined) ?? true),
        },
        typography: {
          ...typography,
          fontFamily: "system",
          cta: {
            ...ctaTypography,
            sizePx: (rawConfig.ctaFontSize as number) ??
              (ctaTypography.sizePx as number) ?? 18,
            weight: (rawConfig.ctaBold as boolean | undefined)
              ? 700
              : ((rawConfig.ctaBold as boolean | undefined) === false
                ? 500
                : ((ctaTypography.weight as number) ?? 500)),
          },
        },
        background: {
          ...rawBackground,
          images: rawImages.map((url) => buildOptimizedImageUrl(url)),
          imagesResponsive: rawImages.map((url) =>
            buildResponsiveImageSet(url)
          ),
        },
        interactions: {
          ...rawInteractions,
          enabled: typeof rawConfig.interactionsEnabled === "boolean"
            ? rawConfig.interactionsEnabled
            : ((rawInteractions.enabled as boolean | undefined) ?? false),
          whatsappPrefillText: typeof rawConfig.whatsappPrefillText === "string"
            ? rawConfig.whatsappPrefillText
            : ((rawInteractions.whatsappPrefillText as string | undefined) ??
              ""),
        },
        leadCapture: {
          ...rawLeadCapture,
          enabled: typeof rawConfigLeadCapture.enabled === "boolean"
            ? rawConfigLeadCapture.enabled
            : ((rawLeadCapture.enabled as boolean | undefined) ?? false),
          title: typeof rawConfigLeadCapture.title === "string"
            ? rawConfigLeadCapture.title
            : ((rawLeadCapture.title as string | undefined) ?? ""),
          description: typeof rawConfigLeadCapture.description === "string"
            ? rawConfigLeadCapture.description
            : ((rawLeadCapture.description as string | undefined) ?? ""),
          fields: {
            ...rawLeadCaptureFields,
            firstName: typeof rawConfigLeadCaptureFields.firstName === "boolean"
              ? rawConfigLeadCaptureFields.firstName
              : ((rawLeadCaptureFields.firstName as boolean | undefined) ??
                true),
            lastName: typeof rawConfigLeadCaptureFields.lastName === "boolean"
              ? rawConfigLeadCaptureFields.lastName
              : ((rawLeadCaptureFields.lastName as boolean | undefined) ??
                true),
            phone: typeof rawConfigLeadCaptureFields.phone === "boolean"
              ? rawConfigLeadCaptureFields.phone
              : ((rawLeadCaptureFields.phone as boolean | undefined) ?? true),
            email: typeof rawConfigLeadCaptureFields.email === "boolean"
              ? rawConfigLeadCaptureFields.email
              : ((rawLeadCaptureFields.email as boolean | undefined) ?? true),
          },
        },
      };
      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=10, must-revalidate",
        },
      });
    }

    const themeWithHex = {
      ...rawConfig,
      titleColor: toHex(rawConfig.titleColor, "#FFFFFF"),
      subtitleColor: toHex(rawConfig.subtitleColor, "#FFFFFF"),
      footerBadgeColor: toHex(rawConfig.footerBadgeColor, "#FFD700"),
      ctaTextColor: toHex(rawConfig.ctaTextColor, "#000000"),
      ctaBackgroundColor: toHex(rawConfig.ctaBackgroundColor, "#25D366"),
      ctaGlowColor: toHex(rawConfig.ctaGlowColor, "#000000"),
    } as Record<string, unknown>;
    const templateNumber = templateNumberForOption(themeWithHex.template);
    const fixedVisualTemplate = templateNumber === 4 || templateNumber === 5;
    const rawImages = (themeWithHex.backgroundImages as string[]) ?? [];

    const payload = {
      schemaVersion: 1,
      updatedAt: asAny.updated_at ??
        new Date().toISOString(),
      id: data.id,
      name: data.name,
      comment: data.comment ?? "",
      workspaceCurrency,
      tracking: {
        pixelId: data.pixel_id ?? "",
        postUrl: effectivePostUrl,
        landingTag: data.landing_tag ?? "",
        phoneCountryCode,
        currency: workspaceCurrency,
        workspaceCurrency,
        sendContactPixel: (rawConfig.sendContactPixel as boolean | undefined) ??
          true,
      },
      background: {
        mode: (themeWithHex.backgroundMode as string) ?? "single",
        images: rawImages.map((url) => buildOptimizedImageUrl(url)),
        imagesResponsive: rawImages.map((url) => buildResponsiveImageSet(url)),
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
        fontFamily: "system",
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
        mode: (data.phone_mode as "random" | "fair" | null) ??
          "random",
      },
      interactions: {
        enabled: fixedVisualTemplate
          ? false
          : ((themeWithHex.interactionsEnabled as boolean | undefined) ??
            false),
        whatsappPrefillText: fixedVisualTemplate
          ? ""
          : ((themeWithHex.whatsappPrefillText as string) ?? ""),
      },
      leadCapture: {
        enabled: fixedVisualTemplate
          ? false
          : (((themeWithHex.leadCapture as Record<string, unknown> | undefined)
            ?.enabled as boolean | undefined) ?? false),
        title:
          ((themeWithHex.leadCapture as Record<string, unknown> | undefined)
            ?.title as string | undefined) ?? "",
        description:
          ((themeWithHex.leadCapture as Record<string, unknown> | undefined)
            ?.description as string | undefined) ?? "",
        fields: {
          firstName:
            (((themeWithHex.leadCapture as Record<string, unknown> | undefined)
              ?.fields as Record<string, unknown> | undefined)
              ?.firstName as boolean | undefined) ?? true,
          lastName:
            (((themeWithHex.leadCapture as Record<string, unknown> | undefined)
              ?.fields as Record<string, unknown> | undefined)
              ?.lastName as boolean | undefined) ?? true,
          phone:
            (((themeWithHex.leadCapture as Record<string, unknown> | undefined)
              ?.fields as Record<string, unknown> | undefined)
              ?.phone as boolean | undefined) ?? true,
          email:
            (((themeWithHex.leadCapture as Record<string, unknown> | undefined)
              ?.fields as Record<string, unknown> | undefined)
              ?.email as boolean | undefined) ?? true,
        },
      },
      layout: {
        ctaPosition: (themeWithHex.ctaPosition as
          | "top"
          | "between_title_and_info"
          | "between_info_and_badge"
          | "bottom") ?? "between_title_and_info",
        template: templateNumber,
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
