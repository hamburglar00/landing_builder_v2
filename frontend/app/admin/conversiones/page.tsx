"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversionsConfig,
  upsertConversionsConfig,
  fetchConversionsForAdmin,
  type ConversionsConfig,
  type ConversionRow,
} from "@/lib/conversionsDb";

export default function AdminConversionesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const [cfg, rows] = await Promise.all([
          fetchConversionsConfig(user.id),
          fetchConversionsForAdmin(200),
        ]);
        setConfig(cfg);
        setConversions(rows);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const handleSave = async () => {
    if (!config || !userId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await upsertConversionsConfig({ ...config, user_id: userId });
      setSaveMsg("Configuración guardada.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  const endpointBase =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Conversiones</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configurá tu integración con Meta Conversions API. Todas tus landings
          usan esta configuración.
        </p>
      </div>

      {saveMsg && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            saveMsg.includes("Error")
              ? "bg-red-950/50 text-red-300"
              : "bg-emerald-950/50 text-emerald-300"
          }`}
          role="alert"
        >
          {saveMsg}
        </p>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">
          Configuración Meta CAPI
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Pixel ID
            </label>
            <input
              type="text"
              value={config?.pixel_id ?? ""}
              onChange={(e) =>
                setConfig((prev) =>
                  prev ? { ...prev, pixel_id: e.target.value } : prev,
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder="Ej: 880464554785896"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Se sincronizará automáticamente a todas tus landings al guardar.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Access Token
            </label>
            <div className="flex gap-2">
              <input
                type={showToken ? "text" : "password"}
                value={config?.meta_access_token ?? ""}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? { ...prev, meta_access_token: e.target.value }
                      : prev,
                  )
                }
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="Token de Meta Conversions API"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                {showToken ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Moneda
              </label>
              <select
                value={config?.meta_currency ?? "ARS"}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev ? { ...prev, meta_currency: e.target.value } : prev,
                  )
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
                <option value="CLP">CLP</option>
                <option value="MXN">MXN</option>
                <option value="COP">COP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                API Version
              </label>
              <input
                type="text"
                value={config?.meta_api_version ?? "v25.0"}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? { ...prev, meta_api_version: e.target.value }
                      : prev,
                  )
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Test Event Code{" "}
              <span className="font-normal text-zinc-500">(opcional)</span>
            </label>
            <input
              type="text"
              value={config?.test_event_code ?? ""}
              onChange={(e) =>
                setConfig((prev) =>
                  prev ? { ...prev, test_event_code: e.target.value } : prev,
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder="TEST12345"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Si tiene valor, los eventos se envían en modo test (visible en
              Events Manager → Test Events). Dejalo vacío para producción.
            </p>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config?.send_contact_capi ?? false}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? { ...prev, send_contact_capi: e.target.checked }
                      : prev,
                  )
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
              />
              <span className="text-xs text-zinc-300">
                Enviar evento Contact por CAPI al recibir contacto de la landing
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config?.geo_use_ipapi ?? false}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? { ...prev, geo_use_ipapi: e.target.checked }
                      : prev,
                  )
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
              />
              <span className="text-xs text-zinc-300">
                Enriquecer geo por IP (ipapi.co)
              </span>
            </label>

            {config?.geo_use_ipapi && (
              <label className="ml-6 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config?.geo_fill_only_when_missing ?? false}
                  onChange={(e) =>
                    setConfig((prev) =>
                      prev
                        ? {
                            ...prev,
                            geo_fill_only_when_missing: e.target.checked,
                          }
                        : prev,
                    )
                  }
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                />
                <span className="text-xs text-zinc-300">
                  Solo completar geo faltante (no pisar datos del payload)
                </span>
              </label>
            )}
          </div>

          <div className="flex gap-3 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 active:scale-95 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">
          Endpoint de conversiones
        </h3>
        <p className="mb-3 text-xs text-zinc-400">
          Tus landings y sistemas externos deben enviar POST a esta URL
          (reemplazando <code className="text-zinc-300">NOMBRE_LANDING</code>{" "}
          por el nombre de la landing).
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
          <code className="text-[11px] text-emerald-400 break-all">
            {endpointBase}/functions/v1/conversions?name=NOMBRE_LANDING
          </code>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">
          Últimas conversiones
        </h3>
        {conversions.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aún no hay conversiones registradas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-800/80">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-300">Fecha</th>
                  <th className="px-3 py-2 font-medium text-zinc-300">Landing</th>
                  <th className="px-3 py-2 font-medium text-zinc-300">Phone</th>
                  <th className="px-3 py-2 font-medium text-zinc-300">Estado</th>
                  <th className="px-3 py-2 font-medium text-zinc-300">Valor</th>
                  <th className="px-3 py-2 font-medium text-zinc-300">CAPI</th>
                  <th className="px-3 py-2 font-medium text-zinc-300">Obs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {conversions.map((c) => (
                  <tr key={c.id} className="bg-zinc-950/40">
                    <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 text-zinc-200">{c.landing_name}</td>
                    <td className="px-3 py-2 text-zinc-300 font-mono">
                      {c.phone ? `...${c.phone.slice(-4)}` : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          c.estado === "purchase"
                            ? "bg-emerald-950 text-emerald-300"
                            : c.estado === "lead"
                              ? "bg-amber-950 text-amber-300"
                              : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-200">
                      {c.valor > 0 ? `$${c.valor}` : "-"}
                    </td>
                    <td className="px-3 py-2">
                      {c.estado === "contact" && c.contact_status_capi === "enviado" && "✅"}
                      {c.estado === "contact" && c.contact_status_capi === "error" && "❌"}
                      {c.estado === "lead" && c.lead_status_capi === "enviado" && "✅"}
                      {c.estado === "lead" && c.lead_status_capi === "error" && "❌"}
                      {c.estado === "purchase" && c.purchase_status_capi === "enviado" && "✅"}
                      {c.estado === "purchase" && c.purchase_status_capi === "error" && "❌"}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 max-w-[200px] truncate">
                      {c.observaciones || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
