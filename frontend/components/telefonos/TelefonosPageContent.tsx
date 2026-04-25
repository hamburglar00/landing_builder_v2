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
  comment: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

type FairCriterion = "usage_count" | "messages_received";

type Props = {
  backLink?: string;
  backLabel?: string;
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
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [globalResetting, setGlobalResetting] = useState(false);
  const [globalDeletingInactive, setGlobalDeletingInactive] = useState(false);
  const [switchingGerenciaId, setSwitchingGerenciaId] = useState<number | null>(null);
  const [openGerenciaId, setOpenGerenciaId] = useState<number | null>(null);
  const [nextSyncCountdown, setNextSyncCountdown] = useState<string>("--:--");
  const [manualPhoneInput, setManualPhoneInput] = useState<Record<number, string>>({});
  const [manualPhoneKind, setManualPhoneKind] = useState<Record<number, "carga" | "ads" | "mkt">>({});
  const [manualSavingGerenciaId, setManualSavingGerenciaId] = useState<number | null>(null);
  const [manualModalGerenciaId, setManualModalGerenciaId] = useState<number | null>(null);
  const [maxPhonesAllowed, setMaxPhonesAllowed] = useState<number | null>(null);
  const [planCapModal, setPlanCapModal] = useState<{
    open: boolean;
    attempted: number;
    allowed: number;
  }>({ open: false, attempted: 0, allowed: 0 });
  const [planLimitModal, setPlanLimitModal] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });
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
    if (!isAdmin) {
      const { data: sub } = await supabase
        .from("client_subscriptions")
        .select("max_phones")
        .eq("user_id", uid)
        .maybeSingle();
      setMaxPhonesAllowed(Number.isFinite(Number(sub?.max_phones)) ? Number(sub?.max_phones) : null);
    } else {
      setMaxPhonesAllowed(null);
    }

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
        "id, gerencia_id, phone, status, usage_count, kind, comment, last_seen_at, created_at, updated_at",
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

    const countsByAssigned: Record<string, number> = {};
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      const baseLeadQuery = supabase
        .from("conversions")
        .select("telefono_asignado, lead_event_id, phone")
        .neq("telefono_asignado", "")
        .neq("phone", "")
        .range(offset, offset + pageSize - 1);

      const { data: leadRows, error: leadsError } = await (isAdmin
        ? baseLeadQuery
        : baseLeadQuery.eq("user_id", uid));
      if (leadsError) throw leadsError;

      const chunk = leadRows ?? [];
      for (const row of chunk) {
        const leadEventId = typeof row.lead_event_id === "string"
          ? row.lead_event_id.trim()
          : "";
        if (!leadEventId) continue;

        const assignedDigits = onlyDigits(row.telefono_asignado ?? "");
        if (!assignedDigits) continue;

        countsByAssigned[assignedDigits] = (countsByAssigned[assignedDigits] ?? 0) + 1;
      }

      if (chunk.length < pageSize) break;
      offset += pageSize;
    }

    setLeadUniqueByAssignedPhone(countsByAssigned);
  }, [isAdmin]);

  const getActivePhonesCount = useCallback(() => {
    return Object.values(phonesByGerencia).reduce((acc, list) => {
      return acc + list.filter((p) => p.status === "active").length;
    }, 0);
  }, [phonesByGerencia]);

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

  // Cuenta regresiva hasta la próxima ejecución real del cron (*/5 en UTC: :00, :05, :10, ...)
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
        setError(`Sync: ${res.status} â€“ ${text}`);
      } else {
        try {
          const json = JSON.parse(text) as {
            plan_cap?: {
              attempted_active?: number;
              allowed_active?: number;
              capped?: boolean;
            } | null;
          };
          const cap = json?.plan_cap;
          if (cap?.capped && Number(cap.attempted_active) > Number(cap.allowed_active)) {
            setPlanCapModal({
              open: true,
              attempted: Number(cap.attempted_active),
              allowed: Number(cap.allowed_active),
            });
          }
        } catch {
          // ignore parse errors and continue normal flow
        }
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
        setError(`Reset: ${res.status} â€“ ${text}`);
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

  const handleDeleteInactive = async () => {
    if (!userId) return;
    const inactiveIds = Object.values(phonesByGerencia)
      .flat()
      .filter((p) => p.status !== "active")
      .map((p) => p.id);
    if (inactiveIds.length === 0) {
      setError("No hay telefonos inactivos para borrar.");
      return;
    }
    const ok = window.confirm(
      `Se borraran ${inactiveIds.length} telefonos inactivos de la base de datos. Esta accion no se puede deshacer. ¿Continuar?`,
    );
    if (!ok) return;
    setGlobalDeletingInactive(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("gerencia_phones")
        .delete()
        .in("id", inactiveIds);
      if (deleteError) throw deleteError;
      await loadData(userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al borrar telefonos inactivos");
    } finally {
      setGlobalDeletingInactive(false);
    }
  };

  const handleFairCriterionChange = async (
    gerenciaId: number,
    criterion: FairCriterion,
  ) => {
    setSwitchingGerenciaId(gerenciaId);
    setError(null);
    const previous = gerencias;
    setGerencias((prev) =>
      prev.map((g) =>
        g.id === gerenciaId ? { ...g, fair_criterion: criterion } : g,
      ),
    );
    try {
      const { error: updateError } = await supabase
        .from("gerencias")
        .update({ fair_criterion: criterion })
        .eq("id", gerenciaId);
      if (updateError) throw updateError;
    } catch (e) {
      setGerencias(previous);
      setError(
        e instanceof Error
          ? e.message
          : "Error al actualizar criterio de equidad",
      );
    } finally {
      setSwitchingGerenciaId(null);
    }
  };

  const handleAddManualPhone = async (gerenciaId: number) => {
    if (!userId) return;
    const phone = onlyDigits(manualPhoneInput[gerenciaId] ?? "");
    if (!phone) {
      setError("Ingresa un telefono valido.");
      return;
    }
    if (!phone.startsWith("549")) {
      setError("El telefono debe comenzar con 549.");
      return;
    }
    if (!isAdmin && maxPhonesAllowed != null) {
      const currentActive = getActivePhonesCount();
      const alreadyActive = (phonesByGerencia[gerenciaId] ?? []).some(
        (p) => onlyDigits(p.phone) === phone && p.status === "active",
      );
      if (!alreadyActive && currentActive >= maxPhonesAllowed) {
        setPlanLimitModal({
          open: true,
          message: `No se puede activar/agregar el teléfono porque alcanzaste el límite de tu plan (${maxPhonesAllowed} teléfonos activos).`,
        });
        return;
      }
    }
    setManualSavingGerenciaId(gerenciaId);
    setError(null);
    try {
      const kind = manualPhoneKind[gerenciaId] ?? "carga";
      const rows = [{
        gerencia_id: gerenciaId,
        phone,
        status: "active",
        kind,
        comment: "",
        last_seen_at: new Date().toISOString(),
      }];
      const { error: upsertError } = await supabase
        .from("gerencia_phones")
        .upsert(rows, { onConflict: "gerencia_id,phone" });
      if (upsertError) throw upsertError;
      setManualPhoneInput((prev) => ({ ...prev, [gerenciaId]: "" }));
      setManualModalGerenciaId(null);
      await loadData(userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar telefono manual.");
    } finally {
      setManualSavingGerenciaId(null);
    }
  };

  const handleManualStatusToggle = async (row: GerenciaPhoneRow) => {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    if (!isAdmin && nextStatus === "active" && maxPhonesAllowed != null) {
      const currentActive = getActivePhonesCount();
      if (currentActive >= maxPhonesAllowed) {
        setPlanLimitModal({
          open: true,
          message: `No se puede activar el teléfono porque alcanzaste el límite de tu plan (${maxPhonesAllowed} teléfonos activos).`,
        });
        return;
      }
    }
    setError(null);
    const { error: updateError } = await supabase
      .from("gerencia_phones")
      .update({ status: nextStatus })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPhonesByGerencia((prev) => {
      const list = prev[row.gerencia_id] ?? [];
      return {
        ...prev,
        [row.gerencia_id]: list.map((x) =>
          x.id === row.id ? { ...x, status: nextStatus } : x,
        ),
      };
    });
  };

  const handleManualCommentSave = async (row: GerenciaPhoneRow, value: string) => {
    const trimmed = value.trim();
    if ((row.comment ?? "") === trimmed) return;
    setError(null);
    const { error: updateError } = await supabase
      .from("gerencia_phones")
      .update({ comment: trimmed })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPhonesByGerencia((prev) => {
      const list = prev[row.gerencia_id] ?? [];
      return {
        ...prev,
        [row.gerencia_id]: list.map((x) =>
          x.id === row.id ? { ...x, comment: trimmed } : x,
        ),
      };
    });
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
      {backLink && backLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a
            href={backLink}
            className="text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            â† {backLabel}
          </a>
        </div>
      ) : null}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Historial de teléfonos por gerencia. Sincroniza y reinicia contadores por
          gerencia o en bloque.
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-400">
            Todas las gerencias:
          </span>
          {(() => {
            const hasPbadmin = gerencias.some((g) => (g.source_type ?? "pbadmin") === "pbadmin");
            return (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSync(null)}
              disabled={globalSyncing || !hasPbadmin}
              title="Trae/actualiza los teléfonos disponibles desde el panel de PB admin para todas las gerencias."
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
            >
              {globalSyncing ? "Sincronizando..." : "Sincronizar"}
            </button>
            <button
              type="button"
              onClick={() => void handleReset(null)}
              disabled={globalResetting || !gerencias.length}
              title="Reinicia a 0 el contador de uso de teléfonos en todas las gerencias."
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
            >
              {globalResetting ? "Reiniciando..." : "Reiniciar contadores"}
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteInactive()}
              disabled={globalDeletingInactive || !gerencias.length}
              title="Borra de forma permanente los telefonos inactivos de todas las gerencias."
              className="rounded-lg border border-red-700 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-900/35 disabled:opacity-60"
            >
              {globalDeletingInactive ? "Borrando..." : "Borrar telefonos inactivos"}
            </button>
          </div>
            );
          })()}
        </div>
      </div>

      {gerencias.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No tienes gerencias. Crea una en{" "}
          <Link
            href={(backLink ?? "").includes("admin") ? "/admin/gerencias" : "/dashboard/gerencias"}
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
            const isPbadminSource = (g.source_type ?? "pbadmin") === "pbadmin";
            const hasPhones = phones.length > 0;
            const allInactive = hasPhones && phones.every((p) => p.status !== "active");
            const totalMessages = phones.reduce(
              (acc, p) =>
                acc + (leadUniqueByAssignedPhone[onlyDigits(p.phone)] ?? 0),
              0,
            );
            const isOpen = openGerenciaId === g.id;
            const syncing = syncingGerenciaId === g.id;
            const resetting = resettingGerenciaId === g.id;
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
                  className="grid w-full grid-cols-1 items-center gap-2 px-4 py-3 text-left hover:bg-zinc-800/50 md:grid-cols-[420px_180px_220px_20px]"
                >
                  <div className="grid items-center gap-2 md:w-[420px] md:grid-cols-[260px_68px_74px]">
                    <span className="font-medium text-zinc-200">
                      {g.nombre} {g.gerencia_id ? `(ID ${g.gerencia_id})` : ""}
                    </span>
                    <span className="inline-flex w-fit rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300">
                      {(g.source_type ?? "pbadmin") === "manual" ? "Manual" : "PBadmin"}
                    </span>
                    <span className="text-xs text-zinc-500 md:text-right">
                      {phones.length} registro{phones.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 md:text-right">
                    Contador: {totalUsage}
                  </div>
                  <div className="text-xs text-zinc-500 md:text-right">
                    Mensajes recibidos: {totalMessages}
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform justify-self-end ml-auto ${isOpen ? "rotate-180" : ""}`}
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
                        title="La distribución equitativa toma como criterio de reparto el contador por número."
                        className={`rounded-lg border px-2 py-1 text-xs font-medium transition disabled:opacity-60 ${
                          (g.fair_criterion ?? "usage_count") === "usage_count"
                            ? "border-zinc-600 bg-zinc-700 text-zinc-100"
                            : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
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
                        title="La distribución equitativa toma como criterio de reparto los mensajes recibidos por número."
                        className={`rounded-lg border px-2 py-1 text-xs font-medium transition disabled:opacity-60 ${
                          (g.fair_criterion ?? "usage_count") === "messages_received"
                            ? "border-zinc-600 bg-zinc-700 text-zinc-100"
                            : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                        }`}
                      >
                        Mensajes recibidos
                      </button>
                      <div className="ml-auto flex flex-wrap gap-2">
                        {isPbadminSource ? (
                          <button
                            type="button"
                            onClick={() => void handleSync(g.id)}
                            disabled={syncing}
                            title="Trae/actualiza los teléfonos disponibles desde el panel de PB admin para esta gerencia."
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
                          >
                            {syncing ? "Sincronizando..." : "Sincronizar"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleReset(g.id)}
                          disabled={resetting}
                          title="Reinicia a 0 el contador de uso de teléfonos de esta gerencia."
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
                        >
                          {resetting ? "Reiniciando..." : "Reiniciar contador"}
                        </button>
                      </div>
                    </div>
                    {isPbadminSource && allInactive ? (
                      <div className="mb-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
                        Sin managers activos detectados para esta gerencia en la última sincronización.
                      </div>
                    ) : null}
                    {(g.source_type ?? "pbadmin") === "manual" ? (
                      <div className="mb-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setManualModalGerenciaId(g.id)}
                          className="rounded-lg border border-emerald-700 bg-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/35"
                        >
                          AÑADIR TELÉFONOS
                        </button>
                      </div>
                    ) : null}
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
                              {(g.source_type ?? "pbadmin") === "manual" ? "Comentario" : "Última sincronización"}
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
                                {(g.source_type ?? "pbadmin") === "manual"
                                  ? "Sin registros. Usa AÑADIR TELÉFONOS para cargar números."
                                  : "Sin registros. Usa Sincronizar para traer números."}
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
                                  {(g.source_type ?? "pbadmin") === "manual" ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleManualStatusToggle(p)}
                                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                                        p.status === "active" ? "bg-emerald-500/70" : "bg-zinc-700"
                                      }`}
                                      title={p.status === "active" ? "Activo (visible en landing)" : "Inactivo (oculto en landing)"}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                          p.status === "active" ? "translate-x-5" : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  ) : (
                                    <span
                                      className={
                                        p.status === "active"
                                          ? "text-emerald-400"
                                          : "text-zinc-500"
                                      }
                                    >
                                      {formatStatus(p.status)}
                                    </span>
                                  )}
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
                                  {(g.source_type ?? "pbadmin") === "manual" ? (
                                    <input
                                      type="text"
                                      defaultValue={p.comment ?? ""}
                                      onBlur={(e) => void handleManualCommentSave(p, e.target.value)}
                                      placeholder="Comentario"
                                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                                    />
                                  ) : p.last_seen_at ? (
                                    new Date(p.last_seen_at).toLocaleString()
                                  ) : (
                                    "â€”"
                                  )}
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

      {manualModalGerenciaId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Añadir teléfonos</h3>
              <button
                type="button"
                onClick={() => setManualModalGerenciaId(null)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Teléfono (debe iniciar con 549)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualPhoneInput[manualModalGerenciaId] ?? ""}
                  onChange={(e) =>
                    setManualPhoneInput((prev) => ({
                      ...prev,
                      [manualModalGerenciaId]: e.target.value,
                    }))
                  }
                  placeholder="5493511234567"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400">Tipo</label>
                <select
                  value={manualPhoneKind[manualModalGerenciaId] ?? "carga"}
                  onChange={(e) =>
                    setManualPhoneKind((prev) => ({
                      ...prev,
                      [manualModalGerenciaId]: e.target.value as "carga" | "ads" | "mkt",
                    }))
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="carga">carga</option>
                  <option value="ads">ads</option>
                  <option value="mkt">mkt</option>
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleAddManualPhone(manualModalGerenciaId)}
                  disabled={manualSavingGerenciaId === manualModalGerenciaId}
                  className="rounded-lg border border-emerald-700 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                >
                  {manualSavingGerenciaId === manualModalGerenciaId ? "Guardando..." : "Guardar teléfono"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {planCapModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-100">Límite de teléfonos del plan</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Intentaste sincronizar <span className="font-semibold">{planCapModal.attempted}</span> teléfonos activos,
              pero tu plan permite <span className="font-semibold">{planCapModal.allowed}</span>. Se mantuvieron activos
              solo los permitidos por plan y el resto quedó inactivo.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPlanCapModal({ open: false, attempted: 0, allowed: 0 })}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {planLimitModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-100">Límite de teléfonos del plan</h3>
            <p className="mt-2 text-sm text-zinc-300">{planLimitModal.message}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPlanLimitModal({ open: false, message: "" })}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


