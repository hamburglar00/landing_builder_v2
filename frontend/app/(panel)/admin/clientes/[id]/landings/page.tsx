"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Landing } from "@/lib/landing/types";
import { fetchLandingsByUserId } from "@/lib/landing/landingsDb";

export default function AdminClienteLandingsPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params?.id as string | undefined;
  const [landings, setLandings] = useState<Landing[]>([]);
  const [clientName, setClientName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user || !clientId) {
        router.replace("/admin/clientes");
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nombre")
          .eq("id", clientId)
          .maybeSingle();
        setClientName(profile?.nombre ?? null);

        const list = await fetchLandingsByUserId(clientId);
        setLandings(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar landings");
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [router, clientId]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/admin/clientes"
          className="text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          ← Clientes
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">
          Landings del cliente
          {clientName ? `: ${clientName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Listado de landings de este cliente. Solo lectura desde aquí.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {landings.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-zinc-400">Este cliente no tiene ninguna landing.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {landings.map((landing) => {
            const thumbUrl =
              landing.config.backgroundImages[0] || landing.config.logoUrl;
            return (
              <div
                key={landing.id}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50"
              >
                <div className="aspect-[3/4] w-full shrink-0 overflow-hidden bg-zinc-800">
                  {thumbUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <span className="text-sm">Sin imagen</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
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
                  <div className="mt-2 flex gap-2">
                    <Link
                      href={`/admin/landings/${landing.id}/preview`}
                      className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                    >
                      Preview
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
