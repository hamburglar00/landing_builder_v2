"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Landing } from "@/lib/landing/types";
import { fetchLandingById } from "@/lib/landing/landingsDb";
import { LandingPreview } from "@/components/landing/LandingPreview";

const BASE = "/admin/landings";

export default function AdminLandingPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const [landing, setLanding] = useState<Landing | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user || !id) {
        router.replace(BASE);
        return;
      }

      try {
        const found = await fetchLandingById(id);
        if (!found) {
          router.replace(BASE);
          return;
        }
        setLanding(found);
      } catch {
        router.replace(BASE);
        return;
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [router, id]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  if (!landing) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Preview: {landing.name}
          </h1>
          {landing.comment ? (
            <p className="mt-0.5 text-sm text-zinc-500">{landing.comment}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link
            href={`${BASE}/${landing.id}/editar`}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
          >
            Editar
          </Link>
          <Link
            href={BASE}
            className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
          >
            Volver al listado
          </Link>
        </div>
      </div>
      <div className="flex justify-center">
        <LandingPreview config={landing.config} />
      </div>
    </div>
  );
}
