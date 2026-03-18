"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import type { Gerencia } from "@/lib/gerencias/types";
import { fetchGerencias, fetchGerenciasForAdmin } from "@/lib/gerencias/gerenciasDb";

export type GerenciaPhoneRow = {
  id: number;
  gerencia_id: number;
  phone: string;
  status: string;
  usage_count: number;
  kind: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

type FairCriterion = "usage_count" | "messages_received";

type Props = {
  backLink: string;
  backLabel: string;
  title?: string;
  /** Si true, se listan todas las gerencias (admin): propias primero, luego de clientes. */
  isAdmin?: boolean;
};

const formatPhone = (raw: string) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");

  // Formato específico para celulares de Argentina tipo:
  // 5493516772507 -> 54 9 3516 77-2507
  if (digits.length === 13 && digits.startsWith("54")) {
    const cc = digits.slice(0, 2);
    const nine = digits.slice(2, 3);
    const area = digits.slice(3, 7);
    const part1 = digits.slice(7, 9);
    const part2 = digits.slice(9);
    return `${cc} ${nine} ${area} ${part1}-${part2}`;
  }

  return raw;
};

const formatStatus = (status: string) => {
  if (status === "active") return "activo";
  if (status === "inactive") return "inactivo";
  return status;
};

const onlyDigits = (raw: string) => raw.replace(/\D/g, "");

export function TelefonosPageContent({
  backLink,
  backLabel,
  title = "Teléfonos",
  isAdmin = false,
}: Props) {
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [phonesByGerencia, setPhonesByGerencia] = useState<
    Record<number, GerenciaPhoneRow[]>
  >({});
  const [leadUniqueByAssignedPhone, setLeadUniqueByAssignedPhone] = useState<
    Record<string, number>
  >({});
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingGerenciaId, setSyncingGerenciaId] = useState<number | null>(
    null,
  );
  const [resettingGerenciaId, setResettingGerenciaId] = useState<number | null>(
    null,
  );
  const [deletingGerenciaId, setDeletingGerenciaId] = useState<number | null>(
    null,
  );
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [globalResetting, setGlobalResetting] = useState(false);
  const [globalDeleting, setGlobalDeleting] = useState(false);
  const [switchingGerenciaId, setSwitchingGerenciaId] = useState<number | null>(null);
  const [openGerenciaId, setOpenGerenciaId] = useState<number | null>(null);
  const [nextSyncCountdown, setNextSyncCountdown] = useState<string>("--:--");
  const userIdRef = useRef<string | null>(null);
  const lastAutoReloadAt = useRef<number>(0);
  const reloadScheduledRef = useRef<boolean>(false);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const loadData = useCallback(async (uid: string) => {
    const list = isAdmin
      ? await fetchGerenciasForAdmin(uid)
      : await fetchGerencias(uid);
    setGerencias(list);
    if (list.length === 0) {
      setPhonesByGerencia({});
      return;
    }
    const ids = list.map((g) => g.id);
    const { data: phones, error: phonesError } = await supabase
      .from("gerencia_phones")
      .select(
        "id, gerencia_id, phone, status, usage_count, kind, last_seen_at, created_at, updated_at",
      )
      .in("gerencia_id", ids)
      .order("gerencia_id", { ascending: true })
      .order("id", { ascending: true });

    if (phonesError) throw phonesError;
    const byGerencia: Record<number, GerenciaPhoneRow[]> = {};
    for (const g of list) byGerencia[g.id] = [];
    for (const p of phones ?? []) {
      byGerencia[p.gerencia_id] = byGerencia[p.gerencia_id] ?? [];
      byGerencia[p.gerencia_id].push(p as GerenciaPhoneRow);
    }
    setPhonesByGerencia(byGerencia);

    const leadQuery = supabase
      .from("conversions")
      .select("telefono_asignado, phone, estado, lead_event_id")
      .neq("telefono_asignado", "")
      .neq("phone", "");

    const { data: leadRows, error: leadsError } = await (isAdmin
      ? leadQuery
      : leadQuery.eq("user_id", uid));

    if (leadsError) throw leadsError;

    const countsByAssigned: Record<string, number> = {};

    for (const row of leadRows ?? []) {
      const leadEventId = typeof row.lead_event_id === "string"
        ? row.lead_event_id.trim()
        : "";
      if (!leadEventId) continue;

      const assignedDigits = onlyDigits(row.telefono_asignado ?? "");
      if (!assignedDigits) continue;

      countsByAssigned[assignedDigits] = (countsByAssigned[assignedDigits] ?? 0) + 1;
    }

    setLeadUniqueByAssignedPhone(countsByAssigned);
  }, [isAdmin]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return;
      setUserId(user.id);
      setError(null);
      try {
        await loadData(user.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        setReady(true);
      }
    };
    void init();
  }, [loadData]);

  // Cuenta regresiva hasta la próxima ejecución real del cron (*/5 en UTC: :00, :05, :10, …)
  // Cuando llega a 00:00 se recargan los datos para mostrar los teléfonos actualizados por el cron.
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const utcMin = now.getUTCMinutes();
      const nextMin = (Math.floor(utcMin / 5) + 1) * 5;
      const nextRun =
        nextMin >= 60
          ? new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                now.getUTCHours() + 1,
                0,
                0,
                0,
              ),
            )
          : new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                now.getUTCHours(),
                nextMin,
                0,
                0,
              ),
            );
      const countdownMs = Math.max(0, nextRun.getTime() - now.getTime());
      const m = Math.floor(countdownMs / 60000);
      const s = Math.floor((countdownMs % 60000) / 1000);
      setNextSyncCountdown(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);

      // Cuando la cuenta regresiva llega a 00:00, programar recarga tras 3 s (dar tiempo al cron a terminar)
      if (countdownMs <= 2000 && countdownMs >= 0 && !reloadScheduledRef.current) {
        const uid = userIdRef.current;
        const nowMs = Date.now();
        if (uid && nowMs - lastAutoReloadAt.current > 4 * 60 * 1000) {
          reloadScheduledRef.current = true;
          lastAutoReloadAt.current = nowMs;
          setTimeout(() => {
            reloadScheduledRef.current = false;
            void loadData(uid);
          }, 3000);
        }
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [loadData]);

  const handleSync = async (gerenciaId: number | null) => {
    if (!userId || !base) return;
    if (gerenciaId !== null) setSyncingGerenciaId(gerenciaId);
    else setGlobalSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${base}/functions/v1/sync-phones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          user_id: userId,
          ...(gerenciaId !== null ? { gerencia_id: gerenciaId } : {}),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        setError(`Sync: ${res.status} – ${text}`);
      } else {
        await loadData(userId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al sincronizar");
    } finally {
      if (gerenciaId !== null) setSyncingGerenciaId(null);
      else setGlobalSyncing(false);
    }
  };

  const handleReset = async (gerenciaId: number | null) => {
    if (!userId || !base) return;
    if (gerenciaId !== null) setResettingGerenciaId(gerenciaId);
    else setGlobalResetting(true);
    setError(null);
    try {
      const res = await fetch(`${base}/functions/v1/reset-phone-counters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          user_id: userId,
          ...(gerenciaId !== null ? { gerencia_id: gerenciaId } : {}),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        setError(`Reset: ${res.status} – ${text}`);
      } else {
        await loadData(userId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al reiniciar contadores");
    } finally {
      if (gerenciaId !== null) setResettingGerenciaId(null);
      else setGlobalResetting(false);
    }
  };

  const handleDelete = (gerenciaId: number | null) => {
    const scope =
      gerenciaId !== null
        ? `esta gerencia (${gerencias.find((g) => g.id === gerenciaId)?.nombre ?? gerenciaId})`
        : "todas las gerencias";
    if (
      !window.confirm(
        `¿Limpiar los registros de teléfonos de ${scope} en esta vista? Esto no borra datos en Supabase y se volverán a ver al sincronizar.`,
      )
    )
      return;

    setError(null);
    if (gerenciaId !== null) {
      setDeletingGerenciaId(gerenciaId);
      setPhonesByGerencia((prev) => {
        const next = { ...prev };
        next[gerenciaId] = [];
        return next;
      });
      setDeletingGerenciaId(null);
    } else {
      setGlobalDeleting(true);
      setPhonesByGerencia((prev) => {
        const next: Record<number, GerenciaPhoneRow[]> = {};
        for (const key of Object.keys(prev)) {
          next[Number(key)] = [];
        }
        return next;
      });
      setGlobalDeleting(false);
    }
  };

  const handleFairCriterionChange = async (
    gerenciaId: number,
    criterion: FairCriterion,
  ) => {
    setSwitchingGerenciaId(gerenciaId);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("gerencias")
        .update({ fair_criterion: criterion })
        .eq("id", gerenciaId);
      if (updateError) throw updateError;
      setGerencias((prev) =>
        prev.map((g) =>
          g.id === gerenciaId ? { ...g, fair_criterion: criterion } : g,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error al actualizar criterio de equidad",
      );
    } finally {
      setSwitchingGerenciaId(null);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={backLink}
          className="text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          ← {backLabel}
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Historial de teléfonos por gerencia. Sincroniza, reinicia contadores o
          borra registros por gerencia o en bloque.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {isAdmin
            ? "Próxima sincronización automática (cron):"
            : "Próxima sincronización automática:"}{" "}
          <span className="font-mono text-zinc-300">{nextSyncCountdown}</span>
        </p>
      </div>

      {error && (
        <p
          className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Botones globales */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <span className="mr-2 self-center text-xs font-medium text-zinc-400">
          Todas las gerencias:
        </span>
        <button
          type="button"
          onClick={() => void handleSync(null)}
          disabled={globalSyncing || !gerencias.length}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
        >
          {globalSyncing ? "Sincronizando..." : "Sincronizar"}
        </button>
        <button
          type="button"
          onClick={() => void handleReset(null)}
          disabled={globalResetting || !gerencias.length}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
        >
          {globalResetting ? "Reiniciando..." : "Reiniciar contadores"}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete(null)}
          disabled={globalDeleting || !gerencias.length}
          className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-60"
        >
          {globalDeleting ? "Borrando..." : "Borrar registros"}
        </button>
      </div>

      {gerencias.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No tienes gerencias. Crea una en{" "}
          <Link
            href={backLink.includes("admin") ? "/admin/gerencias" : "/dashboard/gerencias"}
            className="text-zinc-300 underline hover:text-zinc-100"
          >
            Gerencias
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-2">
          {gerencias.map((g) => {
            const phones = phonesByGerencia[g.id] ?? [];
            const totalUsage = phones.reduce(
              (acc, p) => acc + (Number(p.usage_count) || 0),
              0,
            );
            const totalMessages = phones.reduce(
              (acc, p) =>
                acc + (leadUniqueByAssignedPhone[onlyDigits(p.phone)] ?? 0),
              0,
            );
            const isOpen = openGerenciaId === g.id;
            const syncing = syncingGerenciaId === g.id;
            const resetting = resettingGerenciaId === g.id;
            const deleting = deletingGerenciaId === g.id;
            return (
              <div
                key={g.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenGerenciaId((prev) => (prev === g.id ? null : g.id))
                  }
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-zinc-800/50"
                >
                  <span className="font-medium text-zinc-200">
                    {g.nombre} (ID {g.gerencia_id})
                  </span>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span>
                      {phones.length} registro{phones.length !== 1 ? "s" : ""}
                    </span>
                    <span>Contador: {totalUsage}</span>
                    <span>Mensajes recibidos: {totalMessages}</span>
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-zinc-800 px-4 pb-4 pt-2">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSync(g.id)}
                        disabled={syncing}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
                      >
                        {syncing ? "Sincronizando..." : "Sincronizar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReset(g.id)}
                        disabled={resetting}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
                      >
                        {resetting ? "Reiniciando..." : "Reiniciar contador"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(g.id)}
                        disabled={deleting}
                        className="rounded-lg border border-red-900/60 bg-red-950/30 px-2 py-1 text-xs font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-60"
                      >
                        {deleting ? "Borrando..." : "Borrar registros"}
                      </button>
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                      <span className="text-[11px] text-zinc-400">
                        Equitativo por:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleFairCriterionChange(g.id, "usage_count")
                        }
                        disabled={switchingGerenciaId === g.id}
                        className={`rounded-md px-2 py-1 text-[11px] transition ${
                          (g.fair_criterion ?? "usage_count") === "usage_count"
                            ? "bg-zinc-700 text-zinc-100"
                            : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Contador
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleFairCriterionChange(g.id, "messages_received")
                        }
                        disabled={switchingGerenciaId === g.id}
                        className={`rounded-md px-2 py-1 text-[11px] transition ${
                          (g.fair_criterion ?? "usage_count") === "messages_received"
                            ? "bg-zinc-700 text-zinc-100"
                            : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Mensajes recibidos
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-zinc-700">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-800/80">
                          <tr>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Teléfono
                            </th>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Estado
                            </th>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Tipo
                            </th>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Contador
                            </th>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Mensajes recibidos
                            </th>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Última sincronización
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {phones.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-3 py-4 text-center text-zinc-500"
                              >
                                Sin registros. Usa Sincronizar para traer números.
                              </td>
                            </tr>
                          ) : (
                            phones.map((p) => (
                              <tr
                                key={p.id}
                                className="bg-zinc-950/40"
                              >
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center gap-2 font-mono text-zinc-200">
                                    {formatPhone(p.phone)}
                                    <a
                                      href={`https://wa.me/${p.phone.replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex shrink-0 rounded transition hover:opacity-80"
                                      title="Abrir en WhatsApp"
                                    >
                                      <Image
                                        src="/whatsapp-icon.png"
                                        alt="WhatsApp"
                                        width={15}
                                        height={15}
                                        className="h-[15px] w-[15px]"
                                      />
                                    </a>
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={
                                      p.status === "active"
                                        ? "text-emerald-400"
                                        : "text-zinc-500"
                                    }
                                  >
                                    {formatStatus(p.status)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-zinc-300">
                                  {p.kind}
                                </td>
                                <td className="px-3 py-2 text-zinc-300">
                                  {p.usage_count}
                                </td>
                                <td className="px-3 py-2 text-zinc-300">
                                  {leadUniqueByAssignedPhone[onlyDigits(p.phone)] ?? 0}
                                </td>
                                <td className="px-3 py-2 text-xs text-zinc-500">
                                  {p.last_seen_at
                                    ? new Date(p.last_seen_at).toLocaleString()
                                    : "—"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

