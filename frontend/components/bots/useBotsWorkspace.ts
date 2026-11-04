"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  fetchAtrioClients,
  fetchAtrioClientsForAdmin,
  type AtrioClient,
} from "@/lib/atrio/atrioDb";
import {
  requestManagerDestinations,
  type AdvisorDirectory,
} from "@/lib/atrio/managerDestinations";
import { groupBots } from "@/lib/bots/workspace";
import type { Gerencia } from "@/lib/gerencias/types";
import type { ReportingCurrency } from "@/lib/currency";
export function useBotsWorkspace(
  userId: string | null,
  workspace: ReportingCurrency,
  isAdmin: boolean,
  enabled: boolean,
  gerencias: Gerencia[],
) {
  const [clients, setClients] = useState<AtrioClient[]>([]),
    [directory, setDirectory] = useState<AdvisorDirectory[]>([]);
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setClients([]);
    setDirectory([]);
    setError("");
    if (!userId || !enabled) {
      setBusy(false);
      return () => controller.abort();
    }
    setBusy(true);
    void (async () => {
      try {
        const list = await (isAdmin
          ? fetchAtrioClientsForAdmin(userId, workspace, true)
          : fetchAtrioClients(userId, workspace, true));
        if (controller.signal.aborted) return;
        setClients(list);
        const result: AdvisorDirectory[] = [];
        for (let offset = 0; offset < list.length; offset += 100) {
          const page = await requestManagerDestinations<{
            advisors: AdvisorDirectory[];
          }>(
            {
              action: "directory",
              clientIds: list.slice(offset, offset + 100).map((c) => c.id),
            },
            controller.signal,
          );
          result.push(...page.advisors);
        }
        if (!controller.signal.aborted) setDirectory(result);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los bots de Atrio.",
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [userId, workspace, isAdmin, enabled, revision]);
  const groups = useMemo(
    () => groupBots(gerencias, enabled ? clients : [], directory, userId ?? ""),
    [gerencias, clients, directory, userId, enabled],
  );
  return { groups, clients, busy, error, reload };
}
