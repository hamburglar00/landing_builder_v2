import { createClient } from "@supabase/supabase-js";

// Copiado de supabase/functions/builder-config/index.ts para mantener
// un único criterio de colores hex.
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

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // eslint-disable-next-line no-console
    console.error(
      "Faltan variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1) Traer landings sin landing_config
  const { data, error } = await supabase
    .from("landings")
    .select("id, name, pixel_id, post_url, landing_tag, comment, phone_mode, config, updated_at, landing_config")
    .is("landing_config", null);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error leyendo landings:", error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No hay landings pendientes de backfill de landing_config.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Backfill de landing_config para ${data.length} landings...`);

  for (const row of data as any[]) {
    try {
      const rawConfig = (row.config ?? {}) as Record<string, unknown>;
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
        updatedAt: (row as { updated_at?: string }).updated_at
          ? new Date(row.updated_at).toISOString()
          : new Date().toISOString(),
        id: row.id as string,
        name: row.name as string,
        comment: (row.comment as string) ?? "",
        tracking: {
          pixelId: (row.pixel_id as string) ?? "",
          postUrl: (row.post_url as string) ?? "",
          landingTag: (row.landing_tag as string) ?? "",
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
            (themeWithHex.footerBadgeLine1 as string) ??
              "",
            (themeWithHex.footerBadgeLine2 as string) ?? "",
            (themeWithHex.footerBadgeLine3 as string) ?? "",
          ],
          ctaText: (themeWithHex.ctaText as string) ?? "",
        },
        typography: {
          fontFamily: (themeWithHex.fontFamily as string) ?? "system",
          title: {
            sizePx: (themeWithHex.titleFontSize as number) ?? 28,
            weight: (themeWithHex.titleBold as boolean | undefined)
              ? 700
              : 500,
          },
          subtitle: {
            sizePx: (themeWithHex.subtitleFontSize as number) ?? 16,
            weight: (themeWithHex.subtitleBold as boolean | undefined)
              ? 600
              : 400,
          },
          cta: {
            sizePx: (themeWithHex.ctaFontSize as number) ?? 18,
            weight: (themeWithHex.ctaBold as boolean | undefined)
              ? 700
              : 500,
          },
          badge: {
            sizePx: (themeWithHex.badgeFontSize as number) ?? 12,
            weight: (themeWithHex.badgeBold as boolean | undefined)
              ? 700
              : 400,
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
            ((row as { phone_mode?: "random" | "fair" | null }).phone_mode) ??
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

      const { error: updateError } = await supabase
        .from("landings")
        .update({ landing_config: payload })
        .eq("id", row.id);

      if (updateError) {
        // eslint-disable-next-line no-console
        console.error(
          `Error actualizando landing_config para landing ${row.id}:`,
          updateError,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(`landing_config seteado para landing ${row.id}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Error procesando landing ${row.id}:`, e);
    }
  }
}

// Solo ejecutar si se llama explícitamente a este script (no se corre en producción automáticamente).
// eslint-disable-next-line no-console
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

