"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Landing, LandingThemeConfig } from "@/lib/landing/types";
import { DEFAULT_CONFIG } from "@/lib/landing/mocks";
import {
  fetchLandingById,
  updateLanding,
  deleteLanding,
  UNIQUE_VIOLATION_CODE,
} from "@/lib/landing/landingsDb";
import { uploadLandingImage } from "@/lib/landing/upload";
import { LandingPreview } from "@/components/landing/LandingPreview";
import { LandingEditorForm } from "@/components/landing/LandingEditorForm";
import type { Gerencia } from "@/lib/gerencias/types";
import {
  fetchGerencias,
  fetchGerenciaIdsByLandingId,
  setLandingGerencias,
} from "@/lib/gerencias/gerenciasDb";

const BASE = "/admin/landings";

export default function AdminLandingEditarPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const [landing, setLanding] = useState<Landing | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [selectedGerenciaIds, setSelectedGerenciaIds] = useState<number[]>([]);

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

      setUserId(user.id);
      try {
        const [found, userGerencias, assignedIds] = await Promise.all([
          fetchLandingById(id),
          fetchGerencias(user.id),
          fetchGerenciaIdsByLandingId(id),
        ]);
        if (!found) {
          router.replace(BASE);
          return;
        }
        setLanding(found);
        setGerencias(userGerencias);
        setSelectedGerenciaIds(assignedIds);
      } catch {
        router.replace(BASE);
        return;
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [router, id]);

  const setConfig = (updater: React.SetStateAction<LandingThemeConfig>) => {
    setLanding((prev) => {
      if (!prev) return prev;
      const nextConfig =
        typeof updater === "function" ? updater(prev.config) : updater;
      return { ...prev, config: nextConfig };
    });
  };

  const handleSave = async () => {
    if (!landing) return;
    setSaveError(null);
    if (/\s/.test(landing.name)) {
      setSaveError("El nombre no debe contener espacios.");
      return;
    }
    try {
      await updateLanding(landing.id, {
        name: landing.name,
        pixelId: landing.pixelId,
        comment: landing.comment,
        config: landing.config,
      });
      await setLandingGerencias(landing.id, selectedGerenciaIds);
      router.push(BASE);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === UNIQUE_VIOLATION_CODE) {
        setSaveError("Ese nombre ya existe. Elige otro.");
      } else {
        setSaveError(e instanceof Error ? e.message : "Error al guardar");
      }
    }
  };

  const handleDelete = async () => {
    if (!landing) return;
    if (!window.confirm(`¿Eliminar la landing "${landing.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setSaveError(null);
    try {
      await deleteLanding(landing.id);
      router.push(BASE);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const handleReset = () => {
    if (!landing) return;
    setLanding((prev) =>
      prev ? { ...prev, config: { ...DEFAULT_CONFIG } } : prev,
    );
  };

  if (!ready || !landing) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="lg:flex lg:gap-8 lg:max-h-[calc(100vh-7rem)] lg:items-start">
      <div className="min-h-0 min-w-0 flex-1 space-y-8 lg:overflow-y-auto lg:pr-2">
        {saveError && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
            {saveError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={BASE} className="text-sm text-zinc-400 transition hover:text-zinc-200">
            ← Listado
          </Link>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-70"
          >
            {deleting ? "Eliminando..." : "Eliminar landing"}
          </button>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Editar landing</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Nombre y comentario identifican esta landing en tu listado.
          </p>
        </div>
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">Identificación</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Nombre (sin espacios)</label>
              <input
                type="text"
                value={landing.name}
                onChange={(e) =>
                  setLanding((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="Ej: MiLanding"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Pixel ID</label>
              <input
                type="text"
                value={landing.pixelId}
                onChange={(e) =>
                  setLanding((prev) => (prev ? { ...prev, pixelId: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="ID del pixel (opcional)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Comentario</label>
              <input
                type="text"
                value={landing.comment}
                onChange={(e) =>
                  setLanding((prev) => (prev ? { ...prev, comment: e.target.value } : prev))
                }
                placeholder="Opcional"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">Gerencias</h3>
          <p className="mb-3 text-xs text-zinc-400">
            Asigna las gerencias de esta landing. Crea gerencias en el menú Gerencias si no tienes.
          </p>
          {gerencias.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No tienes gerencias. <Link href="/admin/gerencias" className="text-zinc-300 underline hover:text-zinc-100">Crear gerencias</Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {gerencias.map((g) => (
                <label
                  key={g.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 hover:bg-zinc-800/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedGerenciaIds.includes(g.id)}
                    onChange={() => {
                      setSelectedGerenciaIds((prev) =>
                        prev.includes(g.id)
                          ? prev.filter((x) => x !== g.id)
                          : [...prev, g.id],
                      );
                    }}
                    className="rounded border-zinc-600"
                  />
                  <span className="text-sm text-zinc-200">
                    {g.id} — {g.nombre}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>
        <LandingEditorForm
          config={landing.config}
          setConfig={setConfig}
          onSave={handleSave}
          onReset={handleReset}
          uploadImage={
            userId ? (file) => uploadLandingImage(supabase, userId, file) : undefined
          }
        />
      </div>
      <div className="mt-8 shrink-0 lg:mt-0 lg:w-[380px]">
        <p className="mb-3 text-xs font-medium text-zinc-500">Vista previa</p>
        <LandingPreview config={landing.config} />
      </div>
    </div>
  );
}
