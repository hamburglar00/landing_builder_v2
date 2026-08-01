"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { HomeOverviewStats } from "@/lib/conversionsDb";
import {
  fetchConversionsConfig,
  fetchConversionsFiltered,
  getPremiumThreshold,
} from "@/lib/conversionsDb";
import { computeHomeOverviewStatsFromConversions } from "@/lib/conversionStats";
import { fetchLandings } from "@/lib/landing/landingsDb";
import { HomeOverview } from "@/components/conversiones/HomeOverview";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import {
  SingleCurrencyRequired,
  useCurrencyScope,
} from "@/components/currency/CurrencyScope";
import { CURRENCY_ALL } from "@/lib/currency";
import { filterConversionsByCurrency } from "@/lib/currency";

function currentMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: now,
  };
}

export default function DashboardInicioPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewStats, setOverviewStats] = useState<HomeOverviewStats | null>(null);
  const { currencyScope, isAllCurrencies } = useCurrencyScope();
  const reportingCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;

  useEffect(() => {
    if (isAllCurrencies) {
      setOverviewStats(null);
      setError(null);
      setReady(true);
      return;
    }
    let active = true;
    setReady(false);
    const init = async () => {
      setError(null);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const range = currentMonthRange();
        const [config, rows, landings] = await Promise.all([
          fetchConversionsConfig(user.id),
          fetchConversionsFiltered(user.id, user.id, undefined, range),
          fetchLandings(user.id, reportingCurrency),
        ]);
        const scopedRows = filterConversionsByCurrency(rows, reportingCurrency);
        const stats = computeHomeOverviewStatsFromConversions({
          conversions: scopedRows,
          landingsCount: landings.length,
          premiumThreshold: getPremiumThreshold(config, reportingCurrency),
        });
        if (active) setOverviewStats(stats);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : (typeof e === "object" && e && "message" in e && typeof (e as { message?: unknown }).message === "string"
                ? (e as { message: string }).message
                : "Error al cargar estadísticas");
        if (active) setError(msg);
      } finally {
        if (active) setReady(true);
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, [isAllCurrencies, reportingCurrency, router]);

  if (!ready) {
    return <DashboardSkeleton title="Cargando inicio..." />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-[rgba(239,68,68,0.14)] px-3 py-2 text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (isAllCurrencies) {
    return <SingleCurrencyRequired title="Elegí ARS o PYG para ver el resumen" />;
  }

  return (
    <HomeOverview
      role="client"
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
