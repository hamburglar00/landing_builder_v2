"use client";

import { CASINO_NAMES, managerTypeLabel, type AdvisorDirectory } from "@/lib/atrio/managerDestinations";
export function AdvisorManagers({ advisor, busy, error, onlyActive }: {
  advisor?: AdvisorDirectory; busy: boolean; error: string; onlyActive: boolean;
}) {
  const connections = (advisor?.connections || []).filter(row => !onlyActive || row.active);
  const totals = connections.reduce((sum, row) => ({ assignments: sum.assignments + row.usage_count, chats: sum.chats + row.chats_started }), { assignments: 0, chats: 0 });
  return <details open className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)]">
    <summary className="cursor-pointer px-4 py-3 text-xs text-[var(--color-text)]">
      <strong>Bots de {advisor?.name || advisor?.slug || "Atrio"}</strong>
      <span className="ml-3 text-[var(--color-text-muted)]">{connections.length} bots · Contador: {totals.assignments} · Chats: {totals.chats}</span>
    </summary>
    <div className="space-y-3 border-t border-[var(--color-border-subtle)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
        <p>Contador: nuevas asignaciones. Chats: conversaciones con mensajes del cliente. Totales históricos. El reparto equitativo se calcula dentro de cada landing.</p>
        {busy && <span role="status">Actualizando…</span>}
      </div>
      {error && <p role="alert" className="text-xs text-[var(--color-danger)]">{error}</p>}
      {!busy && !error && !connections.length && <p className="text-xs text-[var(--color-text-muted)]">Este asesor todavía no tiene bots vinculados.</p>}
      {!!connections.length && <div className="overflow-x-auto">
        <table className="min-w-[600px] w-full text-left text-xs">
          <thead className="bg-[var(--color-bg-3)] text-[var(--color-text-muted)]"><tr>
            {["Casino / gerencia", "Bot", "Tipo", "Estado", "Contador", "Chats iniciados"].map(label => <th className="p-2 font-medium" key={label}>{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">{connections.map(connection => <tr key={connection.connection_id}>
            <td className="p-2"><strong>{CASINO_NAMES[connection.target_provider]}</strong><span className="mt-1 block text-[var(--color-text-muted)]">{connection.agency_name || `Gerencia ${connection.agency_id}`}</span></td>
            <td className="p-2">{connection.manager_id}</td>
            <td className="p-2"><span className="rounded-full border border-[var(--color-border)] px-2 py-1">{managerTypeLabel(connection.manager_type)}</span></td>
            <td className={`p-2 ${connection.active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>{connection.active ? "Activo" : "Inactivo"}</td>
            <td className="p-2 tabular-nums">{connection.usage_count}</td><td className="p-2 tabular-nums">{connection.chats_started}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
  </details>;
}
