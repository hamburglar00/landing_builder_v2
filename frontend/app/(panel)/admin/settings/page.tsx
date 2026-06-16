"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getSettings, updateSettings } from "@/lib/settingsDb";

export default function AdminSettingsPage() {
  const [urlBase, setUrlBase] = useState("");
  const [showClientLandingPreview, setShowClientLandingPreview] =
    useState(true);
  const [revalidateSecret, setRevalidateSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [adminNombre, setAdminNombre] = useState("");
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
        const settings = await getSettings();
        setUrlBase(settings.url_base ?? "");
        setShowClientLandingPreview(
          settings.show_client_landing_preview ?? true,
        );
        setRevalidateSecret(settings.revalidate_secret ?? "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("nombre")
          .eq("id", user.id)
          .maybeSingle();
        setAdminNombre(profile?.nombre ?? "");
      } catch {
        setError("No se pudo cargar la configuracion.");
      } finally {
        setReady(true);
      }
    };
    void init();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await updateSettings({
        urlBase: urlBase.trim(),
        showClientLandingPreview,
        revalidateSecret: revalidateSecret.trim(),
      });
      if (user) {
        await supabase
          .from("profiles")
          .update({ nombre: adminNombre.trim() })
          .eq("id", user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
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
        <h1 className="text-xl font-semibold text-zinc-100">CONFIGURACION</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Solo administradores. Configuracion global de la aplicacion.
        </p>
      </div>
      {error && (
        <p
          className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="max-w-md space-y-5">
        <div>
          <label
            htmlFor="admin_nombre"
            className="mb-1 block text-xs font-medium text-zinc-400"
          >
            Nombre del administrador
          </label>
          <input
            id="admin_nombre"
            type="text"
            value={adminNombre}
            onChange={(event) => setAdminNombre(event.target.value)}
            placeholder="Tu nombre (se usa en Conversiones para la URL del endpoint)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            <strong>Para que se usa:</strong> Se utiliza para construir la URL
            del endpoint de conversiones (
            <span className="font-mono">?name=tu-nombre</span>). Tambien
            aparece como tu nombre de perfil.
          </p>
        </div>

        <div>
          <label
            htmlFor="url_base"
            className="mb-1 block text-xs font-medium text-zinc-400"
          >
            URL base
          </label>
          <input
            id="url_base"
            type="url"
            value={urlBase}
            onChange={(event) => setUrlBase(event.target.value)}
            placeholder="https://landing.panelbotadmin.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            <strong>Para que se usa:</strong> Es la URL publica que ven los
            usuarios y Meta Ads. Se usa para revalidar cache, calentar landings
            y armar los links &quot;Abrir landing&quot;.
          </p>
        </div>

        <div>
          <label
            htmlFor="revalidate_secret"
            className="mb-1 block text-xs font-medium text-zinc-400"
          >
            Secreto para revalidar landing publica (ISR)
          </label>
          <div className="relative">
            <input
              id="revalidate_secret"
              type={showSecret ? "text" : "password"}
              value={revalidateSecret}
              onChange={(event) => setRevalidateSecret(event.target.value)}
              placeholder="Secreto compartido con /api/revalidate"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-10 text-sm text-zinc-100"
            />
            <button
              type="button"
              onClick={() => setShowSecret((value) => !value)}
              className="absolute inset-y-0 right-2 flex items-center text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              {showSecret ? "Ocultar" : "Ver"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            <strong>Para que se usa:</strong> Es una clave interna para que
            solo el constructor pueda decirle a la landing publica que refresque
            su cache.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3">
          <input
            id="show_client_preview"
            type="checkbox"
            checked={showClientLandingPreview}
            onChange={(event) =>
              setShowClientLandingPreview(event.target.checked)
            }
            className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900"
          />
          <div>
            <label
              htmlFor="show_client_preview"
              className="text-xs font-medium text-zinc-200"
            >
              Mostrar preview del editor de landings a clientes
            </label>
            <p className="mt-1 text-[11px] text-zinc-400">
              Si esta desactivado, en el dashboard de clientes no se mostrara
              la vista previa del telefono en el editor de landings. En el panel
              de administrador siempre se mostrara.
            </p>
          </div>
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
