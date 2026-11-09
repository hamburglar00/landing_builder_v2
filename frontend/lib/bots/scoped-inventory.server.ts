import type { SupabaseClient } from "@supabase/supabase-js";
import type { DirectoryBot, ImportScope } from "./directory";

/** A directory replaces only its own administration/agency, never its neighbors. */
function mergeSnapshot(
  previous: unknown,
  incoming: DirectoryBot[],
  scope: ImportScope,
) {
  const ids = new Set(incoming.map((bot) => bot.manager_id));
  const foreign = (Array.isArray(previous) ? previous : []).filter((bot) => {
    if (!bot || typeof bot !== "object") return true;
    const belongs =
      scope.kind === "owner"
        ? bot.owner_id === scope.id
        : bot.agency_id === scope.id;
    return !belongs && !ids.has(bot.manager_id);
  });
  return [...foreign, ...incoming];
}

export async function updateScopedInventory({
  db,
  table,
  key,
  id,
  uid,
  currency,
  scope,
  bots,
}: {
  db: SupabaseClient;
  table: "gerencias" | "atrio_clients";
  key: "id" | "atrio_id";
  id: number | string;
  uid: string;
  currency: string;
  scope: ImportScope;
  bots: DirectoryBot[];
}) {
  // Compare-and-swap keeps concurrent imports from discarding a foreign update.
  // Each conditional write locks only this row; no external work runs in a transaction.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await db
      .from(table)
      .select(`${key},pbadmin_bots,pbadmin_bots_synced_at`)
      .eq(key, id)
      .eq("user_id", uid)
      .eq("workspace_currency", currency)
      .maybeSingle();
    if (current.error) return current.error;
    if (!current.data)
      return {
        code: "inventory_missing",
        message: "El recurso ya no está en este workspace.",
      };
    const previous = current.data.pbadmin_bots;
    const version = current.data.pbadmin_bots_synced_at as string | null;
    // Advance even when two writes occur in the same millisecond. Using this
    // existing version column keeps large inventories out of the request URL.
    const previousTime = version ? Date.parse(version) : 0;
    const nextVersion = new Date(
      Math.max(Date.now(), (previousTime || 0) + 1),
    ).toISOString();
    let update = db
      .from(table)
      .update({
        pbadmin_bots: mergeSnapshot(previous, bots, scope),
        pbadmin_bots_synced_at: nextVersion,
      })
      .eq(key, id)
      .eq("user_id", uid)
      .eq("workspace_currency", currency);
    update =
      version == null
        ? update.is("pbadmin_bots_synced_at", null)
        : update.eq("pbadmin_bots_synced_at", version);
    const saved = await update.select(key);
    if (saved.error) return saved.error;
    if (saved.data?.length) return null;
  }
  return {
    code: "inventory_conflict",
    message: "El inventario cambió durante la actualización. Volvé a intentar.",
  };
}
