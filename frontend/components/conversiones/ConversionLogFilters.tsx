"use client";

import { useState } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import type {
  ConversionLogDirectionFilter,
  ConversionLogEventFilter,
} from "@/lib/conversionLogFilters";

type ConversionLogFiltersProps = {
  direction: ConversionLogDirectionFilter;
  eventType: ConversionLogEventFilter;
  onApply: (
    direction: ConversionLogDirectionFilter,
    eventType: ConversionLogEventFilter,
  ) => void;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100";

export default function ConversionLogFilters({
  direction,
  eventType,
  onApply,
}: ConversionLogFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draftDirection, setDraftDirection] =
    useState<ConversionLogDirectionFilter>(direction);
  const [draftEventType, setDraftEventType] =
    useState<ConversionLogEventFilter>(eventType);
  const activeCount =
    (direction === "all" ? 0 : 1) + (eventType === "all" ? 0 : 1);

  const openModal = () => {
    setDraftDirection(direction);
    setDraftEventType(eventType);
    setOpen(true);
  };

  const apply = () => {
    onApply(draftDirection, draftEventType);
    setOpen(false);
  };

  const clear = () => {
    setDraftDirection("all");
    setDraftEventType("all");
    onApply("all", "all");
    setOpen(false);
  };

  return (
    <>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={openModal}
          className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition sm:h-7 ${
            activeCount > 0
              ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
              : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          }`}
          title="Filtrar Logs por recorrido y tipo de evento"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Aplicar filtros
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/60 bg-red-950/50 text-sm font-bold text-red-200 transition hover:bg-red-900/70"
            title="Quitar filtros de Logs"
            aria-label="Quitar filtros de Logs"
          >
            ×
          </button>
        )}
      </span>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/70 p-3 sm:p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="conversion-log-filters-title"
              className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
            >
              <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
                <h3
                  id="conversion-log-filters-title"
                  className="text-sm font-semibold text-zinc-100"
                >
                  Filtros de Logs
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  Separá lo recibido por el Constructor de los requests enviados
                  a Meta. Los envíos conservan visible la respuesta de Meta.
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                <div>
                  <label
                    htmlFor="conversion-log-direction"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Origen del log
                  </label>
                  <select
                    id="conversion-log-direction"
                    value={draftDirection}
                    onChange={(event) =>
                      setDraftDirection(
                        event.target.value as ConversionLogDirectionFilter,
                      )}
                    className={selectClassName}
                  >
                    <option value="all">Todos los logs</option>
                    <option value="received">Eventos recibidos</option>
                    <option value="meta">Eventos enviados a Meta</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="conversion-log-event"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Tipo de evento
                  </label>
                  <select
                    id="conversion-log-event"
                    value={draftEventType}
                    onChange={(event) =>
                      setDraftEventType(
                        event.target.value as ConversionLogEventFilter,
                      )}
                    className={selectClassName}
                  >
                    <option value="all">Todos los eventos</option>
                    <option value="CONTACT">Contact</option>
                    <option value="LEAD">Lead</option>
                    <option value="PURCHASE">Purchase</option>
                  </select>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-800 px-4 py-3">
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-md px-2 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-300"
                >
                  Limpiar
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-500"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
