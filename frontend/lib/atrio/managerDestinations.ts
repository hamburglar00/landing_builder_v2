import { supabase } from "@/lib/supabaseClient";
import type { TargetProvider } from "@/lib/landing/types";

export const CASINO_NAMES: Record<TargetProvider, string> = {
  rey_de_ases: "Rey de Ases", ases_del_norte: "Ases del Norte",
  ganamos_net: "Ganamos NET", multi_skin: "Ganamos+",
};
export type ManagerDestination = {
  connection_id: string; advisor_id: string; advisor_slug: string; advisor_name: string | null;
  manager_id: number; agency_id: number; agency_name: string | null; target_provider: TargetProvider;
  manager_type: string; active: boolean; verified_at: string | null;
  usage_count: number; chats_started: number; messages_received: number;
  usage_count_total?: number; chats_started_total?: number;
};
export type BotResetMetric = "usage_count" | "messages_received";
export type AdvisorDirectory = { id: string; slug: string; name: string | null; connections: ManagerDestination[] };
export type DestinationConfiguration = {
  landing_id: string; target_provider: TargetProvider;
  mode: "fixed" | "weighted_random" | "fair";
  criterion: "usage_count" | "messages_received";
  destinations: { connection_id: string; weight: number }[];
};
export type DestinationEditorConfiguration = {
  configurations: Partial<Record<TargetProvider, DestinationConfiguration | null>>;
  directory: { advisors: AdvisorDirectory[] };
};
export const managerTypeLabel = (type: string) => type === "mkt" ? "MKT" : "Full Carga";

export async function requestManagerDestinations<T>(payload: object, signal?: AbortSignal): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Volvé a iniciar sesión.");
  const response = await fetch("/api/atrio/manager-destinations", {
    method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload), cache: "no-store", signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudieron consultar los bots.");
  return result as T;
}

export async function copyTemplate7ManagerDestinations(sourceLandingId: string, targetLandingId: string, provider: TargetProvider) {
  if (provider === "multi_skin") return;
  const { configuration } = await requestManagerDestinations<{ configuration: DestinationConfiguration | null }>({
    action: "configuration", landingId: sourceLandingId, targetProvider: provider,
  });
  if (!configuration) return;
  await requestManagerDestinations({
    action: "configure", landingId: targetLandingId, targetProvider: provider,
    mode: configuration.mode, criterion: configuration.criterion, destinations: configuration.destinations,
  });
}
