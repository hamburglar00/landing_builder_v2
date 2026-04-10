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
  plan_code?: "starter" | "plus" | "pro" | "premium" | "scale";
  max_landings?: number;
  max_phones?: number;
  plan_status?: "active" | "paused" | "expired";
  plan_status_effective?: "active" | "paused" | "expired";
  expires_at?: string | null;
  grace_days?: number;
};

const ALL_COLUMNS = [
  "phone","email","fn","ln","ct","st","zip","country","fbp","fbc","meta_pixel_id","pixel_id","source_platform",
  "contact_event_id","contact_event_time","sendContactPixel","contact_payload_raw","lead_event_id","lead_event_time","lead_payload_raw",
  "purchase_event_id","purchase_event_time","purchase_payload_raw","timestamp","clientIP","agentuser",
  "estado","valor","purchase_type","contact_status_capi","lead_status_capi","purchase_status_capi",
  "observaciones","external_id","test_event_code","utm_campaign","telefono_asignado","promo_code",
  "device_type","geo_city","geo_region","geo_country",
] as const;

type ColKey = (typeof ALL_COLUMNS)[number];

function normalizeVisibleColumnName(col: string): string {
  switch (col) {
    case "send_contact_pixel":
      return "sendContactPixel";
    case "client_ip":
      return "clientIP";
    case "agent_user":
      return "agentuser";
    default:
      return col;
  }
}

function getPlanDefaults(planCode: "starter" | "plus" | "pro" | "premium" | "scale") {
  switch (planCode) {
    case "plus":
      return { maxLandings: 4, maxPhones: 5 };
    case "pro":
      return { maxLandings: 8, maxPhones: 10 };
    case "premium":
      return { maxLandings: 12, maxPhones: 20 };
    case "scale":
      return { maxLandings: 999, maxPhones: 999 };
    case "starter":
    default:
      return { maxLandings: 2, maxPhones: 2 };
  }
}

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
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(ALL_COLUMNS));
  const [planCode, setPlanCode] = useState<"starter" | "plus" | "pro" | "premium" | "scale">("starter");
  const [maxLandings, setMaxLandings] = useState(2);
  const [maxPhones, setMaxPhones] = useState(2);
  const [planStatus, setPlanStatus] = useState<"active" | "paused" | "expired">("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [graceDays, setGraceDays] = useState(5);
  const [renewing, setRenewing] = useState(false);

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
      setPlanCode(found.plan_code ?? "starter");
      setMaxLandings(Number(found.max_landings ?? 2));
      setMaxPhones(Number(found.max_phones ?? 2));
      setPlanStatus(found.plan_status_effective ?? found.plan_status ?? "active");
      setExpiresAt(
        found.expires_at ? new Date(found.expires_at).toISOString().slice(0, 10) : "",
      );
      setGraceDays(Number(found.grace_days ?? 5));
      const cols = Array.isArray(found.visible_columns) && found.visible_columns.length > 0
        ? found.visible_columns
          .map((c) => normalizeVisibleColumnName(String(c)))
          .filter((c): c is ColKey => (ALL_COLUMNS as readonly string[]).includes(c))
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
      planCode: "starter" | "plus" | "pro" | "premium" | "scale";
      maxLandings: number;
      maxPhones: number;
      planStatus: "active" | "paused" | "expired";
      expiresAt: string | null;
      graceDays: number;
    } = {
      userId: clientId,
      visibleColumns: [...visibleCols],
      showLogs,
      planCode,
      maxLandings,
      maxPhones,
      planStatus,
      expiresAt: expiresAt || null,
      graceDays,
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
    router.push("/admin/clientes");
  };

  const handleRenewOneMonth = async () => {
    if (!clientId) return;
    setRenewing(true);
    setError(null);
    setOkMsg(null);
    const base = expiresAt ? new Date(`${expiresAt}T00:00:00`) : new Date();
    const anchor = base.getTime() > Date.now() ? base : new Date();
    const renewed = new Date(anchor);
    renewed.setMonth(renewed.getMonth() + 1);
    const renewedIso = renewed.toISOString().slice(0, 10);

    const { error } = await invokeFunction<{ id?: string }>(
      supabase,
      "update-client",
      {
        body: {
          userId: clientId,
          expiresAt: renewedIso,
          planStatus: "active",
        },
      },
    );

    setRenewing(false);
    if (error) {
      setError(error.message);
      return;
    }
    setExpiresAt(renewedIso);
    setPlanStatus("active");
    setOkMsg(`Plan renovado hasta ${new Date(`${renewedIso}T00:00:00`).toLocaleDateString()}.`);
    setTimeout(() => setOkMsg(null), 2500);
  };

  const onResetPassword = async () => {
    if (!clientId) return;
    if (!resetPassword.trim()) {
      setError("Ingresa una nueva clave para resetear.");
      return;
    }
    if (resetPassword.trim().length < 6) {
      setError("La clave debe tener al menos 6 caracteres.");
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

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Landings del cliente</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Accede al listado de landings de este cliente desde aquí.
        </p>
        <div className="mt-3">
          <Link
            href={`/admin/clientes/${clientId}/landings`}
            className="inline-flex rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Ver landings
          </Link>
        </div>
      </section>

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
          <h3 className="mb-3 text-xs font-semibold text-zinc-200">Plan y vencimiento</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-400">Plan</label>
              <select
                value={planCode}
                onChange={(e) => {
                  const next = e.target.value as typeof planCode;
                  setPlanCode(next);
                  const d = getPlanDefaults(next);
                  setMaxLandings(d.maxLandings);
                  setMaxPhones(d.maxPhones);
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
              >
                <option value="starter">Starter</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
                <option value="premium">Premium</option>
                <option value="scale">Scale</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-400">Estado</label>
              <select
                value={planStatus}
                onChange={(e) => setPlanStatus(e.target.value as typeof planStatus)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
              >
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="expired">Vencido</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-400">Vence el</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-400">Max. landings</label>
              <select
                value={maxLandings}
                onChange={(e) => setMaxLandings(Number(e.target.value || 1))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
              >
                {Array.from({ length: Math.max(1, getPlanDefaults(planCode).maxLandings) }, (_, i) => i + 1).map((n) => (
                  <option key={`max-landings-${n}`} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-400">Max. telefonos</label>
              <select
                value={maxPhones}
                onChange={(e) => setMaxPhones(Number(e.target.value || 1))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
              >
                {Array.from({ length: Math.max(1, getPlanDefaults(planCode).maxPhones) }, (_, i) => i + 1).map((n) => (
                  <option key={`max-phones-${n}`} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-400">Gracia (dias)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value || 0))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleRenewOneMonth()}
              disabled={renewing}
              className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-60"
            >
              {renewing ? "Renovando..." : "Renovar 1 mes"}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <h3 className="mb-2 text-xs font-semibold text-zinc-200">Resetear contraseña</h3>
          <p className="mb-3 text-[11px] text-zinc-500">
            Si el cliente olvidó su clave, define una nueva aquí y se actualiza de inmediato.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type={showResetPassword ? "text" : "password"}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Nueva clave"
              className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-50 outline-none focus:border-zinc-500"
            />
            <button
              type="button"
              onClick={() => setShowResetPassword((v) => !v)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            >
              {showResetPassword ? "Ocultar clave" : "Ver clave"}
            </button>
            <button
              type="button"
              onClick={() => void onResetPassword()}
              disabled={resettingPassword}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
            >
              {resettingPassword ? "Reseteando..." : "Resetear contraseña"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Nota: por seguridad no se puede ver la clave actual del cliente, solo definir una nueva.
          </p>
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



