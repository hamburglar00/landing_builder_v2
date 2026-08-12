"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import { supabase } from "@/lib/supabaseClient";
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
  vip: "VIP",
};

const TAG_CLASSES: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  nuevo: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  lead: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  cargo: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  recompra: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  vip: "border-lime-400/25 bg-lime-400/10 text-lime-200",
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
    return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(date);
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
  }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function CheckIcon({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "failed") {
    return <span className="text-[10px] font-bold text-rose-300">!</span>;
  }
  if (normalized === "read") {
    return <span className="text-[10px] font-bold text-sky-300">✓✓</span>;
  }
  if (normalized === "delivered") {
    return <span className="text-[10px] font-bold text-[var(--color-text-muted)]">✓✓</span>;
  }
  if (normalized === "sent" || normalized === "accepted") {
    return <span className="text-[10px] font-bold text-[var(--color-text-muted)]">✓</span>;
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

export default function WhatsAppCloudApiInboxPageContent({ mode }: Props) {
  const router = useRouter();
  const basePath = mode === "admin" ? "/admin/whatsapp-cloud-api" : "/dashboard/whatsapp-cloud-api";
  const [threads, setThreads] = useState<WhatsappCloudApiInboxThread[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<"all" | WhatsappCloudApiInboxThread["tag"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const selectedMessages = selectedThread?.messages ?? [];

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
              {(["all", "nuevo", "lead", "cargo", "recompra", "vip"] as const).map((tag) => (
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
              <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] text-xs font-semibold text-[var(--color-text-muted)]">
                    {initials(selectedThread.profile_name, selectedThread.wa_id)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{selectedThread.profile_name || selectedThread.wa_id}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{selectedThread.phone || selectedThread.wa_id}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${TAG_CLASSES[selectedThread.tag]}`}>
                  {TAG_LABELS[selectedThread.tag]}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[radial-gradient(circle_at_16px_16px,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:22px_22px] px-4 py-5">
                {selectedMessages.length === 0 ? (
                  <div className="m-auto max-w-sm rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[rgba(255,255,255,0.02)] px-5 py-6 text-center">
                    <p className="text-sm font-semibold text-[var(--color-text-strong)]">Sin mensajes normalizados</p>
                    <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">El thread existe, pero no hay mensajes disponibles para mostrar.</p>
                  </div>
                ) : selectedMessages.map((message, index) => {
                  const outbound = message.direction === "outbound";
                  return (
                    <div
                      key={`${message.meta_message_id || message.created_at}-${index}`}
                      className={`max-w-[76%] rounded-2xl border px-3 py-2 text-sm leading-6 ${
                        outbound
                          ? "self-end rounded-br-md border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-text-strong)]"
                          : "self-start rounded-bl-md border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] text-[var(--color-text-strong)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body || "-"}</p>
                      <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                        outbound ? "text-[var(--color-primary)]/70" : "text-[var(--color-text-disabled)]"
                      }`}>
                        {messageTime(message)}
                        {outbound ? <CheckIcon status={message.status} /> : null}
                      </span>
                      {message.error ? <p className="mt-1 text-[10px] text-rose-300">{message.error}</p> : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 border-t border-[var(--color-border-subtle)] px-4 py-3">
                <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm text-[var(--color-text-disabled)]">
                  Respuesta manual no habilitada
                </div>
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]" disabled>
                  <SendIcon />
                </button>
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
                  <InfoRow label="Config" value={selectedThread.config_name || "-"} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-disabled)]">Atribucion</p>
                <div className="mt-3 space-y-2 text-xs">
                  <InfoRow label="ctwa_clid" value={selectedThread.ctwa_clid || "-"} mono />
                  <InfoRow label="Tipo" value={selectedThread.source_type || "-"} />
                  <InfoRow label="Titulo" value={selectedThread.headline || "-"} />
                  <InfoRow label="Ultima carga" value={formatDateTime(selectedThread.last_purchase_at)} />
                </div>
              </div>
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
