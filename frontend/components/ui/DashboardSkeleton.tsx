"use client";

import { LandingBuilderLoading } from "@/components/brand/LandingBuilderLoading";

export function DashboardSkeleton({ title = "Cargando..." }: { title?: string }) {
  return <LandingBuilderLoading label={title} />;
}

export function PanelSkeleton({ title = "Preparando vista..." }: { title?: string }) {
  return (
    <div className="ui-card p-4" aria-busy="true" aria-live="polite">
      <div className="h-4 w-40 animate-pulse rounded-lg bg-[var(--color-bg-raised)]" />
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{title}</p>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-9 animate-pulse rounded-lg bg-[var(--color-bg-2)]" />
        ))}
      </div>
    </div>
  );
}
