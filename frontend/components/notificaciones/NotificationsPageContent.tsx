"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  NotificationBotConfig,
  NotificationSettings,
} from "@/lib/notificationsDb";

function normalizeHour(v: number) {
  if (!Number.isFinite(v)) return 10;
  return Math.min(22, Math.max(8, Math.round(v)));
}

type Props = {
  isAdmin: boolean;
  botConfig: NotificationBotConfig | null;
  settings: NotificationSettings | null;
  saving: boolean;
  onSaveBot: (cfg: NotificationBotConfig) => Promise<void>;
  onSaveSettings: (cfg: NotificationSettings) => Promise<void>;
};

export default function NotificationsPageContent({
  isAdmin,
  botConfig,
  settings,
  saving,
  onSaveBot,
  onSaveSettings,
}: Props) {
  const [bot, setBot] = useState<NotificationBotConfig>(
    botConfig ?? { telegram_bot_token: "", telegram_bot_username: "" },
  );
  const [cfg, setCfg] = useState<NotificationSettings | null>(settings);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [botEditable, setBotEditable] = useState(false);

  useEffect(() => {
    setBot(botConfig ?? { telegram_bot_token: "", telegram_bot_username: "" });
    const hasSavedBot = Boolean(
      String(botConfig?.telegram_bot_token ?? "").trim() ||
      String(botConfig?.telegram_bot_username ?? "").trim(),
    );
    setBotEditable(!hasSavedBot);
  }, [botConfig]);

  useEffect(() => {
    setCfg(settings);
  }, [settings]);

  const connectUrl = useMemo(() => {
    const username = String(bot.telegram_bot_username || "").trim().replace(/^@/, "");
    const token = String(cfg?.telegram_start_token || "").trim();
    if (!username || !token) return "";
    return `https://t.me/${username}?start=${token}`;
  }, [bot.telegram_bot_username, cfg?.telegram_start_token]);
  const isTelegramConnected = Boolean(String(cfg?.telegram_chat_id || "").trim());
  const tokenValue = String(cfg?.telegram_start_token || "").trim();
  const shortTokenView = tokenValue
    ? `${tokenValue.slice(0, 6)}...${tokenValue.slice(-6)}`
    : "-";

  if (!cfg) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">NOTIFICACIONES</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configura alertas automaticas por inactividad en Telegram.
        </p>
      </div>

      {msg && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msgType === "error" ? "bg-red-950/50 text-red-300" : "bg-emerald-950/50 text-emerald-300"
          }`}
          role="alert"
        >
          {msg}
        </p>
      )}

      {isAdmin && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">Conectar bot</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-zinc-400">Token del bot</span>
              <input
                value={bot.telegram_bot_token}
                onChange={(e) =>
                  setBot((prev) => ({ ...prev, telegram_bot_token: e.target.value }))
                }
                disabled={!botEditable}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                placeholder="123456:AA..."
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-zinc-400">@nombre_bot</span>
              <input
                value={bot.telegram_bot_username}
                onChange={(e) =>
                  setBot((prev) => ({ ...prev, telegram_bot_username: e.target.value }))
                }
                disabled={!botEditable}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                placeholder="@Geraldina_bot"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setBotEditable((prev) => !prev)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
              >
                {botEditable ? "Bloquear" : "Editar"}
              </button>
            <button
              type="button"
              disabled={saving || !botEditable}
              onClick={async () => {
                try {
                  await onSaveBot(bot);
                  setBotEditable(false);
                  setMsgType("success");
                  setMsg("Bot guardado.");
                } catch (e) {
                  console.error(e);
                  setMsgType("error");
                  setMsg("No se pudo guardar el bot. Revisa permisos o intenta nuevamente.");
                } finally {
                  setTimeout(() => setMsg(null), 3000);
                }
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
            >
              Guardar bot
            </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">
          Seleccione canal de Notificaciones
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="space-y-1">
            <span className="text-xs text-zinc-400">Canal</span>
            <select
              value="telegram"
              disabled
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="telegram">Telegram</option>
            </select>
          </label>
          <a
            href={connectUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium ${
              connectUrl
                ? "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                : "border-zinc-800 bg-zinc-900 text-zinc-500 pointer-events-none"
            }`}
          >
            Conectar Telegram
          </a>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Despues de abrir Telegram, presiona Start para vincular tu chat privado.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center rounded-md px-2 py-1 font-medium ${
              isTelegramConnected
                ? "bg-emerald-950/50 text-emerald-300"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            Telegram conectado: {isTelegramConnected ? "Si" : "No"}
          </span>
          <span className="text-zinc-500">Token: {shortTokenView}</span>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Seguimiento</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="min-h-[2.5rem] text-xs leading-5 text-zinc-400">Activar notificaciones</span>
            <select
              value={cfg.enabled ? "on" : "off"}
              onChange={(e) =>
                setCfg((prev) =>
                  prev ? { ...prev, enabled: e.target.value === "on" } : prev,
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="on">Activadas</option>
              <option value="off">Desactivadas</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="min-h-[2.5rem] text-xs leading-5 text-zinc-400">Recibir notificaciones a las:</span>
            <select
              value={cfg.notify_hour}
              onChange={(e) =>
                setCfg((prev) =>
                  prev ? { ...prev, notify_hour: normalizeHour(Number(e.target.value)) } : prev,
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              {Array.from({ length: 15 }, (_, idx) => 8 + idx).map((hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="min-h-[2.5rem] text-xs leading-5 text-zinc-400">Notificar si la inactividad de un contacto es mayor a (dias):</span>
            <input
              type="number"
              min={1}
              max={90}
              value={cfg.inactive_days}
              onChange={(e) =>
                setCfg((prev) =>
                  prev ? { ...prev, inactive_days: Math.max(1, Math.min(90, Number(e.target.value) || 1)) } : prev,
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="min-h-[2.5rem] text-xs leading-5 text-zinc-400">Si el contacto sigue inactivo re notificar cada (dias):</span>
            <input
              type="number"
              min={1}
              max={90}
              value={cfg.renotify_days}
              onChange={(e) =>
                setCfg((prev) =>
                  prev ? { ...prev, renotify_days: Math.max(1, Math.min(90, Number(e.target.value) || 5)) } : prev,
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Recibiras un resumen de tus contactos inactivos por Telegram para que puedas hacerles seguimiento y fidelizarlos.
        </p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              await onSaveSettings(cfg);
              setMsgType("success");
              setMsg("Configuracion de notificaciones guardada.");
              setTimeout(() => setMsg(null), 3000);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
          >
            Guardar seguimiento
          </button>
        </div>
      </section>
    </div>
  );
}







