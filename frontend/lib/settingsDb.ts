import { supabase } from "@/lib/supabaseClient";

export interface SettingsRow {
  id: number;
  url_base: string;
}

const SETTINGS_ROW_ID = 1;

/**
 * Obtiene la configuración global. Solo admins (RLS).
 */
export async function getSettings(): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from("settings")
    .select("id, url_base")
    .eq("id", SETTINGS_ROW_ID)
    .single();

  if (error) throw error;
  if (!data) throw new Error("No se encontró la configuración.");
  return data as SettingsRow;
}

/**
 * Actualiza url_base. Solo admins (RLS).
 */
export async function updateSettingsUrlBase(urlBase: string): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .update({ url_base: urlBase })
    .eq("id", SETTINGS_ROW_ID);

  if (error) throw error;
}
