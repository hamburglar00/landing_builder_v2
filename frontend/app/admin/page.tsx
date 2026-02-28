"use client";

export default function AdminHomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center sm:rounded-2xl sm:p-12">
      <h1 className="mb-2 text-base font-semibold text-zinc-200 sm:text-lg">
        Inicio
      </h1>
      <p className="text-xs text-zinc-500 sm:text-sm">
        Página principal del panel. Usa el menú lateral para navegar.
      </p>
    </div>
  );
}
