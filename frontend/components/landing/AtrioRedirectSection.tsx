"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { buildAtrioUrl, type AtrioClient, type LandingAtrioAssignment } from "@/lib/atrio/atrioDb";
import type { Landing } from "@/lib/landing/types";
import { CollapsibleSection } from "@/components/landing/LandingEditorForm";

type Props = {
  landing: Landing;
  setLanding: Dispatch<SetStateAction<Landing | null>>;
  atrioClients: AtrioClient[];
  assignments: LandingAtrioAssignment[];
  setAssignments: Dispatch<SetStateAction<LandingAtrioAssignment[]>>;
  createAtrioHref: string;
};

export function AtrioRedirectSection({
  landing,
  setLanding,
  atrioClients,
  assignments,
  setAssignments,
  createAtrioHref,
}: Props) {
  const assignedIds = new Set(assignments.map((item) => item.atrioClientId));

  const toggleAssignment = (client: AtrioClient) => {
    if (assignedIds.has(client.id)) {
      setAssignments((prev) => prev.filter((item) => item.atrioClientId !== client.id));
      return;
    }
    setAssignments((prev) => [...prev, { atrioClientId: client.id, weight: 1 }]);
  };

  return (
    <CollapsibleSection title="Redireccion">
      <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-300">Seleccion de clientes Atrio</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
            <button
              type="button"
              onClick={() => setLanding((prev) => (prev ? { ...prev, atrioSelectionMode: "weighted_random" } : prev))}
              className={`cursor-pointer rounded-l-lg border-r border-zinc-700 px-2 py-1 ${
                landing.atrioSelectionMode === "weighted_random" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
              }`}
              title="Aleatorio por peso del cliente Atrio"
            >
              Aleatoria (peso)
            </button>
            <button
              type="button"
              onClick={() => setLanding((prev) => (prev ? { ...prev, atrioSelectionMode: "fair" } : prev))}
              className={`cursor-pointer rounded-r-lg px-2 py-1 ${
                landing.atrioSelectionMode === "fair" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
              }`}
              title="Equitativo entre los clientes Atrio asignados a esta landing"
            >
              Equitativa
            </button>
          </div>
          {landing.atrioSelectionMode === "fair" && (
            <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
              <button
                type="button"
                onClick={() => setLanding((prev) => (prev ? { ...prev, atrioFairCriterion: "usage_count" } : prev))}
                className={`cursor-pointer rounded-l-lg border-r border-zinc-700 px-2 py-1 ${
                  landing.atrioFairCriterion === "usage_count" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                }`}
                title="Usa el contador aislado de esta landing"
              >
                Por contador
              </button>
              <button
                type="button"
                onClick={() => setLanding((prev) => (prev ? { ...prev, atrioFairCriterion: "messages_received" } : prev))}
                className={`cursor-pointer rounded-r-lg px-2 py-1 ${
                  landing.atrioFairCriterion === "messages_received" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                }`}
                title="Usa leads recibidos de Atrio dentro de esta landing"
              >
                Mensajes recibidos
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs text-zinc-400">
        Configura que clientes Atrio puede abrir el CTA de esta landing.
      </p>
      <p className="mb-3 text-xs text-zinc-500">
        El reparto equitativo se calcula solo dentro de este subconjunto de slugs, independiente de telefonos u otras landings.
      </p>

      {atrioClients.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay clientes Atrio cargados.{" "}
          <Link href={createAtrioHref} className="text-zinc-300 underline hover:text-zinc-100">
            Crear cliente Atrio
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-700">
          <table className="min-w-[760px] text-left text-sm md:min-w-full">
            <thead className="bg-zinc-800/80">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-300">Slug</th>
                <th className="px-3 py-2 font-medium text-zinc-300">URL</th>
                <th className="px-3 py-2 font-medium text-zinc-300">ID Atrio</th>
                <th className="w-20 px-3 py-2 text-center font-medium text-zinc-300">Asignar</th>
                {landing.atrioSelectionMode === "weighted_random" && (
                  <th className="w-20 px-3 py-2 font-medium text-zinc-300">Peso</th>
                )}
                <th className="w-24 px-3 py-2 font-medium text-zinc-300">Contador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {atrioClients.map((client) => {
                const assignment = assignments.find((item) => item.atrioClientId === client.id);
                const isAssigned = Boolean(assignment);
                return (
                  <tr key={client.id} className="bg-zinc-950/40">
                    <td className="px-3 py-2 font-semibold text-zinc-200">{client.slug}</td>
                    <td className="px-3 py-2">
                      <a
                        href={buildAtrioUrl(client.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-emerald-300 hover:underline"
                      >
                        {buildAtrioUrl(client.slug)}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <code className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400">
                        {client.atrio_id}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => toggleAssignment(client)}
                        className="rounded border-zinc-600"
                      />
                    </td>
                    {landing.atrioSelectionMode === "weighted_random" && (
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={assignment?.weight ?? 0}
                          disabled={!isAssigned}
                          onChange={(event) => {
                            if (!isAssigned) return;
                            const parsed = parseInt(event.target.value, 10);
                            const next = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
                            setAssignments((prev) =>
                              prev.map((item) =>
                                item.atrioClientId === client.id ? { ...item, weight: next } : item
                              ),
                            );
                          }}
                          className="w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs text-zinc-400">{client.usage_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleSection>
  );
}
