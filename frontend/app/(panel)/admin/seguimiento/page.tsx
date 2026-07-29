"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversionsForAdmin,
  fetchConversionsConfig,
  upsertConversionsConfig,
  getTrackingRankingConfig,
  setTrackingRankingConfig,
  type ConversionsConfig,
  type TrackingRankingConfig,
  type ConversionRow,
} from "@/lib/conversionsDb";
import { DashboardSkeleton, PanelSkeleton } from "@/components/ui/DashboardSkeleton";
import { PageHeader } from "@/components/ui/PanelPrimitives";
import DateRangeFilter, {
  type DateRange,
  filterByDateRange,
} from "@/components/conversiones/DateRangeFilter";
import {
  SingleCurrencyRequired,
  useCurrencyScope,
} from "@/components/currency/CurrencyScope";
import {
  CURRENCY_ALL,
  filterConversionsByCurrency,
} from "@/lib/currency";

const TrackingBoard = dynamic(() => import("@/components/conversiones/TrackingBoard"), {
  loading: () => <PanelSkeleton title="Cargando seguimiento..." />,
});

export default function AdminSeguimientoPage() {
  const { currencyScope } = useCurrencyScope();
  const reportingCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;
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
    () => filterByDateRange(filterConversionsByCurrency(conversions, currencyScope), dateRange),
    [conversions, dateRange, currencyScope],
  );

  const refreshTable = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const rows = await fetchConversionsForAdmin();
      setConversions(rows);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const [rows, cfg] = await Promise.all([
          fetchConversionsForAdmin(),
          fetchConversionsConfig(user.id),
        ]);
        setConversions(rows);
        setConfig(cfg);

        const { data: gerencias } = await supabase
          .from("gerencias")
          .select("id, nombre, gerencia_id")
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
      if (!config) return;
      const next = setTrackingRankingConfig(config, reportingCurrency, rankingConfig);
      setConfig(next);
      try {
        await upsertConversionsConfig(next);
      } catch (e) {
        console.error(e);
      }
    },
    [config, reportingCurrency],
  );

  if (loading) {
    return <DashboardSkeleton title="Cargando seguimiento..." />;
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Retención global"
        title="Seguimiento"
        description="Monitoreá jugadores, actividad reciente y señales de retención."
      />

      <div className="flex justify-end">
        <DateRangeFilter onChange={setDateRange} />
      </div>

      {currencyScope === CURRENCY_ALL ? (
        <SingleCurrencyRequired title="Elegí ARS o PYG para ver el seguimiento monetario" />
      ) : (
        <TrackingBoard
          conversions={activeConversions}
          onRefresh={refreshTable}
          refreshing={refreshing}
          rankingConfig={getTrackingRankingConfig(config, reportingCurrency)}
          onRankingConfigChange={handleRankingConfigChange}
          gerenciaOptions={gerenciaOptions}
          assignedPhoneToGerenciaId={assignedPhoneToGerenciaId}
          currency={reportingCurrency}
        />
      )}
    </div>
  );
}
