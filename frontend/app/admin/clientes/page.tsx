"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { supabase } from "@/lib/supabaseClient";

type ClientUser = {
  id: string;
  email: string | null;
  nombre: string | null;
  role?: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  visible_columns?: string[];
  show_logs?: boolean;
  plan_code?: string;
  max_landings?: number;
  max_phones?: number;
  plan_status?: string;
  plan_status_effective?: "active" | "paused" | "expired";
  expires_at?: string | null;
  grace_days?: number;
};

export default function AdminClientesPage() {
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.nombre ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [clients, searchQuery]);

  const fetchClients = useCallback(async () => {
    setIsLoadingClients(true);
    setClientsError(null);

    const { data, error } = await invokeFunction<{ users?: ClientUser[] }>(
      supabase,
      "list-clients",
      { method: "GET" },
    );

    setIsLoadingClients(false);

    if (error) {
      setClientsError(error.message);
      return;
    }

    if (!data || !Array.isArray(data.users)) {
      setClientsError("Respuesta inesperada al listar clientes.");
      return;
    }

    setClients(
      data.users.map((u: ClientUser) => ({
        id: u.id,
        email: u.email,
        nombre: u.nombre ?? null,
        role: u.role ?? "cliente",
        visible_columns: Array.isArray(u.visible_columns) ? u.visible_columns : [],
        show_logs: typeof u.show_logs === "boolean" ? u.show_logs : true,
        plan_code: u.plan_code ?? "starter",
        max_landings: Number(u.max_landings ?? 2),
        max_phones: Number(u.max_phones ?? 5),
        plan_status: u.plan_status ?? "active",
        plan_status_effective: u.plan_status_effective ?? "active",
        expires_at: u.expires_at ?? null,
        grace_days: Number(u.grace_days ?? 5),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchClients();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchClients]);

  const handleDeleteClient = async (clientId: string) => {
    if (!window.confirm("Seguro que quieres eliminar este cliente?")) {
      return;
    }

    setDeletingClientId(clientId);
    setClientsError(null);

    const { data, error } = await invokeFunction<{ success?: boolean }>(
      supabase,
      "delete-client",
      { body: { userId: clientId } },
    );

    setDeletingClientId(null);

    if (error || !data?.success) {
      setClientsError(error?.message ?? "No se pudo eliminar el cliente.");
      return;
    }

    setClients((prev) => prev.filter((client) => client.id !== clientId));
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-50 sm:text-lg">
            CLIENTES
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Gestion de usuarios clientes (Supabase Auth).
          </p>
        </div>
        <Link
          href="/admin/clientes/nuevo"
          className="inline-flex w-fit cursor-pointer items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-bg-0)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-press)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-primary)]"
        >
          CREAR CLIENTE
        </Link>
      </div>

      <section className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Listado de clientes</h2>
            <p className="text-xs text-zinc-400">
              Usuarios finales creados en Supabase Auth.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-50 placeholder:text-zinc-500 outline-none ring-0 transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/60 sm:w-56"
              aria-label="Buscar clientes"
            />
            <button
              type="button"
              onClick={() => void fetchClients()}
              disabled={isLoadingClients}
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoadingClients ? "Actualizando..." : "Actualizar listado"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-[560px] divide-y divide-zinc-800 text-left text-xs sm:min-w-full">
            <thead className="bg-zinc-900/80">
              <tr>
                <th className="px-4 py-2 font-medium text-zinc-300">Nombre</th>
                <th className="px-4 py-2 font-medium text-zinc-300">Email</th>
                <th className="px-4 py-2 font-medium text-zinc-300">Plan actual</th>
                <th className="px-4 py-2 font-medium text-zinc-300">Vencimiento</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950/40">
              {filteredClients.length === 0 && !isLoadingClients && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-xs text-zinc-500"
                  >
                    {searchQuery.trim()
                      ? "Ningun cliente coincide con la busqueda."
                      : "Todavia no hay clientes creados."}
                  </td>
                </tr>
              )}

              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-3 align-top text-xs text-zinc-50">
                    {client.nombre ?? "-"}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-50">
                    {client.email ?? "-"}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-200">
                    {client.role === "admin" ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit rounded-md border border-sky-700 bg-sky-950/40 px-2 py-0.5 text-[11px] uppercase text-sky-200">
                          ADMIN
                        </span>
                        <span className="text-[11px] text-zinc-500">Sin plan</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex w-fit rounded-md border px-2 py-0.5 text-[11px] uppercase ${planBadgeClass(client.plan_code)}`}>
                            {client.plan_code ?? "starter"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase text-zinc-200">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                client.plan_status_effective === "expired" ? "bg-red-500" : "bg-emerald-500"
                              }`}
                            />
                            {client.plan_status_effective === "expired" ? "Vencido" : "Activo"}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500">
                          {client.max_landings ?? 2} landings · {client.max_phones ?? 5} telefonos
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-400">
                    {client.role === "admin"
                      ? "No aplica"
                      : client.expires_at
                        ? new Date(client.expires_at).toLocaleDateString()
                        : "Sin venc."}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-right text-xs sm:px-4">
                    <div className="inline-flex gap-2 whitespace-nowrap">
                      <Link
                        href={`/admin/clientes/${client.id}/administrar`}
                        className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                      >
                        Administrar
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDeleteClient(client.id)}
                        disabled={deletingClientId === client.id}
                        className="rounded-md border border-red-700 px-3 py-1 text-xs font-medium text-red-300 transition hover:bg-red-800/60 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deletingClientId === client.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {clientsError && (
          <p className="mt-3 text-xs text-red-400" role="alert">
            {clientsError}
          </p>
        )}
      </section>
    </div>
  );
}

const planBadgeClass = (plan?: string) => {
  switch ((plan ?? "").toLowerCase()) {
    case "starter":
      return "border-zinc-700 text-zinc-200 bg-zinc-900/40";
    case "plus":
      return "border-yellow-700 text-yellow-200 bg-yellow-950/40";
    case "pro":
      return "border-orange-700 text-orange-200 bg-orange-950/40";
    case "premium":
      return "border-purple-700 text-purple-200 bg-purple-950/40";
    case "scale":
      return "border-black text-zinc-100 bg-black";
    default:
      return "border-zinc-700 text-zinc-200 bg-zinc-900/40";
  }
};
