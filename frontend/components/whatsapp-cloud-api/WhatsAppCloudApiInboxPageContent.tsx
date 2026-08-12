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
<svg xmlns="http://www.w3.org/2000/svg" width="170" height="170" viewBox="0 0 170 170">
  <defs>
    <symbol id="chat" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-5 4V5.5Z"/><path d="M8 8h8M8 11.5h5"/></symbol>
    <symbol id="face" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8.5 10h.1M15.5 10h.1M8.5 15c2.5 2 4.5 2 7 0"/></symbol>
    <symbol id="heart" viewBox="0 0 24 24"><path d="M12 20s-8-4.8-8-10.5C4 6.6 6.2 5 8.4 5c1.5 0 2.8.8 3.6 2 .8-1.2 2.1-2 3.6-2C17.8 5 20 6.6 20 9.5 20 15.2 12 20 12 20Z"/></symbol>
    <symbol id="star" viewBox="0 0 24 24"><path d="m12 3 2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.1-5.3 3.1 1.3-6-4.6-4.1 6.1-.6L12 3Z"/></symbol>
    <symbol id="phone" viewBox="0 0 24 24"><path d="M8 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M10 17h4"/></symbol>
    <symbol id="camera" viewBox="0 0 24 24"><path d="M5 8h3l1.5-2h5L16 8h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3"/></symbol>
    <symbol id="gift" viewBox="0 0 24 24"><path d="M4 10h16v10H4V10ZM3 7h18v3H3V7ZM12 7v13"/><path d="M12 7c-4 0-4-4-1.5-4 1.5 0 1.5 2 1.5 4Zm0 0c4 0 4-4 1.5-4C12 3 12 5 12 7Z"/></symbol>
    <symbol id="mail" viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="m4 6 8 7 8-7"/></symbol>
    <symbol id="music" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></symbol>
    <symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="spark" viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M18 6l-4 4M10 14l-4 4"/></symbol>
    <symbol id="pin" viewBox="0 0 24 24"><path d="M12 21s6-6 6-11a6 6 0 0 0-12 0c0 5 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></symbol>
    <symbol id="bolt" viewBox="0 0 24 24"><path d="M13 2 5 13h6l-1 9 9-13h-6l1-7Z"/></symbol>
    <symbol id="cup" viewBox="0 0 24 24"><path d="M6 8h10v5a5 5 0 0 1-10 0V8Z"/><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2M7 20h8M9 4c-1 1-1 2 0 3M13 4c-1 1-1 2 0 3"/></symbol>
    <symbol id="check" viewBox="0 0 24 24"><path d="M4 12.5 9 17 20 6"/></symbol>
    <symbol id="bag" viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></symbol>
    <symbol id="play" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m10 8 6 4-6 4V8Z"/></symbol>
  </defs>
  <g fill="none" stroke="#8696a0" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" opacity=".145">
    <use href="#chat" x="4" y="7" width="17" height="17" transform="rotate(-11 12 15)"/>
    <use href="#heart" x="35" y="4" width="12" height="12" transform="rotate(15 41 10)"/>
    <use href="#camera" x="66" y="9" width="15" height="15" transform="rotate(-7 73 16)"/>
    <use href="#spark" x="111" y="2" width="12" height="12" transform="rotate(28 117 8)"/>
    <use href="#face" x="139" y="8" width="18" height="18" transform="rotate(9 148 17)"/>
    <use href="#music" x="22" y="31" width="14" height="14" transform="rotate(16 29 38)"/>
    <use href="#gift" x="52" y="27" width="16" height="16" transform="rotate(-12 60 35)"/>
    <use href="#pin" x="91" y="33" width="12" height="12" transform="rotate(6 97 39)"/>
    <use href="#mail" x="123" y="28" width="17" height="17" transform="rotate(-16 131 36)"/>
    <use href="#bolt" x="158" y="36" width="10" height="10" transform="rotate(22 163 41)"/>
    <use href="#clock" x="7" y="57" width="13" height="13" transform="rotate(8 13 63)"/>
    <use href="#star" x="38" y="58" width="13" height="13" transform="rotate(-18 44 64)"/>
    <use href="#phone" x="73" y="53" width="16" height="16" transform="rotate(12 81 61)"/>
    <use href="#cup" x="104" y="61" width="13" height="13" transform="rotate(-9 110 67)"/>
    <use href="#chat" x="138" y="55" width="15" height="15" transform="rotate(17 145 62)"/>
    <use href="#bag" x="16" y="84" width="14" height="14" transform="rotate(-14 23 91)"/>
    <use href="#spark" x="51" y="80" width="11" height="11" transform="rotate(4 56 85)"/>
    <use href="#play" x="83" y="87" width="13" height="13" transform="rotate(-21 89 93)"/>
    <use href="#heart" x="116" y="82" width="12" height="12" transform="rotate(10 122 88)"/>
    <use href="#camera" x="147" y="90" width="15" height="15" transform="rotate(-10 154 97)"/>
    <use href="#mail" x="3" y="119" width="15" height="15" transform="rotate(12 10 126)"/>
    <use href="#face" x="34" y="108" width="15" height="15" transform="rotate(-8 41 115)"/>
    <use href="#check" x="66" y="122" width="13" height="13" transform="rotate(19 72 128)"/>
    <use href="#music" x="95" y="111" width="13" height="13" transform="rotate(-18 101 117)"/>
    <use href="#gift" x="128" y="121" width="14" height="14" transform="rotate(8 135 128)"/>
    <use href="#pin" x="154" y="115" width="12" height="12" transform="rotate(-13 160 121)"/>
    <use href="#bolt" x="12" y="150" width="10" height="10" transform="rotate(-21 17 155)"/>
    <use href="#cup" x="45" y="144" width="14" height="14" transform="rotate(14 52 151)"/>
    <use href="#star" x="79" y="151" width="11" height="11" transform="rotate(26 84 156)"/>
    <use href="#phone" x="109" y="139" width="14" height="14" transform="rotate(-8 116 146)"/>
    <use href="#chat" x="139" y="145" width="16" height="16" transform="rotate(10 147 153)"/>
  </g>
  <g fill="none" stroke="#8696a0" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round" opacity=".095">
    <use href="#spark" x="18" y="2" width="8" height="8" transform="rotate(15 22 6)"/>
    <use href="#check" x="58" y="3" width="9" height="9" transform="rotate(-20 62 7)"/>
    <use href="#bolt" x="98" y="18" width="8" height="8" transform="rotate(34 102 22)"/>
    <use href="#heart" x="5" y="39" width="8" height="8" transform="rotate(-24 9 43)"/>
    <use href="#star" x="82" y="30" width="8" height="8" transform="rotate(11 86 34)"/>
    <use href="#check" x="144" y="35" width="9" height="9" transform="rotate(-11 148 39)"/>
    <use href="#spark" x="29" y="70" width="8" height="8" transform="rotate(28 33 74)"/>
    <use href="#bolt" x="64" y="76" width="8" height="8" transform="rotate(-19 68 80)"/>
    <use href="#star" x="128" y="71" width="9" height="9" transform="rotate(19 132 75)"/>
    <use href="#heart" x="155" y="75" width="8" height="8" transform="rotate(-8 159 79)"/>
    <use href="#check" x="28" y="103" width="9" height="9" transform="rotate(14 32 107)"/>
    <use href="#spark" x="74" y="105" width="8" height="8" transform="rotate(-31 78 109)"/>
    <use href="#bolt" x="137" y="105" width="8" height="8" transform="rotate(18 141 109)"/>
    <use href="#star" x="17" y="135" width="8" height="8" transform="rotate(-13 21 139)"/>
    <use href="#heart" x="91" y="136" width="8" height="8" transform="rotate(24 95 140)"/>
    <use href="#spark" x="158" y="145" width="8" height="8" transform="rotate(-22 162 149)"/>
    <path d="M33 20c5 3 8 3 12 0M118 21c3 5 7 6 11 3M24 52l7 7M31 52l-7 7M114 48h11M43 95c4 4 8 4 12 0M100 101l8-6 7 7M5 160c5 2 8 0 10-4M67 163h10M127 162c4 3 8 3 11 0"/>
  </g>
</svg>
`);

const WHATSAPP_CHAT_BACKGROUND: CSSProperties = {
  backgroundColor: "#0b141a",
  backgroundImage: `linear-gradient(rgba(11, 20, 26, 0.66), rgba(11, 20, 26, 0.66)), url("data:image/svg+xml,${WHATSAPP_DOODLE_PATTERN}")`,
  backgroundSize: "auto, 170px 170px",
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
