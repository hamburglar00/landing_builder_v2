import {
  fetchPixelConfigs,
  upsertConversionsConfig,
  upsertPixelConfig,
  type ConversionsConfig,
  type PixelConfig,
} from "@/lib/conversionsDb";

type SaveConversionPageConfigRequest = {
  userId: string;
  config: ConversionsConfig;
  pixelConfigs: PixelConfig[];
};

export async function saveConversionPageConfig({
  userId,
  config,
  pixelConfigs,
}: SaveConversionPageConfigRequest): Promise<PixelConfig[]> {
  await upsertConversionsConfig({ ...config, user_id: userId });

  const pixel = String(config.pixel_id ?? "").replace(/\D/g, "");
  const token = String(config.meta_access_token ?? "").trim();
  if (!pixel || !token) return pixelConfigs;

  const currency = String(config.meta_currency ?? "ARS").trim() || "ARS";
  const existing = pixelConfigs.find((item) => item.pixel_id === pixel);

  await upsertPixelConfig({
    user_id: userId,
    pixel_id: pixel,
    meta_access_token: token,
    meta_currency: currency,
    meta_api_version: config.meta_api_version || "v25.0",
    send_contact_capi: !!config.send_contact_capi,
    send_lead_capi: config.send_lead_capi !== false,
    send_purchase_capi: config.send_purchase_capi !== false,
    include_purchase_type_capi: config.include_purchase_type_capi !== false,
    send_first_purchase_capi: config.send_first_purchase_capi !== false,
    send_repeat_purchase_capi: config.send_repeat_purchase_capi !== false,
    send_geo_capi: config.send_geo_capi !== false,
    geo_use_ipapi: !!config.geo_use_ipapi,
    geo_fill_only_when_missing: !!config.geo_fill_only_when_missing,
    is_default: existing ? existing.is_default : pixelConfigs.length === 0,
  });

  return fetchPixelConfigs(userId);
}
