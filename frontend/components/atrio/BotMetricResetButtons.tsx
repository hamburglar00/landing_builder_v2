"use client";

import type { BotResetMetric } from "@/lib/atrio/managerDestinations";
import styles from "./AtrioDirectory.module.css";

export function BotMetricResetButtons({ disabled, resetting, onReset, global = false }: {
  disabled: boolean; resetting: BotResetMetric | null;
  onReset: (metric: BotResetMetric) => void; global?: boolean;
}) {
  return <div className={styles.resets}>
    {(["usage_count", "messages_received"] as const).map(metric => <button
      key={metric} type="button" disabled={disabled} onClick={() => onReset(metric)}
      title={metric === "usage_count" ? "Reinicia las asignaciones contadas, conservando las cuentas y su destino." : "Reinicia el conteo de chats iniciados, conservando el historial y las conversaciones."}
      className={styles.reset}>
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7" /></svg>
      {resetting === metric ? "Reiniciando…" : metric === "usage_count" ? global ? "Reiniciar contadores" : "Reiniciar contador" : "Reiniciar mensajes"}
    </button>)}
  </div>;
}
