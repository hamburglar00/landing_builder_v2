"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { HomeOverviewStats } from "@/lib/conversionsDb";
import {
  fetchConversionsConfig,
  fetchConversionsForAdminFiltered,
  getPremiumThreshold,
} from "@/lib/conversionsDb";
import { computeHomeOverviewStatsFromConversions } from "@/lib/conversionStats";
import { fetchLandingsForAdmin } from "@/lib/landing/landingsDb";
import { HomeOverview } from "@/components/conversiones/HomeOverview";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import {
  SingleCurrencyRequired,
  useCurrencyScope,
} from "@/components/currency/CurrencyScope";
import { CURRENCY_ALL, filterConversionsByCurrency } from "@/lib/currency";

function currentMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: now,
  };
}

export default function AdminInicioPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewStats, setOverviewStats] = useState<HomeOverviewStats | null>(null);
  const { currencyScope, isAllCurrencies } = useCurrencyScope();
  const reportingCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;

  useEffect(() => {
    const init = async () => {
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("Sesión no válida");
          setReady(true);
          return;
        }

        const range = currentMonthRange();
        const [{ mine, clients }, convs, cfg] = await Promise.all([
          fetchLandingsForAdmin(user.id, reportingCurrency),
          fetchConversionsForAdminFiltered(user.id, undefined, range),
          fetchConversionsConfig(user.id),
        ]);

        const scopedConversions = filterConversionsByCurrency(convs, reportingCurrency);
        setOverviewStats(computeHomeOverviewStatsFromConversions({
          conversions: scopedConversions,
          landingsCount: mine.length + clients.length,
          premiumThreshold: getPremiumThreshold(cfg, reportingCurrency),
        }));
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : (typeof e === "object" && e && "message" in e && typeof (e as { message?: unknown }).message === "string"
                ? (e as { message: string }).message
                : "Error al cargar estadísticas");
        setError(msg);
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [reportingCurrency]);

  if (!ready) {
    return <DashboardSkeleton title="Cargando inicio..." />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-red-950/40 border border-red-800/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      </div>
    );
  }

  if (isAllCurrencies) {
    return <SingleCurrencyRequired title="Elegí ARS o PYG para ver el resumen consolidado" />;
  }

  return (
    <HomeOverview
      role="admin"
      overviewStats={overviewStats ?? {
        landingsCount: 0,
        porcentajeCarga: 0,
        cargaPromedio: 0,
        totalCargado: 0,
        premium: 0,
        retencionActiva30d: 0,
      }}
      currency={reportingCurrency}
    />
  );
}

