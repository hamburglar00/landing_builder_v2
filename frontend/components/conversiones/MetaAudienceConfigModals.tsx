"use client";

import { useEffect, useState } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import { META_AUDIENCE_PRESETS, type MetaAudiencePresetId } from "@/lib/metaAudienceConfig";
import type { SavedMetaAudienceConfig } from "@/lib/metaAudienceConfigDb";

const inputClass = "h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10";

function ModalFrame({ title, onClose, children, width = "max-w-2xl" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/75 p-3 backdrop-blur-[2px] sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[calc(100dvh-1.5rem)] w-full ${width} flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/60`}>
          <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            <button type="button" onClick={onClose} aria-label={`Cerrar ${title}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">×</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </section>
      </div>
    </ModalPortal>
  );
}

export function PresetPickerModal({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (id: MetaAudiencePresetId) => void }) {
  if (!open) return null;
  return (
    <ModalFrame title="Usar preset" onClose={onClose}>
      <p className="mb-3 text-xs text-zinc-400">Elegí una plantilla para reemplazar la configuración actual. Después podés editarla antes de guardarla.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {META_AUDIENCE_PRESETS.map((preset) => (
          <button key={preset.id} type="button" onClick={() => onApply(preset.id)} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-left transition hover:border-emerald-700 hover:bg-emerald-950/20">
            <span className="block text-xs font-semibold text-zinc-100">{preset.name}</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{preset.description}</span>
          </button>
        ))}
      </div>
    </ModalFrame>
  );
}

export function SavedAudiencesModal({
  open,
  loading,
  items,
  error,
  onClose,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  open: boolean;
  loading: boolean;
  items: SavedMetaAudienceConfig[];
  error: string | null;
  onClose: () => void;
  onOpen: (item: SavedMetaAudienceConfig) => void;
  onRename: (item: SavedMetaAudienceConfig) => void;
  onDuplicate: (item: SavedMetaAudienceConfig) => void;
  onDelete: (item: SavedMetaAudienceConfig) => void;
}) {
  if (!open) return null;
  return (
    <ModalFrame title="Mis audiencias" onClose={onClose} width="max-w-3xl">
      {error ? <p className="mb-3 rounded-lg border border-red-900/60 bg-red-950/25 px-3 py-2 text-xs text-red-300" role="alert">{error}</p> : null}
      {loading ? <p className="py-8 text-center text-xs text-zinc-500">Cargando audiencias…</p> : null}
      {!loading && items.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-xs text-zinc-500">Todavía no guardaste audiencias para esta moneda.</p> : null}
      {!loading && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <article key={item.id} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-zinc-100">{item.name}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Actualizada {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.updatedAt))}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onOpen(item)} className="h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-500">Abrir</button>
                <button type="button" onClick={() => onRename(item)} className="h-8 rounded-lg border border-zinc-700 px-2.5 text-[11px] text-zinc-300 hover:bg-zinc-800">Renombrar</button>
                <button type="button" onClick={() => onDuplicate(item)} className="h-8 rounded-lg border border-zinc-700 px-2.5 text-[11px] text-zinc-300 hover:bg-zinc-800">Duplicar</button>
                <button type="button" onClick={() => onDelete(item)} className="h-8 rounded-lg border border-red-900/60 px-2.5 text-[11px] text-red-300 hover:bg-red-950/30">Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </ModalFrame>
  );
}

export type AudienceNameAction = "create" | "rename" | "duplicate";

export function AudienceNameModal({ open, action, initialName, saving, error, onClose, onSubmit }: { open: boolean; action: AudienceNameAction; initialName: string; saving: boolean; error: string | null; onClose: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  if (!open) return null;
  const title = action === "create" ? "Guardar audiencia" : action === "rename" ? "Renombrar audiencia" : "Duplicar audiencia";
  return (
    <ModalFrame title={title} onClose={onClose} width="max-w-md">
      <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSubmit(name); }}>
        {error ? <p className="mb-3 rounded-lg border border-red-900/60 bg-red-950/25 px-3 py-2 text-xs text-red-300" role="alert">{error}</p> : null}
        <label className="block"><span className="mb-1 block text-xs text-zinc-400">Nombre</span><input autoFocus maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-800">Cancelar</button>
          <button type="submit" disabled={saving || !name.trim()} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-45">{saving ? "Guardando…" : action === "duplicate" ? "Duplicar" : "Guardar"}</button>
        </div>
      </form>
    </ModalFrame>
  );
}
