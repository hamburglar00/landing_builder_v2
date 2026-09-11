import type { SupabaseClient } from "@supabase/supabase-js";
import {
  META_AUDIENCE_CONFIG_VERSION,
  cloneMetaAudienceConfig,
  normalizeMetaAudienceConfig,
  validateMetaAudienceConfig,
  type MetaAudienceConfig,
  type MetaAudienceCurrency,
} from "@/lib/metaAudienceConfig";
import { supabase } from "@/lib/supabaseClient";

export type SavedMetaAudienceConfig = {
  id: string;
  userId: string;
  name: string;
  config: MetaAudienceConfig;
  createdAt: string;
  updatedAt: string;
};

type MetaAudienceConfigRow = {
  id: string;
  user_id: string;
  name: string;
  currency: MetaAudienceCurrency;
  audience_type: MetaAudienceConfig["audienceType"];
  period_kind: MetaAudienceConfig["period"]["kind"];
  relative_days: number | null;
  custom_start_date: string | null;
  custom_end_date: string | null;
  period_timezone: MetaAudienceConfig["period"]["timezone"];
  purchase_scope: MetaAudienceConfig["purchaseScope"];
  rules: MetaAudienceConfig["rules"];
  summary_value_metric: MetaAudienceConfig["summaryValueMetric"];
  export_value_metric: MetaAudienceConfig["exportValueMetric"];
  selected_fields: MetaAudienceConfig["selectedFields"];
  source_preset_id: string | null;
  source_preset_version: number | null;
  config_version: number;
  created_at: string;
  updated_at: string;
};

function rowToSaved(row: MetaAudienceConfigRow): SavedMetaAudienceConfig {
  const period: MetaAudienceConfig["period"] = row.period_kind === "relative"
    ? { kind: "relative", days: Number(row.relative_days), timezone: row.period_timezone }
    : { kind: "custom", startDate: String(row.custom_start_date), endDate: String(row.custom_end_date), timezone: row.period_timezone };
  const config: MetaAudienceConfig = {
    currency: row.currency,
    audienceType: row.audience_type,
    period,
    purchaseScope: row.purchase_scope,
    rules: row.rules,
    summaryValueMetric: row.summary_value_metric,
    exportValueMetric: row.export_value_metric,
    selectedFields: row.selected_fields,
    sourcePresetId: row.source_preset_id,
    sourcePresetVersion: row.source_preset_version,
    configVersion: row.config_version as typeof META_AUDIENCE_CONFIG_VERSION,
  };
  const errors = validateMetaAudienceConfig(config);
  if (errors.length > 0) throw new Error(`La audiencia guardada “${row.name}” no es válida: ${errors.join(" ")}`);
  return { id: row.id, userId: row.user_id, name: row.name, config: normalizeMetaAudienceConfig(config), createdAt: row.created_at, updatedAt: row.updated_at };
}

function configColumns(config: MetaAudienceConfig) {
  const normalized = normalizeMetaAudienceConfig(config);
  return {
    currency: normalized.currency,
    audience_type: normalized.audienceType,
    period_kind: normalized.period.kind,
    relative_days: normalized.period.kind === "relative" ? normalized.period.days : null,
    custom_start_date: normalized.period.kind === "custom" ? normalized.period.startDate : null,
    custom_end_date: normalized.period.kind === "custom" ? normalized.period.endDate : null,
    period_timezone: normalized.period.timezone,
    purchase_scope: normalized.purchaseScope,
    rules: normalized.rules,
    summary_value_metric: normalized.summaryValueMetric,
    export_value_metric: normalized.exportValueMetric,
    selected_fields: normalized.selectedFields,
    source_preset_id: normalized.sourcePresetId,
    source_preset_version: normalized.sourcePresetVersion,
    config_version: normalized.configVersion,
  };
}

function assertName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 1 || clean.length > 120) throw new Error("El nombre debe tener entre 1 y 120 caracteres.");
  return clean;
}

async function authenticatedUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw error ?? new Error("La sesión expiró.");
  return data.user.id;
}

export async function listSavedMetaAudienceConfigs(currency: MetaAudienceCurrency): Promise<SavedMetaAudienceConfig[]> {
  return listSavedMetaAudienceConfigsWithClient(supabase, currency);
}

export async function listSavedMetaAudienceConfigsWithClient(client: SupabaseClient, currency: MetaAudienceCurrency): Promise<SavedMetaAudienceConfig[]> {
  const { data, error } = await client.from("meta_audience_configs").select("*").eq("currency", currency).order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MetaAudienceConfigRow[]).map(rowToSaved);
}

export async function createSavedMetaAudienceConfig(name: string, config: MetaAudienceConfig): Promise<SavedMetaAudienceConfig> {
  return createSavedMetaAudienceConfigWithClient(supabase, name, config);
}

export async function createSavedMetaAudienceConfigWithClient(client: SupabaseClient, name: string, config: MetaAudienceConfig): Promise<SavedMetaAudienceConfig> {
  const errors = validateMetaAudienceConfig(config);
  if (errors.length > 0) throw new Error(errors.join(" "));
  const userId = await authenticatedUserId(client);
  const { data, error } = await client.from("meta_audience_configs").insert({ user_id: userId, name: assertName(name), ...configColumns(config) }).select("*").single();
  if (error) throw error;
  return rowToSaved(data as MetaAudienceConfigRow);
}

export async function updateSavedMetaAudienceConfig(saved: SavedMetaAudienceConfig, name: string, config: MetaAudienceConfig): Promise<SavedMetaAudienceConfig> {
  return updateSavedMetaAudienceConfigWithClient(supabase, saved, name, config);
}

export async function updateSavedMetaAudienceConfigWithClient(client: SupabaseClient, saved: SavedMetaAudienceConfig, name: string, config: MetaAudienceConfig): Promise<SavedMetaAudienceConfig> {
  const errors = validateMetaAudienceConfig(config);
  if (errors.length > 0) throw new Error(errors.join(" "));
  const { data, error } = await client.from("meta_audience_configs").update({ name: assertName(name), ...configColumns(config) }).eq("id", saved.id).eq("updated_at", saved.updatedAt).select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Esta audiencia fue modificada en otra pestaña. Volvé a abrirla antes de guardar.");
  return rowToSaved(data as MetaAudienceConfigRow);
}

export async function renameSavedMetaAudienceConfig(saved: SavedMetaAudienceConfig, name: string): Promise<SavedMetaAudienceConfig> {
  const { data, error } = await supabase.from("meta_audience_configs").update({ name: assertName(name) }).eq("id", saved.id).eq("updated_at", saved.updatedAt).select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Esta audiencia fue modificada en otra pestaña. Volvé a abrirla antes de renombrar.");
  return rowToSaved(data as MetaAudienceConfigRow);
}

export async function duplicateSavedMetaAudienceConfig(saved: SavedMetaAudienceConfig, name: string): Promise<SavedMetaAudienceConfig> {
  return createSavedMetaAudienceConfig(assertName(name), cloneMetaAudienceConfig(saved.config));
}

export async function deleteSavedMetaAudienceConfig(saved: SavedMetaAudienceConfig): Promise<void> {
  const { data, error } = await supabase.from("meta_audience_configs").delete().eq("id", saved.id).eq("updated_at", saved.updatedAt).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Esta audiencia fue modificada o eliminada en otra pestaña.");
}
