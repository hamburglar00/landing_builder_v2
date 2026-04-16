"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { supabase } from "@/lib/supabaseClient";

const ALL_COLUMNS = [
  "phone","email","fn","ln","ct","st","zip","country","fbp","fbc","from_meta_ads","meta_pixel_id","pixel_id","source_platform",
  "contact_event_id","contact_event_time","sendContactPixel","contact_payload_raw","lead_event_id","lead_event_time","lead_payload_raw",
  "purchase_event_id","purchase_event_time","purchase_payload_raw","timestamp","clientIP","agentuser",
  "estado","valor","purchase_type","contact_status_capi","lead_status_capi","purchase_status_capi",
  "observaciones","external_id","test_event_code","utm_campaign","telefono_asignado","promo_code",
  "device_type","geo_city","geo_region","geo_country","geo_source",
  "cuit_cuil","inferred_sex","sex_source",
] as const;

type ColKey = (typeof ALL_COLUMNS)[number];

export default function NuevoClientePage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLogs, setShowLogs] = useState(true);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(ALL_COLUMNS));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleColumn = (col: ColKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedName = nombre.trim().toLowerCase();
    if (!/^[a-z0-9]+$/.test(normalizedName)) {
      setError("Nombre invalido. Solo letras y numeros, sin espacios.");
      return;
    }
    setIsSubmitting(true);

    const { data, error: invokeError } = await invokeFunction<{ id?: string }>(
      supabase,
      "create-client",
      {
        body: {
          nombre: normalizedName,
          email,
          password,
          visibleColumns: [...visibleCols],
          showLogs,
        },
      },
    );

    setIsSubmitting(false);

    if (invokeError) {
      setError(invokeError.message);
      return;
    }

    if (data?.id) {
      router.push("/admin/clientes");
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-50 sm:text-lg">
            Crear nuevo cliente
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            El cliente se crea como usuario de Supabase Auth con rol{" "}
            <span className="font-semibold text-zinc-200">client</span>.
          </p>
        </div>
        <Link
          href="/admin/clientes"
          className="inline-flex w-fit items-center rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Volver al listado
        </Link>
      </div>

      <section className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 sm:rounded-2xl sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="new-client-nombre"
              className="block text-xs font-medium text-zinc-200"
            >
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              id="new-client-nombre"
              type="text"
              required
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-50 outline-none ring-0 transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/60"
              placeholder="ej: koben (solo minúsculas y números, para la URL de conversiones)"
            />
            <p className="text-[11px] text-zinc-500">
              Identificador unico e inmutable. Solo letras y numeros (sin espacios). Se usa en el endpoint de conversiones.
            </p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="new-client-email"
              className="block text-xs font-medium text-zinc-200"
            >
              Email
            </label>
            <input
              id="new-client-email"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-50 outline-none ring-0 transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/60"
              placeholder="cliente@ejemplo.com"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="new-client-password"
              className="block text-xs font-medium text-zinc-200"
            >
              Contraseña
            </label>
            <input
              id="new-client-password"
              type="text"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-50 outline-none ring-0 transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/60"
              placeholder="Ingresa la contraseña"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-200">Configuración de Conversiones</p>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={showLogs}
                  onChange={(e) => setShowLogs(e.target.checked)}
                />
                Mostrar logs
              </label>
            </div>
            <p className="text-[11px] text-zinc-500">Columnas visibles en Tabla de Conversiones</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {ALL_COLUMNS.map((col) => (
                <label key={col} className="inline-flex items-center gap-2 rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(col)}
                    onChange={() => toggleColumn(col)}
                  />
                  <span className="font-mono">{col}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creando cliente..." : "Crear cliente"}
            </button>
            <Link
              href="/admin/clientes"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

