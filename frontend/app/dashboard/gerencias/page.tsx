"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Gerencia } from "@/lib/gerencias/types";
import {
  fetchGerencias,
  createGerencia,
  updateGerencia,
  deleteGerencia,
} from "@/lib/gerencias/gerenciasDb";

export default function DashboardGerenciasPage() {
  const router = useRouter();
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editGerenciaId, setEditGerenciaId] = useState<string>("");
  const [newNombre, setNewNombre] = useState("");
  const [newGerenciaId, setNewGerenciaId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);
      setError(null);
      try {
        const list = await fetchGerencias(user.id);
        setGerencias(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar gerencias");
      } finally {
        setReady(true);
      }
    };
    void init();
  }, [router]);

  const parseGerenciaId = (s: string): number | null => {
    const n = s.trim();
    if (n === "") return null;
    const num = parseInt(n, 10);
    return Number.isNaN(num) ? null : num;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newNombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createGerencia(userId, {
        nombre: newNombre.trim(),
        gerencia_id: parseGerenciaId(newGerenciaId),
      });
      setGerencias((prev) => [...prev, created].sort((a, b) => a.id - b.id));
      setNewNombre("");
      setNewGerenciaId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (g: Gerencia) => {
    setEditingId(g.id);
    setEditNombre(g.nombre);
    setEditGerenciaId(g.gerencia_id != null ? String(g.gerencia_id) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNombre("");
    setEditGerenciaId("");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null || !editNombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateGerencia(editingId, {
        nombre: editNombre.trim(),
        gerencia_id: parseGerenciaId(editGerenciaId),
      });
      setGerencias((prev) =>
        prev.map((x) =>
          x.id === editingId
            ? { ...x, nombre: editNombre.trim(), gerencia_id: parseGerenciaId(editGerenciaId) }
            : x,
        ),
      );
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Eliminar esta gerencia?")) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteGerencia(id);
      setGerencias((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          ← Mis Landings
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Gerencias</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Crea y edita gerencias para asignarlas a tus landings.
        </p>
      </div>
      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="new-gerencia-nombre" className="block text-xs font-medium text-zinc-400 mb-1">
            Nombre
          </label>
          <input
            id="new-gerencia-nombre"
            type="text"
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            placeholder="Ej: Gerencia Comercial"
            className="w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="new-gerencia-id" className="block text-xs font-medium text-zinc-400 mb-1">
            Gerencia ID (entero externo)
          </label>
          <input
            id="new-gerencia-id"
            type="number"
            value={newGerenciaId}
            onChange={(e) => setNewGerenciaId(e.target.value)}
            placeholder="Opcional"
            className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !newNombre.trim()}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-70"
        >
          {saving ? "Guardando..." : "Agregar gerencia"}
        </button>
      </form>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/80">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-300">ID</th>
              <th className="px-4 py-3 font-medium text-zinc-300">Nombre</th>
              <th className="px-4 py-3 font-medium text-zinc-300">Gerencia ID</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {gerencias.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  Aún no tienes gerencias. Crea una arriba.
                </td>
              </tr>
            )}
            {gerencias.map((g) => (
              <tr key={g.id} className="bg-zinc-950/40">
                <td className="px-4 py-3 text-zinc-400">{g.id}</td>
                <td className="px-4 py-3">
                  {editingId === g.id ? (
                    <form onSubmit={handleUpdate} className="inline-flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="w-48 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                        autoFocus
                      />
                      <input
                        type="number"
                        value={editGerenciaId}
                        onChange={(e) => setEditGerenciaId(e.target.value)}
                        placeholder="Gerencia ID"
                        className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                      />
                      <button type="submit" disabled={saving} className="text-zinc-300 hover:text-white">
                        Guardar
                      </button>
                      <button type="button" onClick={cancelEdit} className="text-zinc-500 hover:text-zinc-300">
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <span className="text-zinc-100">{g.nombre}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {g.gerencia_id != null ? g.gerencia_id : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === g.id ? null : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(g)}
                        className="mr-2 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(g.id)}
                        disabled={deletingId === g.id}
                        className="rounded-md border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-70"
                      >
                        {deletingId === g.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
