// Single initialization path for manual create-client and PBAdmin provisioning.
// Defaults belong here (and table defaults); do not duplicate them in the extension.
import { parseModuleVisibility } from "./client-module-permissions.ts";
type ClientDb = { from: (table: string) => any };
export type ClientOptions = {
  visibleColumns?: string[];
  showLogs?: boolean;
  showAiAssistant?: boolean;
  showPromotions?: boolean;
  moduleVisibility?: unknown;
};
type PlanCode = "starter" | "plus" | "pro" | "premium" | "scale";

function getPlanDefaults(planCode: PlanCode): {
  maxLandings: number;
  maxPhones: number;
} {
  switch (planCode) {
    case "plus":
      return { maxLandings: 2, maxPhones: 5 };
    case "pro":
      return { maxLandings: 4, maxPhones: 10 };
    case "premium":
      return { maxLandings: 6, maxPhones: 20 };
    case "scale":
      return { maxLandings: 999, maxPhones: 999 };
    case "starter":
    default:
      return { maxLandings: 1, maxPhones: 2 };
  }
}

const FALLBACK_VISIBLE_COLUMNS = [
  "phone",
  "email",
  "fn",
  "ln",
  "ct",
  "st",
  "from_meta_ads",
  "meta_pixel_id",
  "timestamp",
  "estado",
  "valor",
  "currency",
  "test_event_code",
  "utm_campaign",
  "landing",
  "landing_resolution",
  "campana",
  "conjunto",
  "anuncio",
  "telefono_asignado",
  "promo_code",
];

export async function initializeClientDefaults(
  supabaseAdmin: ClientDb,
  userId: string,
  creatorId: string,
  options: ClientOptions = {},
) {
  const requestedVisibleColumns = Array.isArray(options.visibleColumns)
    ? options.visibleColumns.map((c) => String(c)).filter(Boolean)
    : null;
  const requestedShowLogs =
    typeof options.showLogs === "boolean" ? options.showLogs : null;
  const requestedShowAiAssistant =
    typeof options.showAiAssistant === "boolean"
      ? options.showAiAssistant
      : null;
  const requestedShowPromotions =
    typeof options.showPromotions === "boolean" ? options.showPromotions : null;
  const moduleVisibility = parseModuleVisibility(options.moduleVisibility);
  const { data: adminCfg } = await supabaseAdmin
    .from("conversions_config")
    .select(
      "visible_columns, funnel_premium_threshold, funnel_premium_thresholds, tracking_ranking_config, tracking_ranking_configs",
    )
    .eq("user_id", creatorId)
    .maybeSingle();

  const finalVisibleColumns =
    requestedVisibleColumns && requestedVisibleColumns.length > 0
      ? requestedVisibleColumns
      : FALLBACK_VISIBLE_COLUMNS;
  const finalShowLogs = requestedShowLogs ?? false;
  const finalShowAiAssistant = requestedShowAiAssistant ?? false;
  const finalShowPromotions = requestedShowPromotions ?? false;

  const premiumThreshold = Number(adminCfg?.funnel_premium_threshold);

  const { error: cfgError } = await supabaseAdmin
    .from("conversions_config")
    .upsert(
      {
        user_id: userId,
        visible_columns: finalVisibleColumns,
        funnel_premium_threshold: Number.isFinite(premiumThreshold)
          ? premiumThreshold
          : 50000,
        funnel_premium_thresholds:
          adminCfg?.funnel_premium_thresholds &&
          typeof adminCfg.funnel_premium_thresholds === "object" &&
          !Array.isArray(adminCfg.funnel_premium_thresholds)
            ? adminCfg.funnel_premium_thresholds
            : {
                ARS: Number.isFinite(premiumThreshold)
                  ? premiumThreshold
                  : 50000,
              },
        tracking_ranking_config: adminCfg?.tracking_ranking_config ?? null,
        tracking_ranking_configs:
          adminCfg?.tracking_ranking_configs &&
          typeof adminCfg.tracking_ranking_configs === "object" &&
          !Array.isArray(adminCfg.tracking_ranking_configs)
            ? adminCfg.tracking_ranking_configs
            : adminCfg?.tracking_ranking_config
              ? { ARS: adminCfg.tracking_ranking_config }
              : {},
        show_logs: finalShowLogs,
        show_ai_assistant: finalShowAiAssistant,
        show_promotions: finalShowPromotions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  if (cfgError) throw new Error("Client configuration pending");

  const { error: modulePermissionError } = await supabaseAdmin
    .from("client_module_permissions")
    .upsert(
      { user_id: userId, ...moduleVisibility },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (modulePermissionError) throw new Error("Module configuration pending");

  const defaults = getPlanDefaults("starter");
  const { error: subError } = await supabaseAdmin
    .from("client_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_code: "starter",
        max_landings: defaults.maxLandings,
        max_phones: defaults.maxPhones,
        status: "active",
        starts_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        grace_days: 5,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  if (subError) throw new Error("Client subscription pending");
}
