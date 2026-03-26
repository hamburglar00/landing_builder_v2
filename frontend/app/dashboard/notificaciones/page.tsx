"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NotificationsPageContent from "@/components/notificaciones/NotificationsPageContent";
import {
  fetchNotificationBotUsernamePublic,
  fetchNotificationSettings,
  upsertNotificationSettings,
  type NotificationBotConfig,
  type NotificationSettings,
} from "@/lib/notificationsDb";

export default function DashboardNotificacionesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botConfig, setBotConfig] = useState<NotificationBotConfig | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const [bot, cfg] = await Promise.all([
          fetchNotificationBotUsernamePublic()
            .then((username) => ({ telegram_bot_token: "", telegram_bot_username: username }))
            .catch(() => ({ telegram_bot_token: "", telegram_bot_username: "" })),
          fetchNotificationSettings(user.id),
        ]);
        setBotConfig(bot);
        setSettings(cfg);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return <div className="text-sm text-zinc-400">Cargando...</div>;
  }

  return (
    <NotificationsPageContent
      isAdmin={false}
      botConfig={botConfig}
      settings={settings}
      saving={saving}
      onSaveBot={async () => {
        // no-op for clients
      }}
      onSaveSettings={async (cfg) => {
        setSaving(true);
        try {
          await upsertNotificationSettings(cfg);
          setSettings(cfg);
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
