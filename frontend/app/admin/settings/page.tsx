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
        setShowClientLandingPreview(
          s.show_client_landing_preview ?? true,
        );
        setRevalidateSecret(s.revalidate_secret ?? "");
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
      await updateSettings({
        urlBase: urlBase.trim(),
        showClientLandingPreview,
        revalidateSecret: revalidateSecret.trim(),
      });
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
          Solo administradores. Configuración global de la aplicación.
        </p>
      </div>
      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="max-w-md space-y-5">
        <div>
          <label htmlFor="url_base" className="block text-xs font-medium text-zinc-400 mb-1">
            URL base
          </label>
          <input
            id="url_base"
            type="url"
            value={urlBase}
            onChange={(e) => setUrlBase(e.target.value)}
            placeholder="https://tu-landing.vercel.app"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <p className="mt-2 text-[11px] text-zinc-500 leading-relaxed">
            <strong>Para qué se usa:</strong> Es la URL raíz de tu landing pública (ej. <span className="font-mono">https://tu-landing.vercel.app</span>). El constructor la usa para: (1) Enviar <span className="font-mono">POST &lt;URL base&gt;/api/revalidate</span> después de guardar una landing (con nombre y secreto), para invalidar la caché de esa ruta (ISR). (2) Enviar <span className="font-mono">GET &lt;URL base&gt;/&lt;nombre&gt;?warm=1</span> para regenerar la página y dejarla cacheada al instante. (3) Los enlaces &quot;Abrir landing&quot; en el listado. Si no configurás URL base, el guardado en Supabase funciona igual pero no se revalida ni se calienta la landing pública.
          </p>
        </div>
        <div>
          <label
            htmlFor="revalidate_secret"
            className="block text-xs font-medium text-zinc-400 mb-1"
          >
            Secreto para revalidar landing pública (ISR)
          </label>
          <div className="relative">
            <input
              id="revalidate_secret"
              type={showSecret ? "text" : "password"}
              value={revalidateSecret}
              onChange={(e) => setRevalidateSecret(e.target.value)}
              placeholder="Secreto compartido con /api/revalidate"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-10 text-sm text-zinc-100"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              {showSecret ? "Ocultar" : "Ver"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 leading-relaxed">
            <strong>Para qué se usa:</strong> Secreto compartido entre el constructor y la landing pública. Debe coincidir con la variable <span className="font-mono">REVALIDATE_SECRET</span> del proyecto de la landing (Vercel). Al guardar una landing, el constructor envía <span className="font-mono">POST &lt;URL base&gt;/api/revalidate</span> con <span className="font-mono">{`{ name: "<nombre>", secret: "<este valor>" }`}</span>. El endpoint de la landing valida el secreto y ejecuta <span className="font-mono">revalidatePath(&#39;/&lt;nombre&gt;&#39;)</span>, invalidando la caché. Después el constructor hace <span className="font-mono">GET &lt;URL base&gt;/&lt;nombre&gt;?warm=1</span> para regenerar la página y dejarla cacheada. Sin este secreto (o con URL base vacía) no se realiza la revalidación.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3">
          <input
            id="show_client_preview"
            type="checkbox"
            checked={showClientLandingPreview}
            onChange={(e) => setShowClientLandingPreview(e.target.checked)}
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
              Si está desactivado, en el dashboard de clientes no se mostrará
              la vista previa del teléfono en el editor de landings. En el
              panel de administrador siempre se mostrará.
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
