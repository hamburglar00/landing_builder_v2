"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  NotificationBotConfig,
  NotificationTelegramDestination,
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
  destinations: NotificationTelegramDestination[];
  saving: boolean;
  onSaveBot: (cfg: NotificationBotConfig) => Promise<void>;
  onSaveSettings: (cfg: NotificationSettings) => Promise<void>;
  onDisconnectDestination: (destinationId: number) => Promise<void>;
  onDisconnectLegacy: () => Promise<void>;
};

export default function NotificationsPageContent({
  isAdmin,
  botConfig,
  settings,
  destinations,
  saving,
  onSaveBot,
  onSaveSettings,
  onDisconnectDestination,
  onDisconnectLegacy,
}: Props) {
  const [bot, setBot] = useState<NotificationBotConfig>(
    botConfig ?? { telegram_bot_token: "", telegram_bot_username: "" },
  );
  const [cfg, setCfg] = useState<NotificationSettings | null>(settings);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [botEditable, setBotEditable] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [copyOk, setCopyOk] = useState(false);

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
  const connectQrUrl = useMemo(() => {
    if (!connectUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(connectUrl)}`;
  }, [connectUrl]);
  const startCommand = useMemo(
    () => `/start ${String(cfg?.telegram_start_token || "").trim()}`,
    [cfg?.telegram_start_token],
  );
  const connectWithCommandUrl = useMemo(() => connectUrl, [connectUrl]);
  const fullStartToken = String(cfg?.telegram_start_token || "").trim();
  const hasLegacyChat = Boolean(String(cfg?.telegram_chat_id || "").trim());
  const isTelegramConnected = destinations.length > 0 || hasLegacyChat;

  const renderDestinationLabel = (d: NotificationTelegramDestination) => {
    const username = String(d.telegram_username || "").trim();
    const firstName = String(d.telegram_first_name || "").trim();
    const lastName = String(d.telegram_last_name || "").trim();
    const phone = String(d.telegram_phone || "").trim();

    const parts: string[] = [];
    if (username) parts.push(`@${username.replace(/^@/, "")}`);
    if (firstName || lastName) parts.push(`${firstName} ${lastName}`.trim());
    if (phone) parts.push(phone);
    if (!parts.length) parts.push(`chat ${d.telegram_chat_id}`);
    return parts.join(" | ");
  };

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
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">
            <p className="font-medium text-zinc-300">Nota tecnica (solo administrador)</p>
            <p className="mt-1">
              Cada cliente tiene un token unico de vinculacion. Cuando el cliente envia ese token al chat del bot,
              nuestro webhook recibe el mensaje, obtiene el <span className="font-mono">chat_id</span> y busca a que
              cliente pertenece ese token. Si coincide, vinculamos ese <span className="font-mono">chat_id</span> con
              ese cliente y desde ese momento las notificaciones se envian a ese chat.
            </p>
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
              onChange={() => {}}
              className="h-[32px] w-[94px] rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-500"
            >
              <option value="telegram">Telegram</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium ${
              connectUrl
                ? "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                : "border-zinc-800 bg-zinc-900 text-zinc-500 pointer-events-none"
            }`}
          >
            Conectar Telegram
          </button>
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
          <span className="inline-flex items-center gap-2 rounded-md bg-zinc-800 px-2 py-1 text-zinc-300">
            Token: <span className="font-mono text-zinc-100">{fullStartToken || "-"}</span>
            <button
              type="button"
              onClick={async () => {
                if (!fullStartToken) return;
                try {
                  await navigator.clipboard.writeText(fullStartToken);
                  setCopyOk(true);
                  setTimeout(() => setCopyOk(false), 1200);
                } catch {
                  setCopyOk(false);
                }
              }}
              className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-700"
              title="Copiar token"
            >
              {copyOk ? "Copiado" : "Copiar"}
            </button>
          </span>
        </div>
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs font-medium text-zinc-300">Telegram(s) conectado(s)</p>
          {destinations.length === 0 && !hasLegacyChat ? (
            <p className="mt-2 text-xs text-zinc-500">Aun no hay chats vinculados.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {destinations.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                  <span>- {renderDestinationLabel(d)}</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        await onDisconnectDestination(d.id);
                        setMsgType("success");
                        setMsg("Telegram desconectado.");
                      } catch (e) {
                        console.error(e);
                        setMsgType("error");
                        setMsg("No se pudo desconectar el Telegram.");
                      } finally {
                        setTimeout(() => setMsg(null), 2500);
                      }
                    }}
                    className="rounded-md border border-red-700/60 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                </li>
              ))}
              {destinations.length === 0 && hasLegacyChat ? (
                <li className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                  <span>- Chat conectado (legado): {String(cfg.telegram_chat_id)}</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        await onDisconnectLegacy();
                        setMsgType("success");
                        setMsg("Telegram desconectado.");
                      } catch (e) {
                        console.error(e);
                        setMsgType("error");
                        setMsg("No se pudo desconectar el Telegram.");
                      } finally {
                        setTimeout(() => setMsg(null), 2500);
                      }
                    }}
                    className="rounded-md border border-red-700/60 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </section>

      {showConnectModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">Conectar Telegram</h4>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Escanea el QR desde tu celular o abre Telegram directamente.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Si ya tenias el chat abierto, envia: <span className="font-mono">/start {String(cfg.telegram_start_token || "").trim()}</span>
            </p>

            <div className="mt-4 flex justify-center">
              {connectQrUrl ? (
                <img
                  src={connectQrUrl}
                  alt="QR para conectar Telegram"
                  className="h-56 w-56 rounded-lg border border-zinc-700 bg-white p-2"
                />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-zinc-800 text-xs text-zinc-500">
                  Completa primero el bot y token de conexion.
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center">
              <a
                href={connectWithCommandUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium ${
                  connectWithCommandUrl
                    ? "border-zinc-700 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                    : "pointer-events-none border-zinc-800 bg-zinc-900 text-zinc-500"
                }`}
              >
                Abrir Telegram
              </a>
            </div>
          </div>
        </div>
      )}

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







