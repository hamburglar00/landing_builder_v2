"use client";

import type { BotResetMetric } from "@/lib/atrio/managerDestinations";

export function BotMetricResetButtons({ disabled, resetting, onReset, global = false }: {
  disabled: boolean; resetting: BotResetMetric | null;
  onReset: (metric: BotResetMetric) => void; global?: boolean;
}) {
  return <div className="flex flex-wrap items-center gap-2">
    {(["usage_count", "messages_received"] as const).map(metric => <button
      key={metric} type="button" disabled={disabled} onClick={() => onReset(metric)}
      title={metric === "usage_count" ? "Reinicia las asignaciones contadas, conservando las cuentas y su destino." : "Reinicia el conteo de chats iniciados, conservando el historial y las conversaciones."}
      className="ui-button ui-button-secondary h-8 min-h-8 px-3 text-xs">
      {resetting === metric ? "Reiniciando…" : metric === "usage_count" ? global ? "Reiniciar contadores" : "Reiniciar contador" : "Reiniciar mensajes"}
    </button>)}
  </div>;
}
