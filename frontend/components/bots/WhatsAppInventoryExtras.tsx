import type { Gerencia } from "@/lib/gerencias/types";
export function WhatsAppInventoryExtras({
  gerencia,
  phones,
}: {
  gerencia: Gerencia;
  phones: { phone: string }[];
}) {
  const numbers = new Set(
    phones.map((phone) => phone.phone.replace(/\D/g, "")),
  );
  const missing = (
    gerencia.source_type === "manual" ? [] : (gerencia.pbadmin_bots ?? [])
  ).filter(
    (bot) =>
      bot.channel === "whatsapp" &&
      bot.agency_id === gerencia.gerencia_id &&
      (!bot.phone || !numbers.has(bot.phone)),
  );
  if (!missing.length) return null;
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[520px] text-left text-xs">
        <caption className="px-3 py-2 text-left text-[11px] text-zinc-500">
          Bots sin teléfono sincronizado
          {gerencia.pbadmin_bots_synced_at
            ? ` · inventario del ${new Date(gerencia.pbadmin_bots_synced_at).toLocaleString("es-AR")}`
            : ""}
        </caption>
        <thead className="bg-zinc-800/80 text-zinc-400">
          <tr>
            {["Bot", "Teléfono", "Tipo", "Estado en PBAdmin"].map((text) => (
              <th key={text} className="px-3 py-2 font-medium">
                {text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 text-zinc-400">
          {missing.map((bot) => (
            <tr key={bot.manager_id}>
              <td className="px-3 py-2 text-zinc-300">
                {bot.name || `Bot ${bot.manager_id}`}
                <span className="ml-2 text-zinc-500">ID {bot.manager_id}</span>
              </td>
              <td className="px-3 py-2">
                {bot.phone || "Sin teléfono conectado"}
              </td>
              <td className="px-3 py-2">{bot.role}</td>
              <td className="px-3 py-2">
                {bot.active ? "Activo" : "Inactivo"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
