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

export interface NotificationTelegramDestination {
  id: number;
  user_id: string;
  telegram_chat_id: string;
  telegram_username: string;
  telegram_first_name: string;
  telegram_last_name: string;
  telegram_phone: string;
  is_active: boolean;
  linked_at: string;
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

function generateStartToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
}

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
  if (data) {
    const row = data as NotificationSettings;
    if (String(row.telegram_start_token || "").trim()) return row;
    const fixedToken = generateStartToken();
    const { error: fixError } = await supabase
      .from("notification_settings")
      .update({ telegram_start_token: fixedToken, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (fixError) throw fixError;
    return { ...row, telegram_start_token: fixedToken };
  }

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
  const startToken = String(settings.telegram_start_token || "").trim() || generateStartToken();
  const { error } = await supabase
    .from("notification_settings")
    .upsert(
      {
        user_id: settings.user_id,
        enabled: settings.enabled,
        channel: "telegram",
        telegram_chat_id: settings.telegram_chat_id ?? "",
        telegram_start_token: startToken,
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

export async function fetchNotificationTelegramDestinations(
  userId: string,
): Promise<NotificationTelegramDestination[]> {
  const { data, error } = await supabase
    .from("notification_telegram_destinations")
    .select(
      "id, user_id, telegram_chat_id, telegram_username, telegram_first_name, telegram_last_name, telegram_phone, is_active, linked_at",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("linked_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NotificationTelegramDestination[];
}

export async function deactivateNotificationTelegramDestination(
  userId: string,
  destinationId: number,
): Promise<void> {
  const { error } = await supabase
    .from("notification_telegram_destinations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", destinationId)
    .eq("user_id", userId);
  if (error) throw error;
}
