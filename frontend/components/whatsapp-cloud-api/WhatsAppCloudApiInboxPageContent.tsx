"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import { supabase } from "@/lib/supabaseClient";
import { invokeFunction } from "@/lib/supabaseFunctions";
import {
  fetchWhatsappCloudApiInboxThreads,
  type WhatsappCloudApiInboxMessage,
  type WhatsappCloudApiInboxThread,
} from "@/lib/whatsappCloudApiDb";

type Props = {
  mode: "admin" | "dashboard";
};

const TAG_LABELS: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  nuevo: "Nuevo",
  lead: "Lead",
  cargo: "Cargo",
  recompra: "Recompra",
  premium: "Premium",
};

const TAG_CLASSES: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  nuevo: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  lead: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  cargo: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  recompra: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  premium: "border-lime-400/25 bg-lime-400/10 text-lime-200",
};

const WHATSAPP_DOODLE_PATTERN = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <g fill="none" stroke="#8696a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".16">
    <path d="M22 28h32v22H33l-11 9V28Z"/>
    <path d="M39 34v10M34 39h10"/>
    <path d="M98 24c11 0 20 8 20 18s-9 18-20 18-20-8-20-18 9-18 20-18Z"/>
    <path d="M91 38h.1M105 38h.1M91 48c6 4 13 4 19 0"/>
    <path d="M164 29c12 0 20 8 20 18v7h-40v-7c0-10 8-18 20-18Z"/>
    <path d="M151 54v12h26V54"/>
    <path d="M227 22 255 36l-7 32-32-7-7-26 18-13Z"/>
    <path d="M226 36h18M224 48h22"/>
    <path d="M35 101c12-15 36-7 33 11-2 13-18 19-31 9l-13 4 5-12c-3-4-2-8 6-12Z"/>
    <path d="M103 95h46v32h-46z"/>
    <path d="M112 105h28M112 116h18"/>
    <path d="M199 100c8-14 31-7 31 9 0 14-17 23-31 13-10 10-27 3-27-12 0-15 19-22 27-10Z"/>
    <path d="M254 103c-12 0-22 9-22 21 0 7 4 14 10 17l-3 13 14-7h1c12 0 22-9 22-21s-10-23-22-23Z"/>
    <path d="M248 117h13M248 128h9"/>
    <path d="M31 179h24l11 19H42l-11-19Z"/>
    <path d="M31 179l10-13h23l-9 13"/>
    <path d="M111 166c10 0 18 8 18 18s-8 18-18 18-18-8-18-18 8-18 18-18Z"/>
    <path d="M103 184h16M111 176v16"/>
    <path d="M167 170h36v25h-36z"/>
    <path d="m167 170 18 14 18-14"/>
    <path d="M240 166c9 0 16 7 16 16s-7 16-16 16h-25v-32h25Z"/>
    <path d="M226 176h15M226 187h9"/>
    <path d="M43 241c12-8 30-2 31 12 1 15-17 25-30 15l-15 4 5-14c-4-7 0-13 9-17Z"/>
    <path d="M113 236 138 260l-25 24-25-24 25-24Z"/>
    <path d="M107 260h12M113 254v12"/>
    <path d="M185 240c11 0 21 8 21 19s-10 19-21 19-21-8-21-19 10-19 21-19Z"/>
    <path d="M178 255h.1M192 255h.1M178 265c5 4 12 4 17 0"/>
    <path d="M250 238c13 0 23 8 23 19 0 12-10 20-23 20l-10 10v-13c-8-3-13-9-13-17 0-11 10-19 23-19Z"/>
    <path d="M242 253h17M242 264h11"/>
  </g>
  <g fill="none" stroke="#8696a0" stroke-width="1.6" stroke-linecap="round" opacity=".11">
    <path d="M12 74c7 5 12 5 18 0M71 71l10 10M83 71 71 83M139 73c4 6 9 8 16 6M203 76l15-10 8 14M273 74c-6 6-6 12 0 18"/>
    <path d="M15 145c5 5 10 5 15 0M82 146h21M137 144c6 7 13 7 20 0M220 144l16 16M236 144l-16 16M280 147c-4 8-3 14 5 18"/>
    <path d="M14 218c8 2 14 0 18-6M74 219l16-12 15 12M143 217c3 7 8 10 15 8M219 215h22M272 216c-7 5-9 11-5 18"/>
  </g>
</svg>
`);

const WHATSAPP_CHAT_BACKGROUND: CSSProperties = {
  backgroundColor: "#0b141a",
  backgroundImage: `linear-gradient(rgba(11, 20, 26, 0.78), rgba(11, 20, 26, 0.78)), url("data:image/svg+xml,${WHATSAPP_DOODLE_PATTERN}")`,
  backgroundSize: "auto, 300px 300px",
  backgroundPosition: "0 0, 0 0",
};

function initials(name: string, fallback: string): string {
  const source = name.trim() || fallback.trim();
  if (!source) return "WA";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  }
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function StatusCheckIcon({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "failed") {
    return <span className="text-[10px] font-bold text-rose-300">!</span>;
  }
  const color = normalized === "read" ? "#53bdeb" : "#8696a0";
  if (normalized === "read" || normalized === "delivered") {
    return (
      <svg className="h-3.5 w-4" viewBox="0 0 18 12" fill="none" aria-hidden>
        <path d="M1.4 6.3 4.3 9.2 10.8 2.7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.1 8.9 8.5 10.3 16.6 2.2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (normalized === "sent" || normalized === "accepted") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M1.4 6.3 4.3 9.2 10.8 2.7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function EmptyConversationIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-14.5Z" />
      <path d="M8 8h8" />
      <path d="M8 11.5h5" />
    </svg>
  );
}

function messageTime(message: WhatsappCloudApiInboxMessage): string {
  return formatTime(message.created_at);
}

function messageDateLabel(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function lastInboundMessageAt(messages: WhatsappCloudApiInboxMessage[]): Date | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.direction !== "inbound") continue;
    const date = new Date(message.created_at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export default function WhatsAppCloudApiInboxPageContent({ mode }: Props) {
  const router = useRouter();
  const basePath = mode === "admin" ? "/admin/whatsapp-cloud-api" : "/dashboard/whatsapp-cloud-api";
  const [threads, setThreads] = useState<WhatsappCloudApiInboxThread[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<"all" | WhatsappCloudApiInboxThread["tag"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const rows = await fetchWhatsappCloudApiInboxThreads(80);
      setThreads(rows);
      setSelectedId((current) => current || rows[0]?.contact_id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el Inbox.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    setManualMessage("");
    setSendNotice(null);
  }, [selectedId]);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return threads.filter((thread) => {
      if (tagFilter !== "all" && thread.tag !== tagFilter) return false;
      if (!term) return true;
      return [
        thread.profile_name,
        thread.wa_id,
        thread.phone,
        thread.last_message_text,
        thread.assigned_phone,
        thread.assigned_gerencia_label,
        thread.promo_code,
        thread.ctwa_clid,
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [search, tagFilter, threads]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.contact_id === selectedId) ?? filteredThreads[0] ?? null,
    [filteredThreads, selectedId, threads],
  );

  const selectedMessages = useMemo(() => selectedThread?.messages ?? [], [selectedThread]);
  const lastInboundAt = useMemo(() => lastInboundMessageAt(selectedMessages), [selectedMessages]);
  const serviceWindowExpiresAt = useMemo(
    () => lastInboundAt ? new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000) : null,
    [lastInboundAt],
  );
  const serviceWindowActive = Boolean(serviceWindowExpiresAt && Date.now() <= serviceWindowExpiresAt.getTime());

  const sendManualMessage = async () => {
    if (!selectedThread || !manualMessage.trim() || sending) return;
    setSending(true);
    setError(null);
    setSendNotice(null);
    try {
      const { error: sendError } = await invokeFunction<{ ok: boolean }>(
        supabase,
        "whatsapp-cloud-send-message",
        {
          body: {
            contact_id: selectedThread.contact_id,
            body: manualMessage.trim(),
          },
        },
      );
      if (sendError) throw new Error(sendError.message);
      setManualMessage("");
      setSendNotice("Mensaje enviado.");
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox WhatsApp Cloud API"
        description="Conversaciones recibidas desde el numero oficial conectado a Meta."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ui-button ui-button-secondary" onClick={() => void loadThreads()} disabled={loading}>
              Actualizar
            </button>
            <Link href={basePath} className="ui-button ui-button-secondary">
              Volver
            </Link>
          </div>
        }
      />

      {error ? <div className="ui-alert-error">{error}</div> : null}
      {sendNotice ? <div className="ui-alert ui-alert-success text-sm">{sendNotice}</div> : null}

      <SurfaceCard className="grid min-h-[38rem] overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--color-border-subtle)] xl:border-b-0 xl:border-r">
          <div className="space-y-3 border-b border-[var(--color-border-subtle)] p-4">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-[var(--color-text-muted)]">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar contacto"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "nuevo", "lead", "cargo", "recompra", "premium"] as const).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(tag)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    tagFilter === tag
                      ? "border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {tag === "all" ? "Todos" : TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-[var(--color-text-muted)]">Cargando conversaciones...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="max-w-xs">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                    <EmptyConversationIcon />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-[var(--color-text-strong)]">Sin conversaciones</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">No hay threads para los filtros seleccionados.</p>
                </div>
              </div>
            ) : filteredThreads.map((thread) => {
              const selected = selectedThread?.contact_id === thread.contact_id;
              return (
                <button
                  key={thread.contact_id}
                  type="button"
                  onClick={() => setSelectedId(thread.contact_id)}
                  className={`relative flex w-full gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3 text-left transition hover:bg-[rgba(148,163,184,0.06)] ${
                    selected ? "bg-[rgba(148,163,184,0.08)]" : ""
                  }`}
                >
                  {selected ? <span className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--color-primary)]" /> : null}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] text-xs font-semibold text-[var(--color-text-muted)]">
                    {initials(thread.profile_name, thread.wa_id)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
                        {thread.profile_name || thread.wa_id}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--color-text-disabled)]">
                        {formatTime(thread.last_message_at || thread.first_message_at)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--color-text-muted)]">
                      {thread.last_message_text || "Sin mensajes"}
                    </span>
                    <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TAG_CLASSES[thread.tag]}`}>
                      {TAG_LABELS[thread.tag]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-[34rem] flex-col border-b border-[var(--color-border-subtle)] xl:border-b-0 xl:border-r">
          {selectedThread ? (
            <>
              <div className="flex items-center justify-between border-b border-[#26343d] bg-[#111b21] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2a3942] bg-[#202c33] text-xs font-semibold text-[#aebac1]">
                    {initials(selectedThread.profile_name, selectedThread.wa_id)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#e9edef]">{selectedThread.profile_name || selectedThread.wa_id}</p>
                    <p className="text-xs text-[#8696a0]">{selectedThread.phone || selectedThread.wa_id}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${TAG_CLASSES[selectedThread.tag]}`}>
                  {TAG_LABELS[selectedThread.tag]}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-5" style={WHATSAPP_CHAT_BACKGROUND}>
                {selectedMessages.length === 0 ? (
                  <div className="m-auto max-w-sm rounded-xl border border-dashed border-[#2a3942] bg-[#111b21]/90 px-5 py-6 text-center shadow-lg">
                    <p className="text-sm font-semibold text-[#e9edef]">Sin mensajes normalizados</p>
                    <p className="mt-2 text-xs leading-5 text-[#8696a0]">El thread existe, pero no hay mensajes disponibles para mostrar.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 self-center rounded-lg bg-[#182229] px-3 py-1 text-[11px] font-medium text-[#8696a0] shadow">
                      {messageDateLabel(selectedMessages[0]?.created_at ?? null)}
                    </div>
                    {selectedMessages.map((message, index) => {
                      const outbound = message.direction === "outbound";
                      return (
                        <div
                          key={`${message.meta_message_id || message.created_at}-${index}`}
                          className={`relative max-w-[78%] px-2.5 py-1.5 text-[13px] leading-5 shadow-sm ${
                            outbound
                              ? "self-end rounded-lg rounded-tr-sm bg-[#005c4b] text-[#e9edef]"
                              : "self-start rounded-lg rounded-tl-sm bg-[#202c33] text-[#e9edef]"
                          }`}
                        >
                          <span
                            className={`absolute top-0 h-3 w-3 ${
                              outbound
                                ? "-right-1 bg-[#005c4b] [clip-path:polygon(0_0,100%_0,0_100%)]"
                                : "-left-1 bg-[#202c33] [clip-path:polygon(0_0,100%_0,100%_100%)]"
                            }`}
                            aria-hidden
                          />
                          <p className="whitespace-pre-wrap break-words pr-11">{message.body || "-"}</p>
                          <span className="float-right -mb-0.5 ml-2 mt-1 flex items-center gap-1 text-[10px] leading-none text-[#8696a0]">
                            {messageTime(message)}
                            {outbound ? <StatusCheckIcon status={message.status} /> : null}
                          </span>
                          {message.error ? <p className="clear-both mt-2 text-[10px] text-rose-300">{message.error}</p> : null}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              <div className="border-t border-[#26343d] bg-[#111b21] px-4 py-3">
                <div className="mb-2 text-[11px] text-[#8696a0]">
                  {serviceWindowExpiresAt
                    ? serviceWindowActive
                      ? `Ventana activa hasta ${formatDateTime(serviceWindowExpiresAt.toISOString())}`
                      : `Ventana vencida el ${formatDateTime(serviceWindowExpiresAt.toISOString())}`
                    : "Sin mensaje entrante para validar ventana de 24 hs"}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={manualMessage}
                    onChange={(event) => setManualMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendManualMessage();
                      }
                    }}
                    disabled={!serviceWindowActive || sending}
                    className="min-w-0 flex-1 rounded-full border border-[#2a3942] bg-[#202c33] px-4 py-2 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0] disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder={serviceWindowActive ? "Escribir respuesta" : "Ventana de 24 hs no disponible"}
                    maxLength={4096}
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-[#0b141a] transition hover:bg-[#06cf9c] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!serviceWindowActive || !manualMessage.trim() || sending}
                    onClick={() => void sendManualMessage()}
                    title="Enviar respuesta"
                  >
                  <SendIcon />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="max-w-sm rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[rgba(255,255,255,0.02)] px-5 py-6">
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">Selecciona una conversacion</p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">El detalle se muestra al seleccionar un thread.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto p-4">
          {selectedThread ? (
            <div className="space-y-5">
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] text-sm font-semibold text-[var(--color-text-muted)]">
                  {initials(selectedThread.profile_name, selectedThread.wa_id)}
                </span>
                <p className="mt-3 text-sm font-semibold text-[var(--color-text-strong)]">{selectedThread.profile_name || selectedThread.wa_id}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{selectedThread.phone || selectedThread.wa_id}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-disabled)]">Cargas</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{selectedThread.purchase_count}</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-disabled)]">Total</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-primary)]">{formatMoney(selectedThread.total_loaded)}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-disabled)]">Derivacion</p>
                <div className="mt-3 space-y-2 text-xs">
                  <InfoRow label="Telefono" value={selectedThread.assigned_phone || "-"} />
                  <InfoRow label="Gerencia" value={selectedThread.assigned_gerencia_label || selectedThread.assigned_gerencia_id?.toString() || "-"} />
                  <InfoRow label="Promo" value={selectedThread.promo_code || "-"} />
                </div>
              </div>

              {(selectedThread.ctwa_clid || selectedThread.source_type || selectedThread.headline || selectedThread.last_purchase_at) ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-disabled)]">Atribucion</p>
                  <div className="mt-3 space-y-2 text-xs">
                    {selectedThread.ctwa_clid ? <InfoRow label="ctwa_clid" value={selectedThread.ctwa_clid} mono /> : null}
                    {selectedThread.source_type ? <InfoRow label="Tipo anuncio" value={selectedThread.source_type} /> : null}
                    {selectedThread.headline ? <InfoRow label="Titulo anuncio" value={selectedThread.headline} /> : null}
                    {selectedThread.last_purchase_at ? <InfoRow label="Ultima carga" value={formatDateTime(selectedThread.last_purchase_at)} /> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Sin thread seleccionado.</p>
          )}
        </aside>
      </SurfaceCard>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
      <span className="shrink-0 text-[var(--color-text-muted)]">{label}</span>
      <span className={`min-w-0 break-words text-right font-medium text-[var(--color-text-strong)] ${mono ? "font-mono text-[10px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
