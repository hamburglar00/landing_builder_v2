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
import { buildLandingConfig } from "@/lib/landing/buildLandingConfig";
import type { Gerencia } from "@/lib/gerencias/types";
import type { LandingGerenciaAssignment } from "@/lib/gerencias/gerenciasDb";
import {
  fetchGerenciasForAdmin,
  fetchLandingGerencias,
  setLandingGerencias,
} from "@/lib/gerencias/gerenciasDb";
import { getSettings } from "@/lib/settingsDb";

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
  const [assignments, setAssignments] = useState<LandingGerenciaAssignment[]>([]);
  const [initialName, setInitialName] = useState<string | null>(null);
  const [urlBase, setUrlBase] = useState<string | null>(null);
  const [revalidateSecret, setRevalidateSecret] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);

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
        const [found, allGerencias, assigned, settings] = await Promise.all([
          fetchLandingById(id),
          fetchGerenciasForAdmin(user.id),
          fetchLandingGerencias(id),
          getSettings(),
        ]);
        if (!found) {
          router.replace(BASE);
          return;
        }
        setLanding(found);
        if (!initialName) {
          setInitialName(found.name);
        }
        setGerencias(allGerencias);
        setAssignments(assigned);
        setUrlBase(settings.url_base ?? null);
        setRevalidateSecret(settings.revalidate_secret || null);
      } catch {
        router.replace(BASE);
        return;
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [router, id, initialName]);

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
    if (!landing.landingTag.trim()) {
      setSaveError("Landing Tag es obligatorio.");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(landing.landingTag)) {
      setSaveError("Landing Tag solo puede contener letras y números, sin espacios.");
      return;
    }
    if (
      initialName &&
      initialName.startsWith("Nueva-landing-") &&
      landing.name.trim()
    ) {
      const ok = window.confirm(
        `Vas a nombrar esta landing como "${landing.name}". Este nombre se usará en la URL pública y no se podrá cambiar luego.\n\n¿Confirmar nombre?`,
      );
      if (!ok) return;
    }
    try {
      const effectivePhoneMode = assignments.some((a) => a.phoneMode === "fair")
        ? "fair"
        : "random";

      const landingConfig = buildLandingConfig({
        id: landing.id,
        name: landing.name,
        comment: landing.comment,
        pixelId: landing.pixelId,
        postUrl: landing.postUrl,
        landingTag: landing.landingTag,
        config: landing.config,
        phoneMode: effectivePhoneMode,
        updatedAt: undefined,
      });

      await updateLanding(landing.id, {
        name: landing.name,
        pixelId: landing.pixelId,
        phoneMode: effectivePhoneMode,
        phoneKind: landing.phoneKind,
        phoneIntervalStartHour: landing.phoneIntervalStartHour,
        phoneIntervalEndHour: landing.phoneIntervalEndHour,
        postUrl: landing.postUrl,
        landingTag: landing.landingTag,
        comment: landing.comment,
        config: landing.config,
        landingConfig,
      });
      await setLandingGerencias(landing.id, assignments);
      // Revalidar landing pública en Vercel (ISR) y calentar caché.
      if (urlBase && revalidateSecret) {
        const base = urlBase.replace(/\/$/, "");
        try {
          await fetch(`${base}/api/revalidate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: landing.name,
              secret: revalidateSecret,
            }),
          });
          await fetch(
            `${base}/${encodeURIComponent(landing.name)}?warm=1`,
          ).catch(() => {});
          // Calentar la Edge Function builder-config para que la primera visita a la landing no pague cold start.
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
          if (supabaseUrl && anonKey) {
            fetch(
              `${supabaseUrl}/functions/v1/builder-config?name=${encodeURIComponent(landing.name)}`,
              { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
            ).catch(() => {});
          }
        } catch {
          // No bloqueamos el guardado si falla la revalidación.
        }
      }
      router.push(BASE);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === UNIQUE_VIOLATION_CODE) {
        const msg = err.message ?? "";
        if (msg.includes("landing_tag")) {
          setSaveError("Ese Landing Tag ya está en uso. Elegí otro.");
        } else {
          setSaveError("Ese nombre ya existe. Elegí otro.");
        }
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
    <div className="lg:flex lg:gap-6 lg:items-start lg:pr-[440px]">
      <div className="min-w-0 flex-1 space-y-8 pb-8 lg:pr-4">
        {saveError && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
            {saveError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={BASE}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50"
          >
            <span className="text-sm" aria-hidden>
              ←
            </span>
            <span>Volver al listado</span>
          </Link>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="cursor-pointer rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-70 disabled:cursor-not-allowed"
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
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Nombre (URL, solo minúsculas y números)
              </label>
              <input
                type="text"
                value={landing.name}
                onChange={(e) =>
                  setLanding((prev) => {
                    if (!prev) return prev;
                    const raw = e.target.value.toLowerCase();
                    const cleaned = raw.replace(/[^a-z0-9]/g, "");
                    return { ...prev, name: cleaned };
                  })
                }
                disabled={
                  initialName !== null &&
                  !initialName.startsWith("Nueva-landing-")
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="ej: milanding123"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Este nombre se usará como /name en la URL pública. Una vez que
                guardes por primera vez, no se podrá cambiar.
              </p>
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
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">Tracking</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Pixel ID</label>
              <input
                type="text"
                value={landing.pixelId}
                disabled
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Sin configurar"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Se configura desde{" "}
                <a href="/admin/conversiones" className="text-zinc-300 underline hover:text-zinc-100">
                  Conversiones
                </a>
                .
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">URL Post <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={
                  clientName
                    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? ""}/functions/v1/conversions?name=${encodeURIComponent(
                        clientName,
                      )}`
                    : landing.postUrl
                }
                disabled
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Se completa automáticamente desde Conversiones"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                URL única de conversiones (Meta CAPI) para este cliente. Se completa automáticamente desde el
                módulo Conversiones y no requiere edición manual.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Landing Tag <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={landing.landingTag}
                onChange={(e) =>
                  setLanding((prev) => {
                    if (!prev) return prev;
                    const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                    return { ...prev, landingTag: cleaned };
                  })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="ej: miLanding123"
                required
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Identificador único de la landing. Solo letras y números, sin espacios.
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800 mt-3">
              <p className="mb-1 text-[11px] font-semibold text-zinc-400">
                Endpoints de esta landing
              </p>
              <p className="text-[11px] text-zinc-500">
                <span className="font-mono text-[11px]">builder-config</span>:{" "}
                <span className="font-mono break-all text-[11px]">
                  /functions/v1/builder-config?name={landing.name}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                <span className="font-mono text-[11px]">landing-phone</span>:{" "}
                <span className="font-mono break-all text-[11px]">
                  /functions/v1/landing-phone?name={landing.name}
                </span>
              </p>
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-1 text-sm font-semibold text-zinc-200">Redirección</h3>
          <p className="mb-3 text-xs text-zinc-400">
            Configura a donde re dirigirá el CTA de tu landing page.
          </p>
          <p className="mb-3 text-xs text-zinc-500">
            Marque <strong>Asignar</strong> para incluir la gerencia; edite el <strong>Peso</strong>. Elija modo (carga/ads), tipo de elección (aleatorio/equitativo) y opcionalmente un intervalo de tiempo. Crea gerencias en el menú Gerencias si no tienes.
          </p>
          {gerencias.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No tienes gerencias.{" "}
              <Link
                href="/admin/gerencias"
                className="text-zinc-300 underline hover:text-zinc-100"
              >
                Crear gerencias
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/80">
                  <tr>
                    <th className="px-3 py-2 font-medium text-zinc-300">
                      Gerencia ID
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300">
                      Nombre
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300 w-20 text-center">
                      Asignar
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300 w-20">
                      Peso
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300 w-32">
                      Modo
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300 min-w-[140px]">
                      Tipo
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300 w-56">
                      Intervalo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {gerencias.map((g) => {
                    const assignment = assignments.find(
                      (a) => a.gerencia_id === g.id,
                    );
                    const isAssigned = !!assignment;
                    const weight = assignment?.weight ?? 0;
                    const phoneMode = assignment?.phoneMode ?? "random";
                    const phoneKind = assignment?.phoneKind ?? "carga";
                    const intervalStartHour =
                      assignment?.intervalStartHour ?? null;
                    const intervalEndHour = assignment?.intervalEndHour ?? null;
                    return (
                      <tr key={g.id} className="bg-zinc-950/40">
                        <td className="px-3 py-2 text-zinc-300">
                          {g.gerencia_id}
                        </td>
                        <td className="px-3 py-2 text-zinc-200">{g.nombre}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {
                              if (isAssigned) {
                                setAssignments((prev) =>
                                  prev.filter((a) => a.gerencia_id !== g.id),
                                );
                              } else {
                                setAssignments((prev) => [
                                  ...prev,
                                  {
                                    gerencia_id: g.id,
                                    weight: 1,
                                    phoneMode: "random",
                                    phoneKind: "carga",
                                    intervalStartHour: null,
                                    intervalEndHour: null,
                                  },
                                ]);
                              }
                            }}
                            className="rounded border-zinc-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={weight}
                            onChange={(e) => {
                              if (!isAssigned) return;
                              const v = parseInt(e.target.value, 10);
                              const next = Number.isNaN(v) ? 0 : Math.max(0, v);
                              setAssignments((prev) =>
                                prev.map((a) =>
                                  a.gerencia_id === g.id
                                    ? { ...a, weight: next }
                                    : a,
                                ),
                              );
                            }}
                            disabled={!isAssigned}
                            title={
                              isAssigned
                                ? "Peso de esta gerencia en esta landing"
                                : "Marque Asignar para poder editar el peso"
                            }
                            className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneMode: "random" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer px-2 py-1 rounded-l-lg border-r border-zinc-700 ${
                                phoneMode === "random"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Aleatorio
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneMode: "fair" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer px-2 py-1 rounded-r-lg ${
                                phoneMode === "fair"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Equitativo
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 min-w-[140px]">
                          <div className="inline-flex flex-shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneKind: "carga" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer shrink-0 px-2 py-1 rounded-l-lg border-r border-zinc-700 ${
                                phoneKind === "carga"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Carga
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneKind: "ads" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer shrink-0 px-2 py-1 border-r border-zinc-700 ${
                                phoneKind === "ads"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Ads
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneKind: "mkt" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer shrink-0 px-2 py-1 rounded-r-lg ${
                                phoneKind === "mkt"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Mkt
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={
                                  intervalStartHour !== null &&
                                  intervalEndHour !== null
                                }
                                onChange={(e) => {
                                  if (!isAssigned) return;
                                  setAssignments((prev) =>
                                    prev.map((a) => {
                                      if (a.gerencia_id !== g.id) return a;
                                      if (!e.target.checked) {
                                        return {
                                          ...a,
                                          intervalStartHour: null,
                                          intervalEndHour: null,
                                        };
                                      }
                                      return {
                                        ...a,
                                        intervalStartHour:
                                          a.intervalStartHour ?? 9,
                                        intervalEndHour:
                                          a.intervalEndHour ?? 21,
                                      };
                                    }),
                                  );
                                }}
                                className="rounded border-zinc-600"
                              />
                              <span>Aplicar</span>
                            </label>
                            {intervalStartHour !== null &&
                              intervalEndHour !== null && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span>Dentro de</span>
                                  <select
                                    value={intervalStartHour}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value, 10);
                                      const n = Number.isNaN(v)
                                        ? 0
                                        : Math.max(0, Math.min(23, v));
                                      setAssignments((prev) =>
                                        prev.map((a) =>
                                          a.gerencia_id === g.id
                                            ? {
                                                ...a,
                                                intervalStartHour: n,
                                              }
                                            : a,
                                        ),
                                      );
                                    }}
                                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                                  >
                                    {Array.from({ length: 24 }).map((_, h) => (
                                      <option key={h} value={h}>
                                        {h.toString().padStart(2, "0")}:00
                                      </option>
                                    ))}
                                  </select>
                                  <span>a</span>
                                  <select
                                    value={intervalEndHour}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value, 10);
                                      const n = Number.isNaN(v)
                                        ? 0
                                        : Math.max(0, Math.min(23, v));
                                      setAssignments((prev) =>
                                        prev.map((a) =>
                                          a.gerencia_id === g.id
                                            ? {
                                                ...a,
                                                intervalEndHour: n,
                                              }
                                            : a,
                                        ),
                                      );
                                    }}
                                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                                  >
                                    {Array.from({ length: 24 }).map((_, h) => (
                                      <option key={h} value={h}>
                                        {h.toString().padStart(2, "0")}:00
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          landingId={landing.id}
          landingName={landing.name}
          comment={landing.comment}
          pixelId={landing.pixelId}
          postUrl={landing.postUrl}
          landingTag={landing.landingTag}
          getPhoneForPreview={async () => {
            try {
              const base =
                process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
              const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
              if (!base) return null;
              const url = `${base}/functions/v1/landing-phone?name=${encodeURIComponent(
                landing.name,
              )}`;
              const res = await fetch(url, {
                headers: apiKey
                  ? {
                      apikey: apiKey,
                      Authorization: `Bearer ${apiKey}`,
                    }
                  : undefined,
              });
              if (!res.ok) return null;
              const j = await res.json();
              const phone = j?.phone;
              return typeof phone === "string" ? phone : null;
            } catch {
              return null;
            }
          }}
        />
      </div>
      {/* Mobile / tablet: preview al final, con scroll normal */}
      <div className="mt-8 w-full max-w-[380px] lg:hidden">
        <p className="mb-3 text-xs font-medium text-zinc-500">Vista previa</p>
        <LandingPreview config={landing.config} />
        <p className="mt-2 w-full text-[11px] text-zinc-500">
          La vista previa es aproximada. Para una vista certera, abrí el enlace de la landing.
        </p>
      </div>
      {/* Desktop: preview fijo que acompaña el scroll y siempre queda visible */}
      <div className="pointer-events-none fixed right-6 top-16 z-20 hidden w-[360px] max-w-[40vw] lg:block">
        <p className="mb-3 text-xs font-medium text-zinc-500">Vista previa</p>
        <div className="pointer-events-auto w-full">
          <div className="scale-[0.7] origin-top">
            <LandingPreview config={landing.config} />
          </div>
        </div>
        <p className="mt-2 w-full text-[11px] text-zinc-500">
          La vista previa es aproximada. Para una vista certera, abrí el enlace de la landing.
        </p>
      </div>
    </div>
  );
}
