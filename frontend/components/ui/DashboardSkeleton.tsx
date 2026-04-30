"use client";

export function DashboardSkeleton({ title = "Cargando..." }: { title?: string }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div>
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-800" />
        <p className="mt-2 text-sm text-zinc-500">{title}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-800" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-zinc-800" />
            <div className="mt-2 h-2 w-32 animate-pulse rounded bg-zinc-900" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="h-4 w-36 animate-pulse rounded bg-zinc-800" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-8 animate-pulse rounded bg-zinc-950/80" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PanelSkeleton({ title = "Preparando vista..." }: { title?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4" aria-busy="true" aria-live="polite">
      <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
      <p className="mt-2 text-xs text-zinc-500">{title}</p>
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-9 animate-pulse rounded bg-zinc-950/80" />
        ))}
      </div>
    </div>
  );
}
