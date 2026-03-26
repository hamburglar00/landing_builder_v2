"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversionsForAdminFiltered,
  type ConversionRow,
} from "@/lib/conversionsDb";
import TrackingBoard from "@/components/conversiones/TrackingBoard";
import DateRangeFilter, {
  type DateRange,
  filterByDateRange,
} from "@/components/conversiones/DateRangeFilter";

export default function AdminSeguimientoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const activeConversions = useMemo(
    () => filterByDateRange(conversions, dateRange),
    [conversions, dateRange],
  );

  const refreshTable = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const rows = await fetchConversionsForAdminFiltered(userId);
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
        const rows = await fetchConversionsForAdminFiltered(user.id);
        setConversions(rows);
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

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

      <DateRangeFilter onChange={setDateRange} />

      <TrackingBoard
        conversions={activeConversions}
        onRefresh={refreshTable}
        refreshing={refreshing}
      />
    </div>
  );
}
