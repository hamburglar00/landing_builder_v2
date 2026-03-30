"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { supabase } from "@/lib/supabaseClient";

type ClientUser = {
  id: string;
  email: string | null;
  nombre: string | null;
  visible_columns?: string[];
  show_logs?: boolean;
};

const ALL_COLUMNS = [
  "phone","email","fn","ln","ct","st","zip","country","fbp","fbc","pixel_id",
  "contact_event_id","contact_event_time","contact_payload_raw","lead_event_id","lead_event_time","lead_payload_raw",
  "purchase_event_id","purchase_event_time","purchase_payload_raw","timestamp","clientIP","agentuser",
  "estado","valor","purchase_type","contact_status_capi","lead_status_capi","purchase_status_capi",
  "observaciones","external_id","test_event_code","utm_campaign","telefono_asignado","promo_code",
  "device_type","geo_city","geo_region","geo_country",
] as const;

type ColKey = (typeof ALL_COLUMNS)[number];

export default function AdminClientManagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(ALL_COLUMNS));

  const visibleCount = useMemo(() => visibleCols.size, [visibleCols]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!clientId) return;
      setLoading(true);
      setError(null);
      const { data, error } = await invokeFunction<{ users?: ClientUser[] }>(
        supabase,
        "list-clients",
        { method: "GET" },
      );
      if (!mounted) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const found = (data?.users ?? []).find((u) => u.id === clientId);
      if (!found) {
        setError("Cliente no encontrado.");
        setLoading(false);
        return;
      }
      setNombre(found.nombre ?? "");
      setEmail(found.email ?? "");
      setShowLogs(typeof found.show_logs === "boolean" ? found.show_logs : true);
      const cols = Array.isArray(found.visible_columns) && found.visible_columns.length > 0
        ? found.visible_columns.filter((c): c is ColKey => (ALL_COLUMNS as readonly string[]).includes(c))
        : [...ALL_COLUMNS];
      setVisibleCols(new Set(cols));
      setLoading(false);
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  const toggleColumn = (col: ColKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);

    const payload: {
      userId: string;
      email?: string;
      password?: string;
      visibleColumns: string[];
      showLogs: boolean;
    } = {
      userId: clientId,
      visibleColumns: [...visibleCols],
      showLogs,
    };

    if (email.trim()) payload.email = email.trim();

    const { error } = await invokeFunction<{ id?: string }>(
      supabase,
      "update-client",
      { body: payload },
    );

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOkMsg("Configuracion guardada.");
    setTimeout(() => setOkMsg(null), 2500);
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    if (!resetPassword.trim()) {
      setError("Ingresa una nueva clave para resetear.");
      return;
    }
    setResettingPassword(true);
    setError(null);
    setOkMsg(null);

    const { error } = await invokeFunction<{ id?: string }>(
      supabase,
      "update-client",
      {
        body: {
          userId: clientId,
          password: resetPassword.trim(),
        },
      },
    );

    setResettingPassword(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetPassword("");
    setOkMsg("Clave reseteada correctamente.");
    setTimeout(() => setOkMsg(null), 2500);
  };

  if (loading) {
    return <p className="text-sm text-zinc-400">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-zinc-50 sm:text-lg">Administrar cliente</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Gestiona email, clave y permisos de Conversiones.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Volver
          </button>
          <Link
            href="/admin/clientes"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Ir a clientes
          </Link>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {okMsg && <p className="text-xs text-emerald-400">{okMsg}</p>}

      <form onSubmit={onSave} className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">Nombre (inmutable)</label>
            <input
              value={nombre}
              readOnly
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <h3 className="mb-2 text-xs font-semibold text-zinc-200">Resetear contraseña</h3>
          <p className="mb-3 text-[11px] text-zinc-500">
            Si el cliente olvidó su clave, define una nueva aquí y se actualiza de inmediato.
          </p>
          <form onSubmit={onResetPassword} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Nueva clave"
              className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              disabled={resettingPassword}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
            >
              {resettingPassword ? "Reseteando..." : "Resetear contraseña"}
            </button>
          </form>
        </section>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <label className="inline-flex items-center gap-2 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={showLogs}
              onChange={(e) => setShowLogs(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            Mostrar pestaña Logs en Conversiones
          </label>
        </div>

        <section className="rounded-lg border border-zinc-800 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-zinc-200">
              Columnas visibles en Tabla de Conversiones ({visibleCount}/{ALL_COLUMNS.length})
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibleCols(new Set(ALL_COLUMNS))}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setVisibleCols(new Set())}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
              >
                Ninguna
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {ALL_COLUMNS.map((col) => (
              <label key={col} className="inline-flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-[11px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={visibleCols.has(col)}
                  onChange={() => toggleColumn(col)}
                  className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900"
                />
                <span>{col}</span>
              </label>
            ))}
          </div>
        </section>

        <div className="pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
