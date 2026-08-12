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
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
  <g fill="none" stroke="#8696a0" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity=".14">
    <path d="M15 16h22v15H24l-9 7V16Z"/><path d="M22 22h9M22 27h6"/>
    <path d="M58 13c8 0 14 6 14 13s-6 13-14 13-14-6-14-13 6-13 14-13Z"/><path d="M53 24h.1M63 24h.1M53 30c4 3 9 3 13 0"/>
    <path d="M96 15h26v18H96z"/><path d="m96 15 13 10 13-10"/>
    <path d="M154 14c8 0 14 5 14 12s-6 12-14 12h-9l-7 7v-11c-4-2-7-5-7-9 0-6 6-11 14-11Z"/><path d="M147 23h12M147 29h8"/>
    <path d="M192 13 207 28l-15 15-15-15 15-15Z"/><path d="M187 28h10M192 23v10"/>
    <path d="M18 62c8-9 23-4 22 7-1 9-12 13-21 7l-9 3 3-8c-2-4 0-7 5-9Z"/>
    <path d="M60 58h20v24H60z"/><path d="M65 64h10M65 70h7"/>
    <path d="M108 59c8 0 15 6 15 14s-7 14-15 14-15-6-15-14 7-14 15-14Z"/><path d="M102 73h12M108 67v12"/>
    <path d="M153 59h21v21h-21z"/><path d="M158 64h11M158 70h8M158 76h5"/>
    <path d="M196 58c7 0 13 6 13 13s-6 13-13 13h-15V58h15Z"/><path d="M188 67h10M188 74h6"/>
    <path d="M20 106h17l8 14H27l-7-14Z"/><path d="M20 106l7-10h17l-7 10"/>
    <path d="M68 99c7 0 12 5 12 12v6H56v-6c0-7 5-12 12-12Z"/><path d="M60 117v8h16v-8"/>
    <path d="M109 101 125 117l-16 16-16-16 16-16Z"/><path d="M103 117h12M109 111v12"/>
    <path d="M154 100c6-9 21-5 21 6 0 9-11 15-20 9-7 7-18 2-18-8 0-9 12-14 17-7Z"/>
    <path d="M197 99c8 0 14 6 14 13s-6 13-14 13-14-6-14-13 6-13 14-13Z"/><path d="M191 108h12M191 115h8"/>
    <path d="M18 151h24v17H18z"/><path d="M22 156h16M22 162h10"/>
    <path d="M66 145c9 0 16 6 16 14 0 9-7 15-16 15l-8 8v-10c-5-2-8-7-8-13 0-8 7-14 16-14Z"/>
    <path d="M109 146c8 0 14 6 14 14s-6 14-14 14-14-6-14-14 6-14 14-14Z"/><path d="M104 157h.1M114 157h.1M104 164c4 3 8 3 12 0"/>
    <path d="M152 146h24v18h-24z"/><path d="m152 146 12 11 12-11"/>
    <path d="M197 146c7 0 13 5 13 12s-6 12-13 12h-15v-24h15Z"/><path d="M188 154h11M188 160h7"/>
    <path d="M27 193c0-7 6-13 13-13s13 6 13 13-6 13-13 13H27v-13Z"/><path d="M34 190h10M34 196h7"/>
    <path d="M82 183 94 195l-12 12-12-12 12-12Z"/>
    <path d="M119 182h24v18h-24z"/><path d="M124 188h14M124 194h9"/>
    <path d="M168 183c8 0 14 5 14 12s-6 12-14 12-14-5-14-12 6-12 14-12Z"/>
    <path d="M201 181h9v26h-9z"/><path d="M197 186h17M197 202h17"/>
  </g>
  <g fill="none" stroke="#8696a0" stroke-width=".95" stroke-linecap="round" stroke-linejoin="round" opacity=".1">
    <path d="M8 47c5 4 9 4 14 0M46 48l8 8M54 48l-8 8M84 48c4 5 8 6 13 4M130 49h14M176 48l10-7 6 10M209 46c-4 5-4 9 0 14"/>
    <path d="M9 90h13M43 90c4 5 9 5 13 0M86 90l8-8 8 8M129 90c2 6 7 8 12 6M178 90h13M211 91c-5 3-7 8-4 13"/>
    <path d="M7 137c6 2 11 0 14-5M45 137l9-9 9 9M86 137h16M129 137c4 4 9 4 13 0M177 137l8 8M185 137l-8 8M210 137c-4 5-4 9 0 14"/>
    <path d="M9 177c5 4 9 4 14 0M48 178h14M99 179c3 5 7 6 12 4M146 178l8-8 8 8M188 178c6 2 10 0 13-5"/>
    <path d="M31 6c3 3 6 3 9 0M77 6h12M128 7l6 6M134 7l-6 6M181 7c3 3 6 3 9 0"/>
    <path d="M35 213h13M71 211c4 4 8 4 12 0M149 212h12M187 212l7-7 7 7"/>
  </g>
</svg>
`);

const WHATSAPP_CHAT_BACKGROUND: CSSProperties = {
  backgroundColor: "#0b141a",
  backgroundImage: `linear-gradient(rgba(11, 20, 26, 0.7), rgba(11, 20, 26, 0.7)), url("data:image/svg+xml,${WHATSAPP_DOODLE_PATTERN}")`,
  backgroundSize: "auto, 220px 220px",
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
