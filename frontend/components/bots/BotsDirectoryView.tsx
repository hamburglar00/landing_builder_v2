"use client";

import { Fragment, useCallback, useState, type ReactNode } from "react";
import type { GerenciaPhoneRow } from "@/components/telefonos/TelefonosPageContent";
import type { AtrioBotEntry, BotGerencia } from "@/lib/bots/workspace";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import { CASINO_NAMES, managerTypeLabel } from "@/lib/atrio/managerDestinations";
import { ModalShell } from "@/components/ui/PanelPrimitives";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import { GerenciaActions } from "./BotsManagement";
import { AtrioBotTable, PLATFORM_NAMES } from "./AtrioBotTable";
import { AtrioWorkspaceActions } from "./AtrioWorkspaceActions";
import { BotMenu } from "./BotMenu";
import { BotResetIcon, BotTrashIcon } from "./BotActionIcons";
import styles from "./BotsDirectory.module.css";

type Channel = "all" | "whatsapp" | "atrio";
type Metric = { messagesReceived: number; messagesReceivedHistorical: number; calculatedAt: string };
type Item = { kind: "phone"; phone: GerenciaPhoneRow } | { kind: "atrio"; entry: AtrioBotEntry };
type Props = {
  groups: BotGerencia[];
  filteredGroups: BotGerencia[];
  page: number;
  total: number;
  counts: { all: number; whatsapp: number; atrio: number };
  loading: boolean;
  onPage: (page: number) => void;
  onResetAtrio: (metric: "usage_count" | "messages_received") => Promise<void>;
  phones: Record<number, GerenciaPhoneRow[]>;
  metrics: Record<number, Metric>;
  clients: AtrioClient[];
  isAdmin: boolean;
  canAtrio: boolean;
  search: string;
  onSearch: (value: string) => void;
  channel: Channel;
  onChannel: (value: Channel) => void;
  onlyActive: boolean;
  onOnlyActive: () => void;
  activeCount: number;
  filterKey: string;
  countdown: string;
  metricsTime: string;
  management: ReactNode;
  feedback: ReactNode;
  globalSyncing: boolean;
  canSync: boolean;
  resettingCounters: boolean;
  resettingMessages: boolean;
  deletingInactive: boolean;
  hasPhoneGroups: boolean;
  autoReset: boolean;
  autoResetSaving: boolean;
  syncingId: number | null;
  resettingId: number | null;
  resettingMessagesId: number | null;
  switchingId: number | null;
  onSyncAll: () => void;
  onSync: (id: number) => Promise<void>;
  onReset: (id: number | null) => Promise<void>;
  onResetMessages: (id: number | null) => Promise<void>;
  onAutoReset: () => Promise<void>;
  onDeleteInactive: () => Promise<void>;
  onFairCriterion: (id: number, value: "usage_count" | "messages_received") => Promise<void>;
  onStatus: (phone: GerenciaPhoneRow) => Promise<void>;
  onUsage: (phone: GerenciaPhoneRow, value: "acquisition" | "follow_up") => Promise<void>;
  onComment: (phone: GerenciaPhoneRow, value: string) => Promise<void>;
  onAddPhone: (id: number) => void;
  onGerenciaChanged: () => Promise<void>;
  onAtrioChanged: () => void;
  formatPhone: (value: string) => string;
};

const numberFormat = new Intl.NumberFormat("es-AR");
const labels = ["GERENCIA", "ID", "ASESOR", "CANAL", "PLATAFORMA", "BOT", "TIPO", "USO", "ESTADO", "CONTADOR", "CHATS", "HISTÓRICO"];
const NotApplicable = () => <span className={styles.notApplicable}>N.A.</span>;
const Separator = () => <div role="separator" className={styles.separator} />;
const roleLabel = (phone: GerenciaPhoneRow) => phone.assignment_role === "follow_up" ? "Ventas" : "Publicitario";
const numeric = (value: number | null | undefined) => value == null ? <NotApplicable /> : numberFormat.format(value);
const isValidPhone = (phone: string, workspace?: string) => /^[+\d\s().-]+$/.test(phone) && (workspace === "PYG" ? /^595\d{9}$/ : /^549\d{10}$/).test(phone.replace(/\D/g, ""));

function phoneInventory(phone: GerenciaPhoneRow, group: BotGerencia) {
  const inventory = (group.pbadmin_bots ?? []).filter(bot => bot.channel === "whatsapp" && bot.agency_id === group.gerencia_id);
  return phone.pbadmin_manager_id
    ? inventory.find(bot => bot.manager_id === phone.pbadmin_manager_id)
    : inventory.find(bot => bot.phone?.replace(/\D/g, "") === phone.phone.replace(/\D/g, ""));
}
function itemPlatform(item: Item, group: BotGerencia): string | null {
  if (item.kind === "atrio") return item.entry.connection ? CASINO_NAMES[item.entry.connection.target_provider] : PLATFORM_NAMES[item.entry.inventory?.platform ?? 0] ?? null;
  const bot = phoneInventory(item.phone, group);
  return PLATFORM_NAMES[bot?.platform ?? 0] ?? null;
}

function Status({ children, tone = "neutral", title }: { children: ReactNode; tone?: "positive" | "warning" | "neutral"; title?: string }) {
  return <span className={`${styles.status} ${styles[tone]}`} title={title}><span aria-hidden="true" className={styles.dot} />{children}</span>;
}

/** Directory presentation. Queries and mutations stay in the data controllers. */
export function BotsDirectoryView(p: Props) {
  const confirm = useAppConfirm();
  const [expanded, setExpanded] = useState<string | number | null>(null);
  const [phoneDialog, setPhoneDialog] = useState<{ id: number; mode: "usage" | "comment" } | null>(null);
  const closePhoneDialog = useCallback(() => setPhoneDialog(null), []);
  const selectedPhone = phoneDialog ? Object.values(p.phones).flat().find(phone => phone.id === phoneDialog.id) : undefined;
  const pages = Math.max(1, Math.ceil(p.total / 50));
  const page = p.page;
  const visible = p.filteredGroups;
  const setPage = (value: number) => { setExpanded(null); p.onPage(value); };
  const latestSync = Math.max(0, ...p.groups.map(group => Date.parse(group.pbadmin_bots_synced_at ?? "") || 0), ...Object.values(p.phones).flat().map(phone => Date.parse(phone.last_seen_at) || 0));
  const syncTime = latestSync ? new Date(latestSync).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const counts = p.counts;

  async function resetPhones(id: number | null, messages = false) {
    if (await confirm({
      title: messages ? "Reiniciar mensajes de WhatsApp" : "Reiniciar contadores de WhatsApp",
      description: `Se reinicia ${messages ? "el conteo operativo de mensajes" : "el contador de asignaciones"} ${id == null ? "de todas las gerencias, aunque estén ocultas por los filtros" : "de esta gerencia"}. Se conservan los históricos.`,
      confirmLabel: "Reiniciar",
    })) await (messages ? p.onResetMessages(id) : p.onReset(id));
  }

  const bulkMenu = (atrioActions?: ReactNode) => <BotMenu label="Acciones de los bots" text="Acciones">
    <button type="button" role="menuitem" disabled={p.resettingCounters || !p.hasPhoneGroups} onClick={() => void resetPhones(null)}><BotResetIcon />Reiniciar contadores de WhatsApp</button>
    <button type="button" role="menuitem" disabled={p.resettingMessages || !p.hasPhoneGroups} onClick={() => void resetPhones(null, true)}><BotResetIcon />Reiniciar mensajes de WhatsApp</button>
    {atrioActions && <><Separator />{atrioActions}</>}
    <Separator />
    {!p.isAdmin && <button type="button" role="menuitemcheckbox" aria-checked={p.autoReset} disabled={p.autoResetSaving} onClick={() => void p.onAutoReset()}
      title="Reinicia contadores y mensajes de WhatsApp, y asignaciones y chats de Atrio, a las 00:00 de Buenos Aires. Aplica a todos tus workspaces y conserva los históricos.">
      <span className={styles.switch} aria-hidden="true" /><span>Reinicio automático 00:00<span className={styles.secondary}>WhatsApp y Atrio · {p.autoReset ? "On" : "Off"}</span></span>
    </button>}
    <Separator />
    <button type="button" role="menuitem" data-danger="true" disabled={p.deletingInactive || !p.hasPhoneGroups} onClick={() => void p.onDeleteInactive()}><BotTrashIcon />Borrar teléfonos inactivos…</button>
  </BotMenu>;

  function phoneActions(phone: GerenciaPhoneRow, group: BotGerencia) {
    const canToggle = group.source_type === "manual" || phone.source_available !== false;
    return <>
      <a role="menuitem" href={`https://wa.me/${phone.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">Abrir en WhatsApp</a>
      <button type="button" role="menuitem" disabled={!canToggle} onClick={() => void p.onStatus(phone)}>{phone.status === "active" ? "Desactivar teléfono" : "Activar teléfono"}</button>
      <button type="button" role="menuitem" disabled={!!phone.pbadmin_manager_id} title={phone.pbadmin_manager_id ? "El uso de este teléfono se administra en PBAdmin." : undefined}
        onClick={() => setPhoneDialog({ id: phone.id, mode: "usage" })}>Cambiar uso…</button>
      {group.source_type === "manual" && <button type="button" role="menuitem" onClick={() => setPhoneDialog({ id: phone.id, mode: "comment" })}>Editar comentario…</button>}
    </>;
  }

  function groupActions(group: BotGerencia) {
    return <>
      {!group.virtual && <GerenciaActions gerencia={group} onChanged={p.onGerenciaChanged} menuItem />}
      {(group.virtual || group.source_type !== "manual") && <button type="button" role="menuitem" disabled={p.syncingId === group.id}
        onClick={() => group.virtual ? p.onAtrioChanged() : void p.onSync(group.id)}>Sincronizar</button>}
      {!group.virtual && <>
        <Separator /><p className={styles.menuLabel}>Reparto equitativo por</p>
        {(["usage_count", "messages_received"] as const).map(value => <button key={value} type="button" role="menuitemradio"
          aria-checked={(group.fair_criterion ?? "usage_count") === value} disabled={p.switchingId === group.id} onClick={() => void p.onFairCriterion(group.id, value)}>
          <span aria-hidden="true">{(group.fair_criterion ?? "usage_count") === value ? "●" : "○"}</span>{value === "usage_count" ? "Contador" : "Mensajes"}
        </button>)}
        <Separator />
        <button type="button" role="menuitem" disabled={p.resettingId === group.id} onClick={() => void resetPhones(group.id)}><BotResetIcon />Reiniciar contador…</button>
        <button type="button" role="menuitem" disabled={p.resettingMessagesId === group.id} onClick={() => void resetPhones(group.id, true)}><BotResetIcon />Reiniciar mensajes…</button>
        {group.source_type === "manual" && <><Separator /><button type="button" role="menuitem" onClick={() => p.onAddPhone(group.id)}>Añadir teléfonos</button></>}
      </>}
    </>;
  }

  function cells(item: Item, group: BotGerencia) {
    const platform = itemPlatform(item, group);
    if (item.kind === "atrio") {
      const { entry } = item;
      const connection = entry.connection;
      const inventory = entry.inventory;
      return <>
        <td title={`Asesor: ${entry.name} · /${entry.client.slug}`}>{entry.name}</td>
        <td className={styles.muted}>Atrio</td>
        <td className={styles.muted}>{platform ?? <NotApplicable />}</td>
        <td>{connection || inventory ? `Bot ${connection?.manager_id ?? inventory?.manager_id}` : <span className={styles.muted}>Sin bots vinculados</span>}</td>
        <td className={styles.muted}>{connection ? managerTypeLabel(connection.manager_type) : inventory ? inventory.role === "mkt" ? "MKT" : inventory.role === "carga" ? "Full Carga" : inventory.role : <NotApplicable />}</td>
        <td><NotApplicable /></td>
        <td><Status tone={connection?.active ? "positive" : "neutral"}>{connection ? connection.active ? "Activo" : "Inactivo" : inventory ? "Pendiente de vinculación" : "Pendiente"}</Status></td>
        <td className={styles.numeric}>{numeric(connection?.usage_count ?? (inventory ? null : 0))}</td>
        <td className={styles.numeric}>{numeric(connection?.chats_started ?? (inventory ? null : 0))}</td>
        <td className={styles.numeric}>{numeric(connection?.chats_started_total ?? connection?.chats_started ?? (inventory ? null : 0))}</td>
      </>;
    }
    const { phone } = item;
    const metrics = p.metrics[phone.id];
    return <>
      <td><NotApplicable /></td><td className={styles.muted}>WhatsApp</td>
      <td className={styles.muted}>{platform ?? <NotApplicable />}</td>
      <td><span className={styles.phoneNumber}>{p.formatPhone(phone.phone)}</span></td>
      <td className={styles.muted}>{phone.kind === "assistant" ? "asistente" : phone.kind}</td>
      <td className={styles.muted}>{roleLabel(phone)}</td>
      <td><Status tone={phone.source_available === false ? "warning" : phone.status !== "active" ? "neutral" : "positive"}
        title={[phone.last_seen_at ? `Última sincronización: ${new Date(phone.last_seen_at).toLocaleString("es-AR")}` : "", phone.comment ? `Comentario: ${phone.comment}` : ""].filter(Boolean).join(" · ")}>
        {phone.source_available === false ? "Sin managers activos" : phone.status === "active" ? "Activo" : phone.status === "inactive" ? "Inactivo" : phone.status}
      </Status></td>
      <td className={styles.numeric}>{numeric(phone.usage_count)}</td><td className={styles.numeric}>{numeric(metrics?.messagesReceived ?? 0)}</td><td className={styles.numeric}>{numeric(metrics?.messagesReceivedHistorical ?? 0)}</td>
    </>;
  }

  return <div className={styles.view}>
    <header className={styles.header}>
      <h1 className={`ui-page-title ${styles.title}`}>Redirección</h1><div className={styles.headerDetails}><div className={styles.headerCopy}>
        <p className={styles.channelDescription}>{p.canAtrio ? "WhatsApp y Atrio por gerencia" : "WhatsApp por gerencia"}</p>
        <div className={styles.syncLine}>
        <span title={`Métricas de mensajes calculadas por backend cada 30 min${p.metricsTime ? ` · última actualización ${p.metricsTime}` : ""}. El horario de sincronización corresponde al inventario o los teléfonos recibidos.`}>
          <span className={`${styles.dot} ${latestSync ? styles.positive : styles.neutral}`} aria-hidden="true" /> {p.globalSyncing ? "Sincronizando…" : syncTime ? `Sincronizado ${syncTime}` : "Sincronización pendiente"}, próxima en <span className="tabular-nums">{p.countdown}</span>
        </span>
        <button type="button" disabled={p.globalSyncing || !p.canSync} onClick={p.onSyncAll}>Sincronizar ahora</button>
        </div>
      </div>
      {p.management}
      </div>
    </header>
    {p.feedback}
    <div className={styles.toolbar}>
      <div className={styles.search}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input className="ui-input" value={p.search} onChange={event => p.onSearch(event.target.value)} aria-label="Buscar gerencia, asesor, bot o teléfono" placeholder="Buscar gerencia, asesor, bot o teléfono" />
      </div>
      {p.canAtrio && <div role="group" aria-label="Canal de los bots" className={styles.channels}>
        {(["all", "whatsapp", "atrio"] as const).map(channel => <button type="button" key={channel} aria-pressed={p.channel === channel} onClick={() => p.onChannel(channel)}>{channel === "all" ? "Todos" : channel === "whatsapp" ? "WhatsApp" : "Atrio"}<span>{counts[channel]}</span></button>)}
      </div>}
      <button type="button" role="switch" aria-checked={p.onlyActive} onClick={p.onOnlyActive} className={styles.activeFilter} title={`${p.activeCount} de ${counts.all} gerencias con bots activos`}>
        <span className={styles.switch} aria-hidden="true" />Solo activos
      </button>
      <div className={styles.bulk}>{p.canAtrio && counts.atrio>0 ? <AtrioWorkspaceActions clients={p.clients} hasClients={counts.atrio>0} onReset={p.onResetAtrio} onChanged={p.onAtrioChanged} render={bulkMenu} /> : bulkMenu()}</div>
    </div>
    <AtrioBotTable entries={p.filteredGroups.flatMap(group => group.atrioBots)} onChanged={p.onAtrioChanged} render={atrioActions => <div className={styles.scroll} tabIndex={0} aria-label="Directorio de bots, desplazamiento horizontal">
      <table className={styles.table} aria-label="Bots por gerencia">
        <thead><tr>{labels.map((label, i) => <th key={label} scope="col" className={i === 1 || i >= 9 ? styles.numeric : undefined} title={label === "CHATS" ? "Atrio: chats iniciados. WhatsApp: mensajes recibidos." : undefined}>{label}</th>)}<th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
          {!visible.length && <tbody><tr><td colSpan={labels.length + 1} className={styles.empty}>{p.loading ? "Cargando bots…" : !counts.all ? "Todavía no hay bots. Usá Vincular Bots para comenzar." : p.onlyActive ? "No hay gerencias con bots activos para mostrar." : "No hay gerencias que coincidan con la búsqueda."}</td></tr></tbody>}
          {visible.map((group, index) => {
            const phones = (p.phones[group.id] ?? []).filter(phone => isValidPhone(phone.phone, group.workspace_currency));
            const items: Item[] = [
              ...(p.channel !== "atrio" ? phones.map(phone => ({ kind: "phone" as const, phone })) : []),
              ...(p.channel !== "whatsapp" ? group.atrioBots.map(entry => ({ kind: "atrio" as const, entry })) : []),
            ];
            const single = items.length === 1 ? items[0] : null;
            const agencyId = group.gerencia_id ?? (!group.virtual ? group.id : null);
            const platforms = [...new Set(items.map(item => itemPlatform(item, group)).filter((name): name is string => !!name))];
            const botSummary = [phones.length ? `${phones.length} ${phones.length === 1 ? "teléfono" : "teléfonos"}` : "", group.atrioBots.length ? `${group.atrioBots.length} ${group.atrioBots.length === 1 ? "bot de Atrio" : "bots de Atrio"}` : ""].filter(Boolean).join(" · ");
            const expandable = items.length > 1;
            const key = group.uiKey ?? group.id;
            const open = expanded === key;
            const toggle = () => setExpanded(current => current === key ? null : key);
            const connections = group.atrioBots.flatMap(entry => entry.connection ? [entry.connection] : []);
            const activePhones = phones.filter(phone => phone.status === "active" && phone.assignment_role !== "follow_up").length;
            const unavailable = phones.length > 0 && group.source_type !== "manual" && phones.every(phone => phone.source_available === false);
            const onlyAtrio = group.virtual || (!phones.length && !!group.atrioBots.length);
            const unknown = onlyAtrio && !connections.length && group.atrioBots.some(entry => entry.inventory);
            const usage = phones.reduce((sum, phone) => sum + (Number(phone.usage_count) || 0), connections.reduce((sum, entry) => sum + entry.usage_count, 0));
            const messages = phones.reduce((sum, phone) => sum + (p.metrics[phone.id]?.messagesReceived ?? 0), connections.reduce((sum, entry) => sum + entry.chats_started, 0));
            const historical = phones.reduce((sum, phone) => sum + (p.metrics[phone.id]?.messagesReceivedHistorical ?? 0), connections.reduce((sum, entry) => sum + (entry.chats_started_total ?? entry.chats_started), 0));
            return <tbody key={key} className={styles.group} data-gerencia-group={key} data-expanded={expandable && open} aria-label={`Gerencia ${group.nombre}`}>
              <tr className={styles.groupSpacer} aria-hidden="true"><td colSpan={labels.length + 1} /></tr>
              <tr className={`${styles.parent} ${expandable ? styles.expandable : ""}`} data-stripe={index % 2} data-gerencia={key}
                onClick={event => { if (expandable && event.currentTarget.contains(event.target as Node) && !(event.target as HTMLElement).closest("button,a,input,select")) toggle(); }}>
                <td title={group.source_type === "manual" ? "Origen manual" : "Origen PBAdmin"}><span className={styles.name}>{group.nombre}</span></td>
                <td className={styles.numeric}>{agencyId ?? <NotApplicable />}</td>
                {single ? cells(single, group) : <>
                  <td><NotApplicable /></td><td className={styles.muted}>{onlyAtrio ? "Atrio" : group.atrioBots.length ? "WhatsApp + Atrio" : "WhatsApp"}</td>
                  <td className={styles.muted}>{platforms.length ? platforms.join(", ") : <NotApplicable />}</td>
                  <td>{botSummary || <NotApplicable />}</td>
                  <td><NotApplicable /></td><td><NotApplicable /></td>
                  <td><Status tone={onlyAtrio ? connections.some(entry => entry.active) ? "positive" : "neutral" : unavailable || !activePhones ? "warning" : "positive"}>
                    {onlyAtrio ? connections.some(entry => entry.active) ? "Activo" : "Pendiente / inactivo" : unavailable ? "Sin managers activos" : activePhones ? `${activePhones} ${activePhones === 1 ? "publicitario activo" : "publicitarios activos"}` : "Sin publicitarios activos"}
                  </Status></td>
                  <td className={styles.numeric}>{numeric(unknown ? null : usage)}</td><td className={styles.numeric}>{numeric(unknown ? null : messages)}</td><td className={styles.numeric}>{numeric(unknown ? null : historical)}</td>
                </>}
                <td><div className={styles.rowActions}>
                  <BotMenu label={`Acciones de ${group.nombre}`}>{groupActions(group)}{single?.kind === "atrio" && <><Separator />{atrioActions(single.entry)}</>}{single?.kind === "phone" && <><Separator />{phoneActions(single.phone, group)}</>}</BotMenu>
                  {expandable && <button type="button" className={styles.iconButton} aria-label="Ver detalle" aria-expanded={open} onClick={event => { event.stopPropagation(); toggle(); }}><svg className={styles.chevron} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></button>}
                </div></td>
              </tr>
              {expandable && open && items.map((item, itemIndex) => <tr key={item.kind === "phone" ? `phone:${item.phone.id}` : `atrio:${item.entry.client.id}:${item.entry.connection?.connection_id ?? item.entry.inventory?.manager_id ?? "pending"}`} className={styles.child}>
                <td title={group.nombre}><span aria-hidden="true" className="ml-3 text-zinc-600">└</span><span className="sr-only">Detalle de {group.nombre}, elemento {itemIndex + 1}</span></td><td className={styles.numeric}>{agencyId ?? <NotApplicable />}</td>{cells(item, group)}
                <td><div className={styles.rowActions}><BotMenu label={`Acciones de ${item.kind === "phone" ? p.formatPhone(item.phone.phone) : item.entry.name}`}>{item.kind === "phone" ? phoneActions(item.phone, group) : atrioActions(item.entry)}</BotMenu></div></td>
              </tr>)}
            </tbody>;
          })}
      </table>
    </div>} />
    <footer className={styles.footer}>
      <span>{visible.length ? `${(page-1)*50+1}–${(page-1)*50+visible.length}` : "0"} de {p.total} gerencias · 50 por página{p.total !== counts.all ? ` · ${counts.all} en total` : ""}</span>
      <nav className={styles.pagination} aria-label="Paginación de gerencias">
        <button type="button" disabled={p.loading || page === 1} aria-label="Página anterior" onClick={() => setPage(page - 1)}>‹</button>
        {[...new Set([1,page-1,page,page+1,pages])].filter(value=>value>0&&value<=pages).sort((a,b)=>a-b).map((value, i, values) => <Fragment key={value}>{i > 0 && value - values[i - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" disabled={p.loading} aria-label={`Página ${value}`} aria-current={page === value ? "page" : undefined} onClick={() => setPage(value)}>{value}</button></Fragment>)}
        <button type="button" disabled={p.loading || page === pages} aria-label="Página siguiente" onClick={() => setPage(page + 1)}>›</button>
      </nav>
    </footer>
    <ModalShell open={!!selectedPhone} title={phoneDialog?.mode === "comment" ? "Editar comentario" : "Cambiar uso del teléfono"} onClose={closePhoneDialog} width="sm">
      {selectedPhone && <div className="space-y-3">
        <p className="text-sm text-zinc-300">{p.formatPhone(selectedPhone.phone)}</p>
        {phoneDialog?.mode === "comment" ? <div>
          <label htmlFor="bots-phone-comment" className="block text-xs text-zinc-400">Comentario</label>
          <input id="bots-phone-comment" className={styles.dialogControl} defaultValue={selectedPhone.comment ?? ""} onBlur={event => void p.onComment(selectedPhone, event.target.value)} />
        </div> : <div>
          <label htmlFor="bots-phone-usage" className="block text-xs text-zinc-400">Uso</label>
          <select id="bots-phone-usage" className={styles.dialogControl} disabled={!!selectedPhone.pbadmin_manager_id} value={selectedPhone.assignment_role === "follow_up" ? "follow_up" : "acquisition"} onChange={event => void p.onUsage(selectedPhone, event.target.value as "acquisition" | "follow_up")}>
            <option value="acquisition">WhatsApp publicitario</option><option value="follow_up">WhatsApp de venta</option>
          </select>
        </div>}
      </div>}
    </ModalShell>
  </div>;
}
