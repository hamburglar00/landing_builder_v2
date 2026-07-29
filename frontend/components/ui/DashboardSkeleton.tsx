"use client";

export function DashboardSkeleton({ title = "Cargando..." }: { title?: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="border-b border-[var(--color-border-subtle)] pb-5">
        <div className="h-2.5 w-20 animate-pulse rounded-full bg-[var(--color-bg-raised)]" />
        <div className="mt-3 h-6 w-48 animate-pulse rounded-lg bg-[var(--color-bg-raised)]" />
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{title}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="ui-card p-4">
            <div className="h-2.5 w-24 animate-pulse rounded-full bg-[var(--color-bg-raised)]" />
            <div className="mt-4 h-7 w-20 animate-pulse rounded-lg bg-[var(--color-bg-raised)]" />
            <div className="mt-3 h-2 w-32 animate-pulse rounded-full bg-[var(--color-bg-3)]" />
          </div>
        ))}
      </div>
      <div className="ui-card p-4">
        <div className="h-4 w-36 animate-pulse rounded-lg bg-[var(--color-bg-raised)]" />
        <div className="mt-5 space-y-2.5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-9 animate-pulse rounded-lg bg-[var(--color-bg-2)]" />
          ))}
        </div>
      </div>
    </div>
  );
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
