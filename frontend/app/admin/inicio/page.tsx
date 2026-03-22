"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { FunnelContact, ConversionRow } from "@/lib/conversionsDb";
import {
  fetchConversionsConfig,
  fetchConversionsForAdmin,
  buildFunnelContactsFromConversions,
} from "@/lib/conversionsDb";
import { fetchLandingsForAdmin } from "@/lib/landing/landingsDb";
import { HomeOverview } from "@/components/conversiones/HomeOverview";

export default function AdminInicioPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landingsCount, setLandingsCount] = useState(0);
  const [funnelContacts, setFunnelContacts] = useState<FunnelContact[]>([]);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [premiumThreshold, setPremiumThreshold] = useState(50000);

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
          fetchLandingsForAdmin(user.id),
          fetchConversionsForAdmin(500),
          fetchConversionsConfig(user.id),
        ]);

        setLandingsCount(mine.length + clients.length);
        setFunnelContacts(buildFunnelContactsFromConversions(convs));
        setConversions(convs);
        setPremiumThreshold(cfg?.funnel_premium_threshold ?? 50000);
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
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Cargando inicio...</p>
      </div>
    );
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

  return (
    <HomeOverview
      role="admin"
      landingsCount={landingsCount}
      funnelContacts={funnelContacts}
      conversions={conversions}
      premiumThreshold={premiumThreshold}
    />
  );
}

