import { supabase } from "@/lib/supabaseClient";

export type KommoSyncStatus = "pending" | "synced" | "error";

export interface KommoClientConfig {
  id: string;
  user_id: string;
  name: string;
  kommo_api_base_url: string;
  kommo_access_token: string;
  active: boolean;
  sync_status: KommoSyncStatus;
  sync_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchKommoClientConfig(
  userId: string,
): Promise<KommoClientConfig | null> {
  const { data, error } = await supabase
    .from("kommo_client_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as KommoClientConfig | null;
}

export async function upsertKommoClientConfig(input: {
  user_id: string;
  name: string;
  kommo_api_base_url: string;
  kommo_access_token: string;
  active: boolean;
  sync_status?: KommoSyncStatus;
  sync_error?: string | null;
  last_synced_at?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("kommo_client_configs")
    .upsert(
      {
        user_id: input.user_id,
        name: input.name,
        kommo_api_base_url: input.kommo_api_base_url,
        kommo_access_token: input.kommo_access_token,
        active: input.active,
        sync_status: input.sync_status ?? "pending",
        sync_error: input.sync_error ?? null,
        last_synced_at: input.last_synced_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}
