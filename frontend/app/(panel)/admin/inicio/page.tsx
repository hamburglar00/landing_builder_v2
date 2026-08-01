"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ConversionRow, ConversionsConfig } from "@/lib/conversionsDb";
import {
  fetchConversionsConfig,
  fetchConversionsForAdminFiltered,
  getPremiumThreshold,
} from "@/lib/conversionsDb";
import { fetchLandingsForAdmin } from "@/lib/landing/landingsDb";
import { HomeOverview } from "@/components/conversiones/HomeOverview";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import {
  SingleCurrencyRequired,
  useCurrencyScope,
} from "@/components/currency/CurrencyScope";
import { CURRENCY_ALL, filterConversionsByCurrency } from "@/lib/currency";

export default function AdminInicioPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landingsCount, setLandingsCount] = useState(0);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
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

        const [{ mine, clients }, convs, cfg] = await Promise.all([
          fetchLandingsForAdmin(user.id, reportingCurrency),
          fetchConversionsForAdminFiltered(user.id),
          fetchConversionsConfig(user.id),
        ]);

        setLandingsCount(mine.length + clients.length);
        setConversions(convs);
        setConfig(cfg);
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

  const scopedConversions = useMemo(
    () => filterConversionsByCurrency(conversions, currencyScope),
    [conversions, currencyScope],
  );

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
      landingsCount={landingsCount}
      conversions={scopedConversions}
      premiumThreshold={getPremiumThreshold(config, reportingCurrency)}
      currency={reportingCurrency}
    />
  );
}

