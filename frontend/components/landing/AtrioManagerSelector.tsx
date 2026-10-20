"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { TargetProvider } from "@/lib/landing/types";

type Connection = { id: string; manager_id: number; agency_id: number; agency_name: string | null; manager_type: string };
type Route = { connection_id: string | null; connections: Connection[] };
const casinoNames: Record<TargetProvider, string> = { rey_de_ases: "Rey de Ases", multi_skin: "Ganamos+", ases_del_norte: "Ases del Norte", ganamos_net: "Ganamos NET" };
const label = (c: Connection, provider: TargetProvider) => `${casinoNames[provider]} · ${c.agency_name || `Gerencia ${c.agency_id}`} · Manager ${c.manager_id} · ${c.manager_type === "mkt" ? "MKT" : "Full Carga"}`;

export function AtrioManagerSelector({ landingId, atrioClientId, provider }: { landingId: string; atrioClientId: string; provider: TargetProvider }) {
  const [route, setRoute] = useState<Route | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  async function request(connectionId?: string, signal?: AbortSignal): Promise<Route> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Volvé a iniciar sesión para configurar el manager.");
    const response = await fetch("/api/atrio/manager-routes", {
      method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ landingId, atrioClientId, targetProvider: provider, ...(connectionId ? { connectionId } : {}) }),
      cache: "no-store", signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudieron consultar los managers.");
    if (!Array.isArray(result.connections) || (result.connection_id !== null && typeof result.connection_id !== "string")) throw new Error("Respuesta de managers no válida.");
    return result;
  }
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setBusy(true);
      setRoute(null);
      setMessage("");
      try {
        const result = await request(undefined, controller.signal);
        if (controller.signal.aborted) return;
        setRoute(result);
        setChoice(result.connection_id || "");
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "No se pudieron consultar los managers.");
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void load();
    return () => controller.abort();
    // Reload only when this landing/advisor/casino changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landingId, atrioClientId, provider]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const result = await request(choice);
      setRoute(result);
      setChoice(result.connection_id || "");
      setMessage("Manager guardado para las cuentas nuevas de esta landing.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el manager."); }
    finally { setBusy(false); }
  }

  const activeSelection = route?.connections.find((c) => c.id === route.connection_id);
  return <div className="min-w-64 space-y-2">
    {busy && !route ? <p className="text-xs text-zinc-400">Consultando managers…</p> : route?.connections.length === 1 && activeSelection ?
      <p className="text-xs text-zinc-200">{label(activeSelection, provider)}<span className="mt-1 block text-zinc-500">Asignado automáticamente y guardado.</span></p> : route?.connections.length ? <>
        <select aria-label="Manager de esta landing" value={choice} onChange={(event) => setChoice(event.target.value)} disabled={busy}
          className="max-w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200">
          <option value="">Elegir manager</option>
          {route.connection_id && !activeSelection && <option value={route.connection_id} disabled>El manager guardado está inactivo</option>}
          {route.connections.map((c) => <option key={c.id} value={c.id}>{label(c, provider)}</option>)}
        </select>
        <button type="button" disabled={busy || !choice || choice === route.connection_id} onClick={save}
          className="block rounded bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-40">{busy ? "Guardando…" : "Guardar manager"}</button>
        {!activeSelection && <p className="text-xs text-amber-300">Elegí y guardá un manager antes de recibir usuarios nuevos.</p>}
      </> : route ? <p className="text-xs text-amber-300">Este asesor no tiene managers activos vinculados a {casinoNames[provider]}. Revisá su configuración en Atrio.</p> : null}
    {message && <p role="status" className="text-xs text-zinc-400">{message}</p>}
  </div>;
}
