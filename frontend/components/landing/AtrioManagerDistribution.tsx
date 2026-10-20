"use client";

import { useEffect, useId, useState, type Dispatch, type SetStateAction } from "react";
import type { AtrioClient, LandingAtrioAssignment } from "@/lib/atrio/atrioDb";
import { CASINO_NAMES, managerTypeLabel, requestManagerDestinations, type AdvisorDirectory, type DestinationConfiguration } from "@/lib/atrio/managerDestinations";
import type { TargetProvider } from "@/lib/landing/types";

export type ManagerDestinationDraft = { provider: TargetProvider; loaded: boolean; mode: DestinationConfiguration["mode"]; criterion: DestinationConfiguration["criterion"]; destinations: DestinationConfiguration["destinations"] };

const DISTRIBUTION_MODES = {
  weighted_random: { label: "Aleatoria", description: "Reparte los usuarios nuevos al azar entre los bots seleccionados. Con pesos iguales tienen la misma posibilidad; un peso mayor aumenta la posibilidad de recibir usuarios." },
  fair: { label: "Equitativa", description: "Prioriza al bot con menos asignaciones o chats iniciados en esta landing, según el criterio elegido. Cada conversación cuenta una vez, aunque reciba varios mensajes." },
} as const;

export function AtrioManagerDistribution({ landingId, provider, clients, setAssignments, onDraftChange }: {
  landingId: string; provider: TargetProvider; clients: AtrioClient[];
  setAssignments: Dispatch<SetStateAction<LandingAtrioAssignment[]>>;
  onDraftChange: (draft: ManagerDestinationDraft) => void;
}) {
  const [advisors, setAdvisors] = useState<AdvisorDirectory[]>([]);
  const [destinations, setDestinations] = useState<DestinationConfiguration["destinations"]>([]);
  const [mode, setMode] = useState<DestinationConfiguration["mode"]>("weighted_random");
  const [criterion, setCriterion] = useState<DestinationConfiguration["criterion"]>("usage_count");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadedProvider, setLoadedProvider] = useState<TargetProvider | null>(null);
  const [configured, setConfigured] = useState(false);
  const [helpMode, setHelpMode] = useState<keyof typeof DISTRIBUTION_MODES | null>(null);
  const helpId = useId();
  useEffect(() => {
    setLoadedProvider(null);
    if (provider === "multi_skin") { setLoaded(false); setBusy(false); setDestinations([]); return; }
    const controller = new AbortController();
    setBusy(true); setLoaded(false); setMessage(""); setConfigured(false); setDestinations([]);
    void requestManagerDestinations<{ configuration: DestinationConfiguration | null; directory: { advisors: AdvisorDirectory[] } }>({
      action: "configuration", landingId, targetProvider: provider,
    }, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setAdvisors(result.directory.advisors);
      if (result.configuration) {
        setMode(result.configuration.mode === "fixed" ? "weighted_random" : result.configuration.mode); setCriterion(result.configuration.criterion); setDestinations(result.configuration.destinations); setConfigured(true);
        setAssignments(clients.map(client => ({ atrioClientId: client.id, weight: 1 })));
      }
      setLoadedProvider(provider); setLoaded(true);
    }).catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "No se pudieron consultar los destinos."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
    // Reload a persisted landing/provider, not transient parent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landingId, provider]);
  const connections = advisors.flatMap(advisor => advisor.connections).filter(row => row.target_provider === provider);
  const advisorGroups = advisors.map(advisor => ({ ...advisor, connections: advisor.connections.filter(row => row.target_provider === provider) })).filter(advisor => advisor.connections.length > 0);
  const mixedTypes = new Set(connections.filter(row => destinations.some(d => d.connection_id === row.connection_id)).map(row => row.manager_type)).size > 1;
  useEffect(() => {
    onDraftChange({ provider, loaded: loaded && loadedProvider === provider, mode: destinations.length === 1 ? "fixed" : mode, criterion, destinations });
  }, [provider, loaded, loadedProvider, mode, criterion, destinations, onDraftChange]);
  if (provider === "multi_skin") return <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">Ganamos+ todavía no está integrado con PBAdmin. Sus bots no se comparten con Ganamos NET.</p>;
  return <div className="space-y-4">
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3">
      <p className="font-medium text-sm">Destinos de {CASINO_NAMES[provider]}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Elegí cada bot que participará en la redirección de la landing.</p>
      <div role="group" aria-label="Modo de reparto" className="mt-3 inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
        {(["weighted_random", "fair"] as const).map((value, index) => <div key={value} className={`inline-flex items-center ${index === 0 ? "rounded-l-lg border-r border-zinc-700" : "rounded-r-lg"} ${mode === value ? "bg-zinc-100 text-zinc-900" : "text-zinc-300"}`}>
          <button type="button" disabled={busy} onClick={() => setMode(value)} aria-pressed={mode === value}
            className={`cursor-pointer px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 disabled:cursor-wait ${index === 0 ? "rounded-l-lg" : ""} ${mode !== value ? "hover:bg-zinc-800" : ""}`}>
            {DISTRIBUTION_MODES[value].label}
          </button>
          <button type="button" aria-label={`Información sobre ${DISTRIBUTION_MODES[value].label}`} aria-expanded={helpMode === value} aria-controls={helpId}
            onClick={() => setHelpMode(current => current === value ? null : value)}
            onKeyDown={event => { if (event.key === "Escape") setHelpMode(null); }}
            className="mr-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-[10px] font-semibold opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
            <span aria-hidden="true" className="inline-flex size-3.5 items-center justify-center rounded-full border border-current">i</span>
          </button>
        </div>)}
      </div>
      {helpMode && <div id={helpId} role="note" className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-3)] px-3 py-2 text-xs leading-5 text-[var(--color-text-muted)]">
        <p><strong className="text-[var(--color-text)]">{DISTRIBUTION_MODES[helpMode].label}: </strong>{DISTRIBUTION_MODES[helpMode].description}</p>
        <p className="mt-1">MKT y Full Carga participan juntos solo si seleccionás ambos. Las cuentas existentes conservan su bot.</p>
      </div>}
      {mode === "fair" && <div role="group" aria-label="Criterio de reparto equitativo" className="mt-3 flex w-fit rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">{(["usage_count", "messages_received"] as const).map((value, index) => <button key={value} type="button" disabled={busy} onClick={() => setCriterion(value)} aria-pressed={criterion === value} className={`cursor-pointer px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 ${index === 0 ? "rounded-l-lg border-r border-zinc-700" : "rounded-r-lg"} ${criterion === value ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}>{value === "usage_count" ? "Por contador" : "Chats iniciados"}</button>)}</div>}
    </div>
    {busy && !loaded && <p className="text-xs text-[var(--color-text-muted)]">Consultando bots…</p>}
    {loaded && !configured && <p className="text-xs text-amber-300">Elegí los bots y guardá los cambios de la landing. Las cuentas existentes conservan su destino.</p>}
    {loaded && <div className="space-y-3">
      {advisorGroups.map(advisor => <details key={advisor.id} className="group overflow-hidden rounded-xl border border-[var(--color-border)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[var(--color-bg-3)] px-3 py-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 truncate font-semibold">{advisor.name || advisor.slug}</span>
          <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{advisor.connections.filter(connection => destinations.some(row => row.connection_id === connection.connection_id)).length}/{advisor.connections.length} seleccionados</span>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
        </summary>
        <div className="overflow-x-auto border-t border-[var(--color-border)]">
      <table className="min-w-[600px] w-full text-left text-xs">
        <thead className="bg-[var(--color-bg-3)] text-[var(--color-text-muted)]"><tr>{["Elegir", "Casino / gerencia", "Bot", "Tipo", "Estado", ...(mode === "weighted_random" ? ["Peso"] : [])].map(label => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">{advisor.connections.map(connection => {
          const selected = destinations.find(row => row.connection_id === connection.connection_id);
          return <tr key={connection.connection_id} className={selected ? "bg-[var(--color-primary-soft-bg)]" : ""}>
            <td className="p-3"><input type="checkbox" aria-label={`Seleccionar bot ${connection.manager_id}`} checked={!!selected} disabled={busy || !connection.active && !selected} onChange={() => setDestinations(current => selected ? current.filter(row => row.connection_id !== connection.connection_id) : [...current, { connection_id: connection.connection_id, weight: 1 }])} /></td>
            <td className="p-3">{CASINO_NAMES[connection.target_provider]}<span className="mt-1 block text-[var(--color-text-muted)]">{connection.agency_name || `Gerencia ${connection.agency_id}`}</span></td>
            <td className="p-3">{connection.manager_id}</td><td className="p-3">{managerTypeLabel(connection.manager_type)}</td>
            <td className="p-3">{connection.active ? "Activo" : "Inactivo"}</td>
            {mode === "weighted_random" && <td className="p-3"><input aria-label={`Peso bot ${connection.manager_id}`} className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] p-2" type="number" min={1} max={1000} value={selected?.weight || 1} disabled={!selected || busy} onChange={event => setDestinations(current => current.map(row => row.connection_id === connection.connection_id ? { ...row, weight: Math.max(1, Math.min(1000, Number(event.target.value) || 1)) } : row))} /></td>}
          </tr>;
        })}</tbody>
      </table>
        </div>
      </details>)}
      {!connections.length && <p className="p-4 text-xs text-[var(--color-text-muted)]">No hay bots de este casino vinculados a los asesores del workspace.</p>}
    </div>}
    {mixedTypes && <p className="text-xs text-amber-300">Seleccionaste MKT y Full Carga. Las cuentas nuevas se repartirán entre ambas modalidades.</p>}
    {destinations.length === 1 && <p className="text-xs text-[var(--color-text-muted)]">Un bot seleccionado: todos los usuarios nuevos irán a ese destino.</p>}
    <p className="text-xs text-[var(--color-text-muted)]">Los destinos se guardan con los cambios de la landing.</p>
    {message && <p role="status" className="text-xs text-[var(--color-text-muted)]">{message}</p>}
  </div>;
}
