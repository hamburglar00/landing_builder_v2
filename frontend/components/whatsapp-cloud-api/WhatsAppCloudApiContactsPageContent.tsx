"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalShell, PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import { useCurrencyScope } from "@/components/currency/CurrencyScope";
import { CURRENCY_ALL } from "@/lib/currency";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchWhatsappCloudApiContactsPage,
  formatWhatsappCloudApiError,
  logWhatsappCloudApiError,
  type WhatsappCloudApiContactsPageRow,
  type WhatsappCloudApiInboxThread,
} from "@/lib/whatsappCloudApiDb";
import { formatWhatsAppDisplayPhone } from "@/lib/phoneFormatting";
import { useWhatsappCloudApiHiddenContacts } from "@/lib/whatsappCloudApiHiddenContacts";

type Props = {
  mode: "admin" | "dashboard";
};

const CONTACTS_PAGE_SIZE = 20;

const TAG_LABELS: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  nuevo: "Nuevo",
  contacto: "Contacto",
  lead: "Lead",
  cargo: "Cargo",
  recompra: "Recargo",
  premium: "Premium",
};

const TAG_CLASSES: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  nuevo: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  contacto: "border-zinc-600/35 bg-zinc-950/40 text-zinc-300",
  lead: "border-amber-800/40 bg-amber-950/18 text-amber-300",
  cargo: "border-rose-800/40 bg-rose-950/18 text-rose-300",
  recompra: "border-violet-800/40 bg-violet-950/20 text-violet-300",
  premium: "border-amber-500/20 bg-amber-500/8 text-amber-300",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function TrashIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export default function WhatsAppCloudApiContactsPageContent({ mode }: Props) {
  const router = useRouter();
  const { currencyScope } = useCurrencyScope();
  const workspaceCurrency =
    currencyScope === CURRENCY_ALL ? null : currencyScope;
  const basePath =
    mode === "admin"
      ? "/admin/whatsapp-cloud-api"
      : "/dashboard/whatsapp-cloud-api";
  const [rows, setRows] = useState<WhatsappCloudApiContactsPageRow[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactToHide, setContactToHide] =
    useState<WhatsappCloudApiContactsPageRow | null>(null);
  const { hiddenContactIds, hideContactId } = useWhatsappCloudApiHiddenContacts(
    workspaceCurrency,
  );

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const pageRows = await fetchWhatsappCloudApiContactsPage(
        CONTACTS_PAGE_SIZE,
        workspaceCurrency,
        pageIndex * CONTACTS_PAGE_SIZE,
      );
      setRows(pageRows);
      setTotalContacts((current) =>
        pageRows[0]?.total_contacts ?? (pageIndex === 0 ? 0 : current)
      );
    } catch (err) {
      logWhatsappCloudApiError("contacts page load failed", err, {
        mode,
        workspaceCurrency,
        pageIndex,
        limit: CONTACTS_PAGE_SIZE,
        offset: pageIndex * CONTACTS_PAGE_SIZE,
      });
      setError(
        formatWhatsappCloudApiError(err, "No se pudieron cargar contactos."),
      );
    } finally {
      setLoading(false);
    }
  }, [mode, pageIndex, router, workspaceCurrency]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    setPageIndex(0);
  }, [workspaceCurrency]);

  const visibleRows = useMemo(
    () => rows.filter((row) => !hiddenContactIds.has(row.contact_id)),
    [hiddenContactIds, rows],
  );
  const totalVisibleContacts = Math.max(
    0,
    totalContacts - hiddenContactIds.size,
  );
  const pageEnd = Math.min(
    totalVisibleContacts,
    pageIndex * CONTACTS_PAGE_SIZE + visibleRows.length,
  );
  const pageStart = visibleRows.length
    ? Math.min(pageIndex * CONTACTS_PAGE_SIZE + 1, pageEnd)
    : 0;
  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageEnd < totalVisibleContacts;

  const hideContactFromUi = () => {
    if (!contactToHide) return;
    hideContactId(contactToHide.contact_id);
    setContactToHide(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contactos WhatsApp Cloud API"
        description="Contactos recibidos desde el numero oficial conectado a Meta."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={() => void loadContacts()}
              disabled={loading}
            >
              Actualizar
            </button>
            <Link href={basePath} className="ui-button ui-button-secondary">
              Volver
            </Link>
          </div>
        }
      />

      {error ? <div className="ui-alert-error">{error}</div> : null}

      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
              Total de contactos
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text-strong)]">
              {totalVisibleContacts.toLocaleString("es-AR")}
            </p>
          </div>
          <p className="text-xs font-medium text-[var(--color-text-muted)]">
            {pageStart}-{pageEnd} de {totalVisibleContacts}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] text-xs uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Telefono</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Ultimo mensaje</th>
                <th className="px-4 py-3 text-right font-semibold">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]"
                  >
                    Cargando contactos...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]"
                  >
                    Sin contactos.
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]"
                  >
                    No hay contactos visibles en esta pagina.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr
                    key={row.contact_id}
                    className="transition hover:bg-[rgba(148,163,184,0.06)]"
                  >
                    <td className="max-w-xs px-4 py-3">
                      <span className="block truncate font-semibold text-[var(--color-text-strong)]">
                        {row.profile_name || "-"}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[var(--color-text-disabled)]">
                        {row.config_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                      {formatWhatsAppDisplayPhone(row.phone || row.wa_id)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${TAG_CLASSES[row.tag]}`}
                      >
                        {TAG_LABELS[row.tag]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {formatDate(row.last_message_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label="Ocultar contacto"
                        title="Ocultar contacto"
                        onClick={() => setContactToHide(row)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[var(--color-text-disabled)] transition hover:border-rose-400/25 hover:bg-rose-400/10 hover:text-rose-200"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border-subtle)] p-3">
          <button
            type="button"
            className="ui-button ui-button-secondary"
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            disabled={!canGoPrevious || loading}
          >
            Anterior
          </button>
          <button
            type="button"
            className="ui-button ui-button-secondary"
            onClick={() => setPageIndex((current) => current + 1)}
            disabled={!canGoNext || loading}
          >
            Siguiente
          </button>
        </div>
      </SurfaceCard>

      <ModalShell
        open={Boolean(contactToHide)}
        title="Ocultar contacto"
        description={
          contactToHide
            ? `${contactToHide.profile_name || contactToHide.wa_id} se quitara de Contactos y del Inbox. No se elimina de la base de datos.`
            : undefined
        }
        onClose={() => setContactToHide(null)}
        width="sm"
        footer={
          <>
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={() => setContactToHide(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ui-button ui-button-danger"
              onClick={hideContactFromUi}
            >
              Ocultar
            </button>
          </>
        }
      >
        {null}
      </ModalShell>
    </div>
  );
}
