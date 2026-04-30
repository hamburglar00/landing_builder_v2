"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NotificationsPageContent from "@/components/notificaciones/NotificationsPageContent";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import {
  clearLegacyNotificationTelegramChat,
  fetchNotificationBotUsernamePublic,
  fetchNotificationTelegramDestinations,
  fetchNotificationSettings,
  removeNotificationTelegramDestination,
  upsertNotificationSettings,
  type NotificationBotConfig,
  type NotificationTelegramDestination,
  type NotificationSettings,
} from "@/lib/notificationsDb";

export default function DashboardNotificacionesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botConfig, setBotConfig] = useState<NotificationBotConfig | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [destinations, setDestinations] = useState<NotificationTelegramDestination[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const bot = await fetchNotificationBotUsernamePublic()
          .then((username) => ({ telegram_bot_token: "", telegram_bot_username: username }))
          .catch(() => ({ telegram_bot_token: "", telegram_bot_username: "" }));
        setBotConfig(bot);

        const cfg = await fetchNotificationSettings(user.id);
        setSettings(cfg);

        const dest = await fetchNotificationTelegramDestinations(user.id).catch(() => []);
        setDestinations(dest);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return <DashboardSkeleton title="Cargando notificaciones..." />;
  }

  return (
    <NotificationsPageContent
      isAdmin={false}
      botConfig={botConfig}
      settings={settings}
      destinations={destinations}
      saving={saving}
      onSaveBot={async () => {
        // no-op for clients
      }}
      onSaveSettings={async (cfg) => {
        setSaving(true);
        try {
          await upsertNotificationSettings(cfg);
          setSettings(cfg);
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setDestinations(await fetchNotificationTelegramDestinations(user.id));
          }
        } finally {
          setSaving(false);
        }
      }}
      onDisconnectDestination={async (destinationId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setSaving(true);
        try {
          await removeNotificationTelegramDestination(user.id, destinationId);
          setDestinations(await fetchNotificationTelegramDestinations(user.id));
          setSettings(await fetchNotificationSettings(user.id));
        } finally {
          setSaving(false);
        }
      }}
      onDisconnectLegacy={async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setSaving(true);
        try {
          await clearLegacyNotificationTelegramChat(user.id);
          setSettings(await fetchNotificationSettings(user.id));
          setDestinations(await fetchNotificationTelegramDestinations(user.id));
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
