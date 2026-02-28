"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Landing } from "@/lib/landing/types";
import { fetchLandings, createLanding } from "@/lib/landing/landingsDb";
import { DEFAULT_CONFIG } from "@/lib/landing/mocks";

export default function DashboardPage() {
  const router = useRouter();
  const [landings, setLandings] = useState<Landing[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setError(null);
      try {
        const list = await fetchLandings(user.id);
        setLandings(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar landings");
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [router]);

  const handleCreate = async () => {
    if (!userId) return;
    setCreating(true);
    setError(null);
    try {
      const { id } = await createLanding(userId, {
        comment: "",
        config: { ...DEFAULT_CONFIG },
      });
      router.push(`/dashboard/landing/${id}/editar`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear la landing");
    } finally {
      setCreating(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Mis landings
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Crea y edita tus landings. Solo tú ves las que has creado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-70"
        >
          {creating ? "Creando..." : "Crear landing"}
        </button>
      </div>

      {landings.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-zinc-400">Aún no tienes ninguna landing.</p>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-70"
          >
            {creating ? "Creando..." : "Crear la primera"}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {landings.map((landing) => {
            const thumbUrl =
              landing.config.backgroundImages[0] || landing.config.logoUrl;
            return (
              <Link
                key={landing.id}
                href={`/dashboard/landing/${landing.id}/editar`}
                className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition hover:border-zinc-600 hover:bg-zinc-800/50"
              >
                <div className="aspect-[3/4] w-full shrink-0 overflow-hidden bg-zinc-800">
                  {thumbUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbUrl}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <span className="text-sm">Sin imagen</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-zinc-100 truncate">
                    {landing.name}
                  </p>
                  {landing.pixelId ? (
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      Pixel: {landing.pixelId}
                    </p>
                  ) : null}
                  {landing.comment ? (
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {landing.comment}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
