import type { ReactNode } from "react";
import {
  COLUMN_NOTES,
  columnLabel,
  type ConversionColumnKey,
  type ConversionTableView,
} from "@/components/conversiones/conversionPageShared";

export type ConversionTabId =
  | "funnel"
  | "seguimiento"
  | "tabla"
  | "estadisticas"
  | "desempeno"
  | "configuracion"
  | "inbox"
  | "logs";

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

function InboxTabIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 overflow-visible"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
      <path d="M3 14h4.6l1.8 2h5.2l1.8-2H21" />
    </svg>
  );
}

function iconForTab(tab: ConversionTabId): ReactNode {
  if (tab === "funnel") return <FunnelTabIcon />;
  if (tab === "seguimiento") return <TrackingTabIcon />;
  if (tab === "tabla") return <TableTabIcon />;
  if (tab === "estadisticas") return <StatsTabIcon />;
  if (tab === "desempeno") return <PerformanceTabIcon />;
  if (tab === "configuracion") return <GearTabIcon />;
  if (tab === "inbox") return <InboxTabIcon />;
  return <LogsTabIcon />;
}

type ConversionTabsProps<T extends ConversionTabId> = {
  tabs: readonly T[];
  utilityTabs: readonly T[];
  labels: Readonly<Record<T, string>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  trailing?: ReactNode;
};

export function ConversionTabs<T extends ConversionTabId>({
  tabs,
  utilityTabs,
  labels,
  activeTab,
  onTabChange,
  trailing,
}: ConversionTabsProps<T>) {
  const renderTab = (tab: T) => {
    const active = activeTab === tab;
    return (
      <button
        key={tab}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onTabChange(tab)}
        className="ui-tab whitespace-nowrap"
        data-active={active ? "true" : "false"}
      >
        <span className="inline-flex items-center gap-1.5">
          {iconForTab(tab)}
          {labels[tab]}
        </span>
      </button>
    );
  };

  return (
    <div
      className="ui-tabs flex items-center justify-between gap-2 overflow-x-auto"
      role="tablist"
      aria-label="Secciones de conversiones"
    >
      <div className="flex min-w-max gap-1">
        {tabs.filter((tab) => !utilityTabs.includes(tab)).map(renderTab)}
      </div>
      <div className="ml-auto flex min-w-max items-center gap-1">
        {tabs.filter((tab) => utilityTabs.includes(tab)).map(renderTab)}
        {trailing}
      </div>
    </div>
  );
}

export function ConversionTableHeader({
  columns,
  view = "technical",
}: {
  columns: readonly ConversionColumnKey[];
  view?: ConversionTableView;
}) {
  const friendly = view === "friendly";
  return (
    <thead
      className={`sticky top-0 z-20 ${
        friendly ? "bg-[#13211d]/95" : "bg-zinc-800/95"
      }`}
    >
      <tr>
        <th
          className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap cursor-help"
          title={COLUMN_NOTES.id}
        >
          {friendly ? "Registro" : "ID"}
        </th>
        <th
          className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap cursor-help"
          title={COLUMN_NOTES.timestamp}
        >
          {friendly ? "Fecha y hora" : "timestamp"}
        </th>
        {columns.map((column) => (
          <th
            key={column}
            className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap cursor-help"
            title={COLUMN_NOTES[column] ?? column}
          >
            {columnLabel(column, view)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function ConversionTableViewToggle({
  view,
  onToggle,
}: {
  view: ConversionTableView;
  onToggle: () => void;
}) {
  const friendly = view === "friendly";
  const nextView = friendly ? "técnica" : "reducida";

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Cambiar a vista ${nextView}`}
        title={`Cambiar a vista ${nextView}`}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
          friendly
            ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20"
            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
        }`}
      >
        <svg
          className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 7h-5V2M4 17h5v5M19 11a7.5 7.5 0 0 0-12.7-4.4L5 8m14 8-1.3 1.4A7.5 7.5 0 0 1 5 13"
          />
        </svg>
      </button>
      <span className="pointer-events-none absolute right-0 top-10 z-40 hidden w-max rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-[10px] text-zinc-300 shadow-xl group-hover:block">
        Cambiar a vista {nextView}
      </span>
    </div>
  );
}

export function ConversionPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= pageSize) return null;

  return (
    <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
      <span>
        Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalItems)} de {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          {page}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export function estadoBadge(estado: string, isRepeat = false) {
  const normalized = estado === "LeadSubmitted" ? "lead" : estado;
  const cls =
    normalized === "purchase" && isRepeat
      ? "bg-violet-950 text-violet-300"
      : normalized === "purchase"
        ? "bg-rose-950 text-rose-300"
        : normalized === "lead"
          ? "bg-amber-950 text-amber-300"
          : "bg-zinc-800 text-zinc-400";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${cls}`}>
      {normalized === "purchase" && isRepeat ? "purchase repeat" : estado}
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

type MetaResponseLog = {
  function_name: string;
  message: string;
  response_meta?: string | null;
};

export function isSuccessfulMetaResponse(log: MetaResponseLog): boolean {
  if (
    log.function_name !== "sendToMetaCAPI" ||
    log.message !== "Meta CAPI respuesta" ||
    !log.response_meta
  ) {
    return false;
  }

  try {
    const parsed = JSON.parse(log.response_meta) as {
      error?: unknown;
      events_received?: number | string;
    };
    const eventsReceived = typeof parsed.events_received === "number"
      ? parsed.events_received
      : Number(parsed.events_received ?? 0);
    return !parsed.error && Number.isFinite(eventsReceived) && eventsReceived > 0;
  } catch {
    return false;
  }
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
    : fn.includes("handlecompleteregistration") ? "COMPLETEREGISTRATION"
    : fn.includes("handlepurchase") || fn.includes("handlesimplepurchase") ? "PURCHASE"
    : (
      msg.includes("contact") ? "CONTACT" :
      msg.includes("lead") ? "LEAD" :
      msg.includes("completeregistration") || msg.includes("registro") ? "COMPLETEREGISTRATION" :
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
