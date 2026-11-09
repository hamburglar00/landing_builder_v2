"use client";
import { useCallback, useState, type ReactNode } from "react";
import {
  buildAtrioUrl,
  updateAtrioClient,
  deleteAtrioClient,
} from "@/lib/atrio/atrioDb";
import {
  requestManagerDestinations,
  CASINO_NAMES,
  managerTypeLabel,
  type BotResetMetric,
} from "@/lib/atrio/managerDestinations";
import type { AtrioBotEntry } from "@/lib/bots/workspace";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import { ModalShell } from "@/components/ui/PanelPrimitives";
import { BotResetIcon } from "./BotActionIcons";
export const PLATFORM_NAMES: Record<number, string> = {
  1: "Ases del Norte",
  2: "Ganamos NET",
  3: "Juga y Gana",
  4: "Caipirinha",
  5: "Rey de Ases",
  6: "Revolución",
  7: "Multi Skin",
};
export function AtrioBotTable({
  entries,
  onChanged,
  render,
}: {
  entries: AtrioBotEntry[];
  onChanged: () => void;
  render?: (actions: (entry: AtrioBotEntry) => ReactNode) => ReactNode;
}) {
  const confirm = useAppConfirm(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AtrioBotEntry | null>(null),
    [slug, setSlug] = useState(""),
    [atrioId, setAtrioId] = useState("");
  const closeEditing = useCallback(() => setEditing(null), []);
  async function reset(entry: AtrioBotEntry, metric: BotResetMetric) {
    if (
      !(await confirm({
        title: "Reiniciar métricas del asesor",
        description: `Se reinician ${metric === "usage_count" ? "las asignaciones" : "los chats operativos"} de todos los bots de ${entry.name}, aunque estén en otra gerencia. Se conservan los históricos.`,
        confirmLabel: "Reiniciar",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await requestManagerDestinations({
        action: "reset",
        clientIds: [entry.client.id],
        metric,
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reiniciar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(entry: AtrioBotEntry) {
    if (
      !(await confirm({
        title: "Quitar asesor del constructor",
        description: `Se quita el vínculo de ${entry.name} y sus asignaciones en este workspace. No se elimina el asesor de Atrio.`,
        confirmLabel: "Quitar asesor",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await deleteAtrioClient(entry.client.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo quitar.");
    } finally {
      setBusy(false);
    }
  }
  const renderActions = (entry: AtrioBotEntry) => <>
                      <a
                        role="menuitem"
                        href={buildAtrioUrl(entry.client.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-300"
                      >
                        Abrir asesor
                      </a>
                      {entry.connection && (
                        <a
                        role="menuitem"
                          href={`${buildAtrioUrl(entry.client.slug)}/bot/${entry.connection.manager_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir chat del bot
                        </a>
                      )}
                      <button
                        role="menuitem"
                        disabled={busy}
                        onClick={() => {
                          setEditing(entry);
                          setSlug(entry.client.slug);
                          setAtrioId(entry.client.atrio_id);
                        }}
                      >
                        Editar vínculo
                      </button>
                      {render && <div role="separator" className="my-1 h-px bg-[#26323a]" />}
                      <button
                        role="menuitem"
                        disabled={busy || !entry.connection}
                        onClick={() => void reset(entry, "usage_count")}
                      >
                        <BotResetIcon />Reiniciar asignaciones del asesor
                      </button>
                      <button
                        role="menuitem"
                        disabled={busy || !entry.connection}
                        onClick={() => void reset(entry, "messages_received")}
                      >
                        <BotResetIcon />Reiniciar chats del asesor
                      </button>
                      {render && <div role="separator" className="my-1 h-px bg-[#26323a]" />}
                      <button
                        role="menuitem"
                        disabled={busy}
                        onClick={() => void remove(entry)}
                        className="text-red-300" data-danger="true"
                      >
                        Quitar asesor
                      </button>
  </>;
  return (
    <>
      {render ? <>{error && <p role="alert" className="text-xs text-red-300">{error}</p>}{render(renderActions)}</> : (
    <section className="mt-4 space-y-2" aria-label="Bots de Atrio">
      <h3 className="text-xs font-semibold text-zinc-300">Atrio</h3>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-700">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-zinc-800/80 text-zinc-300">
            <tr>
              {[
                "Asesor",
                "Bot / plataforma",
                "Estado",
                "Asignaciones",
                "Chats iniciados",
                "Históricos",
                "Acciones",
              ].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {entries.map((entry) => (
              <tr
                key={`${entry.client.id}:${entry.connection?.connection_id ?? entry.inventory?.manager_id ?? "unlinked"}`}
              >
                <td className="px-3 py-3 text-zinc-200">
                  {entry.name}
                  <span className="block text-[11px] text-zinc-500">
                    /{entry.client.slug}
                  </span>
                </td>
                <td className="px-3 py-3 text-zinc-300">
                  {entry.connection ? (
                    <>
                      Bot {entry.connection.manager_id} ·{" "}
                      {managerTypeLabel(entry.connection.manager_type)}
                      <span className="block text-zinc-500">
                        {CASINO_NAMES[entry.connection.target_provider]}
                      </span>
                    </>
                  ) : entry.inventory ? (
                    <>
                      Bot {entry.inventory.manager_id} ·{" "}
                      {entry.inventory.role === "mkt"
                        ? "MKT"
                        : entry.inventory.role === "carga"
                          ? "Full Carga"
                          : entry.inventory.role}
                      <span className="block text-zinc-500">
                        {PLATFORM_NAMES[entry.inventory.platform ?? 0] ??
                          entry.inventory.name}
                      </span>
                    </>
                  ) : (
                    "Sin bots vinculados"
                  )}
                </td>
                <td className="px-3 py-3 text-zinc-400">
                  {entry.connection
                    ? entry.connection.active
                      ? "Activo"
                      : "Inactivo"
                    : entry.inventory
                      ? "Pendiente de vinculación"
                      : "Pendiente"}
                </td>
                <td className="px-3 py-3 text-zinc-300">
                  {entry.connection?.usage_count ?? (entry.inventory ? "—" : 0)}
                </td>
                <td className="px-3 py-3 text-zinc-300">
                  {entry.connection?.chats_started ??
                    (entry.inventory ? "—" : 0)}
                </td>
                <td className="px-3 py-3 text-zinc-400">
                  {entry.connection?.chats_started_total ??
                    entry.connection?.chats_started ??
                    (entry.inventory ? "—" : 0)}
                </td>
                <td className="px-3 py-3">
                  <details className="relative">
                    <summary className="cursor-pointer text-zinc-300">
                      Administrar
                    </summary>
                    {renderActions(entry)}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
      )}
      <ModalShell
        open={!!editing}
        title="Editar vínculo de Atrio"
        onClose={closeEditing}
        closeDisabled={busy}
        footer={
          <button
            className="ui-button ui-button-primary"
            disabled={busy || !slug.trim() || !atrioId.trim()}
            onClick={async () => {
              if (!editing) return;
              setBusy(true);
              try {
                await updateAtrioClient(editing.client.id, {
                  slug,
                  atrioId,
                });
                setEditing(null);
                onChanged();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo guardar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar
          </button>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs text-zinc-400">
            Slug del asesor
            <input
              className="ui-input mt-2 w-full"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            ID del asesor de Atrio
            <input
              className="ui-input mt-2 w-full"
              value={atrioId}
              disabled={busy}
              onChange={(event) => setAtrioId(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}
        </div>
      </ModalShell>
    </>
  );
}
