"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSettings } from "@/lib/settingsDb";
import { invokeFunction } from "@/lib/supabaseFunctions";
import type { Landing } from "@/lib/landing/types";
import { fetchLandingsForAdmin, createLanding } from "@/lib/landing/landingsDb";
import { DEFAULT_CONFIG } from "@/lib/landing/mocks";
import { LandingPreview } from "@/components/landing/LandingPreview";

const BASE = "/admin/landings";

export default function AdminLandingsPage() {
  const router = useRouter();
  const [mineLandings, setMineLandings] = useState<Landing[]>([]);
  const [clientLandings, setClientLandings] = useState<Landing[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [urlBase, setUrlBase] = useState<string | null>(null);
  const [clientLabelsByUserId, setClientLabelsByUserId] = useState<Record<string, string>>({});

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
        const [{ mine, clients }, settings] = await Promise.all([
          fetchLandingsForAdmin(user.id),
          getSettings(),
        ]);
        setMineLandings(mine);
        setClientLandings(clients);
        setUrlBase(settings.url_base ?? null);
        const clientUserIds = Array.from(
          new Set((clients ?? []).map((l) => l.userId).filter((v): v is string => !!v)),
        );
        if (clientUserIds.length > 0) {
          const { data } = await invokeFunction<{ users?: Array<{ id: string; nombre: string | null; email: string | null }> }>(
            supabase,
            "list-clients",
            { method: "GET" },
          );
          const users = Array.isArray(data?.users) ? data!.users : [];
          const byId = new Map(users.map((u) => [String(u.id), u]));
          const map: Record<string, string> = {};
          for (const uid of clientUserIds) {
            const u = byId.get(uid);
            const nombre = String(u?.nombre ?? "").trim();
            const email = String(u?.email ?? "").trim();
            const label = [nombre, email].filter(Boolean).join("-");
            map[String(uid)] = label || nombre || email || String(uid);
          }
          setClientLabelsByUserId(map);
        } else {
          setClientLabelsByUserId({});
        }
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
      router.push(`${BASE}/${id}/editar`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear la landing");
    } finally {
      setCreating(false);
    }
  };

  const handleConnectExisting = async () => {
    if (!userId) return;
    setCreating(true);
    setError(null);
    try {
      const { id } = await createLanding(userId, {
        landingType: "external",
        externalDomain: "",
        comment: "",
        config: { ...DEFAULT_CONFIG },
      });
      router.push(`${BASE}/${id}/editar`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al conectar landing existente");
    } finally {
      setCreating(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-muted)]">Cargando...</p>
      </div>
    );
  }

  const groupedClientLandings = clientLandings.reduce<Record<string, Landing[]>>((acc, landing) => {
    const ownerId = landing.userId ?? "sin-owner";
    if (!acc[ownerId]) acc[ownerId] = [];
    acc[ownerId].push(landing);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedClientLandings).sort((a, b) => {
    const nameA = (clientLabelsByUserId[a[0]] || a[0]).toLowerCase();
    const nameB = (clientLabelsByUserId[b[0]] || b[0]).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-[rgba(239,68,68,0.14)] px-3 py-2 text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-strong)]">
            LANDINGS
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Crea y edita tus landings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleConnectExisting()}
            disabled={creating}
            className="cursor-pointer rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-100 transition-colors duration-150 hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            {creating ? "CREANDO..." : "CONECTAR EXISTENTE"}
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="cursor-pointer rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-bg-0)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-press)] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-primary)]"
          >
            {creating ? "CREANDO..." : "CREAR LANDING"}
          </button>
        </div>
      </div>

      {mineLandings.length === 0 && clientLandings.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-8 text-center shadow-sm">
          <p className="text-[var(--color-text-muted)]">Aún no tienes ninguna landing.</p>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="mt-4 cursor-pointer rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-bg-0)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-press)] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-primary)]"
          >
            {creating ? "CREANDO..." : "CREAR LA PRIMERA"}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Mis landings */}
          {mineLandings.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">
                Mis landings
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mineLandings.map((landing) => (
                  <LandingCard key={landing.id} landing={landing} urlBase={urlBase} />
                ))}
              </div>
            </section>
          )}
          {/* Landings de clientes */}
          {clientLandings.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">
                Landings de clientes
              </h2>
              <div className="space-y-6">
                {groupedEntries.map(([ownerId, landings]) => (
                  <div key={ownerId} className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {(clientLabelsByUserId[ownerId] || ownerId).trim() || "Cliente"}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {landings.map((landing) => (
                        <LandingCard key={landing.id} landing={landing} urlBase={urlBase} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function LandingCard({ landing, urlBase }: { landing: Landing; urlBase: string | null }) {
  return (
    <div
      className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-1)] shadow-sm"
    >
              <Link
                href={`${BASE}/${landing.id}/editar`}
                className="absolute inset-0"
              >
                <div className="group/img absolute inset-0 overflow-hidden">
                  <div className="h-full w-full transition-transform duration-200 group-hover/img:scale-[1.02]">
                    <LandingPreview config={landing.config} compact gallery />
                  </div>
                </div>
              </Link>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 to-black/50 px-2.5 py-2">
                <div className="space-y-0.5">
                  <p className="truncate text-xs font-medium text-[var(--color-text-strong)]">
                    {landing.name}
                  </p>
                  <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                    {landing.pixelId
                      ? `Pixel: ${landing.pixelId}`
                      : "Pixel: sin configurar"}
                  </p>
                  <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                    Teléfono:{" "}
                    {landing.phoneMode === "fair" ? "equitativo" : "aleatorio"}
                  </p>
                  {landing.comment ? (
                    <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                      {landing.comment}
                    </p>
                  ) : null}
                </div>
                <div className="pointer-events-auto flex items-center gap-1.5 pt-1">
                  <a
                    href={
                      urlBase
                        ? `${urlBase.replace(/\/$/, "")}/${landing.name}`
                        : "#"
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] bg-[rgba(255,255,255,0.08)] px-2 py-1 text-[10px] font-medium text-[var(--color-text)] transition hover:bg-[rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-neutral)]"
                  >
                    <span>Abrir landing</span>
                    <svg
                      aria-hidden="true"
                      className="h-2.5 w-2.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 3h7v7" />
                      <path d="M10 14L21 3" />
                      <path d="M5 5v14h14" />
                    </svg>
                  </a>
                  <Link
                    href={`${BASE}/${landing.id}/editar`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[rgba(255,255,255,0.06)] px-2 py-1 text-[10px] font-medium text-[var(--color-text)] transition hover:bg-[rgba(255,255,255,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-neutral)]"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            </div>
  );
}
