import { supabase } from "@/lib/supabaseClient";
import { normalizeClientModulePermissions, type ClientModulePermissions } from "@/lib/clientModules";

export async function fetchClientModulePermissions(userId: string): Promise<ClientModulePermissions> {
  const { data, error } = await supabase
    .from("client_module_permissions")
    .select("show_followups,show_whatsapp_api,show_atrio,show_kommo,show_chatrace")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("No se pudieron cargar los permisos de la cuenta.");
  return normalizeClientModulePermissions(data);
}
