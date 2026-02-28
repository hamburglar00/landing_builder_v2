"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { supabase } from "@/lib/supabaseClient";

type ClientUser = {
  id: string;
  email: string | null;
  nombre: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

export default function AdminClientesPage() {
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClientNombre, setEditingClientNombre] = useState("");
  const [editingClientEmail, setEditingClientEmail] = useState("");
  const [editingClientPassword, setEditingClientPassword] = useState("");
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
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

  const fetchClients = async () => {
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
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    );
  };

  useEffect(() => {
    void fetchClients();
  }, []);

  const startEditingClient = (client: ClientUser) => {
    setEditingClientId(client.id);
    setEditingClientNombre(client.nombre ?? "");
    setEditingClientEmail(client.email ?? "");
    setEditingClientPassword("");
  };

  const cancelEditingClient = () => {
    setEditingClientId(null);
    setEditingClientNombre("");
    setEditingClientEmail("");
    setEditingClientPassword("");
  };

  const handleUpdateClient = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingClientId) return;

    setIsUpdatingClient(true);
    setClientsError(null);

    const payload: {
      userId: string;
      email?: string;
      password?: string;
      nombre?: string;
    } = { userId: editingClientId };

    if (editingClientEmail.trim()) {
      payload.email = editingClientEmail.trim();
    }
    if (editingClientPassword.trim()) {
      payload.password = editingClientPassword;
    }
    payload.nombre = editingClientNombre.trim();

    const { data, error } = await invokeFunction<{ id?: string }>(
      supabase,
      "update-client",
      { body: payload },
    );

    setIsUpdatingClient(false);

    if (error) {
      setClientsError(error.message);
      return;
    }

    if (data?.id) {
      void fetchClients();
    }

    cancelEditingClient();
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!window.confirm("¿Seguro que quieres eliminar este cliente?")) {
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
            Clientes
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Gestión de usuarios clientes (Supabase Auth).
          </p>
        </div>
        <Link
          href="/admin/clientes/nuevo"
          className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
        >
          Crear cliente
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
          <table className="min-w-[600px] divide-y divide-zinc-800 text-left text-xs sm:min-w-full">
            <thead className="bg-zinc-900/80">
              <tr>
                <th className="px-4 py-2 font-medium text-zinc-300">Nombre</th>
                <th className="px-4 py-2 font-medium text-zinc-300">Email</th>
                <th className="px-4 py-2 font-medium text-zinc-300">Creado</th>
                <th className="px-4 py-2 font-medium text-zinc-300">
                  Último acceso
                </th>
                <th className="px-4 py-2 text-right font-medium text-zinc-300">
                  Acciones
                </th>
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
                      ? "Ningún cliente coincide con la búsqueda."
                      : "Todavía no hay clientes creados."}
                  </td>
                </tr>
              )}

              {filteredClients.map((client) => {
                const isEditing = editingClientId === client.id;

                return (
                  <tr key={client.id}>
                    <td className="px-4 py-3 align-top text-xs text-zinc-50">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingClientNombre}
                          onChange={(event) =>
                            setEditingClientNombre(event.target.value)
                          }
                          placeholder="Nombre"
                          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-50 outline-none ring-0 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/70"
                        />
                      ) : (
                        client.nombre ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-zinc-50">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editingClientEmail}
                          onChange={(event) =>
                            setEditingClientEmail(event.target.value)
                          }
                          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-50 outline-none ring-0 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/70"
                        />
                      ) : (
                        client.email ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-zinc-400">
                      {client.created_at
                        ? new Date(client.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-zinc-400">
                      {client.last_sign_in_at
                        ? new Date(
                            client.last_sign_in_at,
                          ).toLocaleString()
                        : "Nunca"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-right text-xs sm:px-4">
                      {isEditing ? (
                        <form
                          onSubmit={handleUpdateClient}
                          className="inline-flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end"
                        >
                          <input
                            type="password"
                            value={editingClientPassword}
                            onChange={(event) =>
                              setEditingClientPassword(event.target.value)
                            }
                            placeholder="Nueva contraseña (opcional)"
                            className="w-40 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-50 outline-none ring-0 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/70"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={isUpdatingClient}
                              className="rounded-md bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingClient}
                              className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="inline-flex flex-wrap gap-2">
                          <Link
                            href={`/admin/clientes/${client.id}/landings`}
                            className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                          >
                            Ver landings
                          </Link>
                          <button
                            type="button"
                            onClick={() => startEditingClient(client)}
                            className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                          >
                            Editar
                          </button>
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
                      )}
                    </td>
                  </tr>
                );
              })}
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
