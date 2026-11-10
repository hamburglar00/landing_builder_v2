"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { BotGerencia, BotsDirectorySort } from "@/lib/bots/workspace";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import type { GerenciaPhoneRow } from "@/components/telefonos/TelefonosPageContent";
import { requestManagerDestinations, type AdvisorDirectory } from "@/lib/atrio/managerDestinations";

type PageData = {
  groups: BotGerencia[]; phones: GerenciaPhoneRow[];
  metrics: { gerencia_phone_id: number; messages_received: number; messages_received_historical: number; calculated_at: string }[];
  total: number; page: number; counts: { all: number; whatsapp: number; atrio: number };
  activeCount: number; activePhones: number; inactivePhones: number; hasPbadmin: boolean; projectionPending: number;
};
const empty: PageData = { groups: [], phones: [], metrics: [], total: 0, page: 1, counts: { all: 0, whatsapp: 0, atrio: 0 }, activeCount: 0, activePhones: 0, inactivePhones: 0, hasPbadmin: false, projectionPending: 0 };

/** Server filters/counts first, then returns at most 50 groups. Live Atrio
 * metric calculations are limited to advisors occurring on that page. */
export function usePagedBotsWorkspace(input: {
  enabled: boolean; userId: string | null; workspace: string; canAtrio: boolean;
  search: string; channel: string; onlyActive: boolean; sort: BotsDirectorySort;
  onData: (data: PageData) => void;
}) {
  const [data, setData] = useState(empty), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [loadedKey,setLoadedKey]=useState("");
  const loadedKeyRef=useRef("");
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const filterKey = JSON.stringify([input.userId, input.workspace, input.canAtrio, input.search, input.channel, input.onlyActive, input.sort.column, input.sort.direction]);
  // Remember each filter transition, including returning to a previous query.
  // Otherwise clearing a search could resurrect that query's old page number.
  if(pageState.key!==filterKey)setPageState({key:filterKey,page:1});
  const page = pageState.key === filterKey ? pageState.page : 1;
  const latest = useRef({ ...input, page });
  latest.current = { ...input, page };
  const pending = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);

  const load = useCallback((uid?: string) => {
    const query = latest.current;
    const userId = uid || query.userId;
    if (!query.enabled || !userId) return Promise.resolve();
    const key = JSON.stringify([userId, query.workspace, query.canAtrio, query.search, query.channel, query.onlyActive, query.sort.column, query.sort.direction, query.page]);
    if (pending.current?.key === key) return pending.current.promise;
    pending.current?.controller.abort();
    const controller = new AbortController();
    setBusy(true); setError("");
    // Hide previous-page actions immediately while a different page is loading.
    if(loadedKeyRef.current!==key)setData(previous => ({ ...previous, groups: [], phones: [], metrics: [] }));
    const promise = (async () => {
      try {
        const readPage=()=>supabase.rpc("read_bots_directory_page_sorted", {
          p_workspace: query.workspace, p_page: query.page, p_search: query.search.trim(),
          p_channel: query.channel, p_active: query.onlyActive, p_include_atrio: query.canAtrio,
          p_sort: query.sort.column, p_direction: query.sort.direction,
        }).abortSignal(controller.signal);
        const result = await readPage();
        if (result.error) throw result.error;
        if (controller.signal.aborted) return;
        let next = result.data as PageData;
        const advisors = new Map<string, AdvisorDirectory>();
        try {
        for(let pass=0;pass<2;pass++){
        // Group by owner: Atrio validates each tenant independently.
        const owners = new Map<string, Map<string, AtrioClient>>();
        for (const group of next.groups) for (const entry of group.atrioBots) {
          if (!owners.has(entry.client.user_id)) owners.set(entry.client.user_id, new Map());
          owners.get(entry.client.user_id)!.set(entry.client.id, entry.client);
        }
          let directoryChanged=false;
          for (const clients of owners.values()) {
            const ids = [...clients.values()].filter(client=>!advisors.has(client.atrio_id)).map(client=>client.id);
            for (let offset = 0; offset < ids.length; offset += 100) {
              const live = await requestManagerDestinations<{ advisors: AdvisorDirectory[];directoryChanged?:boolean }>({ action: "directory", clientIds: ids.slice(offset, offset + 100) }, controller.signal);
              for (const advisor of live.advisors) advisors.set(advisor.id, advisor);
              directoryChanged=directoryChanged||live.directoryChanged===true;
            }
          }
          if(pass===0&&directoryChanged){
            // A newly linked advisor may gain a real agency group. Re-index
            // this page once, without downloading the remaining directory.
            const indexed=await readPage();if(indexed.error)throw indexed.error;
            next=indexed.data as PageData;
          }else break;
        }
        } catch (cause) {
          if (controller.signal.aborted) return;
          setError(cause instanceof Error ? cause.message : "No se pudieron actualizar las métricas de Atrio.");
        }
        if (controller.signal.aborted) return;
        next.groups = next.groups.map(group => ({ ...group, atrioBots: group.atrioBots.map(entry => {
          const advisor = advisors.get(entry.client.atrio_id);
          const connection = advisor?.connections.find(connection => connection.connection_id === entry.connection?.connection_id || connection.manager_id === entry.inventory?.manager_id);
          // Never present cached metadata as a fresh metric value.
          return { ...entry, name: advisor?.name || entry.name, connection: connection || null };
        }) }));
        setData(next); setLoadedKey(key); loadedKeyRef.current=key; latest.current.onData(next);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar esta página de bots.");
      } finally {
        if (!controller.signal.aborted) { setBusy(false); pending.current = null; }
      }
    })();
    pending.current = { key, controller, promise };
    return promise;
  }, []);
  useEffect(() => {
    if (!input.enabled || !input.userId) return;
    const timeout = setTimeout(() => void load(), 200);
    return () => { clearTimeout(timeout); pending.current?.controller.abort(); pending.current = null; };
  }, [filterKey, page, input.enabled, input.userId, load]);
  const reload = useCallback(() => { void load(); }, [load]);
  const currentKey=JSON.stringify([input.userId,input.workspace,input.canAtrio,input.search,input.channel,input.onlyActive,input.sort.column,input.sort.direction,page]);
  const visible=loadedKey===currentKey?data:{...data,groups:[],phones:[],metrics:[]};
  const clients = [...new Map(visible.groups.flatMap(group => group.atrioBots.map(entry => [entry.client.id, entry.client] as const))).values()];
  return { ...visible, clients, busy:busy||(!error&&!!input.userId&&input.enabled&&loadedKey!==currentKey), error, load, reload, filterKey, requestedPage: page,
    setPage: (value: number) => setPageState({ key: filterKey, page: value }) };
}
