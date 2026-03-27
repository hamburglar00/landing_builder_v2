"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NotificationsPageContent from "@/components/notificaciones/NotificationsPageContent";
import {
  deactivateNotificationTelegramDestination,
  fetchNotificationBotConfig,
  fetchNotificationTelegramDestinations,
  fetchNotificationSettings,
  upsertNotificationBotConfig,
  upsertNotificationSettings,
  type NotificationBotConfig,
  type NotificationTelegramDestination,
  type NotificationSettings,
} from "@/lib/notificationsDb";

export default function AdminNotificacionesPage() {
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
        const bot = await fetchNotificationBotConfig();
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
    return <div className="text-sm text-zinc-400">Cargando...</div>;
  }

  return (
    <NotificationsPageContent
      isAdmin
      botConfig={botConfig}
      settings={settings}
      destinations={destinations}
      saving={saving}
      onSaveBot={async (cfg) => {
        setSaving(true);
        try {
          await upsertNotificationBotConfig(cfg);
          setBotConfig(cfg);
        } finally {
          setSaving(false);
        }
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
          await deactivateNotificationTelegramDestination(user.id, destinationId);
          setDestinations(await fetchNotificationTelegramDestinations(user.id));
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
