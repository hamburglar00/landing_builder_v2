import { supabase } from "@/lib/supabaseClient";

export interface NotificationBotConfig {
  telegram_bot_token: string;
  telegram_bot_username: string;
}

export interface NotificationSettings {
  user_id: string;
  enabled: boolean;
  channel: "telegram";
  telegram_chat_id: string;
  telegram_start_token: string;
  inactive_days: number;
  renotify_days: number;
  notify_hour: number;
  timezone: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  user_id: "",
  enabled: true,
  channel: "telegram",
  telegram_chat_id: "",
  telegram_start_token: "",
  inactive_days: 1,
  renotify_days: 5,
  notify_hour: 10,
  timezone: "America/Argentina/Buenos_Aires",
};

export async function fetchNotificationBotConfig(): Promise<NotificationBotConfig> {
  const { data, error } = await supabase
    .from("notification_bot_config")
    .select("telegram_bot_token, telegram_bot_username")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return {
    telegram_bot_token: data?.telegram_bot_token ?? "",
    telegram_bot_username: data?.telegram_bot_username ?? "",
  };
}

export async function fetchNotificationBotUsernamePublic(): Promise<string> {
  const { data, error } = await supabase.rpc("get_notification_bot_username");
  if (error) throw error;
  return String(data ?? "");
}

export async function upsertNotificationBotConfig(cfg: NotificationBotConfig): Promise<void> {
  const payload = {
    telegram_bot_token: cfg.telegram_bot_token.trim(),
    telegram_bot_username: cfg.telegram_bot_username.trim().replace(/^@/, ""),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("notification_bot_config")
    .update(payload)
    .eq("id", 1);
  if (!updateError) return;

  // Fallback defensivo por si no existiera la fila singleton.
  const { error: insertError } = await supabase
    .from("notification_bot_config")
    .insert({ id: 1, ...payload });
  if (insertError) throw insertError;
}

export async function fetchNotificationSettings(userId: string): Promise<NotificationSettings> {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as NotificationSettings;

  // Cliente nuevo: inicializa fila para generar telegram_start_token y defaults.
  const { error: ensureError } = await supabase
    .from("notification_settings")
    .upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (ensureError) throw ensureError;

  const { data: created, error: createdError } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (createdError) throw createdError;
  if (!created) return { ...DEFAULT_SETTINGS, user_id: userId };
  return created as NotificationSettings;
}

export async function upsertNotificationSettings(settings: NotificationSettings): Promise<void> {
  const { error } = await supabase
    .from("notification_settings")
    .upsert(
      {
        user_id: settings.user_id,
        enabled: settings.enabled,
        channel: "telegram",
        telegram_chat_id: settings.telegram_chat_id ?? "",
        telegram_start_token: settings.telegram_start_token,
        inactive_days: settings.inactive_days,
        renotify_days: settings.renotify_days,
        notify_hour: settings.notify_hour,
        timezone: "America/Argentina/Buenos_Aires",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}
