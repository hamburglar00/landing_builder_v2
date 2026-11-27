"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Delivery = {
  id: number;
  landing_label: string | null;
  operation_reference: string | null;
  event_id: string;
  amount: number | null;
  currency: string | null;
  purchase_type: "first" | "repeat" | null;
  status: "sent" | "failed";
  meta_response: { events_received?: number; error_code?: number; error_subcode?: number; trace_id?: string };
  created_at: string;
};
const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

export function MetaPurchaseDeliveryHistory({ userId }: { userId: string }) {
  const [state, setState] = useState<{ loading: boolean; error: boolean; rows?: Delivery[] }>({ loading: false, error: false });
  async function load() {
    setState(previous => ({ ...previous, loading: true, error: false }));
    const { data, error } = await supabase.from("meta_purchase_delivery_history")
      .select("id,landing_label,operation_reference,event_id,amount,currency,purchase_type,status,meta_response,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    setState({ loading: false, error: Boolean(error), rows: (data ?? []) as Delivery[] });
  }
  return <details className="pixel-settings-group" onToggle={event => {
    if (event.currentTarget.open && !state.loading && !state.rows) void load();
  }}>
    <summary className="cursor-pointer font-semibold">Historial de envíos de compras</summary>
    <button className="ui-button ui-button-secondary mt-3" type="button" disabled={state.loading} onClick={() => void load()}>Actualizar</button>
    {state.loading ? <p role="status" className="my-3 text-sm">Consultando envíos…</p> : null}
    {state.error ? <p role="alert" className="my-3 text-sm text-red-300">No se pudo cargar el historial.</p> : null}
    {state.rows?.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-xs">
      <thead><tr>{["Fecha", "Landing", "Operación", "Importe", "Tipo", "Evento", "Respuesta de Meta"].map(title =>
        <th key={title} scope="col" className="whitespace-nowrap p-2">{title}</th>)}</tr></thead>
      <tbody>{state.rows.map(row => <tr key={row.id} className="border-t border-zinc-500/20">
        <td className="whitespace-nowrap p-2">{date.format(new Date(row.created_at))}</td>
        <td className="p-2">{row.landing_label || "—"}</td>
        <td className="p-2">{row.operation_reference || "—"}</td>
        <td className="whitespace-nowrap p-2">{row.amount ?? "—"} {row.currency}</td>
        <td className="p-2">{row.purchase_type === "repeat" ? "Recompra" : row.purchase_type === "first" ? "Primera compra" : "—"}</td>
        <td className="break-all p-2 font-mono">{row.event_id}</td>
        <td className="p-2">{row.status === "sent" ? "Aceptado" : "Fallido"}
          {row.meta_response.error_code ? " · " + row.meta_response.error_code : ""}
          {row.meta_response.trace_id ? <small className="block">{row.meta_response.trace_id}</small> : null}</td>
      </tr>)}</tbody>
    </table></div> : !state.loading && state.rows && !state.error ? <p className="my-3 text-sm">Todavía no hay envíos registrados.</p> : null}
  </details>;
}
