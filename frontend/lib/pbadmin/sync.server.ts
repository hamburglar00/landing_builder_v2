import { adminDb } from "./provider.server";
import { AccessError, origin } from "./protocol.server";
import { parseImportDirectory } from "../bots/directory";
import { persistImport } from "../bots/persist-import.server";
import { reconcileSessions } from "./accounts.server";

// These advisors belong to the existing test setup. Never move or rewrite them.
const excluded = new Set([
  "19817f1f-a0a4-4cd9-a8a9-d9c6733dda41",
  "00b8615f-a42a-4fa1-bb2e-ad6022dc6db5",
]);
export async function syncBuilder(ownerId: number, accountId: string) {
  const db = adminDb();
  const binding = await db
    .from("pbadmin_accounts")
    .select("account_id")
    .eq("owner_id", ownerId)
    .eq("account_id", accountId)
    .eq("ready", true)
    .single();
  if (binding.error) throw new AccessError("Vínculo no disponible.", 403);
  await reconcileSessions(db, "builder", ownerId);
  const key = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
  if (!key)
    throw new AccessError("Sincronización pendiente de configuración.", 503);
  const response = await fetch(
    `${origin(process.env.INTERNAL_CHAT_ORIGIN)}/api/gateway/bot-directory`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ kind: "owner", id: ownerId, refresh: false }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new AccessError("No se pudo consultar el inventario de bots.", 503);
  const data = parseImportDirectory(await response.json(), {
    kind: "owner",
    id: ownerId,
  });
  const omitted = [
    ...data.agencies.flatMap((a) => a.bots),
    ...data.unassigned,
  ].some((b) => !!b.advisor_id && excluded.has(b.advisor_id));
  data.advisors = data.advisors.filter((a) => !excluded.has(a.id));
  data.agencies = data.agencies.map((a) => ({
    ...a,
    bots: a.bots.filter((b) => !b.advisor_id || !excluded.has(b.advisor_id)),
  }));
  data.unassigned = data.unassigned.filter(
    (b) => !b.advisor_id || !excluded.has(b.advisor_id),
  );
  // Existing PYG rows stay in their workspace; automatic ARS imports never move them.
  const existing = await db
    .from("gerencias")
    .select("id,gerencia_id,source_type,workspace_currency,pbadmin_bots")
    .eq("user_id", accountId);
  const advisors = await db
    .from("atrio_clients")
    .select("atrio_id,workspace_currency,pbadmin_bots")
    .eq("user_id", accountId);
  if (existing.error || advisors.error)
    throw new AccessError("No se pudo verificar el inventario existente.", 503);
  const warnings: string[] = [];
  const allBots = [
    ...data.agencies.flatMap((g) =>
      g.bots.map((b) => ({ ...b, agency_name: g.name, platform: g.platform })),
    ),
    ...data.unassigned,
  ];
  const knownAdvisors = new Set(data.advisors.map((a) => a.id));
  if (
    allBots.some(
      (b) =>
        b.channel === "atrio" &&
        (!b.advisor_id || !knownAdvisors.has(b.advisor_id)),
    )
  )
    warnings.push("Hay bots de Atrio sin un asesor válido para importar.");
  if (data.unassigned.some((b) => b.channel === "whatsapp"))
    warnings.push(
      "Hay bots de WhatsApp sin gerencia que no se pudieron incorporar.",
    );
  for (const currency of ["ARS", "PYG"] as const) {
    const groupIds = new Set(
      existing.data
        .filter((g) => g.workspace_currency === "PYG")
        .map((g) => g.gerencia_id),
    );
    const advisorIds = new Set(
      advisors.data
        .filter((a) => a.workspace_currency === "PYG")
        .map((a) => a.atrio_id),
    );
    const batch = {
      ...data,
      agencies: data.agencies.filter((g) =>
        currency === "PYG"
          ? groupIds.has(g.agency_id)
          : !groupIds.has(g.agency_id),
      ),
      advisors: data.advisors.filter((a) =>
        currency === "PYG" ? advisorIds.has(a.id) : !advisorIds.has(a.id),
      ),
    };
    // Import each resource once. Advisor snapshots include all their bots,
    // even across agency batches or a pre-existing PYG workspace.
    for (let offset = 0; offset < batch.agencies.length; offset += 100) {
      const result = await persistImport(
        db,
        accountId,
        currency,
        "import",
        {
          ...batch,
          agencies: batch.agencies.slice(offset, offset + 100).map((g) => ({
            ...g,
            bots: g.bots.filter((b) => b.channel === "whatsapp"),
          })),
          advisors: [],
          unassigned: [],
        },
        true,
      );
      warnings.push(...result.warnings);
    }
    for (let offset = 0; offset < batch.advisors.length; offset += 200) {
      const selected = batch.advisors.slice(offset, offset + 200);
      const selectedIds = new Set(selected.map((a) => a.id));
      const result = await persistImport(
        db,
        accountId,
        currency,
        "import",
        {
          ...batch,
          agencies: [],
          advisors: selected,
          unassigned: allBots.filter(
            (b) =>
              b.channel === "atrio" &&
              !!b.advisor_id &&
              selectedIds.has(b.advisor_id),
          ),
        },
        true,
      );
      warnings.push(...result.warnings);
    }
  }
  // Only remove stale PBAdmin metadata. Keep the linked record and its landing settings.
  const ids = new Set(
      data.agencies
        .filter((a) => a.bots.some((b) => b.channel === "whatsapp"))
        .map((a) => a.agency_id),
    ),
    advisorIds = new Set(data.advisors.map((a) => a.id));
  for (const row of existing.data) {
    if (
      row.source_type === "manual" ||
      ids.has(row.gerencia_id) ||
      !Array.isArray(row.pbadmin_bots) ||
      !row.pbadmin_bots.some(
        (b: { owner_id?: number }) => b.owner_id === ownerId,
      )
    )
      continue;
    const result = await db
      .from("gerencias")
      .update({
        pbadmin_bots: row.pbadmin_bots.filter(
          (b: { owner_id?: number }) => b.owner_id !== ownerId,
        ),
        pbadmin_bots_synced_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", accountId);
    if (result.error)
      throw new AccessError("Hay cambios pendientes en el inventario.", 503);
  }
  for (const row of advisors.data) {
    if (
      excluded.has(row.atrio_id) ||
      advisorIds.has(row.atrio_id) ||
      !Array.isArray(row.pbadmin_bots) ||
      !row.pbadmin_bots.some(
        (b: { owner_id?: number }) => b.owner_id === ownerId,
      )
    )
      continue;
    const result = await db
      .from("atrio_clients")
      .update({
        pbadmin_bots: row.pbadmin_bots.filter(
          (b: { owner_id?: number }) => b.owner_id !== ownerId,
        ),
        pbadmin_bots_synced_at: new Date().toISOString(),
      })
      .eq("atrio_id", row.atrio_id)
      .eq("user_id", accountId);
    if (result.error)
      throw new AccessError("Hay cambios pendientes en el inventario.", 503);
  }
  return {
    complete: !omitted && warnings.length === 0,
    warnings: [...new Set(warnings)],
  };
}
