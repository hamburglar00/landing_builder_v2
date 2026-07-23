export function RouteProgress({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden bg-cyan-950/40"
      role="status"
      aria-live="polite"
      aria-label="Cargando sección"
    >
      <div className="route-progress-bar h-full w-2/5 rounded-r-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.65)]" />
      <span className="sr-only">Cargando sección…</span>
    </div>
  );
}
