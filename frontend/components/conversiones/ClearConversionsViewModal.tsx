"use client";

import { useCallback, useEffect, useState } from "react";

export type ClearConversionsViewMode = "keep_current_month" | "hide_all";

export default function ClearConversionsViewModal({
  open,
  busy,
  currentMonthLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  currentMonthLabel: string;
  onClose: () => void;
  onConfirm: (mode: ClearConversionsViewMode) => void;
}) {
  const [mode, setMode] =
    useState<ClearConversionsViewMode>("keep_current_month");
  const closeModal = useCallback(() => {
    setMode("keep_current_month");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, closeModal]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) closeModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-conversions-title"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl shadow-black/60 sm:p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Organización de la vista
            </p>
            <h2
              id="clear-conversions-title"
              className="mt-1 text-base font-semibold text-zinc-100"
            >
              Limpiar vistas de Conversiones
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Elegí cuánto historial querés mantener visible en Funnel, Tabla,
              Estadísticas, Inbox y Logs.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            disabled={busy}
            onClick={closeModal}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            role="radio"
            aria-checked={mode === "keep_current_month"}
            onClick={() => setMode("keep_current_month")}
            className={`w-full rounded-xl border p-3 text-left transition ${
              mode === "keep_current_month"
                ? "border-emerald-500/70 bg-emerald-950/30"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`h-3.5 w-3.5 rounded-full border ${
                  mode === "keep_current_month"
                    ? "border-emerald-400 bg-emerald-400 shadow-[inset_0_0_0_3px_#052e16]"
                    : "border-zinc-600"
                }`}
              />
              <span className="text-sm font-medium text-zinc-100">
                Conservar {currentMonthLabel}
              </span>
              <span className="rounded border border-emerald-800/70 bg-emerald-950 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">
                Recomendado
              </span>
            </span>
            <span className="mt-1.5 block pl-5 text-[11px] leading-relaxed text-zinc-400">
              Oculta todo lo anterior al primer día del mes actual y mantiene
              visibles sus registros.
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={mode === "hide_all"}
            onClick={() => setMode("hide_all")}
            className={`w-full rounded-xl border p-3 text-left transition ${
              mode === "hide_all"
                ? "border-amber-500/70 bg-amber-950/25"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`h-3.5 w-3.5 rounded-full border ${
                  mode === "hide_all"
                    ? "border-amber-400 bg-amber-400 shadow-[inset_0_0_0_3px_#451a03]"
                    : "border-zinc-600"
                }`}
              />
              <span className="text-sm font-medium text-zinc-100">
                Ocultar todo lo actual
              </span>
            </span>
            <span className="mt-1.5 block pl-5 text-[11px] leading-relaxed text-zinc-400">
              Vacía las vistas ahora. Las conversiones nuevas volverán a
              aparecer normalmente.
            </span>
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={closeModal}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const selectedMode = mode;
              setMode("keep_current_month");
              onConfirm(selectedMode);
            }}
            className="ui-button ui-button-primary"
          >
            {busy ? "Limpiando..." : "Aplicar limpieza"}
          </button>
        </div>
      </div>
    </div>
  );
}
