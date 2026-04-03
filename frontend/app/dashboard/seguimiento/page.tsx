"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversions,
  fetchConversionsConfig,
  upsertConversionsConfig,
  type ConversionsConfig,
  type TrackingRankingConfig,
  type ConversionRow,
} from "@/lib/conversionsDb";
import TrackingBoard from "@/components/conversiones/TrackingBoard";
import DateRangeFilter, {
  type DateRange,
  filterByDateRange,
} from "@/components/conversiones/DateRangeFilter";

export default function DashboardSeguimientoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [gerenciaOptions, setGerenciaOptions] = useState<
    { id: number; label: string }[]
  >([]);
  const [assignedPhoneToGerenciaId, setAssignedPhoneToGerenciaId] = useState<
    Record<string, number>
  >({});

  const activeConversions = useMemo(
    () => filterByDateRange(conversions, dateRange),
    [conversions, dateRange],
  );

  const refreshTable = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const rows = await fetchConversions(userId);
      setConversions(rows);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  const handleDeletePhone = useCallback(
    async (phone: string) => {
      if (!userId) return;
      const cleanPhone = String(phone || "").replace(/\D/g, "");
      if (!cleanPhone) return;

      const { data: ownRows, error: ownRowsError } = await supabase
        .from("conversions")
        .select("id, phone")
        .eq("user_id", userId);
      if (ownRowsError) throw ownRowsError;

      const idsToDelete = (ownRows ?? [])
        .filter((r) => String(r.phone ?? "").replace(/\D/g, "") === cleanPhone)
        .map((r) => r.id)
        .filter(Boolean);

      if (idsToDelete.length === 0) return;

      const { error: delConvError } = await supabase
        .from("conversions")
        .delete()
        .in("id", idsToDelete);
      if (delConvError) throw delConvError;

      // Best effort: si falla por permisos/RLS no debe bloquear el borrado principal.
      const { error: delAlertsError } = await supabase
        .from("notification_contact_alerts")
        .delete()
        .eq("user_id", userId)
        .eq("phone", cleanPhone);
      if (delAlertsError) {
        console.warn("No se pudo limpiar notification_contact_alerts:", delAlertsError.message);
      }

      await refreshTable();
    },
    [userId, refreshTable],
  );

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const [rows, cfg] = await Promise.all([
          fetchConversions(user.id),
          fetchConversionsConfig(user.id),
        ]);
        setConversions(rows);
        setConfig(cfg);

        const { data: gerencias } = await supabase
          .from("gerencias")
          .select("id, nombre, gerencia_id")
          .eq("user_id", user.id)
          .order("nombre", { ascending: true });
        const options = (gerencias ?? []).map((g) => ({
          id: Number(g.id),
          label: `${g.nombre} (ID ${g.gerencia_id})`,
        }));
        setGerenciaOptions(options);

        const gerenciaIds = (gerencias ?? []).map((g) => Number(g.id)).filter(Boolean);
        if (gerenciaIds.length > 0) {
          const { data: phones } = await supabase
            .from("gerencia_phones")
            .select("gerencia_id, phone")
            .in("gerencia_id", gerenciaIds);
          const map: Record<string, number> = {};
          for (const p of phones ?? []) {
            const digits = String(p.phone ?? "").replace(/\D/g, "");
            if (!digits) continue;
            map[digits] = Number(p.gerencia_id);
          }
          setAssignedPhoneToGerenciaId(map);
        } else {
          setAssignedPhoneToGerenciaId({});
        }
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const handleRankingConfigChange = useCallback(
    async (rankingConfig: TrackingRankingConfig) => {
      if (!userId || !config) return;
      const next = { ...config, tracking_ranking_config: rankingConfig };
      setConfig(next);
      try {
        await upsertConversionsConfig(next);
      } catch (e) {
        console.error(e);
      }
    },
    [userId, config],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">SEGUIMIENTO</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Seguimiento de jugadores y actividad reciente.
        </p>
      </div>

      <div className="flex justify-end">
        <DateRangeFilter onChange={setDateRange} />
      </div>

      <TrackingBoard
        conversions={activeConversions}
        onRefresh={refreshTable}
        refreshing={refreshing}
        rankingConfig={config?.tracking_ranking_config ?? null}
        onRankingConfigChange={handleRankingConfigChange}
        onDeletePhone={handleDeletePhone}
        gerenciaOptions={gerenciaOptions}
        assignedPhoneToGerenciaId={assignedPhoneToGerenciaId}
      />
    </div>
  );
}
