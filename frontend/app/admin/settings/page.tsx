"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getSettings, updateSettingsUrlBase } from "@/lib/settingsDb";

export default function AdminSettingsPage() {
  const [urlBase, setUrlBase] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return;
      try {
        const s = await getSettings();
        setUrlBase(s.url_base ?? "");
      } catch {
        setError("No se pudo cargar la configuración.");
      } finally {
        setReady(true);
      }
    };
    void init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateSettingsUrlBase(urlBase.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
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
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Solo administradores. URL base para la aplicación.
        </p>
      </div>
      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label htmlFor="url_base" className="block text-xs font-medium text-zinc-400 mb-1">
            URL base
          </label>
          <input
            id="url_base"
            type="url"
            value={urlBase}
            onChange={(e) => setUrlBase(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-70"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </div>
  );
}
