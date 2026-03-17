"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { FunnelContact, ConversionRow } from "@/lib/conversionsDb";
import {
  fetchFunnelContacts,
  fetchConversions,
} from "@/lib/conversionsDb";
import { fetchLandings } from "@/lib/landing/landingsDb";
import { HomeOverview } from "@/components/conversiones/HomeOverview";

export default function DashboardInicioPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landingsCount, setLandingsCount] = useState(0);
  const [funnelContacts, setFunnelContacts] = useState<FunnelContact[]>([]);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);

  useEffect(() => {
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

        const [landings, funnel, convs] = await Promise.all([
          fetchLandings(user.id),
          fetchFunnelContacts(user.id),
          fetchConversions(user.id, 500),
        ]);

        setLandingsCount(landings.length);
        setFunnelContacts(funnel);
        setConversions(convs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar estadísticas");
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-muted)]">Cargando inicio...</p>
      </div>
    );
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

  return (
    <HomeOverview
      role="client"
      landingsCount={landingsCount}
      funnelContacts={funnelContacts}
      conversions={conversions}
      premiumThreshold={50000}
    />
  );
}

