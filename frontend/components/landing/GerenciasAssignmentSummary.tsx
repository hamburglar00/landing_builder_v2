"use client";

import type { LandingGerenciaAssignment } from "@/lib/gerencias/gerenciasDb";
import type { Gerencia } from "@/lib/gerencias/types";
import type { Landing } from "@/lib/landing/types";

type Props = {
  assignments: LandingGerenciaAssignment[];
  gerencias: Gerencia[];
  selectionMode: Landing["gerenciaSelectionMode"];
};

const PHONE_KIND_LABEL: Record<LandingGerenciaAssignment["phoneKind"], string> = {
  carga: "Carga",
  ads: "Ads",
  mkt: "Mkt",
  assistant: "Asistente",
};

function formatInterval(assignment: LandingGerenciaAssignment): string | null {
  if (assignment.intervalStartHour === null || assignment.intervalEndHour === null) {
    return null;
  }

  const start = String(assignment.intervalStartHour).padStart(2, "0");
  const end = String(assignment.intervalEndHour).padStart(2, "0");
  return `${start}:00-${end}:00`;
}

export function GerenciasAssignmentSummary({
  assignments,
  gerencias,
  selectionMode,
}: Props) {
  const gerenciaById = new Map(gerencias.map((gerencia) => [gerencia.id, gerencia]));
  const assignedRows = assignments
    .map((assignment) => ({
      assignment,
      gerencia: gerenciaById.get(assignment.gerencia_id),
    }))
    .sort((a, b) => {
      const aName = a.gerencia?.nombre ?? `Gerencia ${a.assignment.gerencia_id}`;
      const bName = b.gerencia?.nombre ?? `Gerencia ${b.assignment.gerencia_id}`;
      return aName.localeCompare(bName, "es", { numeric: true, sensitivity: "base" });
    });

  return (
    <section className="mt-3 rounded-xl border border-[var(--color-border-subtle)] bg-zinc-950/45 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase text-zinc-300">
          RESUMEN DE GERENCIAS ASIGNADAS
        </h3>
        <span className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
          {assignedRows.length}
        </span>
      </div>

      {assignedRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 px-3 py-3 text-xs text-zinc-500">
          Sin gerencias asignadas.
        </p>
      ) : (
        <ul className="space-y-2">
          {assignedRows.map(({ assignment, gerencia }) => {
            const externalId = gerencia?.gerencia_id ?? assignment.gerencia_id;
            const interval = formatInterval(assignment);

            return (
              <li
                key={assignment.gerencia_id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-100">
                      {gerencia?.nombre ?? "Gerencia sin nombre"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      ID {externalId}
                    </p>
                  </div>
                  {selectionMode === "weighted_random" && (
                    <span className="shrink-0 rounded-md bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-400">
                      Peso {assignment.weight}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-400">
                  <span className="rounded-md bg-zinc-950 px-1.5 py-0.5">
                    {assignment.phoneMode === "fair" ? "Equitativo" : "Aleatorio"}
                  </span>
                  <span className="rounded-md bg-zinc-950 px-1.5 py-0.5">
                    {PHONE_KIND_LABEL[assignment.phoneKind] ?? assignment.phoneKind}
                  </span>
                  {interval && (
                    <span className="rounded-md bg-zinc-950 px-1.5 py-0.5">
                      {interval}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
