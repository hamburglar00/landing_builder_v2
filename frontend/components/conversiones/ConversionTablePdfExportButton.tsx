"use client";

import { useMemo, useState } from "react";
import type { ConversionRow } from "@/lib/conversionsDb";
import type { ConversionColumnKey } from "@/components/conversiones/conversionPageShared";
import { exportConversionTablePdf } from "@/components/conversiones/exportConversionTablePdf";

type EventKey = "contact" | "lead" | "purchase";

const EVENT_OPTIONS: { key: EventKey; label: string }[] = [
  { key: "contact", label: "Contact" },
  { key: "lead", label: "Lead" },
  { key: "purchase", label: "Purchase" },
];

type Props = {
  rows: ConversionRow[];
  columns: ConversionColumnKey[];
  filters: string[];
  workspaceName?: string;
  disabled?: boolean;
};

export default function ConversionTablePdfExportButton({
  rows,
  columns,
  filters,
  workspaceName,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<Record<EventKey, boolean>>({
    contact: false,
    lead: true,
    purchase: true,
  });

  const counts = useMemo(() => {
    return rows.reduce<Record<EventKey, number>>(
      (acc, row) => {
        const status = String(row.estado ?? "").toLowerCase();
        if (status === "contact" || status === "lead" || status === "purchase") {
          acc[status] += 1;
        }
        return acc;
      },
      { contact: 0, lead: 0, purchase: 0 },
    );
  }, [rows]);

  const selectedRows = useMemo(() => {
    return rows.filter((row) => {
      const status = String(row.estado ?? "").toLowerCase();
      return (
        (status === "contact" && selectedEvents.contact) ||
        (status === "lead" && selectedEvents.lead) ||
        (status === "purchase" && selectedEvents.purchase)
      );
    });
  }, [rows, selectedEvents]);

  const canExport = !disabled && selectedRows.length > 0 && Object.values(selectedEvents).some(Boolean);

  const toggleEvent = (key: EventKey) => {
    setSelectedEvents((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleExport = () => {
    if (!canExport) return;
    void exportConversionTablePdf({
      rows: selectedRows,
      metricRows: rows,
      columns,
      filters: [
        ...filters,
        `Eventos: ${EVENT_OPTIONS.filter((option) => selectedEvents[option.key]).map((option) => option.label).join(", ")}`,
      ],
      workspaceName,
      selectedEventTypes: EVENT_OPTIONS.filter((option) => selectedEvents[option.key]).map((option) => option.key),
    });
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        className="h-8 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600"
      >
        Exportar PDF
      </button>
      {open && !disabled ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-2xl shadow-black/40">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Tipo de evento
          </p>
          <div className="space-y-2">
            {EVENT_OPTIONS.map((option) => (
              <label
                key={option.key}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-200"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedEvents[option.key]}
                    onChange={() => toggleEvent(option.key)}
                    className="h-3.5 w-3.5 accent-emerald-400"
                  />
                  {option.label}
                </span>
                <span className="font-mono text-[11px] text-zinc-500">{counts[option.key]}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-500">
              {selectedRows.length} filas
            </span>
            <button
              type="button"
              onClick={handleExport}
              disabled={!canExport}
              className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[11px] font-bold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              Exportar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
