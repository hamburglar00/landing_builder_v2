"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import type { Gerencia } from "@/lib/gerencias/types";
import { fetchGerencias, fetchGerenciasForAdmin } from "@/lib/gerencias/gerenciasDb";
import type { PhoneKind } from "@/lib/landing/types";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { PageHeader } from "@/components/ui/PanelPrimitives";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import CustomSelect from "@/components/ui/CustomSelect";
import ModalPortal from "@/components/ui/ModalPortal";
import { CURRENCY_ALL } from "@/lib/currency";
import { SingleCurrencyRequired, useCurrencyScope } from "@/components/currency/CurrencyScope";

export type GerenciaPhoneRow = {
  id: number;
  gerencia_id: number;
  phone: string;
  status: string;
  source_available?: boolean;
  usage_count: number;
  kind: string;
  assignment_role?: AssignmentRole | null;
  comment: string;
  messages_reset_at: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

type FairCriterion = "usage_count" | "messages_received";
type AssignmentRole = "acquisition" | "follow_up";

const PHONE_KIND_OPTIONS: PhoneKind[] = ["carga", "assistant", "ads", "mkt"];
const PHONE_KIND_LABELS: Record<PhoneKind, string> = {
  carga: "carga",
  ads: "ads",
  mkt: "mkt",
  assistant: "asistente",
};
const ASSIGNMENT_ROLE_OPTIONS: AssignmentRole[] = ["acquisition", "follow_up"];
const ASSIGNMENT_ROLE_LABELS: Record<AssignmentRole, string> = {
  acquisition: "WhatsApp publicitario",
  follow_up: "WhatsApp de venta",
};

const getAssignmentRole = (row: GerenciaPhoneRow): AssignmentRole =>
  row.assignment_role === "follow_up" ? "follow_up" : "acquisition";

type Props = {
  backLink?: string;
  backLabel?: string;
  title?: string;
  /** Si true, se listan todas las gerencias (admin): propias primero, luego de clientes. */
  isAdmin?: boolean;
};

type PhoneMetricRow = {
  gerencia_phone_id: number;
  messages_received: number;
  messages_received_historical: number;
  calculated_at: string;
};

type PhoneMetricSummary = {
  messagesReceived: number;
  messagesReceivedHistorical: number;
  calculatedAt: string;
};

const formatPhone = (raw: string) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("595")) {
    return `595 ${digits.slice(3, 6)} ${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

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

const formatPhoneAvailabilityStatus = (row: GerenciaPhoneRow) => {
  if (row.source_available === false) return "no disponible";
  return formatStatus(row.status);
};

const onlyDigits = (raw: string) => raw.replace(/\D/g, "");

const normalizePhoneForWorkspace = (raw: string, workspaceCurrency: string): string | null => {
  const digits = onlyDigits(raw);
  if (workspaceCurrency === "PYG") {
    return digits.startsWith("595") && digits.length === 12 ? digits : null;
  }
  return digits.startsWith("549") && digits.length === 13 ? digits : null;
};

const phoneHelpForWorkspace = (workspaceCurrency: string) =>
  workspaceCurrency === "PYG" ? "595973123456" : "5493511234567";

export function TelefonosPageContent({
  backLink,
  backLabel,
  title = "Teléfonos",
  isAdmin = false,
}: Props) {
  const confirmAction = useAppConfirm();
  const { currencyScope, isAllCurrencies } = useCurrencyScope();
  const workspaceCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [phonesByGerencia, setPhonesByGerencia] = useState<
    Record<number, GerenciaPhoneRow[]>
  >({});
  const [phoneMetricsById, setPhoneMetricsById] = useState<
    Record<number, PhoneMetricSummary>
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
  const [resettingMessagesGerenciaId, setResettingMessagesGerenciaId] = useState<number | null>(
    null,
  );
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [globalResetting, setGlobalResetting] = useState(false);
  const [globalResettingMessages, setGlobalResettingMessages] = useState(false);
  const [globalDeletingInactive, setGlobalDeletingInactive] = useState(false);
  const [autoResetDaily, setAutoResetDaily] = useState(false);
  const [autoResetSaving, setAutoResetSaving] = useState(false);
  const [switchingGerenciaId, setSwitchingGerenciaId] = useState<number | null>(null);
  const [openGerenciaId, setOpenGerenciaId] = useState<number | null>(null);
  const [gerenciaSearch, setGerenciaSearch] = useState("");
  const [showOnlyActiveGerencias, setShowOnlyActiveGerencias] = useState(false);
  const [nextSyncCountdown, setNextSyncCountdown] = useState<string>("--:--");
  const [manualPhoneInput, setManualPhoneInput] = useState<Record<number, string>>({});
  const [manualPhoneKind, setManualPhoneKind] = useState<Record<number, PhoneKind>>({});
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

      const { data: config, error: configError } = await supabase
        .from("conversions_config")
        .select("phone_auto_reset_daily")
        .eq("user_id", uid)
        .maybeSingle();
      if (configError) throw configError;
      setAutoResetDaily(Boolean(config?.phone_auto_reset_daily));
    } else {
      setMaxPhonesAllowed(null);
      setAutoResetDaily(false);
    }

    const listRaw = isAdmin
      ? await fetchGerenciasForAdmin(uid, workspaceCurrency)
      : await fetchGerencias(uid, workspaceCurrency);
    const list = [...listRaw].sort((a, b) => {
      const byName = a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
      if (byName !== 0) return byName;
      return Number(a.gerencia_id ?? a.id) - Number(b.gerencia_id ?? b.id);
    });
    setGerencias(list);
    if (list.length === 0) {
      setPhonesByGerencia({});
      return;
    }
    const ids = list.map((g) => g.id);
    const { data: phones, error: phonesError } = await supabase
      .from("gerencia_phones")
      .select(
        "id, gerencia_id, phone, status, source_available, usage_count, kind, assignment_role, comment, messages_reset_at, last_seen_at, created_at, updated_at",
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

    const phoneIds = (phones ?? [])
      .map((phone) => Number((phone as GerenciaPhoneRow).id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (phoneIds.length === 0) {
      setPhoneMetricsById({});
      return;
    }

    const { data: metricsRows, error: metricsError } = await supabase
      .from("phone_metrics")
      .select("gerencia_phone_id, messages_received, messages_received_historical, calculated_at")
      .in("gerencia_phone_id", phoneIds);
    if (metricsError) throw metricsError;

    const metricsById: Record<number, PhoneMetricSummary> = {};
    for (const metric of (metricsRows ?? []) as PhoneMetricRow[]) {
      const id = Number(metric.gerencia_phone_id);
      if (!Number.isFinite(id)) continue;
      metricsById[id] = {
        messagesReceived: Number(metric.messages_received) || 0,
        messagesReceivedHistorical: Number(metric.messages_received_historical) || 0,
        calculatedAt: String(metric.calculated_at ?? ""),
      };
    }
    setPhoneMetricsById(metricsById);
  }, [isAdmin, workspaceCurrency]);

  const getActivePhonesCount = useCallback(() => {
    return Object.values(phonesByGerencia).reduce((acc, list) => {
      return acc + list.filter((p) => p.status === "active" && getAssignmentRole(p) === "acquisition").length;
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

  const handleResetMessages = async (gerenciaId: number | null) => {
    if (!userId || !base) return;
    if (gerenciaId !== null) setResettingMessagesGerenciaId(gerenciaId);
    else setGlobalResettingMessages(true);
    setError(null);
    try {
      const res = await fetch(`${base}/functions/v1/reset-phone-messages`, {
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
        setError(`Reset mensajes: ${res.status} - ${text}`);
      } else {
        await loadData(userId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al reiniciar mensajes");
    } finally {
      if (gerenciaId !== null) setResettingMessagesGerenciaId(null);
      else setGlobalResettingMessages(false);
    }
  };

  const handleAutoResetToggle = async () => {
    if (!userId || isAdmin) return;
    const next = !autoResetDaily;
    const previous = autoResetDaily;
    setAutoResetDaily(next);
    setAutoResetSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("conversions_config")
        .upsert(
          {
            user_id: userId,
            phone_auto_reset_daily: next,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (updateError) throw updateError;
    } catch (e) {
      setAutoResetDaily(previous);
      setError(e instanceof Error ? e.message : "Error al actualizar reinicio automatico");
    } finally {
      setAutoResetSaving(false);
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
    const ok = await confirmAction({
      title: "Eliminar teléfonos inactivos",
      description: `Se eliminarán ${inactiveIds.length} teléfonos inactivos de la base de datos. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar teléfonos",
      danger: true,
    });
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
    const phone = normalizePhoneForWorkspace(manualPhoneInput[gerenciaId] ?? "", workspaceCurrency);
    if (!phone) {
      setError(
        workspaceCurrency === "PYG"
          ? "El telefono debe comenzar con 595 y tener 12 digitos."
          : "El telefono debe comenzar con 549 y tener 13 digitos.",
      );
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
        source_available: true,
        kind,
        assignment_role: "acquisition",
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
    if (nextStatus === "active" && row.source_available === false) {
      setPlanLimitModal({
        open: true,
        message: "No se puede activar este teléfono porque la API externa ya no lo devuelve para esta gerencia.",
      });
      return;
    }
    if (
      !isAdmin &&
      nextStatus === "active" &&
      getAssignmentRole(row) === "acquisition" &&
      maxPhonesAllowed != null
    ) {
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

  const handleAssignmentRoleChange = async (
    row: GerenciaPhoneRow,
    nextRole: AssignmentRole,
  ) => {
    const currentRole = getAssignmentRole(row);
    if (currentRole === nextRole) return;
    if (
      !isAdmin &&
      row.status === "active" &&
      nextRole === "acquisition" &&
      maxPhonesAllowed != null &&
      getActivePhonesCount() >= maxPhonesAllowed
    ) {
      setPlanLimitModal({
        open: true,
        message: `No se puede marcar como WhatsApp publicitario porque alcanzaste el limite de tu plan (${maxPhonesAllowed} telefonos publicitarios activos).`,
      });
      return;
    }
    setError(null);
    const { error: updateError } = await supabase
      .from("gerencia_phones")
      .update({ assignment_role: nextRole })
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
          x.id === row.id ? { ...x, assignment_role: nextRole } : x,
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
    return <DashboardSkeleton title="Cargando teléfonos..." />;
  }

  if (isAllCurrencies) {
    return <SingleCurrencyRequired title="Elegí ARS o PYG para administrar teléfonos" />;
  }

  const normalizedGerenciaSearch = gerenciaSearch.trim().toLowerCase();
  const normalizedPhoneSearch = onlyDigits(gerenciaSearch);
  const gerenciaHasActivePhone = (g: Gerencia) =>
    (phonesByGerencia[g.id] ?? []).some(
      (p) => p.status === "active" && p.source_available !== false,
    );
  const activeGerenciasCount = gerencias.filter(gerenciaHasActivePhone).length;
  const filteredGerencias = gerencias.filter((g) => {
    if (showOnlyActiveGerencias && !gerenciaHasActivePhone(g)) return false;
    if (!normalizedGerenciaSearch) return true;
    const id = String(g.gerencia_id ?? g.id ?? "").toLowerCase();
    const internalId = String(g.id ?? "").toLowerCase();
    const name = String(g.nombre ?? "").toLowerCase();
    const phones = phonesByGerencia[g.id] ?? [];
    const hasPhoneMatch =
      normalizedPhoneSearch.length > 0 &&
      phones.some((p) => onlyDigits(p.phone).includes(normalizedPhoneSearch));
    return (
      name.includes(normalizedGerenciaSearch) ||
      id.includes(normalizedGerenciaSearch) ||
      internalId.includes(normalizedGerenciaSearch) ||
      hasPhoneMatch
    );
  });
  const latestPhoneMetricsAt = Object.values(phoneMetricsById).reduce((latest, metric) => {
    const timestamp = Date.parse(metric.calculatedAt);
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
  const phoneMetricsLabel = latestPhoneMetricsAt > 0
    ? new Date(latestPhoneMetricsAt).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    })
    : "";

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
      <PageHeader
        eyebrow="Operación"
        title={title}
        description={
          <>
            Historial de teléfonos por gerencia. Sincronizá y reiniciá contadores por gerencia o en bloque.
            <span className="mt-1 block text-[11px] text-[var(--color-text-disabled)]">
          {isAdmin
            ? "Próxima sincronización automática (cron):"
            : "Próxima sincronización automática:"}{" "}
              <span className="font-mono text-[var(--color-text)]">{nextSyncCountdown}</span>
            </span>
            <span className="mt-1 block text-[11px] text-[var(--color-text-disabled)]">
              Métricas de mensajes calculadas por backend cada 30 min
              {phoneMetricsLabel ? ` · última actualización ${phoneMetricsLabel}` : ""}.
            </span>
          </>
        }
      />

      {error && (
        <p
          className="ui-alert border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.07)] text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Botones globales */}
      <div className="ui-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <span className="text-xs font-medium text-zinc-400">
            Todas las gerencias:
          </span>
          <input
            value={gerenciaSearch}
            onChange={(e) => setGerenciaSearch(e.target.value)}
            placeholder="Buscar por gerencia, ID o phone..."
            aria-label="Buscar gerencia por nombre, ID o phone"
            className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 lg:max-w-xs"
          />
          {(() => {
            const hasPbadmin = gerencias.some((g) => (g.source_type ?? "pbadmin") === "pbadmin");
            return (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOnlyActiveGerencias((prev) => !prev)}
              aria-pressed={showOnlyActiveGerencias}
              title={
                showOnlyActiveGerencias
                  ? "Volver a mostrar todas las gerencias."
                  : "Mostrar solo gerencias que tienen al menos un teléfono activo."
              }
              className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${
                showOnlyActiveGerencias
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                  : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              <span>{showOnlyActiveGerencias ? "Mostrando activas" : "Solo activas"}</span>
              <span className="text-[10px] text-zinc-400">
                {activeGerenciasCount}/{gerencias.length}
              </span>
            </button>
            {!isAdmin ? (
              <button
                type="button"
                onClick={() => void handleAutoResetToggle()}
                disabled={autoResetSaving}
                aria-pressed={autoResetDaily}
                title="Si esta activo, todos los dias a las 00:00 se reinician Contador y Mensajes operativos. No borra historicos."
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
              >
                <span>Auto 00:00</span>
                <span className="text-[10px] text-zinc-500">
                  {autoResetDaily ? "On" : "Off"}
                </span>
                <span
                  className={`relative inline-flex h-4 w-7 rounded-full border transition ${
                    autoResetDaily
                      ? "border-cyan-400/60 bg-cyan-500/30"
                      : "border-zinc-600 bg-zinc-900"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition ${
                      autoResetDaily
                        ? "left-3.5 bg-cyan-300"
                        : "left-0.5 bg-zinc-400"
                    }`}
                  />
                </span>
              </button>
            ) : null}
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
              onClick={() => void handleResetMessages(null)}
              disabled={globalResettingMessages || !gerencias.length}
              title="Reinicia el conteo operativo de mensajes recibidos sin borrar el historico de conversiones."
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
            >
              {globalResettingMessages ? "Reiniciando..." : "Reiniciar mensajes"}
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
          {filteredGerencias.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-6 text-center text-sm text-zinc-500">
              {showOnlyActiveGerencias
                ? "No hay gerencias con teléfonos activos para mostrar."
                : "No hay gerencias que coincidan con la búsqueda."}
            </div>
          ) : null}
          {filteredGerencias.map((g) => {
            const phones = phonesByGerencia[g.id] ?? [];
            const activePhonesCount = phones.filter(
              (p) => p.status === "active" && getAssignmentRole(p) === "acquisition",
            ).length;
            const totalUsage = phones.reduce(
              (acc, p) => acc + (Number(p.usage_count) || 0),
              0,
            );
            const isPbadminSource = (g.source_type ?? "pbadmin") === "pbadmin";
            const hasPhones = phones.length > 0;
            const allUnavailableFromSource =
              hasPhones && isPbadminSource && phones.every((p) => p.source_available === false);
            const totalMessages = phones.reduce(
              (acc, p) =>
                acc + (phoneMetricsById[p.id]?.messagesReceived ?? 0),
              0,
            );
            const totalHistoricalMessages = phones.reduce(
              (acc, p) =>
                acc + (phoneMetricsById[p.id]?.messagesReceivedHistorical ?? 0),
              0,
            );
            const isOpen = openGerenciaId === g.id;
            const syncing = syncingGerenciaId === g.id;
            const resetting = resettingGerenciaId === g.id;
            const resettingMessages = resettingMessagesGerenciaId === g.id;
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
                  className="grid w-full grid-cols-1 items-center gap-2 px-4 py-3 text-left hover:bg-zinc-800/50 lg:grid-cols-[minmax(220px,1fr)_72px_110px_92px_150px_105px_20px]"
                >
                  <span className="min-w-0 truncate font-medium text-zinc-200">
                      {g.nombre} {g.gerencia_id ? `(ID ${g.gerencia_id})` : ""}
                  </span>
                  <span className="inline-flex w-fit rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 lg:justify-self-start">
                    {(g.source_type ?? "pbadmin") === "manual" ? "Manual" : "PBadmin"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-500 lg:justify-end">
                    <span
                      className={`h-[9px] w-[9px] rounded-full ${activePhonesCount > 0 ? "bg-emerald-400/80" : "bg-red-400/80"}`}
                      aria-label={activePhonesCount > 0 ? "Tiene WhatsApp publicitarios activos" : "No tiene WhatsApp publicitarios activos"}
                      title={activePhonesCount > 0 ? "Tiene WhatsApp publicitarios activos" : "No tiene WhatsApp publicitarios activos"}
                    />
                    publicitarios: {activePhonesCount}
                  </span>
                  <div className="whitespace-nowrap text-xs text-zinc-500 lg:text-right">
                    Contador: {totalUsage}
                  </div>
                  <div className="whitespace-nowrap text-xs text-zinc-500 lg:text-right">
                    Mensajes recibidos: {totalMessages}
                  </div>
                  <div className="whitespace-nowrap text-xs text-zinc-500 lg:text-right">
                    Histórico: {totalHistoricalMessages}
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 justify-self-end text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
                        <button
                          type="button"
                          onClick={() => void handleResetMessages(g.id)}
                          disabled={resettingMessages}
                          title="Reinicia el conteo operativo de mensajes recibidos de esta gerencia sin borrar conversiones."
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-60"
                        >
                          {resettingMessages ? "Reiniciando..." : "Reiniciar mensajes"}
                        </button>
                      </div>
                    </div>
                    {allUnavailableFromSource ? (
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
                      <table className="min-w-[980px] text-left text-sm md:min-w-full">
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
                              Uso
                            </th>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Contador
                            </th>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Mensajes recibidos
                            </th>
                            <th className="px-3 py-2 font-medium text-zinc-300">
                              Mensajes recibidos históricos
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
                                colSpan={8}
                                className="px-3 py-4 text-center text-zinc-500"
                              >
                                {(g.source_type ?? "pbadmin") === "manual"
                                  ? "Sin registros. Usa AÑADIR TELÉFONOS para cargar números."
                                  : "Sin registros. Usa Sincronizar para traer números."}
                              </td>
                            </tr>
                          ) : (
                            phones.map((p) => {
                              const canTogglePhoneStatus =
                                (g.source_type ?? "pbadmin") === "manual" ||
                                p.source_available !== false;
                              const assignmentRole = getAssignmentRole(p);

                              return (
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
                                  <div className="flex items-center gap-2">
                                    {canTogglePhoneStatus ? (
                                      <button
                                        type="button"
                                        onClick={() => void handleManualStatusToggle(p)}
                                        className={`relative inline-flex h-3 w-5 items-center rounded-full transition ${
                                          p.status === "active" ? "bg-emerald-500/70" : "bg-zinc-700"
                                        }`}
                                        title={
                                          p.status === "active"
                                            ? "Activo: este telefono puede recibir seguimiento. Si el uso es WhatsApp publicitario, tambien puede ser asignado por publicidad."
                                            : "Inactivo: este telefono queda registrado pero no se usa para asignaciones."
                                        }
                                        aria-pressed={p.status === "active"}
                                      >
                                        <span
                                          className={`inline-block h-2 w-2 transform rounded-full bg-white transition ${
                                            p.status === "active" ? "translate-x-3" : "translate-x-0.5"
                                          }`}
                                        />
                                      </button>
                                    ) : null}
                                    <span
                                      className={
                                        p.status === "active"
                                          ? "text-emerald-400"
                                          : "text-zinc-500"
                                      }
                                    >
                                      {formatPhoneAvailabilityStatus(p)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-zinc-300">
                                  {PHONE_KIND_LABELS[p.kind as PhoneKind] ?? p.kind}
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    value={assignmentRole}
                                    onChange={(e) =>
                                      void handleAssignmentRoleChange(
                                        p,
                                        e.target.value as AssignmentRole,
                                      )
                                    }
                                    className={`min-w-[150px] rounded-lg border px-2 py-1 text-xs font-medium outline-none transition ${
                                      assignmentRole === "follow_up"
                                        ? "border-amber-800/70 bg-amber-950/25 text-amber-200"
                                        : "border-emerald-900/70 bg-emerald-950/20 text-emerald-200"
                                    }`}
                                    title={
                                      assignmentRole === "follow_up"
                                        ? "WhatsApp de venta: queda activo para seguimiento, pero no se asigna en publicidad."
                                        : "WhatsApp publicitario: puede ser elegido por landings, Chatrace y WhatsApp Cloud API."
                                    }
                                  >
                                    {ASSIGNMENT_ROLE_OPTIONS.map((role) => (
                                      <option key={role} value={role}>
                                        {ASSIGNMENT_ROLE_LABELS[role]}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-zinc-300">
                                  {p.usage_count}
                                </td>
                                <td className="px-3 py-2 text-zinc-300">
                                  {phoneMetricsById[p.id]?.messagesReceived ?? 0}
                                </td>
                                <td className="px-3 py-2 text-zinc-300">
                                  {phoneMetricsById[p.id]?.messagesReceivedHistorical ?? 0}
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
                              );
                            })
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
        <ModalPortal>
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
                <label className="mb-1 block text-xs text-zinc-400">
                  Teléfono (debe iniciar con {workspaceCurrency === "PYG" ? "595" : "549"})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualPhoneInput[manualModalGerenciaId] ?? ""}
                  onChange={(e) =>
                    setManualPhoneInput((prev) => ({
                      ...prev,
                      [manualModalGerenciaId]: onlyDigits(e.target.value),
                    }))
                  }
                  placeholder={phoneHelpForWorkspace(workspaceCurrency)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              <CustomSelect
                label="Tipo"
                value={manualPhoneKind[manualModalGerenciaId] ?? "carga"}
                options={PHONE_KIND_OPTIONS.map((kind) => ({
                  value: kind,
                  label: PHONE_KIND_LABELS[kind],
                }))}
                onChange={(nextValue) =>
                  setManualPhoneKind((prev) => ({
                    ...prev,
                    [manualModalGerenciaId]: nextValue as PhoneKind,
                  }))
                }
                buttonClassName="h-10 px-3 py-2 text-sm"
              />

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
        </ModalPortal>
      )}

      {planCapModal.open ? (
        <ModalPortal>
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
        </ModalPortal>
      ) : null}

      {planLimitModal.open ? (
        <ModalPortal>
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
        </ModalPortal>
      ) : null}
    </div>
  );
}


