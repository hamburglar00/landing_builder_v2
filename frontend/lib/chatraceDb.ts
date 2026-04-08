import { supabase } from "@/lib/supabaseClient";

export interface ChatraceClientConfig {
  id: string;
  user_id: string;
  name: string;
  meta_pixel_id: string;
  post_url: string;
  landing_tag: string;
  send_contact_pixel: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchChatraceClientConfig(
  userId: string,
): Promise<ChatraceClientConfig | null> {
  const { data, error } = await supabase
    .from("chatrace_client_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ChatraceClientConfig | null;
}

export async function upsertChatraceClientConfig(input: {
  user_id: string;
  name: string;
  meta_pixel_id: string;
  post_url: string;
  landing_tag: string;
  send_contact_pixel: boolean;
  active: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from("chatrace_client_configs")
    .upsert(
      {
        user_id: input.user_id,
        name: input.name,
        meta_pixel_id: input.meta_pixel_id,
        post_url: input.post_url,
        landing_tag: input.landing_tag,
        send_contact_pixel: input.send_contact_pixel,
        active: input.active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}
