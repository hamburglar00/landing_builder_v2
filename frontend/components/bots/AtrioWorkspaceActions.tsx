"use client";
import { useRef, useState } from "react";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import {
  requestManagerDestinations,
  type BotResetMetric,
} from "@/lib/atrio/managerDestinations";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
export function AtrioWorkspaceActions({
  clients,
  onChanged,
}: {
  clients: AtrioClient[];
  onChanged: () => void;
}) {
  const confirm = useAppConfirm(),
    inFlight = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function reset(metric: BotResetMetric) {
    if (inFlight.current || !clients.length) return;
    inFlight.current = true;
    try {
      if (
        !(await confirm({
          title: "Reiniciar métricas de Atrio",
          description: `Se reinician ${metric === "usage_count" ? "las asignaciones" : "los chats iniciados"} de todos los bots de Atrio de este workspace, aunque estén ocultos por los filtros. Se conservan los históricos y la cuenta de cada cliente.`,
          confirmLabel: "Reiniciar",
        }))
      )
        return;
      setBusy(true);
      setError("");
      for (let index = 0; index < clients.length; index += 100)
        await requestManagerDestinations({
          action: "reset",
          metric,
          clientIds: clients
            .slice(index, index + 100)
            .map((client) => client.id),
        });
    } catch {
      setError(
        "No se pudo completar el reinicio. Actualizá los datos antes de volver a intentarlo.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
      onChanged();
    }
  }
  return (
    <div className="space-y-2">
      <details className="w-fit rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400">
        <summary className="cursor-pointer">Métricas de Atrio</summary>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !clients.length}
            onClick={() => void reset("usage_count")}
          >
            Reiniciar asignaciones de Atrio
          </button>
          <button
            type="button"
            disabled={busy || !clients.length}
            onClick={() => void reset("messages_received")}
          >
            Reiniciar chats de Atrio
          </button>
        </div>
      </details>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
