"use client";

import { useState } from "react";
import type { Gerencia, GerenciaWorkGroup } from "@/lib/gerencias/types";

type Props = {
  gerencias: Gerencia[];
  groups: GerenciaWorkGroup[];
  saving: boolean;
  onCreate: (name: string, gerenciaIds: number[]) => Promise<void>;
  onUpdate: (groupId: number, name: string, gerenciaIds: number[]) => Promise<void>;
  onDelete: (groupId: number) => Promise<void>;
};

export function GerenciaWorkGroupsPanel({
  gerencias,
  groups,
  saving,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSelectedIds, setEditSelectedIds] = useState<number[]>([]);

  const toggleId = (id: number, list: number[], setter: (next: number[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim(), selectedIds);
    setName("");
    setSelectedIds([]);
  };

  const startEdit = (group: GerenciaWorkGroup) => {
    setEditingId(group.id);
    setEditName(group.name);
    setEditSelectedIds(group.gerenciaIds);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null || !editName.trim()) return;
    await onUpdate(editingId, editName.trim(), editSelectedIds);
    setEditingId(null);
    setEditName("");
    setEditSelectedIds([]);
  };

  const renderGerenciaPicker = (ids: number[], setIds: (next: number[]) => void) => (
    <div className="grid max-h-52 gap-2 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 sm:grid-cols-2 lg:grid-cols-3">
      {gerencias.length === 0 ? (
        <p className="text-xs text-zinc-500">Primero creá gerencias para poder agruparlas.</p>
      ) : (
        gerencias.map((g) => (
          <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={ids.includes(g.id)}
              onChange={() => toggleId(g.id, ids, setIds)}
              className="rounded border-zinc-600"
            />
            <span className="truncate">
              {g.nombre} {g.gerencia_id ? `(ID ${g.gerencia_id})` : ""}
            </span>
          </label>
        ))
      )}
    </div>
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Grupos de trabajo</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Agrupá gerencias para encontrarlas más rápido. Una gerencia puede estar en varios grupos.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400">
          {groups.length} grupos
        </span>
      </div>

      <form onSubmit={submitCreate} className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del grupo, ej: Equipo mañana"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-lg border border-emerald-700/70 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Crear grupo
          </button>
        </div>
        {renderGerenciaPicker(selectedIds, setSelectedIds)}
      </form>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-xs text-zinc-500">
          Todavía no hay grupos de trabajo.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const names = group.gerenciaIds
              .map((id) => gerencias.find((g) => g.id === id))
              .filter((g): g is Gerencia => Boolean(g))
              .map((g) => g.nombre);

            return (
              <div key={group.id} className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
                {editingId === group.id ? (
                  <form onSubmit={submitEdit} className="space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    />
                    {renderGerenciaPicker(editSelectedIds, setEditSelectedIds)}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                        Cancelar
                      </button>
                      <button type="submit" disabled={saving || !editName.trim()} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-60">
                        Guardar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{group.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {names.length > 0 ? names.join(", ") : "Sin gerencias asignadas"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(group)} className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el grupo "${group.name}"?`)) void onDelete(group.id);
                        }}
                        className="rounded-md border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950/50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
