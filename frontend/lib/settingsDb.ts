import { supabase } from "@/lib/supabaseClient";

export interface SettingsRow {
  id: number;
  url_base: string;
  show_client_landing_preview: boolean;
}

const SETTINGS_ROW_ID = 1;

/**
 * Proyeccion no sensible; RLS autoriza las filas accesibles.
 */
export async function getSettings(): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from("settings")
    .select(
      "id, url_base, show_client_landing_preview",
    )
    .eq("id", SETTINGS_ROW_ID)
    .single();

  if (error) throw error;
  if (!data) throw new Error("No se encontro la configuracion.");
  return { id: data.id, url_base: data.url_base, show_client_landing_preview: data.show_client_landing_preview };
}

/**
 * Actualiza url_base y banderas globales. Solo admins (RLS para update).
 */
export async function updateSettings(params: {
  urlBase?: string;
  showClientLandingPreview?: boolean;
}): Promise<void> {
  if (!params || typeof params !== "object" || Array.isArray(params)
    || Object.keys(params).some(key => !["urlBase", "showClientLandingPreview"].includes(key))) {
    throw new Error("Actualizacion de configuracion no permitida.");
  }
  const body: Record<string, unknown> = {};
  if (params.urlBase !== undefined) body.url_base = params.urlBase;
  if (params.showClientLandingPreview !== undefined) {
    body.show_client_landing_preview = params.showClientLandingPreview;
  }

  if (Object.keys(body).length === 0) return;

  const { error } = await supabase
    .from("settings")
    .update(body)
    .eq("id", SETTINGS_ROW_ID);

  if (error) throw error;
}
