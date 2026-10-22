"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SingleCurrencyRequired, useCurrencyScope } from "@/components/currency/CurrencyScope";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { EmptyState, ModalShell, PageHeader } from "@/components/ui/PanelPrimitives";
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
import styles from "./AtrioDirectory.module.css";

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
    <span className={styles.workspace}>
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
        eyebrow="Integración"
        title="Atrio"
        description="Tus asesores y sus bots. Consultá las asignaciones y los chats de cada destino."
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

      <div className={styles.toolbar}>
        <div className={styles.toolbarScroll}>
          <div className={styles.toolbarRow} role="group" aria-label="Filtros y acciones de asesores Atrio">
            <div className={styles.toolbarTitle}>
              <h2>Asesores</h2>
              <p>
                {filteredClients.length} de {clients.length} asesores en {workspaceCurrency}
              </p>
            </div>
            <label className={styles.search}>
              <span>
                <SearchIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar asesor, bot o casino…"
                aria-label="Buscar asesor, bot, casino o gerencia"
              />
            </label>
            <label className={styles.activeFilter}><input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} />Solo bots activos</label>
            <div className={styles.toolbarActions}>
              <button type="button" disabled={directoryBusy || !!resetting} onClick={() => setRefreshDirectory(v => v + 1)} className="ui-button ui-button-secondary h-8 min-h-8 px-3 text-xs">{directoryBusy ? "Actualizando…" : "Actualizar"}</button>
              <div className={styles.globalResets} role="group" aria-label="Reiniciar métricas de todos los asesores del workspace">
                <BotMetricResetButtons global disabled={directoryBusy || !!resetting || !clients.length || !!directoryError} resetting={resetting?.clientId === null ? resetting.metric : null} onReset={metric => void handleMetricReset(metric)} />
              </div>
            </div>
          </div>
        </div>
      </div>
        {clients.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={<AtrioMark />}
            title="No hay asesores Atrio cargados"
            description="Vinculá tu primer asesor para consultar sus bots y usarlos en tus landings."
            action={
              <button type="button" onClick={openCreateModal} className="ui-button ui-button-secondary">
                Agregar asesor
              </button>
            }
          />
        ) : (
          <div className={styles.list}>
            {!filteredClients.length && <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No hay asesores que coincidan con la búsqueda.</p>}
            {filteredClients.map(client => <section key={client.id} className={styles.advisor} aria-label={`Asesor ${client.slug}`}>
              <div className={styles.advisorHeader}>
                <div className={styles.identity}>
                  <span className={styles.avatar} aria-hidden="true">{(directory.find(advisor => advisor.id === client.atrio_id)?.name || client.slug).slice(0, 1)}</span>
                  <div className="min-w-0">
                    <h2><a href={buildAtrioUrl(client.slug)} target="_blank" rel="noreferrer" className={styles.advisorName}>
                      {directory.find(advisor => advisor.id === client.atrio_id)?.name || client.slug}
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></svg>
                    </a></h2>
                    <div className={styles.identityMeta}>
                      <span>/{client.slug}</span><WorkspaceBadge workspace={client.workspace_currency} />
                      <details className={styles.uuid}><summary>Ver UUID</summary><code>{client.atrio_id}</code></details>
                    </div>
                  </div>
                </div>
                <div className={styles.advisorActions}>
                  <button type="button" onClick={() => openEditModal(client)} className={styles.edit} aria-label={`Editar asesor ${client.slug}`}>Editar</button>
                  <button type="button" onClick={() => void handleDelete(client)} disabled={deletingId === client.id} className={styles.delete} aria-label={`Eliminar asesor ${client.slug}`} title={deletingId === client.id ? "Eliminando…" : "Eliminar asesor"}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7" /></svg>
                  </button>
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
