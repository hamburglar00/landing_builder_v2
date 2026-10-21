"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SingleCurrencyRequired, useCurrencyScope } from "@/components/currency/CurrencyScope";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { EmptyState, ModalShell, PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import {
  buildAtrioUrl,
  createAtrioClient,
  deleteAtrioClient,
  fetchAtrioClients,
  fetchAtrioClientsForAdmin,
  formatAtrioError,
  isValidAtrioId,
  isValidAtrioSlug,
  normalizeAtrioSlug,
  sortAtrioClients,
  updateAtrioClient,
  type AtrioClient,
} from "@/lib/atrio/atrioDb";
import { CURRENCY_ALL, type ReportingCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabaseClient";
import { requestManagerDestinations, CASINO_NAMES, managerTypeLabel, type AdvisorDirectory, type BotResetMetric } from "@/lib/atrio/managerDestinations";
import { AdvisorManagers } from "./AdvisorManagers";
import { BotMetricResetButtons } from "./BotMetricResetButtons";

type Mode = "dashboard" | "admin";

type FormState = {
  slug: string;
  atrioId: string;
};

const EMPTY_FORM: FormState = {
  slug: "",
  atrioId: "",
};

function SearchIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function AtrioMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" className="opacity-45" />
      <path d="M8 13.5c.9 1.4 2.2 2.1 4 2.1s3.1-.7 4-2.1" />
      <path d="M8.8 9.2h.01M15.2 9.2h.01" />
      <path d="M5.8 18.2 4.6 21l3.2-1" />
    </svg>
  );
}

function WorkspaceBadge({ workspace }: { workspace: ReportingCurrency }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] px-2 text-[10px] font-semibold text-[var(--color-primary)]">
      {workspace}
    </span>
  );
}

export default function AtrioClientsPageContent({ mode }: { mode: Mode }) {
  const router = useRouter();
  const confirmAction = useAppConfirm();
  const { currencyScope, isAllCurrencies } = useCurrencyScope();
  const workspaceCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;
  const [userId, setUserId] = useState<string | null>(null);
  const [clients, setClients] = useState<AtrioClient[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingClient, setEditingClient] = useState<AtrioClient | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [directory, setDirectory] = useState<AdvisorDirectory[]>([]);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [refreshDirectory, setRefreshDirectory] = useState(0);
  const [resetting, setResetting] = useState<{ metric: BotResetMetric; clientId: string | null } | null>(null);
  const resetInFlight = useRef(false);
  const directoryClientIds = clients.map(c => c.id).sort().join(",");
  useEffect(() => {
    const controller = new AbortController();
    setDirectory([]); setDirectoryError("");
    if (!directoryClientIds) return;
    setDirectoryBusy(true);
    const ids = directoryClientIds.split(",");
    // Bound each authenticated request while keeping one directory snapshot per screen.
    void Promise.all(Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
      requestManagerDestinations<{ advisors: AdvisorDirectory[] }>({ action: "directory", clientIds: ids.slice(i*100, (i+1)*100) }, controller.signal)))
      .then(results => { if (!controller.signal.aborted) setDirectory(results.flatMap(result => result.advisors)); })
      .catch(error => { if (!controller.signal.aborted) setDirectoryError(error instanceof Error ? error.message : "No se pudieron consultar los bots."); })
      .finally(() => { if (!controller.signal.aborted) setDirectoryBusy(false); });
    return () => controller.abort();
  }, [directoryClientIds, refreshDirectory]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadClients = async (nextUserId = userId) => {
    if (!nextUserId || isAllCurrencies) return;
    setLoading(true);
    setError(null);
    try {
      const list =
        mode === "admin"
          ? await fetchAtrioClientsForAdmin(nextUserId, workspaceCurrency)
          : await fetchAtrioClients(nextUserId, workspaceCurrency);
      setClients(list);
    } catch (e) {
      setError(formatAtrioError(e, "Error al cargar clientes de Atrio"));
    } finally {
      setLoading(false);
      setReady(true);
    }
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      await loadClients(user.id);
    };

    setReady(false);
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, workspaceCurrency, isAllCurrencies, mode]);

  useEffect(() => {
    if (!success) return;
    const timeoutId = window.setTimeout(() => setSuccess(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [success]);

  const normalizedSlug = normalizeAtrioSlug(form.slug);
  const previewUrl = buildAtrioUrl(normalizedSlug);
  const canSubmit =
    isValidAtrioSlug(form.slug) &&
    isValidAtrioId(form.atrioId) &&
    !saving;

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => {
      return (
        client.slug.toLowerCase().includes(query) ||
        client.atrio_id.toLowerCase().includes(query) ||
        buildAtrioUrl(client.slug).toLowerCase().includes(query) ||
        client.workspace_currency.toLowerCase().includes(query) ||
        directory.some(advisor => advisor.id === client.atrio_id && ((advisor.name || "").toLowerCase().includes(query) ||
          advisor.connections.some(bot => `${bot.manager_id} ${bot.agency_name || bot.agency_id} ${CASINO_NAMES[bot.target_provider]} ${managerTypeLabel(bot.manager_type)}`.toLowerCase().includes(query))))
      );
    });
  }, [clients, search, directory]);

  const openCreateModal = () => {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalMode("create");
  };

  const openEditModal = (client: AtrioClient) => {
    setEditingClient(client);
    setForm({
      slug: client.slug,
      atrioId: client.atrio_id,
    });
    setError(null);
    setModalMode("edit");
  };

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setEditingClient(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !canSubmit) return;

    setSaving(true);
    setError(null);
    try {
      if (modalMode === "edit" && editingClient) {
        const updated = await updateAtrioClient(editingClient.id, {
          slug: normalizedSlug,
          atrioId: form.atrioId,
        });
        setClients((prev) => sortAtrioClients(prev.map((client) => (client.id === updated.id ? updated : client))));
        setSuccess("Cliente Atrio actualizado.");
      } else {
        const created = await createAtrioClient(userId, {
          workspaceCurrency,
          slug: normalizedSlug,
          atrioId: form.atrioId,
        });
        setClients((prev) => sortAtrioClients([...prev, created]));
        setSuccess("Cliente Atrio agregado.");
      }
      setModalMode(null);
      setEditingClient(null);
      setForm(EMPTY_FORM);
    } catch (e) {
      setError(formatAtrioError(e, "Error al guardar cliente de Atrio"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client: AtrioClient) => {
    const confirmed = await confirmAction({
      title: "Eliminar asesor Atrio",
      description: `Se eliminara el slug ${client.slug} del workspace ${client.workspace_currency}.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!confirmed) return;

    setDeletingId(client.id);
    setError(null);
    try {
      await deleteAtrioClient(client.id);
      setClients((prev) => prev.filter((item) => item.id !== client.id));
      setSuccess("Cliente Atrio eliminado.");
    } catch (e) {
      setError(formatAtrioError(e, "Error al eliminar cliente de Atrio"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleMetricReset = async (metric: BotResetMetric, client?: AtrioClient) => {
    if (resetInFlight.current || !clients.length) return;
    resetInFlight.current = true;
    try {
      const confirmed = await confirmAction({
        title: metric === "usage_count" ? "Reiniciar contador" : "Reiniciar mensajes",
        description: `Se reiniciará ${metric === "usage_count" ? "el contador de asignaciones" : "el conteo de chats iniciados"} ${client ? `de los bots de ${client.slug}` : "de todos los bots de este workspace"}. Se conserva el historial y cada cuenta mantiene su bot. El reparto equitativo usará el nuevo conteo.`,
        confirmLabel: "Reiniciar",
      });
      if (!confirmed) return;
      setResetting({ metric, clientId: client?.id ?? null });
      setError(null); setSuccess(null);
      const ids = client ? [client.id] : clients.map(row => row.id);
      for (let index = 0; index < ids.length; index += 100) {
        await requestManagerDestinations({ action: "reset", metric, clientIds: ids.slice(index, index + 100) });
      }
      setSuccess(metric === "usage_count" ? "Contadores reiniciados." : "Conteo de chats iniciados reiniciado.");
    } catch {
      setError("No se pudo completar el reinicio. Actualizá los datos y volvé a intentarlo.");
    } finally {
      setResetting(null); resetInFlight.current = false;
      setRefreshDirectory(value => value + 1);
    }
  };

  if (!ready) return <DashboardSkeleton title="Cargando Atrio..." />;

  if (isAllCurrencies) {
    return <SingleCurrencyRequired title="Elegi ARS o PYG para administrar Atrio" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integracion"
        title="Atrio"
        description="Asesores, bots y métricas de los destinos disponibles para tus landings."
        actions={
          <button type="button" onClick={openCreateModal} className="ui-button ui-button-primary">
            AGREGAR ASESOR
          </button>
        }
      />

      {error ? (
        <p className="ui-alert border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.07)] text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="ui-alert border-[rgba(0,214,143,0.35)] bg-[rgba(0,214,143,0.08)] text-sm text-[var(--color-primary)]" role="status">
          {success}
        </p>
      ) : null}

      <SurfaceCard className="overflow-hidden">
        <div className="scrollbar-none overflow-x-auto border-b border-[var(--color-border-subtle)]">
          <div className="flex min-w-max items-center gap-4 p-4" role="group" aria-label="Filtros y acciones de asesores Atrio">
            <div className="shrink-0 whitespace-nowrap">
              <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Asesores Atrio</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {filteredClients.length} de {clients.length} asesores en {workspaceCurrency}
              </p>
            </div>
            <label className="relative ml-auto w-56 min-w-[200px] max-w-sm flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar asesor, bot, casino o gerencia..."
                className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] pl-9 pr-3 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring-primary)]"
              />
            </label>
            <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs"><input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} />Solo bots activos</label>
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap [&>div]:flex-nowrap">
              <button type="button" disabled={directoryBusy || !!resetting} onClick={() => setRefreshDirectory(v => v + 1)} className="ui-button ui-button-secondary h-8 min-h-8 px-3 text-xs">{directoryBusy ? "Actualizando…" : "Actualizar"}</button>
              <BotMetricResetButtons global disabled={directoryBusy || !!resetting || !clients.length || !!directoryError} resetting={resetting?.clientId === null ? resetting.metric : null} onReset={metric => void handleMetricReset(metric)} />
            </div>
          </div>
        </div>
        {clients.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={<AtrioMark />}
            title="No hay asesores Atrio cargados"
            description="Agrega el slug publico y el ID unico de Atrio para preparar el destino del CTA."
            action={
              <button type="button" onClick={openCreateModal} className="ui-button ui-button-secondary">
                Agregar asesor
              </button>
            }
          />
        ) : (
          <div className="space-y-4 p-3 sm:p-4">
            {!filteredClients.length && <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No hay asesores que coincidan con la búsqueda.</p>}
            {filteredClients.map(client => <section key={client.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] p-3">
                <div className="min-w-0"><a href={buildAtrioUrl(client.slug)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--color-text)]">{client.slug}</a>
                  <p className="mt-1 break-all text-[10px] text-[var(--color-text-muted)]">UUID: {client.atrio_id}</p></div>
                <div className="flex items-center gap-2"><WorkspaceBadge workspace={client.workspace_currency} />
                  <button type="button" onClick={() => openEditModal(client)} className="ui-button ui-button-secondary h-8 min-h-8 px-3 text-xs">Editar</button>
                  <button type="button" onClick={() => void handleDelete(client)} disabled={deletingId === client.id} className="ui-button ui-button-danger h-8 min-h-8 px-3 text-xs">{deletingId === client.id ? "Eliminando…" : "Eliminar"}</button>
                </div>
              </div>
              <AdvisorManagers advisor={directory.find(advisor => advisor.id === client.atrio_id)} busy={directoryBusy} error={directoryError} onlyActive={onlyActive}
                resetDisabled={!!resetting || !!directoryError} resetting={resetting?.clientId === client.id ? resetting.metric : null} onReset={metric => void handleMetricReset(metric, client)} />
            </section>)}
          </div>
        )}

        {loading ? (
          <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
            Actualizando...
          </div>
        ) : null}
      </SurfaceCard>

      <ModalShell
        open={modalMode !== null}
        title={modalMode === "edit" ? "Editar asesor Atrio" : "Agregar asesor Atrio"}
        description="Carga el slug publico de Atrio y el UUID unico del cliente."
        onClose={closeModal}
        closeDisabled={saving}
        width="md"
        footer={
          <>
            <button type="button" onClick={closeModal} disabled={saving} className="ui-button ui-button-secondary">
              Cancelar
            </button>
            <button type="submit" form="atrio-client-form" disabled={!canSubmit} className="ui-button ui-button-primary">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        <form id="atrio-client-form" onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">
              Slug <span className="text-[var(--color-danger)]">*</span>
            </span>
            <input
              autoFocus
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="gera"
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring-primary)]"
            />
            <span className="block text-[11px] leading-5 text-[var(--color-text-muted)]">
              URL final: <span className="text-[var(--color-text)]">{previewUrl}</span>
            </span>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">
              ID de Atrio <span className="text-[var(--color-danger)]">*</span>
            </span>
            <input
              value={form.atrioId}
              onChange={(event) => setForm((prev) => ({ ...prev, atrioId: event.target.value.trim() }))}
              placeholder="00000000-0000-4000-8000-000000000000"
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 font-mono text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring-primary)]"
            />
            <span className="block text-[11px] leading-5 text-[var(--color-text-muted)]">
              Identificador UUID unico del cliente en Atrio.
            </span>
          </label>

          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.02)] p-3 text-[11px] leading-5 text-[var(--color-text-muted)]">
            El slug define el link publico. El ID de Atrio se usa como identificador estable para relacionar eventos de ese webchat.
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
