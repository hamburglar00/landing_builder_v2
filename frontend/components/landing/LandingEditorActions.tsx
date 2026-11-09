"use client";

export function LandingEditorActions({ onDelete, onSave, deleting, saving }: {
  onDelete: () => void;
  onSave: () => void;
  deleting: boolean;
  saving: boolean;
}) {
  return <div role="group" aria-label="Acciones de la landing" className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800 pt-6">
    <button type="button" onClick={onDelete} disabled={deleting} className="ui-button ui-button-danger">
      <svg aria-hidden="true" width="16" height="16" className="shrink-0 text-[var(--color-danger)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg>
      {deleting ? "Eliminando..." : "Eliminar landing"}
    </button>
    <button type="button" onClick={onSave} disabled={saving} className="ui-button ui-button-primary">
      <svg aria-hidden="true" width="16" height="16" className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8" /></svg>
      {saving ? "Guardando…" : "Guardar"}
    </button>
  </div>;
}
