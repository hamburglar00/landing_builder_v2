"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import type { Gerencia, GerenciaWorkGroup } from "@/lib/gerencias/types";
import type { LandingGerenciaAssignment } from "@/lib/gerencias/gerenciasDb";
import type { Landing, PhoneKind } from "@/lib/landing/types";
import { CollapsibleSection } from "@/components/landing/LandingEditorForm";

const PHONE_KIND_OPTIONS: Array<{ value: PhoneKind; label: string }> = [
  { value: "carga", label: "Carga" },
  { value: "assistant", label: "Asistente" },
  { value: "ads", label: "Ads" },
  { value: "mkt", label: "Mkt" },
];

type Props = {
  landing: Landing;
  setLanding: Dispatch<SetStateAction<Landing | null>>;
  gerencias: Gerencia[];
  workGroups: GerenciaWorkGroup[];
  assignments: LandingGerenciaAssignment[];
  setAssignments: Dispatch<SetStateAction<LandingGerenciaAssignment[]>>;
  createGerenciasHref: string;
};

type DisplayGroup = {
  id: string;
  name: string;
  gerencias: Gerencia[];
};

function buildDisplayGroups(gerencias: Gerencia[], workGroups: GerenciaWorkGroup[]): DisplayGroup[] {
  if (workGroups.length === 0) {
    return [{ id: "__all__", name: "Todas las gerencias", gerencias }];
  }

  const byId = new Map(gerencias.map((g) => [g.id, g]));
  const groupedIds = new Set<number>();
  const groups = workGroups.map((group) => {
    const groupGerencias = group.gerenciaIds
      .map((id) => byId.get(id))
      .filter((g): g is Gerencia => Boolean(g));
    groupGerencias.forEach((g) => groupedIds.add(g.id));
    return {
      id: String(group.id),
      name: group.name,
      gerencias: groupGerencias,
    };
  });

  const ungrouped = gerencias.filter((g) => !groupedIds.has(g.id));
  if (ungrouped.length > 0) {
    groups.push({ id: "__ungrouped__", name: "Sin grupo", gerencias: ungrouped });
  }

  return groups;
}

export function GerenciaRedirectSection({
  landing,
  setLanding,
  gerencias,
  workGroups,
  assignments,
  setAssignments,
  createGerenciasHref,
}: Props) {
  const displayGroups = buildDisplayGroups(gerencias, workGroups);

  const upsertAssignment = (g: Gerencia) => {
    const exists = assignments.some((a) => a.gerencia_id === g.id);
    if (exists) {
      setAssignments((prev) => prev.filter((a) => a.gerencia_id !== g.id));
      return;
    }
    setAssignments((prev) => [
      ...prev,
      {
        gerencia_id: g.id,
        weight: 1,
        phoneMode: "random",
        phoneKind: "carga",
        intervalStartHour: null,
        intervalEndHour: null,
      },
    ]);
  };

  const renderRows = (rows: Gerencia[]) => {
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={landing.gerenciaSelectionMode === "weighted_random" ? 7 : 6} className="px-3 py-4 text-center text-xs text-zinc-500">
            Este grupo todavía no tiene gerencias.
          </td>
        </tr>
      );
    }

    return rows.map((g) => {
      const assignment = assignments.find((a) => a.gerencia_id === g.id);
      const isAssigned = !!assignment;
      const weight = assignment?.weight ?? 0;
      const phoneMode = assignment?.phoneMode ?? "random";
      const phoneKind = assignment?.phoneKind ?? "carga";
      const intervalStartHour = assignment?.intervalStartHour ?? null;
      const intervalEndHour = assignment?.intervalEndHour ?? null;
      return (
        <tr key={g.id} className="bg-zinc-950/40">
          <td className="px-3 py-2 text-zinc-300">{g.gerencia_id ?? "MANUAL"}</td>
          <td className="px-3 py-2 text-zinc-200">{g.nombre}</td>
          <td className="px-3 py-2 text-center">
            <input
              type="checkbox"
              checked={isAssigned}
              onChange={() => upsertAssignment(g)}
              className="rounded border-zinc-600"
            />
          </td>
          {landing.gerenciaSelectionMode === "weighted_random" && (
            <td className="px-3 py-2">
              <input
                type="number"
                min={0}
                value={weight}
                onChange={(e) => {
                  if (!isAssigned) return;
                  const v = parseInt(e.target.value, 10);
                  const next = Number.isNaN(v) ? 0 : Math.max(0, v);
                  setAssignments((prev) =>
                    prev.map((a) => (a.gerencia_id === g.id ? { ...a, weight: next } : a)),
                  );
                }}
                disabled={!isAssigned}
                title={isAssigned ? "Peso de esta gerencia en esta landing" : "Marque Asignar para poder editar el peso"}
                className="w-10 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </td>
          )}
          <td className="px-3 py-2">
            <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  if (!isAssigned) return;
                  setAssignments((prev) =>
                    prev.map((a) => (a.gerencia_id === g.id ? { ...a, phoneMode: "random" } : a)),
                  );
                }}
                className={`cursor-pointer rounded-l-lg border-r border-zinc-700 px-2 py-1 ${
                  phoneMode === "random" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                Aleatorio
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isAssigned) return;
                  setAssignments((prev) =>
                    prev.map((a) => (a.gerencia_id === g.id ? { ...a, phoneMode: "fair" } : a)),
                  );
                }}
                className={`cursor-pointer rounded-r-lg px-2 py-1 ${
                  phoneMode === "fair" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                Equitativo
              </button>
            </div>
          </td>
          <td className="min-w-[190px] px-3 py-2">
            <div className="inline-flex flex-shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
              {PHONE_KIND_OPTIONS.map(({ value: kind, label }, idx) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    if (!isAssigned) return;
                    setAssignments((prev) =>
                      prev.map((a) => (a.gerencia_id === g.id ? { ...a, phoneKind: kind } : a)),
                    );
                  }}
                  className={`cursor-pointer shrink-0 px-2 py-1 ${idx === 0 ? "rounded-l-lg" : ""} ${
                    idx === PHONE_KIND_OPTIONS.length - 1 ? "rounded-r-lg" : "border-r border-zinc-700"
                  } ${phoneKind === kind ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </td>
          <td className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={intervalStartHour !== null && intervalEndHour !== null}
                  onChange={(e) => {
                    if (!isAssigned) return;
                    setAssignments((prev) =>
                      prev.map((a) => {
                        if (a.gerencia_id !== g.id) return a;
                        if (!e.target.checked) return { ...a, intervalStartHour: null, intervalEndHour: null };
                        return {
                          ...a,
                          intervalStartHour: a.intervalStartHour ?? 9,
                          intervalEndHour: a.intervalEndHour ?? 21,
                        };
                      }),
                    );
                  }}
                  className="rounded border-zinc-600"
                />
                <span>Aplicar</span>
              </label>
              {intervalStartHour !== null && intervalEndHour !== null && (
                <div className="flex flex-wrap items-center gap-1">
                  <span>Dentro de</span>
                  <select
                    value={intervalStartHour}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      const n = Number.isNaN(v) ? 0 : Math.max(0, Math.min(23, v));
                      setAssignments((prev) =>
                        prev.map((a) => (a.gerencia_id === g.id ? { ...a, intervalStartHour: n } : a)),
                      );
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>{h.toString().padStart(2, "0")}:00</option>
                    ))}
                  </select>
                  <span>a</span>
                  <select
                    value={intervalEndHour}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      const n = Number.isNaN(v) ? 0 : Math.max(0, Math.min(23, v));
                      setAssignments((prev) =>
                        prev.map((a) => (a.gerencia_id === g.id ? { ...a, intervalEndHour: n } : a)),
                      );
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>{h.toString().padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <CollapsibleSection title="Redirección">
      <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-300">Selección de gerencias</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
            <button
              type="button"
              onClick={() => setLanding((prev) => (prev ? { ...prev, gerenciaSelectionMode: "weighted_random" } : prev))}
              className={`cursor-pointer rounded-l-lg border-r border-zinc-700 px-2 py-1 ${
                landing.gerenciaSelectionMode === "weighted_random" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
              }`}
              title="Aleatorio por peso de gerencia"
            >
              Aleatoria (peso)
            </button>
            <button
              type="button"
              onClick={() => setLanding((prev) => (prev ? { ...prev, gerenciaSelectionMode: "fair" } : prev))}
              className={`cursor-pointer rounded-r-lg px-2 py-1 ${
                landing.gerenciaSelectionMode === "fair" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
              }`}
              title="Equitativo entre gerencias (ignora peso)"
            >
              Equitativa
            </button>
          </div>
          {landing.gerenciaSelectionMode === "fair" && (
            <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
              <button
                type="button"
                onClick={() => setLanding((prev) => (prev ? { ...prev, gerenciaFairCriterion: "usage_count" } : prev))}
                className={`cursor-pointer rounded-l-lg border-r border-zinc-700 px-2 py-1 ${
                  landing.gerenciaFairCriterion === "usage_count" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                }`}
                title="Equitativo por sumatoria de contador"
              >
                Por contador
              </button>
              <button
                type="button"
                onClick={() => setLanding((prev) => (prev ? { ...prev, gerenciaFairCriterion: "messages_received" } : prev))}
                className={`cursor-pointer rounded-r-lg px-2 py-1 ${
                  landing.gerenciaFairCriterion === "messages_received" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                }`}
                title="Equitativo por sumatoria de mensajes recibidos"
              >
                Mensajes recibidos
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="mb-3 text-xs text-zinc-400">Configura a dónde redirigirá el CTA de tu landing page.</p>
      <p className="mb-3 text-xs text-zinc-500">
        Desplegá un grupo de trabajo y marcá <strong>Asignar</strong> para incluir sus gerencias. La asignación real sigue siendo por gerencia individual.
      </p>
      {gerencias.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No tienes gerencias.{" "}
          <Link href={createGerenciasHref} className="text-zinc-300 underline hover:text-zinc-100">
            Crear gerencias
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          {displayGroups.map((group) => {
            const assignedCount = group.gerencias.filter((g) => assignments.some((a) => a.gerencia_id === g.id)).length;
            return (
              <details key={group.id} className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-200 marker:hidden">
                  <span>{group.name}</span>
                  <span className="text-[11px] font-normal text-zinc-500">
                    {assignedCount}/{group.gerencias.length} asignadas
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-zinc-800">
                  <table className="min-w-[900px] text-left text-sm md:min-w-full">
                    <thead className="bg-zinc-800/80">
                      <tr>
                        <th className="px-3 py-2 font-medium text-zinc-300">Gerencia</th>
                        <th className="px-3 py-2 font-medium text-zinc-300">Nombre</th>
                        <th className="w-20 px-3 py-2 text-center font-medium text-zinc-300">Asignar</th>
                        {landing.gerenciaSelectionMode === "weighted_random" && (
                          <th className="w-10 px-3 py-2 font-medium text-zinc-300">Peso</th>
                        )}
                        <th className="w-32 px-3 py-2 font-medium text-zinc-300">Modo</th>
                        <th className="min-w-[140px] px-3 py-2 font-medium text-zinc-300">Tipo</th>
                        <th className="w-56 px-3 py-2 font-medium text-zinc-300">Intervalo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">{renderRows(group.gerencias)}</tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
