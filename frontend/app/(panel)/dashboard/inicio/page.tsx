"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { HomeOverviewStats } from "@/lib/conversionsDb";
import { fetchHomeOverviewStats } from "@/lib/conversionsDb";
import { HomeOverview } from "@/components/conversiones/HomeOverview";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";

export default function DashboardInicioPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewStats, setOverviewStats] = useState<HomeOverviewStats | null>(null);

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

        const stats = await fetchHomeOverviewStats(user.id);
        setOverviewStats(stats);
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
  }, [router]);

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

  return (
    <HomeOverview
      role="client"
      overviewStats={overviewStats ?? undefined}
    />
  );
}
