"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Landing } from "@/lib/landing/types";
import { fetchLandings, createLanding } from "@/lib/landing/landingsDb";
import { buildLandingPublicUrl } from "@/lib/landing/publicUrls";
import { fetchLandingGerencias, setLandingGerencias } from "@/lib/gerencias/gerenciasDb";
import { DEFAULT_CONFIG } from "@/lib/landing/mocks";
import { LandingPreview } from "@/components/landing/LandingPreview";
import { getSettings } from "@/lib/settingsDb";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { EmptyState, ModalShell, PageHeader } from "@/components/ui/PanelPrimitives";

export default function DashboardLandingsPage() {
  const router = useRouter();
  const [landings, setLandings] = useState<Landing[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [urlBase, setUrlBase] = useState<string | null>(null);
  const [planLimitModalOpen, setPlanLimitModalOpen] = useState(false);
  const [planLimitModalText, setPlanLimitModalText] = useState("");

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
        const [list, settings] = await Promise.all([
          fetchLandings(user.id),
          getSettings(),
        ]);
        setLandings(list);
        setUrlBase(settings.url_base ?? null);
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
      const { data: sub } = await supabase
        .from("client_subscriptions")
        .select("max_landings, plan_code")
        .eq("user_id", userId)
        .maybeSingle();
      const maxLandings = Number(sub?.max_landings ?? 1);
      if (Number.isFinite(maxLandings) && landings.length >= maxLandings) {
        setPlanLimitModalText(
          `No puedes crear esta landing porque alcanzaste el máximo de tu plan actual (${maxLandings} landings).`,
        );
        setPlanLimitModalOpen(true);
        return;
      }
      const { id } = await createLanding(userId, {
        comment: "",
        config: { ...DEFAULT_CONFIG },
      });
      router.push(`/dashboard/landing/${id}/editar`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear la landing";
      if (msg.includes("PLAN_LIMIT_LANDINGS")) {
        setPlanLimitModalText(
          "No puedes crear esta landing porque alcanzaste el límite de tu plan actual. En Starter puedes tener hasta 1 landing activa.",
        );
        setPlanLimitModalOpen(true);
      } else {
        setError(msg);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleConnectExisting = async () => {
    if (!userId) return;
    setCreating(true);
    setError(null);
    try {
      const { data: sub } = await supabase
        .from("client_subscriptions")
        .select("max_landings, plan_code")
        .eq("user_id", userId)
        .maybeSingle();
      const maxLandings = Number(sub?.max_landings ?? 1);
      if (Number.isFinite(maxLandings) && landings.length >= maxLandings) {
        setPlanLimitModalText(
          `No puedes conectar otra landing porque alcanzaste el máximo de tu plan actual (${maxLandings} landings).`,
        );
        setPlanLimitModalOpen(true);
        return;
      }
      const { id } = await createLanding(userId, {
        landingType: "external",
        externalDomain: "",
        comment: "",
        config: { ...DEFAULT_CONFIG },
      });
      router.push(`/dashboard/landing/${id}/editar`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al conectar landing existente";
      if (msg.includes("PLAN_LIMIT_LANDINGS")) {
        setPlanLimitModalText(
          "No puedes conectar otra landing porque alcanzaste el límite de tu plan actual. En Starter puedes tener hasta 1 landing activa.",
        );
        setPlanLimitModalOpen(true);
      } else {
        setError(msg);
      }
    } finally {
      setCreating(false);
    }
  };

  const ensureCanCreateLanding = async (action: "crear" | "conectar" | "duplicar") => {
    if (!userId) return false;
    const { data: sub } = await supabase
      .from("client_subscriptions")
      .select("max_landings, plan_code")
      .eq("user_id", userId)
      .maybeSingle();
    const maxLandings = Number(sub?.max_landings ?? 1);
    if (Number.isFinite(maxLandings) && landings.length >= maxLandings) {
      const verb = action === "duplicar" ? "duplicar" : action === "conectar" ? "conectar otra" : "crear esta";
      setPlanLimitModalText(
        `No puedes ${verb} landing porque alcanzaste el máximo de tu plan actual (${maxLandings} landings).`,
      );
      setPlanLimitModalOpen(true);
      return false;
    }
    return true;
  };

  const handleDuplicate = async (landing: Landing) => {
    if (!userId) return;
    setDuplicatingId(landing.id);
    setError(null);
    try {
      const canCreate = await ensureCanCreateLanding("duplicar");
      if (!canCreate) return;
      const copiedConfig = JSON.parse(JSON.stringify(landing.config)) as Landing["config"];
      const { id } = await createLanding(userId, {
        landingType: landing.landingType,
        publishTarget: landing.publishTarget,
        externalDomain: landing.externalDomain,
        pixelId: landing.pixelId,
        gerenciaSelectionMode: landing.gerenciaSelectionMode,
        gerenciaFairCriterion: landing.gerenciaFairCriterion,
        phoneMode: landing.phoneMode,
        phoneKind: landing.phoneKind,
        phoneIntervalStartHour: landing.phoneIntervalStartHour,
        phoneIntervalEndHour: landing.phoneIntervalEndHour,
        landingTag: "",
        comment: landing.comment,
        config: copiedConfig,
      });
      const assignments = await fetchLandingGerencias(landing.id);
      if (assignments.length > 0) {
        await setLandingGerencias(id, assignments);
      }
      router.push(`/dashboard/landing/${id}/editar`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al duplicar la landing";
      if (msg.includes("PLAN_LIMIT_LANDINGS")) {
        setPlanLimitModalText(
          "No puedes duplicar esta landing porque alcanzaste el límite de tu plan actual.",
        );
        setPlanLimitModalOpen(true);
      } else {
        setError(msg);
      }
    } finally {
      setDuplicatingId(null);
    }
  };

  if (!ready) {
    return <DashboardSkeleton title="Cargando landings..." />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="ui-alert border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.07)] text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      <PageHeader
        eyebrow="Constructor"
        title="Landings"
        description="Creá, conectá y administrá todas tus experiencias publicadas."
        actions={
          <>
          <button
            type="button"
            onClick={() => void handleConnectExisting()}
            disabled={creating}
            className="ui-button ui-button-secondary"
          >
            {creating ? "Creando…" : "Conectar existente"}
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="ui-button ui-button-primary"
          >
            {creating ? "Creando…" : "Crear landing"}
          </button>
          </>
        }
      />

      {landings.length === 0 ? (
        <EmptyState
          title="Todavía no hay landings"
          description="Creá tu primera landing con el constructor o conectá una experiencia existente."
          icon={
            <svg aria-hidden className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 4v5" />
            </svg>
          }
          action={
            <button type="button" onClick={() => void handleCreate()} disabled={creating} className="ui-button ui-button-primary">
              {creating ? "Creando…" : "Crear la primera"}
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {landings.map((landing) => (
            <LandingCard
              key={landing.id}
              landing={landing}
              urlBase={urlBase}
              duplicating={duplicatingId === landing.id}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      <ModalShell
        open={planLimitModalOpen}
        title="Límite del plan alcanzado"
        description="Tu configuración actual llegó al máximo disponible."
        onClose={() => setPlanLimitModalOpen(false)}
        width="sm"
        footer={
          <button type="button" onClick={() => setPlanLimitModalOpen(false)} className="ui-button ui-button-primary">
            Entendido
          </button>
        }
      >
        <p className="text-sm leading-6 text-[var(--color-text)]">{planLimitModalText}</p>
      </ModalShell>
    </div>
  );
}

function LandingCard({
  landing,
  urlBase,
  duplicating,
  onDuplicate,
}: {
  landing: Landing;
  urlBase: string | null;
  duplicating: boolean;
  onDuplicate: (landing: Landing) => void;
}) {
  const publicUrl =
    landing.landingType === "external"
      ? urlBase
        ? `${urlBase.replace(/\/$/, "")}/${landing.name}`
        : "#"
      : buildLandingPublicUrl(landing.name, landing.publishTarget, urlBase);
  const publishLabel =
    landing.landingType === "external"
      ? "Conectada externa"
      : landing.publishTarget === "constructor"
        ? "Constructor"
        : "Clasico";

  return (
    <div
      key={landing.id}
      className="ui-card group relative aspect-[3/4] w-full overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-raised)]"
    >
      <Link href={`/dashboard/landing/${landing.id}/editar`} className="absolute inset-0">
        <div className="group/img absolute inset-0 overflow-hidden">
          <div className="h-full w-full transition-transform duration-500 ease-out group-hover/img:scale-[1.025]">
            <LandingPreview config={landing.config} compact gallery />
          </div>
        </div>
      </Link>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-[#07090d] via-[#07090d]/95 to-transparent px-3 pb-3 pt-12">
        <div className="space-y-0.5">
          <p className="truncate text-xs font-medium text-[var(--color-text-strong)]">
            {landing.name}
          </p>
          <p className="truncate text-[10px] text-[var(--color-text-muted)]">
            {landing.pixelId ? `Pixel: ${landing.pixelId}` : "Pixel: sin configurar"}
          </p>
          <p className="truncate text-[10px] text-[var(--color-text-muted)]">
            Teléfono: {landing.phoneMode === "fair" ? "equitativo" : "aleatorio"}
          </p>
          <p className="truncate text-[10px] text-[var(--color-text-muted)]">
            Motor: {publishLabel}
          </p>
          {landing.comment ? (
            <p className="truncate text-[10px] text-[var(--color-text-muted)]">{landing.comment}</p>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5 pt-1">
          <a
            href={publicUrl}
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
            href={`/dashboard/landing/${landing.id}/editar`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[rgba(255,255,255,0.06)] px-2 py-1 text-[10px] font-medium text-[var(--color-text)] transition hover:bg-[rgba(255,255,255,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-neutral)]"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(landing);
            }}
            disabled={duplicating}
            className="inline-flex h-[26px] w-[30px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-[rgba(255,255,255,0.06)] text-[var(--color-text)] transition hover:bg-[rgba(255,255,255,0.1)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-neutral)]"
            title="Duplicar landing"
            aria-label={`Duplicar landing ${landing.name}`}
          >
            {duplicating ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-zinc-100" />
            ) : (
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="8" y="8" width="11" height="11" rx="2" />
                <path d="M5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

