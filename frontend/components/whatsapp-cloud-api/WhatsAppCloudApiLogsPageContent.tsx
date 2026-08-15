"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import { CURRENCY_ALL } from "@/lib/currency";
import { SingleCurrencyRequired, useCurrencyScope } from "@/components/currency/CurrencyScope";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchWhatsappCloudApiLogs,
  type WhatsappCloudApiLogEntry,
  type WhatsappCloudApiLogKind,
} from "@/lib/whatsappCloudApiDb";

type Props = {
  mode: "admin" | "dashboard";
};

const KIND_LABELS: Record<WhatsappCloudApiLogKind, string> = {
  request: "Request",
  webhook: "Webhook",
  assignment: "Derivacion",
  outbound: "Saliente",
};

const KIND_OPTIONS: Array<{ value: "all" | WhatsappCloudApiLogKind; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "request", label: "Requests" },
  { value: "webhook", label: "Webhooks" },
  { value: "assignment", label: "Derivaciones" },
  { value: "outbound", label: "Salientes" },
];

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (["processed", "accepted", "sent", "delivered", "read"].includes(normalized)) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }
  if (["failed", "error"].includes(normalized)) {
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  }
  if (["pending", "processing"].includes(normalized)) {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }
  return "border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-text-muted)]";
}

function compactId(value: string): string {
  if (!value) return "-";
  if (value.length <= 18) return value;
  return `${value.slice(0, 9)}...${value.slice(-6)}`;
}

function payloadSummary(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "";
  }
}

export default function WhatsAppCloudApiLogsPageContent({ mode }: Props) {
  const router = useRouter();
  const { currencyScope, isAllCurrencies } = useCurrencyScope();
  const workspaceCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;
  const basePath = mode === "admin" ? "/admin/whatsapp-cloud-api" : "/dashboard/whatsapp-cloud-api";
  const [logs, setLogs] = useState<WhatsappCloudApiLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | WhatsappCloudApiLogKind>("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const rows = await fetchWhatsappCloudApiLogs({
        userId: auth.user.id,
        isAdmin: mode === "admin",
        workspaceCurrency,
        limit: 80,
      });
      setLogs(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los logs.");
    } finally {
      setLoading(false);
    }
  }, [mode, router, workspaceCurrency]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const statuses = useMemo(() => {
    const values = Array.from(new Set(logs.map((log) => log.status).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (kind !== "all" && log.kind !== kind) return false;
      if (status !== "all" && log.status !== status) return false;
      if (!term) return true;
      return [
        log.label,
        log.status,
        log.config_name,
        log.phone,
        log.phone_number_id,
        log.meta_message_id,
        log.promo_code,
        log.gerencia,
        log.error,
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [kind, logs, search, status]);

  const summary = useMemo(() => ({
    total: logs.length,
    webhooks: logs.filter((log) => log.kind === "request" || log.kind === "webhook").length,
    outbound: logs.filter((log) => log.kind === "outbound").length,
    failed: logs.filter((log) => log.status.toLowerCase() === "failed" || log.error).length,
  }), [logs]);

  if (isAllCurrencies) {
    return <SingleCurrencyRequired title="Elegi ARS o PYG para ver logs de WhatsApp Cloud API" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs WhatsApp Cloud API"
        description="Diagnostico de webhooks, worker y respuestas enviadas por el canal oficial."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ui-button ui-button-secondary" onClick={() => void loadLogs()} disabled={loading}>
              Actualizar
            </button>
            <Link href={basePath} className="ui-button ui-button-secondary">
              Volver
            </Link>
          </div>
        }
      />

      {error ? <div className="ui-alert-error">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <SurfaceCard className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Eventos</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-strong)]">{summary.total}</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Webhooks</p>
          <p className="mt-2 text-2xl font-semibold text-sky-200">{summary.webhooks}</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Salientes</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-200">{summary.outbound}</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Con error</p>
          <p className="mt-2 text-2xl font-semibold text-rose-200">{summary.failed}</p>
        </SurfaceCard>
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--color-border-subtle)] p-4 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por telefono, mensaje, promo, gerencia o error"
            className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)]"
          />
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as "all" | WhatsappCloudApiLogKind)}
            className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-sm text-[var(--color-text-strong)] outline-none"
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-sm text-[var(--color-text-strong)] outline-none"
          >
            <option value="all">Todos los estados</option>
            {statuses.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-[rgba(148,163,184,0.08)] text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Hora</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Cuenta</th>
                <th className="px-4 py-3 font-semibold">Telefono</th>
                <th className="px-4 py-3 font-semibold">Gerencia / Promo</th>
                <th className="px-4 py-3 font-semibold">Meta ID</th>
                <th className="px-4 py-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Cargando logs...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">No hay logs para los filtros seleccionados.</td>
                </tr>
              ) : filteredLogs.map((log) => {
                const payload = payloadSummary(log.payload);
                return (
                  <tr key={`${log.kind}-${log.id}`} className="align-top text-[var(--color-text)]">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-text-muted)]">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--color-text-strong)]">{KIND_LABELS[log.kind]}</div>
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">{log.label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(log.status)}`}>
                        {log.status || "-"}
                      </span>
                      {log.attempts !== null ? (
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">Intentos: {log.attempts}</div>
                      ) : null}
                    </td>
                    <td className="max-w-[14rem] px-4 py-3 text-xs text-[var(--color-text-muted)]">{log.config_name || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{log.phone || "-"}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{log.gerencia || "-"}</div>
                      {log.promo_code ? <div className="mt-1 font-mono text-[var(--color-primary)]">{log.promo_code}</div> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" title={log.meta_message_id || undefined}>{compactId(log.meta_message_id)}</td>
                    <td className="max-w-[18rem] px-4 py-3 text-xs">
                      {log.phone_number_id ? (
                        <p className="mb-1 font-mono text-[var(--color-text-muted)]">Phone Number ID: {log.phone_number_id}</p>
                      ) : null}
                      {log.error ? <p className="text-rose-200">{log.error}</p> : <p className="text-[var(--color-text-muted)]">Sin error</p>}
                      {payload ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[var(--color-primary)]">Payload</summary>
                          <pre className="mt-2 max-h-52 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3 text-[10px] leading-4 text-[var(--color-text-muted)]">
                            {payload}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
}
