"use client";

import { CASINO_NAMES, managerTypeLabel, type AdvisorDirectory } from "@/lib/atrio/managerDestinations";
import type { BotResetMetric } from "@/lib/atrio/managerDestinations";
import { BotMetricResetButtons } from "./BotMetricResetButtons";
import styles from "./AtrioDirectory.module.css";
export function AdvisorManagers({ advisor, busy, error, onlyActive, resetDisabled, resetting, onReset }: {
  advisor?: AdvisorDirectory; busy: boolean; error: string; onlyActive: boolean;
  resetDisabled: boolean; resetting: BotResetMetric | null; onReset: (metric: BotResetMetric) => void;
}) {
  const connections = (advisor?.connections || []).filter(row => !onlyActive || row.active);
  const totals = connections.reduce((sum, row) => ({ assignments: sum.assignments + row.usage_count, chats: sum.chats + row.chats_started }), { assignments: 0, chats: 0 });
  const pending = busy || !!error;
  return <details open className={styles.bots}>
    <summary className={styles.botSummary} aria-label={`Bots de ${advisor?.name || advisor?.slug || "Atrio"}`}>
      <span className={styles.botHeading}>Bots vinculados <span className={styles.botCount}>{pending ? "—" : connections.length}</span></span>
      <span className={styles.total}><strong>{pending ? "—" : totals.assignments.toLocaleString("es-AR")}</strong><span>Asignaciones</span></span>
      <span className={styles.total}><strong>{pending ? "—" : totals.chats.toLocaleString("es-AR")}</strong><span>Chats iniciados</span></span>
      <svg className={styles.chevron} aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <div>
      {busy && <p className={styles.message} role="status">Actualizando bots…</p>}
      {error && <p role="alert" className={`${styles.message} ${styles.error}`}>{error}</p>}
      {!busy && !error && !connections.length && <p className={styles.message}>{onlyActive && !!advisor?.connections.length ? "Este asesor no tiene bots activos. Desmarcá el filtro para ver todos." : "Este asesor todavía no tiene bots vinculados."}</p>}
      {!!connections.length && <div className={styles.tableScroll} role="region" aria-label={`Bots vinculados de ${advisor?.name || advisor?.slug || "Atrio"}`} tabIndex={0}>
        <table className={styles.table}>
          <thead><tr>
            {["Casino / gerencia", "Bot", "Tipo", "Estado", "Asignaciones", "Chats iniciados", "Históricos"].map((label, index) => <th scope="col" className={index >= 4 ? styles.number : undefined} title={index === 4 ? "Contador de nuevas asignaciones desde el último reinicio" : index === 6 ? "Chats históricos: total de conversaciones iniciadas, sin reinicios" : undefined} key={label}>{label}</th>)}
          </tr></thead>
          <tbody>{connections.map(connection => <tr key={connection.connection_id}>
            <td><strong className={styles.casino}>{CASINO_NAMES[connection.target_provider]}</strong><span className={styles.agency}>{connection.agency_name || `Gerencia ${connection.agency_id}`}</span></td>
            <td><span className={styles.botId}>{connection.manager_id}</span></td>
            <td><span className={`${styles.type} ${connection.manager_type === "full_carga" ? styles.automatic : ""}`}>{managerTypeLabel(connection.manager_type)}</span></td>
            <td><span className={`${styles.status} ${connection.active ? "" : styles.inactive}`}>{connection.active ? "Activo" : "Inactivo"}</span></td>
            <td className={`${styles.number} ${styles.assignments}`}>{connection.usage_count.toLocaleString("es-AR")}</td><td className={styles.number}>{connection.chats_started.toLocaleString("es-AR")}</td>
            <td className={`${styles.number} ${styles.history}`}>{(connection.chats_started_total ?? connection.chats_started).toLocaleString("es-AR")}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className={styles.botFooter}>
        <p className={styles.legend}>Asignaciones y chats desde el último reinicio.<br />Los chats históricos se conservan.</p>
        <div role="group" aria-label={`Reiniciar métricas de ${advisor?.name || advisor?.slug || "este asesor"}`}>
          <BotMetricResetButtons disabled={resetDisabled || busy || !advisor?.connections.length} resetting={resetting} onReset={onReset} />
        </div>
      </div>
    </div>
  </details>;
}
