export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export function FunnelTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
    </svg>
  );
}

export function TrackingTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 15l3-3 3 2 4-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 10h2v2" />
    </svg>
  );
}

export function TableTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M9 5v14M15 5v14" />
    </svg>
  );
}

export function StatsTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
      <rect x="6" y="11" width="3" height="6" rx="1" />
      <rect x="11" y="8" width="3" height="9" rx="1" />
      <rect x="16" y="5" width="3" height="12" rx="1" />
    </svg>
  );
}

export function PerformanceTabIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
      <path d="M8 4v16M16 4v16" />
      <path d="M6 9h4M14 15h4" />
    </svg>
  );
}

export function GearTabIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .37 2l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-2-.37 1.8 1.8 0 0 0-1 1.62V21a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1-1.62 1.8 1.8 0 0 0-2 .37l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.8 1.8 0 0 0 .37-2 1.8 1.8 0 0 0-1.62-1H3a2 2 0 0 1 0-4h.09a1.8 1.8 0 0 0 1.62-1 1.8 1.8 0 0 0-.37-2l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.8 1.8 0 0 0 2 .37H9A1.8 1.8 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1 1.62 1.8 1.8 0 0 0 2-.37l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.37 2V11c0 .74.42 1.4 1.1 1.73" />
    </svg>
  );
}

export function LogsTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6M9 13h6M9 9h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h8l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  );
}

export function estadoBadge(estado: string, isRepeat = false) {
  const cls =
    estado === "purchase" && isRepeat
      ? "bg-violet-950 text-violet-300"
      : estado === "purchase"
        ? "bg-rose-950 text-rose-300"
        : estado === "lead"
          ? "bg-amber-950 text-amber-300"
          : "bg-zinc-800 text-zinc-400";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${cls}`}>
      {estado === "purchase" && isRepeat ? "purchase repeat" : estado}
    </span>
  );
}

export function statusText(status: string) {
  if (status === "enviado") return <span className="text-emerald-400">enviado</span>;
  if (status === "error") return <span className="text-red-400">error</span>;
  if (status === "skipped_meta_crawler") return <span className="text-zinc-400">omitido bot meta</span>;
  if (status === "skipped_contact_capi_disabled") return <span className="text-amber-300">omitido: Contact desactivado</span>;
  if (status === "skipped_lead_capi_disabled") return <span className="text-amber-300">omitido: Lead desactivado</span>;
  if (status === "skipped_first_purchase_capi_disabled") return <span className="text-amber-300">omitido: First desactivado</span>;
  if (status === "skipped_repeat_purchase_capi_disabled") return <span className="text-amber-300">omitido: Repeat desactivado</span>;
  if (status === "skipped_purchase_capi_disabled") return <span className="text-amber-300">omitido: Purchase desactivado</span>;
  if (status === "skipped_chatrace_capi_disabled") return <span className="text-amber-300">omitido: Chatrace desactivado</span>;
  if (status.startsWith("skipped")) return <span className="text-zinc-400">omitido</span>;
  return <span className="text-zinc-600">-</span>;
}

export function levelBadge(level: string, functionName?: string, message?: string) {
  const cls =
    level === "ERROR"
      ? "bg-red-950 text-red-300"
      : level === "DEBUG"
        ? "bg-zinc-800 text-zinc-500"
        : "bg-blue-950 text-blue-300";
  const msg = String(message ?? "").toLowerCase();
  const fn = String(functionName ?? "").toLowerCase();
  const event = fn.includes("handlecontact") ? "CONTACT"
    : fn.includes("handlelead") ? "LEAD"
    : fn.includes("handlepurchase") || fn.includes("handlesimplepurchase") ? "PURCHASE"
    : (
      msg.includes("contact") ? "CONTACT" :
      msg.includes("lead") ? "LEAD" :
      msg.includes("purchase") || msg.includes("compra") || msg.includes("recarga") ? "PURCHASE" :
      null
    );
  const text = level === "ERROR"
    ? (event ? `ERROR / ${event}` : "ERROR")
    : (event ?? level);
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {text}
    </span>
  );
}
