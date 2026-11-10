import type { Gerencia } from "@/lib/gerencias/types";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import type { DirectoryBot } from "./directory";
import type {
  AdvisorDirectory,
  ManagerDestination,
} from "@/lib/atrio/managerDestinations";
export type BotsDirectorySort = { column: "name" | "id"; direction: "asc" | "desc" };
export const DEFAULT_BOTS_DIRECTORY_SORT: BotsDirectorySort = { column: "name", direction: "asc" };
export type AtrioBotEntry = {
  client: AtrioClient;
  connection: ManagerDestination | null;
  name: string;
  inventory?: DirectoryBot;
};
export type BotGerencia = Gerencia & {
  virtual?: boolean;
  uiKey?: string;
  atrioBots: AtrioBotEntry[];
};

/** Match by workspace owner AND PBAdmin agency; manual IDs are unrelated. */
export function groupBots(
  gerencias: Gerencia[],
  clients: AtrioClient[],
  directory: AdvisorDirectory[],
  userId: string,
): BotGerencia[] {
  const rows: BotGerencia[] = gerencias.map((g) => ({ ...g, atrioBots: [] }));
  const groups = new Map(
    rows
      .filter((g) => g.source_type !== "manual")
      .map((g) => [`${g.user_id ?? userId}:${g.gerencia_id}`, g]),
  );
  const advisors = new Map(directory.map((advisor) => [advisor.id, advisor]));
  let nextVirtual = -1;
  for (const client of clients) {
    const advisor = advisors.get(client.atrio_id),
      connections = advisor?.connections ?? [];
    const entries: {
      connection: ManagerDestination | null;
      inventory?: DirectoryBot;
    }[] = connections.map((connection) => ({ connection }));
    for (const inventory of client.pbadmin_bots ?? [])
      if (
        inventory.advisor_id === client.atrio_id &&
        !connections.some(
          (connection) => connection.manager_id === inventory.manager_id,
        )
      )
        entries.push({ connection: null, inventory });
    if (!entries.length) entries.push({ connection: null });
    for (const { connection, inventory } of entries) {
      const agencyId = connection?.agency_id ?? inventory?.agency_id;
      const key = agencyId
        ? `${client.user_id}:${agencyId}`
        : `${client.user_id}:advisor:${client.atrio_id}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          id: nextVirtual--,
          nombre:
            connection?.agency_name ||
            inventory?.agency_name ||
            advisor?.name ||
            client.slug,
          gerencia_id: agencyId ?? null,
          source_type: "pbadmin",
          user_id: client.user_id,
          workspace_currency: client.workspace_currency,
          virtual: true,
          uiKey: key,
          atrioBots: [],
        };
        groups.set(key, group);
        rows.push(group);
      }
      if (
        !group.atrioBots.some(
          (entry) =>
            entry.client.id === client.id &&
            entry.connection?.connection_id === connection?.connection_id &&
            entry.inventory?.manager_id === inventory?.manager_id,
        )
      )
        group.atrioBots.push({
          client,
          connection,
          inventory,
          name: advisor?.name || client.slug,
        });
    }
  }
  return rows.sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}
export function botSearchText(group: BotGerencia): string {
  return [
    group.nombre,
    group.gerencia_id,
    ...(group.pbadmin_bots ?? []).flatMap((bot) => [
      bot.name,
      bot.manager_id,
      bot.phone,
    ]),
    ...group.atrioBots.flatMap((entry) => [
      entry.name,
      entry.client.slug,
      entry.connection?.manager_id,
      entry.inventory?.manager_id,
      entry.inventory?.name,
      entry.connection?.target_provider,
    ]),
  ]
    .join(" ")
    .toLowerCase();
}
