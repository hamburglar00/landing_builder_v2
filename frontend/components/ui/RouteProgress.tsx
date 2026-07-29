export function RouteProgress({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px] overflow-hidden bg-[rgba(163,230,53,0.08)]"
      role="status"
      aria-live="polite"
      aria-label="Cargando sección"
    >
      <div className="route-progress-bar h-full w-2/5 rounded-r-full bg-[var(--color-primary)] shadow-[0_0_18px_rgba(163,230,53,0.6)]" />
      <span className="sr-only">Cargando sección…</span>
    </div>
  );
}
