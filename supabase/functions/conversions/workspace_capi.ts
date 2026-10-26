import { normalizeCurrencyCode } from "./shared.ts";

export const WORKSPACE_CAPI_DISABLED_STATUS = "skipped_workspace_capi_disabled";

export function workspaceCapiEnabled(
  config: { capi_workspace_settings?: unknown; meta_currency?: unknown },
  currency: unknown,
): boolean {
  const workspace = normalizeCurrencyCode(currency, config.meta_currency);
  const settings = config.capi_workspace_settings;
  return !settings || typeof settings !== "object" || Array.isArray(settings) ||
    (settings as Record<string, unknown>)[workspace] !== false;
}
