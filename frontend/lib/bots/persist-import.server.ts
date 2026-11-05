import type { SupabaseClient } from "@supabase/supabase-js";
import { importDirectory, type ImportDirectory } from "./directory";
export async function persistImport(
  db: SupabaseClient,
  uid: string,
  currency: "ARS" | "PYG",
  action: "import" | "refresh",
  data: ImportDirectory,
  retryTransientErrors = false,
) {
  let transientFailure = false;
  const failedWrite = (error: { code?: string }) => {
    if (error.code !== "23505") transientFailure = true;
    throw error;
  };
  // Re-read authoritative inventory for every import. Never accept rows or owners supplied by the browser.
  const [existingGroups, existingAdvisors] = await Promise.all([
    db
      .from("gerencias")
      .select("id,gerencia_id,source_type")
      .eq("user_id", uid)
      .eq("workspace_currency", currency),
    db
      .from("atrio_clients")
      .select("atrio_id")
      .eq("user_id", uid)
      .eq("workspace_currency", currency),
  ]);
  if (existingGroups.error || existingAdvisors.error)
    throw Error("No se pudo comprobar el workspace.");
  const groups = new Map(
      existingGroups.data
        .filter((g) => g.source_type !== "manual")
        .map((g) => [g.gerencia_id, g.id]),
    ),
    advisors = new Set(existingAdvisors.data.map((a) => a.atrio_id));
  const result = await importDirectory(data, {
    async agency(group) {
      const snapshot = {
        pbadmin_bots: group.bots
          .filter((bot) => bot.channel === "whatsapp")
          .map((bot) => ({
            manager_id: bot.manager_id,
            name: bot.name,
            agency_id: bot.agency_id,
            owner_id: bot.owner_id,
            channel: bot.channel,
            role: bot.role,
            active: bot.active,
            phone: bot.phone,
            advisor_id: null,
            advisor_slug: null,
          })),
        pbadmin_bots_synced_at: new Date().toISOString(),
      };
      const existingId = groups.get(group.agency_id);
      if (existingId !== undefined) {
        const result = await db
          .from("gerencias")
          .update(snapshot)
          .eq("id", existingId)
          .eq("user_id", uid)
          .eq("workspace_currency", currency);
        if (result.error) failedWrite(result.error);
        return "existing";
      }
      if (action === "refresh") return "existing";
      const result = await db.from("gerencias").insert({
        id: group.agency_id,
        gerencia_id: group.agency_id,
        nombre: group.name,
        user_id: uid,
        workspace_currency: currency,
        source_type: "pbadmin",
        ...snapshot,
      });
      if (result.error) failedWrite(result.error);
      groups.set(group.agency_id, group.agency_id);
      return "created";
    },
    async advisor(advisor) {
      const all = [
        ...data.agencies.flatMap((group) =>
          group.bots.map((bot) => ({
            ...bot,
            agency_name: group.name,
            platform: group.platform,
          })),
        ),
        ...data.unassigned,
      ];
      const snapshot = {
        pbadmin_bots: all.filter(
          (bot) => bot.channel === "atrio" && bot.advisor_id === advisor.id,
        ),
        pbadmin_bots_synced_at: new Date().toISOString(),
      };
      if (advisors.has(advisor.id)) {
        const result = await db
          .from("atrio_clients")
          .update(snapshot)
          .eq("atrio_id", advisor.id)
          .eq("user_id", uid)
          .eq("workspace_currency", currency);
        if (result.error) failedWrite(result.error);
        return "existing";
      }
      if (action === "refresh") return "existing";
      const result = await db.from("atrio_clients").insert({
        atrio_id: advisor.id,
        slug: advisor.slug,
        user_id: uid,
        workspace_currency: currency,
        ...snapshot,
      });
      if (result.error) failedWrite(result.error);
      advisors.add(advisor.id);
      return "created";
    },
  });
  if (retryTransientErrors && transientFailure)
    throw Error(
      "Hay cambios pendientes de sincronizar. Se volverán a intentar.",
    );
  return result;
}
