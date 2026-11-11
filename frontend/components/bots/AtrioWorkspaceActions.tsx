"use client";
import { useRef, useState, type ReactNode } from "react";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import {
  requestManagerDestinations,
  type BotResetMetric,
} from "@/lib/atrio/managerDestinations";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import { BotResetIcon } from "./BotActionIcons";
import { ActionNotice, useActionMessage } from "@/components/ui/ActionNotice";
export function AtrioWorkspaceActions({
  clients,
  onChanged,
  render,
  onReset,
  hasClients,
}: {
  clients: AtrioClient[];
  onChanged: () => void;
  render?: (actions: ReactNode) => ReactNode;
  onReset?: (metric: BotResetMetric) => Promise<void>;
  hasClients?: boolean;
}) {
  const confirm = useAppConfirm(),
    inFlight = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError, errorNoticeKey] = useActionMessage("");
  const [notice, setNotice, noticeNoticeKey] = useActionMessage("");
  async function reset(metric: BotResetMetric) {
    if (inFlight.current || !(hasClients ?? !!clients.length)) return;
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
      setNotice("");
      if(onReset)await onReset(metric);
      else for (let index = 0; index < clients.length; index += 100)
        await requestManagerDestinations({
          action: "reset",
          metric,
          clientIds: clients
            .slice(index, index + 100)
            .map((client) => client.id),
        });
      setNotice(metric === "usage_count" ? "Asignaciones de Atrio reiniciadas." : "Chats de Atrio reiniciados.");
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
  const actions = <>
          <button
            type="button"
            role={render ? "menuitem" : undefined}
            disabled={busy || !(hasClients ?? !!clients.length)}
            onClick={() => void reset("usage_count")}
          >
            <BotResetIcon />Reiniciar asignaciones de Atrio
          </button>
          <button
            type="button"
            role={render ? "menuitem" : undefined}
            disabled={busy || !(hasClients ?? !!clients.length)}
            onClick={() => void reset("messages_received")}
          >
            <BotResetIcon />Reiniciar chats de Atrio
          </button>
  </>;
  return <div className="space-y-2">
    {render ? render(actions) : <details className="w-fit rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400"><summary className="cursor-pointer">Métricas de Atrio</summary><div className="mt-3 flex flex-wrap gap-3">{actions}</div></details>}
      <ActionNotice noticeKey={noticeNoticeKey} message={notice} />
      <ActionNotice noticeKey={errorNoticeKey} message={error} tone="error" />
  </div>;
}
