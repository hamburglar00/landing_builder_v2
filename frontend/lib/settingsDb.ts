import { supabase } from "@/lib/supabaseClient";

export interface SettingsRow {
  id: number;
  url_base: string;
  show_client_landing_preview: boolean;
  revalidate_secret: string;
}

const SETTINGS_ROW_ID = 1;

/**
 * Obtiene la configuración global. Solo admins (RLS).
 */
export async function getSettings(): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from("settings")
    .select("id, url_base, show_client_landing_preview, revalidate_secret")
    .eq("id", SETTINGS_ROW_ID)
    .single();

  if (error) throw error;
  if (!data) throw new Error("No se encontró la configuración.");
  return data as SettingsRow;
}

/**
 * Actualiza url_base y banderas globales. Solo admins (RLS para update).
 */
export async function updateSettings(params: {
  urlBase?: string;
  showClientLandingPreview?: boolean;
  revalidateSecret?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {};
  if (params.urlBase !== undefined) body.url_base = params.urlBase;
  if (params.showClientLandingPreview !== undefined)
    body.show_client_landing_preview = params.showClientLandingPreview;
  if (params.revalidateSecret !== undefined)
    body.revalidate_secret = params.revalidateSecret;

  if (Object.keys(body).length === 0) return;

  const { error } = await supabase
    .from("settings")
    .update(body)
    .eq("id", SETTINGS_ROW_ID);

  if (error) throw error;
}
